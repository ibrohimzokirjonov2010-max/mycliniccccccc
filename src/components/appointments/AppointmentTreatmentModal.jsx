import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, Circle, Activity, ChevronRight, Camera } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AppointmentTreatmentModal
 * Shows treatment plans for a patient during an appointment
 * Allows marking plan items as "completed"
 */
export default function AppointmentTreatmentModal({ open, onClose, appointment, onCompleted }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState({}); // { planId: [service_id, ...] }
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadingXray, setUploadingXray] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && appointment?.patient_id) {
      loadPlans();
    } else {
      setPlans([]);
      setSelectedItems({});
    }
  }, [open, appointment]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await base44.entities.TreatmentPlan.filter({ 
        patient_id: appointment.patient_id 
      });
      // Filter out plans that are already completed (optional, or just show incomplete services)
      setPlans(data.filter(p => p.services && p.services.some(s => !s.completed)));
    } catch (error) {
      console.error('Failed to load plans:', error);
      toast.error('Rejalarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (planId, serviceId) => {
    setSelectedItems(prev => {
      const current = prev[planId] || [];
      const next = current.includes(serviceId)
        ? current.filter(id => id !== serviceId)
        : [...current, serviceId];
      return { ...prev, [planId]: next };
    });
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // 1. Update Appointment to Completed
      await base44.entities.Appointment.update(appointment.id, {
        status: 'Completed',
        end_time: new Date().toISOString()
      });

      // 2. Update Treatment Plans
      const planIdsToUpdate = Object.keys(selectedItems);
      for (const pId of planIdsToUpdate) {
        const itemIds = selectedItems[pId];
        if (itemIds.length === 0) continue;

        const plan = plans.find(p => p.id === pId);
        if (!plan) continue;

        const updatedServices = plan.services.map(s => {
          if (itemIds.includes(s.service_id)) {
            return { ...s, completed: true, completion_date: new Date().toISOString() };
          }
          return s;
        });

        // Check if all services are now completed to update overall plan status
        const allCompleted = updatedServices.every(s => s.completed);
        
        await base44.entities.TreatmentPlan.update(pId, {
          services: updatedServices,
          status: allCompleted ? 'Completed' : 'In Progress'
        });

        // 3. Sync completed services to ToothRecords
        const completedInThisPlan = updatedServices.filter(s => itemIds.includes(s.service_id));
        if (completedInThisPlan.length > 0 && appointment?.patient_id) {
          const existingRecords = await base44.entities.ToothRecord.filter(
            { patient_id: appointment.patient_id },
            'tooth_number',
            100
          );

          const clinicId = localStorage.getItem('current_clinic_id') || plan?.clinic_id || 'default_clinic';

          const getToothFdi = (service) => {
            let val = service.tooth || service.tooth_number || service.tooth_id || '';
            val = String(val).trim();
            if (!val) return '';
            const match = val.match(/^(ur|ul|lr|ll)(\d+)(c)?$/i);
            if (match) {
              const [, quad, num, isChild] = match;
              const q = quad.toLowerCase();
              if (isChild) {
                const qMap = { ur: 5, ul: 6, ll: 7, lr: 8 };
                return `${qMap[q]}${num}`;
              } else {
                const qMap = { ur: 1, ul: 2, ll: 3, lr: 4 };
                return `${qMap[q]}${num}`;
              }
            }
            return val;
          };

          const isExtractionService = (service) => {
            const text = [
              service?.service_name,
              service?.name,
              service?.type,
              service?.category,
            ].filter(Boolean).join(' ');
            return /(aqil\s*tish|tish).*(olish|sug'?urish)|olib\s*tashlash|ekstraks|extraction|удалени/i.test(text);
          };

          for (const service of completedInThisPlan) {
            const toothNumber = getToothFdi(service);
            if (!toothNumber || toothNumber.toLowerCase() === 'general') continue;

            const existingRecord = (existingRecords || []).find(record => String(record?.tooth_number) === String(toothNumber));
            const svcName = String(service.service_name || service.name || '').toLowerCase();
            
            let derivedCondition = null;
            let derivedTreatment = service.service_name || service.name || 'Davolangan';
            const isExtraction = isExtractionService(service);
            
            if (isExtraction) {
              derivedCondition = 'Olib tashlangan';
              derivedTreatment = 'Olib tashlangan';
            } else if (svcName.includes('implant')) {
              derivedTreatment = 'Implant';
            } else if (svcName.includes('vinir') || svcName.includes('veneer')) {
              derivedTreatment = 'Veneer';
            } else if (svcName.includes('karonka') || svcName.includes('toj') || svcName.includes('crown') || svcName.includes('protez') || svcName.includes('metallokeramika')) {
              derivedTreatment = 'Toj';
            } else if (svcName.includes('plomba') || svcName.includes('restavratsiya')) {
              derivedTreatment = 'Restavratsiya';
            } else if (svcName.includes('endo') || svcName.includes('kanal') || svcName.includes('pulpit')) {
              derivedCondition = 'Pulpit';
              derivedTreatment = 'Kanal';
            } else if (svcName.includes('kariyes') || svcName.includes('caries') || svcName.includes('karies')) {
              derivedCondition = 'Kariyes';
              derivedTreatment = 'Davolangan';
            }

            const payload = {
              patient_id: appointment.patient_id,
              clinic_id: clinicId,
              tooth_number: toothNumber,
              condition: derivedCondition || (existingRecord ? existingRecord.condition : null),
              treatment: derivedTreatment || (existingRecord ? existingRecord.treatment : null),
              notes: existingRecord?.notes || `Qabul yakunlanganda tizim orqali kiritildi (${service.service_name})`,
            };

            if (existingRecord?.id) {
              await base44.entities.ToothRecord.update(existingRecord.id, payload);
            } else {
              await base44.entities.ToothRecord.create(payload);
            }
          }
        }
      }

      toast.success("Qabul va muolajalar saqlandi");
      if (onCompleted) onCompleted();
      return true;
    } catch (error) {
      console.error('Failed to finish appointment:', error);
      toast.error('Saqlashda xatolik yuz berdi');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleFinishAndClose = async () => {
    const success = await handleFinish();
    if (success) {
      onClose();
    }
  };

  const handleFinishAndPay = async () => {
    setSaving(true);
    let totalAmount = 0;
    let paymentCategory = [];

    // Calculate total from selected items before we complete them
    const planIdsToUpdate = Object.keys(selectedItems);
    for (const pId of planIdsToUpdate) {
      const itemIds = selectedItems[pId];
      if (itemIds.length === 0) continue;
      const plan = plans.find(p => p.id === pId);
      if (!plan) continue;
      
      plan.services.forEach(s => {
        if (itemIds.includes(s.service_id) && !s.completed) {
          totalAmount += Number(s.price || 0);
          paymentCategory.push(s.service_name);
        }
      });
    }

    // Fallback if no plans selected but appointment has details
    if (totalAmount === 0 && appointment?.price) {
      totalAmount = Number(appointment.price);
    }
    if (paymentCategory.length === 0 && appointment?.service_name) {
      paymentCategory.push(appointment.service_name);
    }

    // Complete appointment
    const success = await handleFinish();
    
    if (success) {
      onClose();
      // Navigate to payments
      navigate('/payments', { 
        state: { 
          openAddModal: true, 
          prefillPatient: appointment?.patient_id,
          // Patient name is usually included in the appointment object or we just let it fallback
          prefillPatientName: appointment?.patient_name || '',
          prefillAmount: totalAmount,
          prefillCategory: paymentCategory.join(', ') || 'Muolaja to\'lovi',
          prefillDoctor: appointment?.doctor_id
        } 
      });
    }
  };

  const handleXrayUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploadingXray(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Determine relevant teeth based on selections
      let teethArr = [];
      const planIdsWithSelections = Object.keys(selectedItems).filter(pid => selectedItems[pid].length > 0);
      planIdsWithSelections.forEach(pid => {
         const p = plans.find(x => x.id === pid);
         if (p && p.tooth_number) teethArr.push(p.tooth_number);
      });
      // If nothing selected, fallback to all planned teeth
      if (teethArr.length === 0) {
         teethArr = plans.map(p => p.tooth_number).filter(Boolean);
      }
      
      // Split comma-separated multiple tooth numbers just in case, then unique filter
      const flattenedTeeth = teethArr.flatMap(t => t.split(',').map(s => s.trim()));
      const uniqueTeeth = [...new Set(flattenedTeeth)].filter(Boolean);
      const fdiValue = uniqueTeeth.length > 0 ? uniqueTeeth.join(', ') : 'all';
      
      const uploadPromises = files.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = async () => {
             try {
                await base44.entities.Xray.create({
                  patient_id: appointment.patient_id,
                  image_url: reader.result,
                  description: `Muolaja jarayoni rentgeni (${uniqueTeeth.length > 0 ? fdiValue + '-tish' : 'Umumiy'})`,
                  tooth_number: fdiValue,
                  date: today,
                });
                resolve();
             } catch (err) { reject(err); }
          };
          reader.readAsDataURL(file);
        });
      });
      
      await Promise.all(uploadPromises);
      toast.success("Rentgen muvaffaqiyatli yuklandi!");
    } catch (err) {
      console.error('Rentgen yuklashda xato:', err);
      toast.error('Xatolik yuz berdi');
    } finally {
      setUploadingXray(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90dvh] overflow-y-auto p-0 rounded-2xl border-0 shadow-2xl">
        <div className="sticky top-0 bg-white z-20 px-6 py-4 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Muolajalarni yakunlash</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 mt-1 font-medium italic">
            Bugun bajarilgan ishlarni belgilang:
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm font-medium text-slate-400">Rejalar yuklanmoqda...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 px-6">
              <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-400 mb-4">Rejalashtirilgan ishlar yo'q</p>
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleFinishAndPay}
                  disabled={saving}
                  className="w-full text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 h-12 rounded-xl font-bold shadow-md shadow-emerald-100 whitespace-normal h-auto py-3"
                >
                  {saving ? 'Kuting...' : (appointment?.service_name ? `${appointment.service_name} — To'lovga o'tish` : "To'lovga o'tish")}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleFinishAndClose}
                  className="w-full text-slate-500 font-bold hover:bg-white h-12 rounded-xl border border-transparent hover:border-slate-200"
                >
                  Shunchaki yakunlash <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {plans.map(plan => (
                <div key={plan.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-1 bg-slate-900 text-white text-[10px] font-black rounded-md uppercase tracking-widest">
                      Tish #{plan.tooth_number}
                    </div>
                    <span className="text-xs font-bold text-slate-400 truncate flex-1">{plan.name}</span>
                  </div>
                  
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden divide-y divide-white">
                    {plan.services.filter(s => !s.completed).map(service => {
                      const isSelected = selectedItems[plan.id]?.includes(service.service_id);
                      return (
                        <div 
                          key={service.service_id}
                          className={`flex items-center gap-3 p-4 transition-colors cursor-pointer active:bg-slate-100 ${
                            isSelected ? 'bg-emerald-50/50' : ''
                          }`}
                          onClick={() => toggleItem(plan.id, service.service_id)}
                        >
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(plan.id, service.service_id)}
                            className="w-5 h-5 rounded-lg border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {service.service_name}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                              {service.price?.toLocaleString()} so'm
                            </p>
                          </div>
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-200" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white p-6 border-t border-slate-100 z-20">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleXrayUpload}
          />
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              disabled={uploadingXray}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 rounded-xl border-cyan-200 bg-cyan-50 text-cyan-700 font-bold hover:bg-cyan-100"
            >
              {uploadingXray ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Camera className="w-5 h-5 mr-2" />}
              {uploadingXray ? 'Rentgen yuklanmoqda...' : 'Rentgen yuklash'}
            </Button>
            <Button
              onClick={handleFinishAndPay}
              disabled={saving}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold"
            >
              {saving ? 'Kuting...' : 'Muolaja va To\'lovni yakunlash'}
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl border-slate-200 font-bold text-slate-600"
              >
                Bekor
              </Button>
              <Button
                onClick={handleFinishAndClose}
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-slate-900 border-0 hover:bg-slate-800 text-white font-bold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saqlanmoqda
                  </>
                ) : (
                  'Qabulni yakunlash'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
