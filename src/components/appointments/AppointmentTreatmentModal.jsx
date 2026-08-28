import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  Loader2, CheckCircle2, Circle, Activity, ChevronRight, ChevronLeft, 
  Camera, Package, Search, Plus, Minus, Layers, DollarSign, Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_INVENTORY_CATEGORIES = [
  'Endodontiya',
  'Restavratsiya',
  'Plomba materiallari',
  'Anesteziya',
  'Xirurgiya',
  'Ortopediya',
  'Ortodontiya',
  'Asboblar',
  'Bir martalik (Sarf)',
  'Dezinseksiya',
  'Boshqa'
];

/**
 * AppointmentTreatmentModal
 * 2-bosqichli muolajani yakunlash dialogi:
 * 1-Bosqich: Bajarilgan muolajalar va narxlarni belgilash (doktor o'z narxini kiritishi mumkin)
 * 2-Bosqich: Ombordagi bo'limlardan sarflangan materiallarni hisobdan chiqarish (Endo, Restavratsiya va h.k.)
 */
export default function AppointmentTreatmentModal({ open, onClose, appointment, onCompleted }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Stepper state (1: Muolaja va narx, 2: Ombor/Materiallar)
  const [step, setStep] = useState(1);

  // Step 1 states
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState({}); // { [planId]: [service_id, ...] }
  const [serviceCustomPrices, setServiceCustomPrices] = useState({}); // { [serviceId]: number }
  const [customTotalAmount, setCustomTotalAmount] = useState('');
  const [manualTotalOverridden, setManualTotalOverridden] = useState(false);
  const [singleServicePrice, setSingleServicePrice] = useState('');

  // Step 2 states (Inventory / Ombor)
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [usedMaterials, setUsedMaterials] = useState({}); // { [itemId]: quantity }

  // Saving / Uploading states
  const [saving, setSaving] = useState(false);
  const [uploadingXray, setUploadingXray] = useState(false);

  // Load initial data when modal opens
  useEffect(() => {
    if (open && appointment?.patient_id) {
      setStep(1);
      loadPlans();
      loadInventory();
      setSingleServicePrice(appointment?.price ? String(appointment.price) : '0');
    } else {
      setPlans([]);
      setSelectedItems({});
      setServiceCustomPrices({});
      setCustomTotalAmount('');
      setManualTotalOverridden(false);
      setUsedMaterials({});
      setStep(1);
    }
  }, [open, appointment]);

  // Load patient treatment plans
  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await base44.entities.TreatmentPlan.filter({ 
        patient_id: appointment.patient_id 
      });
      // Incomplete plans
      const activePlans = data.filter(p => p.services && p.services.some(s => !s.completed));
      setPlans(activePlans);

      // Prepopulate prices
      const priceMap = {};
      activePlans.forEach(p => {
        (p.services || []).forEach(s => {
          priceMap[s.service_id] = Number(s.price || 0);
        });
      });
      setServiceCustomPrices(priceMap);
    } catch (error) {
      console.error('Failed to load plans:', error);
      toast.error('Rejalarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  // Load inventory items from warehouse
  const loadInventory = async () => {
    try {
      setInventoryLoading(true);
      const data = await base44.entities.Inventory.list('name', 300);
      setInventoryItems(data || []);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setInventoryLoading(false);
    }
  };

  // Compute distinct inventory categories
  const categoriesList = useMemo(() => {
    const fromSaved = (() => {
      try {
        const saved = localStorage.getItem('inventory_categories');
        if (saved) return JSON.parse(saved);
      } catch {}
      return [];
    })();
    const fromItems = inventoryItems.map(i => i.category).filter(Boolean);
    const combined = Array.from(new Set([...DEFAULT_INVENTORY_CATEGORIES, ...fromSaved, ...fromItems]));
    return combined;
  }, [inventoryItems]);

  // Toggle selection of treatment item
  const toggleItem = (planId, serviceId) => {
    setSelectedItems(prev => {
      const current = prev[planId] || [];
      const next = current.includes(serviceId)
        ? current.filter(id => id !== serviceId)
        : [...current, serviceId];
      return { ...prev, [planId]: next };
    });
  };

  // Recalculate automatic sum when selections or individual prices change
  useEffect(() => {
    let autoSum = 0;
    let hasSelected = false;

    Object.keys(selectedItems).forEach(pId => {
      const itemIds = selectedItems[pId] || [];
      const plan = plans.find(p => p.id === pId);
      if (plan) {
        plan.services.forEach(s => {
          if (itemIds.includes(s.service_id)) {
            hasSelected = true;
            const price = serviceCustomPrices[s.service_id] !== undefined 
              ? Number(serviceCustomPrices[s.service_id]) 
              : Number(s.price || 0);
            autoSum += price;
          }
        });
      }
    });

    if (plans.length === 0 && appointment?.price) {
      autoSum = Number(singleServicePrice || appointment.price || 0);
    }

    if (!manualTotalOverridden || !hasSelected) {
      setCustomTotalAmount(autoSum > 0 ? String(autoSum) : (appointment?.price ? String(appointment.price) : '0'));
    }
  }, [selectedItems, serviceCustomPrices, plans, appointment, singleServicePrice, manualTotalOverridden]);

  // Handle individual service price edit
  const handleServicePriceChange = (serviceId, newPrice) => {
    setServiceCustomPrices(prev => ({
      ...prev,
      [serviceId]: Number(newPrice) || 0
    }));
  };

  // Inventory item quantity change
  const updateMaterialQty = (itemId, deltaOrValue, isDirect = false) => {
    setUsedMaterials(prev => {
      const current = prev[itemId] || 0;
      let next;
      if (isDirect) {
        next = Math.max(0, parseInt(deltaOrValue) || 0);
      } else {
        next = Math.max(0, current + deltaOrValue);
      }

      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  // Filtered inventory items for Step 2
  const filteredInventoryItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchCat = selectedCategory === 'all' || 
        (item.category || 'Boshqa').toLowerCase() === selectedCategory.toLowerCase();
      const q = inventorySearch.toLowerCase().trim();
      const matchSearch = !q || 
        (item.name || '').toLowerCase().includes(q) || 
        (item.category || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [inventoryItems, selectedCategory, inventorySearch]);

  // Total count of selected materials
  const totalUsedMaterialsCount = useMemo(() => {
    return Object.values(usedMaterials).reduce((sum, qty) => sum + qty, 0);
  }, [usedMaterials]);

  // Core finish function (saves procedures, ToothRecords, and deducts materials from warehouse)
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
            const finalPrice = serviceCustomPrices[s.service_id] !== undefined 
              ? Number(serviceCustomPrices[s.service_id]) 
              : Number(s.price || 0);
            return { 
              ...s, 
              price: finalPrice,
              completed: true, 
              completion_date: new Date().toISOString() 
            };
          }
          return s;
        });

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

      // 4. OMBORDAN SARFLANGAN MATERIALLARNI HISOBLASH VA KAMAYTIRISH
      const usedMaterialIds = Object.keys(usedMaterials);
      if (usedMaterialIds.length > 0) {
        for (const itemId of usedMaterialIds) {
          const usedQty = usedMaterials[itemId];
          if (!usedQty || usedQty <= 0) continue;

          const item = inventoryItems.find(i => i.id === itemId);
          if (item) {
            const currentQty = Number(item.quantity) || 0;
            const newQty = Math.max(0, currentQty - usedQty);
            await base44.entities.Inventory.update(item.id, {
              ...item,
              quantity: newQty
            });
          }
        }
      }

      const msg = totalUsedMaterialsCount > 0 
        ? `Qabul saqlandi va ${totalUsedMaterialsCount} ta ombor materiali yechildi!`
        : "Qabul va muolajalar muvaffaqiyatli saqlandi!";
      toast.success(msg);

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
    let paymentCategory = [];

    // Collect service names
    const planIdsToUpdate = Object.keys(selectedItems);
    for (const pId of planIdsToUpdate) {
      const itemIds = selectedItems[pId];
      if (itemIds.length === 0) continue;
      const plan = plans.find(p => p.id === pId);
      if (!plan) continue;
      
      plan.services.forEach(s => {
        if (itemIds.includes(s.service_id) && !s.completed) {
          paymentCategory.push(s.service_name);
        }
      });
    }

    if (paymentCategory.length === 0 && appointment?.service_name) {
      paymentCategory.push(appointment.service_name);
    }

    // Final price entered by doctor
    const finalAmount = Number(customTotalAmount) || 0;

    // Complete appointment and deduct materials
    const success = await handleFinish();
    
    if (success) {
      onClose();
      // Navigate to payments with exact doctor-entered price
      navigate('/payments', { 
        state: { 
          openAddModal: true, 
          prefillPatient: appointment?.patient_id,
          prefillPatientName: appointment?.patient_name || '',
          prefillAmount: finalAmount,
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
      
      let teethArr = [];
      const planIdsWithSelections = Object.keys(selectedItems).filter(pid => selectedItems[pid].length > 0);
      planIdsWithSelections.forEach(pid => {
         const p = plans.find(x => x.id === pid);
         if (p && p.tooth_number) teethArr.push(p.tooth_number);
      });
      if (teethArr.length === 0) {
         teethArr = plans.map(p => p.tooth_number).filter(Boolean);
      }
      
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
      <DialogContent className="w-[96vw] sm:max-w-xl max-h-[92dvh] overflow-hidden flex flex-col p-0 rounded-3xl border-0 shadow-2xl bg-white">
        
        {/* MODAL HEADER WITH STEP INDICATOR */}
        <div className="sticky top-0 bg-white z-20 px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Muolajalarni yakunlash</span>
              </DialogTitle>
              
              {/* Step indicator badge */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${
                    step === 1 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  1. Muolaja & Narx
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
                    step === 2 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <span>2. Ombor</span>
                  {totalUsedMaterialsCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${step === 2 ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {totalUsedMaterialsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </DialogHeader>

          <p className="text-xs text-slate-500 mt-1 font-medium">
            {step === 1 
              ? "Bajarilgan ishlarni belgilang va kerak bo'lsa doktor narxini kiriting:" 
              : "Ishlatilgan materiallarni tanlang (Endodontiya, Restavratsiya va h.k.):"}
          </p>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-9 h-9 text-emerald-500 animate-spin" />
              <p className="text-sm font-bold text-slate-400">Rejalar yuklanmoqda...</p>
            </div>
          ) : step === 1 ? (
            /* =========================================================
               STEP 1: BAJARILGAN ISHLAR VA DOKTOR NARXINI KIRITISH
               ========================================================= */
            <div className="space-y-5">
              {plans.length === 0 ? (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-700 font-bold">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {appointment?.service_name || "Yozilgan qabul muolajasi"}
                      </p>
                      <p className="text-xs text-slate-400 font-medium">Rejalashtirilgan maxsus reja yo'q</p>
                    </div>
                  </div>

                  {/* Doktor narxini kiritish */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                    <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
                      Muolaja to'lov narxi (Doktor narxi):
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="0"
                        value={singleServicePrice}
                        onChange={(e) => {
                          setSingleServicePrice(e.target.value);
                          setCustomTotalAmount(e.target.value);
                        }}
                        className="h-12 rounded-xl font-mono font-bold text-lg text-slate-900 border-slate-200"
                      />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">SO'M</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {plans.map(plan => (
                    <div key={plan.id} className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                          Tish #{plan.tooth_number || 'Umumiy'}
                        </span>
                        <span className="text-xs font-bold text-slate-500 truncate">{plan.name}</span>
                      </div>
                      
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {plan.services.filter(s => !s.completed).map(service => {
                          const isSelected = (selectedItems[plan.id] || []).includes(service.service_id);
                          const currentPrice = serviceCustomPrices[service.service_id] !== undefined 
                            ? serviceCustomPrices[service.service_id] 
                            : (service.price || 0);

                          return (
                            <div 
                              key={service.service_id}
                              className={`p-3.5 transition-all space-y-2 ${
                                isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-100/50'
                              }`}
                            >
                              <div 
                                className="flex items-center gap-3 cursor-pointer"
                                onClick={() => toggleItem(plan.id, service.service_id)}
                              >
                                <Checkbox 
                                  checked={isSelected}
                                  onCheckedChange={() => toggleItem(plan.id, service.service_id)}
                                  className="w-5 h-5 rounded-lg border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-bold truncate ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>
                                    {service.service_name}
                                  </p>
                                </div>
                                {isSelected ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                                )}
                              </div>

                              {/* Editable Price for each selected or available service */}
                              {isSelected && (
                                <div className="flex items-center justify-between pl-8 pt-1">
                                  <span className="text-[11px] font-bold text-emerald-800">
                                    Xizmat narxi (so'm):
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="number"
                                      value={currentPrice}
                                      onChange={(e) => handleServicePriceChange(service.service_id, e.target.value)}
                                      className="h-8 w-32 rounded-lg bg-white border-emerald-300 text-xs font-mono font-bold text-right text-emerald-900"
                                    />
                                    <span className="text-[10px] font-bold text-slate-400">so'm</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* JAMI SUMMA (Doktor o'zgartirishi mumkin bo'lgan umumiy to'lov) */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 sm:p-5 rounded-2xl shadow-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Jami to'lov summasi
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-bold">
                    Doktor ixtiyoriy o'zgartirishi mumkin
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-700">
                  <Input
                    type="number"
                    placeholder="0"
                    value={customTotalAmount}
                    onChange={(e) => {
                      setCustomTotalAmount(e.target.value);
                      setManualTotalOverridden(true);
                    }}
                    className="h-11 bg-transparent border-0 text-xl sm:text-2xl font-mono font-black text-emerald-400 focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
                  />
                  <span className="text-xs font-black text-slate-400 pr-2">SO'M</span>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================
               STEP 2: OMBOR BO'LIMLARI VA ISHLATILGAN MATERIALLAR
               ========================================================= */
            <div className="space-y-4">
              {/* Category selector pills */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
                  Ombor bo'limini tanlang:
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Barchasi ({inventoryItems.length})
                  </button>
                  {categoriesList.map(cat => {
                    const count = inventoryItems.filter(i => (i.category || 'Boshqa').toLowerCase() === cat.toLowerCase()).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          selectedCategory.toLowerCase() === cat.toLowerCase()
                            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat} {count > 0 && `(${count})`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search in warehouse */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Material nomini qidirish (plomba, anesteziya, shpris...)..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="pl-9 h-11 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium"
                />
              </div>

              {/* Inventory items list */}
              {inventoryLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-7 h-7 text-emerald-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400">Materiallar yuklanmoqda...</p>
                </div>
              ) : filteredInventoryItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-400">Ushbu bo'limda material topilmadi</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {filteredInventoryItems.map(item => {
                    const usedQty = usedMaterials[item.id] || 0;
                    const stock = Number(item.quantity) || 0;
                    const isUsed = usedQty > 0;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isUsed 
                            ? 'bg-emerald-50/80 border-emerald-300 shadow-sm' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${isUsed ? 'text-emerald-950' : 'text-slate-900'}`}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                              {item.category || 'Ombor'}
                            </span>
                            <span className={`text-[10px] font-bold ${
                              stock <= (item.min_quantity || 5) ? 'text-amber-600' : 'text-slate-500'
                            }`}>
                              Qoldiq: {stock} {item.unit || 'dona'}
                            </span>
                          </div>
                        </div>

                        {/* Stepper control */}
                        <div className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                          <button
                            type="button"
                            onClick={() => updateMaterialQty(item.id, -1)}
                            disabled={usedQty === 0}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              usedQty > 0 
                                ? 'bg-slate-100 text-slate-800 hover:bg-slate-200' 
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={usedQty}
                            onChange={(e) => updateMaterialQty(item.id, e.target.value, true)}
                            className="w-10 text-center font-mono font-black text-sm text-slate-900 outline-none bg-transparent"
                          />

                          <button
                            type="button"
                            onClick={() => updateMaterialQty(item.id, 1)}
                            className="w-7 h-7 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center transition-all shadow-sm shadow-emerald-200"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Summary of used materials */}
              {totalUsedMaterialsCount > 0 && (
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Sarflanadigan materiallar ({totalUsedMaterialsCount} ta):
                    </span>
                    <button
                      type="button"
                      onClick={() => setUsedMaterials({})}
                      className="text-[10px] font-bold text-rose-600 hover:underline"
                    >
                      Tozalash
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(usedMaterials).map(itemId => {
                      const item = inventoryItems.find(i => i.id === itemId);
                      const qty = usedMaterials[itemId];
                      if (!qty || !item) return null;
                      return (
                        <span key={itemId} className="text-xs bg-white text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg font-medium">
                          {item.name}: <b>{qty} {item.unit || 'dona'}</b>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER BUTTONS */}
        <div className="sticky bottom-0 bg-white p-4 sm:p-5 border-t border-slate-100 z-20 flex-shrink-0 space-y-2.5">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleXrayUpload}
          />

          {/* Stepper forward or Action buttons */}
          {step === 1 ? (
            <div className="space-y-2.5">
              {/* Rentgen va 2-bosqichga o'tish */}
              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  disabled={uploadingXray}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 rounded-xl border-cyan-200 bg-cyan-50 text-cyan-700 font-bold hover:bg-cyan-100 text-xs"
                >
                  {uploadingXray ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Camera className="w-4 h-4 mr-1.5" />}
                  {uploadingXray ? 'Yuklanmoqda...' : 'Rentgen yuklash'}
                </Button>

                <Button
                  onClick={() => setStep(2)}
                  className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <span>2-bosqich: Ombor</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Muolaja va To'lovni yakunlash */}
              <Button
                onClick={handleFinishAndPay}
                disabled={saving}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md shadow-emerald-200"
              >
                {saving ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Kuting...</span>
                ) : (
                  `Muolaja va To'lovni yakunlash (${(Number(customTotalAmount) || 0).toLocaleString()} so'm)`
                )}
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl border-slate-200 font-bold text-slate-600 text-xs"
                >
                  Bekor
                </Button>
                <Button
                  onClick={handleFinishAndClose}
                  disabled={saving}
                  className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                >
                  Shunchaki yakunlash
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Back to Step 1 & Finish & Pay */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-12 rounded-xl border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>1-bosqich</span>
                </Button>

                <Button
                  onClick={handleFinishAndPay}
                  disabled={saving}
                  className="col-span-2 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-200"
                >
                  {saving ? (
                    <span className="flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" /> Kuting...</span>
                  ) : (
                    `To'lovga o'tish (${(Number(customTotalAmount) || 0).toLocaleString()} so'm)`
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl border-slate-200 font-bold text-slate-600 text-xs"
                >
                  Bekor
                </Button>
                <Button
                  onClick={handleFinishAndClose}
                  disabled={saving}
                  className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                >
                  {saving ? 'Saqlanmoqda...' : 'Qabulni yakunlash'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
