import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Info } from 'lucide-react';

const FIRMALAR = ['Nobel', 'Osstem', 'Straumann', 'Nucleoss', 'Boshqa'];
const IMPLANT_TYPES = ['Bone level', 'Tissue level'];
const BONE_TYPES = ['D1', 'D2', 'D3', 'D4'];

/**
 * ToothImplantModal - Individual tooth implant data entry
 * Opens when clicking on a tooth in the odontogram
 */
export default function ToothImplantModal({ 
  open, 
  onClose, 
  toothId, 
  fdiNumber, 
  onSave, 
  existingData 
}) {
  const [form, setForm] = useState({
    firma: 'Osstem',
    firma_custom: '',
    brend: '',
    diameter: '',
    length: '',
    lot_number: '',
    torque: '',
    isq: '',
    bone_type: 'D2',
    implant_type: 'Bone level',
    notes: ''
  });

  // Load existing data if editing
  useEffect(() => {
    if (existingData) {
      setForm(existingData);
    } else {
      resetForm();
    }
  }, [open, existingData]);

  const resetForm = () => {
    setForm({
      firma: 'Osstem',
      firma_custom: '',
      brend: '',
      diameter: '',
      length: '',
      lot_number: '',
      torque: '',
      isq: '',
      bone_type: 'D2',
      implant_type: 'Bone level',
      notes: ''
    });
  };

  const setField = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    if (!form.firma || !form.brend) {
      alert('Firma va Brend majburiy!');
      return;
    }

    onSave(toothId, form);
    onClose();
  };

  const isValid = form.firma && form.brend;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl font-black">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              🦷
            </div>
            <div>
              <div className="text-sm text-slate-500 font-bold uppercase tracking-wider">Tish</div>
              <div className="text-2xl text-emerald-600">{fdiNumber}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Firma Selection */}
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <Label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4" /> Implant firmasi *
            </Label>
            <Select value={form.firma} onValueChange={v => setField('firma', v)}>
              <SelectTrigger className="bg-white border-slate-300 h-11 rounded-xl shadow-sm font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIRMALAR.map(f => (
                  <SelectItem key={f} value={f} className="font-bold">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {form.firma === 'Boshqa' && (
              <Input
                className="bg-white border-slate-300 h-11 rounded-xl font-medium"
                value={form.firma_custom}
                onChange={e => setField('firma_custom', e.target.value)}
                placeholder="Firma nomini kiriting"
              />
            )}
          </div>

          {/* Brend/Model */}
          <div className="bg-gradient-to-br from-slate-50 to-purple-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <Label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Brend / Model *
            </Label>
            <Input
              className="bg-white border-slate-300 h-11 rounded-xl font-medium"
              value={form.brend}
              onChange={e => setField('brend', e.target.value)}
              placeholder="Masalan: Replace CC, TSIII, SLA..."
            />
          </div>

          {/* Razmerlar Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-xl border border-emerald-200 space-y-2">
              <Label className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                Diametr
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  className="bg-white border-emerald-300 h-11 rounded-xl pr-8 font-bold text-emerald-700"
                  value={form.diameter}
                  onChange={e => setField('diameter', e.target.value)}
                  placeholder="3.5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-600">mm</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200 space-y-2">
              <Label className="text-[10px] font-black text-blue-700 uppercase tracking-wider">
                Uzunlik
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  className="bg-white border-blue-300 h-11 rounded-xl pr-8 font-bold text-blue-700"
                  value={form.length}
                  onChange={e => setField('length', e.target.value)}
                  placeholder="10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-blue-600">mm</span>
              </div>
            </div>
          </div>

          {/* Lot Number & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <Label className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                Lot #
              </Label>
              <Input
                className="bg-white border-slate-300 h-11 rounded-xl font-mono font-bold"
                value={form.lot_number}
                onChange={e => setField('lot_number', e.target.value)}
                placeholder="LOT-123"
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <Label className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                Suyak turi
              </Label>
              <Select value={form.bone_type} onValueChange={v => setField('bone_type', v)}>
                <SelectTrigger className="bg-white border-slate-300 h-11 rounded-xl shadow-sm font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BONE_TYPES.map(b => (
                    <SelectItem key={b} value={b} className="font-bold">{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Torque & ISQ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 space-y-2">
              <Label className="text-[10px] font-black text-orange-700 uppercase tracking-wider">
                Torque
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  className="bg-white border-orange-300 h-11 rounded-xl pr-10 font-bold text-orange-700"
                  value={form.torque}
                  onChange={e => setField('torque', e.target.value)}
                  placeholder="35"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-orange-600">Ncm</span>
              </div>
            </div>

            <div className="bg-pink-50 p-4 rounded-xl border border-pink-200 space-y-2">
              <Label className="text-[10px] font-black text-pink-700 uppercase tracking-wider">
                ISQ
              </Label>
              <Input
                type="number"
                className="bg-white border-pink-300 h-11 rounded-xl font-bold text-pink-700"
                value={form.isq}
                onChange={e => setField('isq', e.target.value)}
                placeholder="70"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <Label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Qo'shimcha izoh
            </Label>
            <textarea
              className="w-full bg-white border-slate-300 rounded-xl p-3 font-medium min-h-[80px] resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Muolaja haqida qisqacha..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border-2 font-black text-sm hover:bg-slate-50"
          >
            <X className="w-4 h-4 mr-2" /> Bekor
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black shadow-lg shadow-emerald-500/30 transition-all active:scale-95 text-sm"
          >
            <Check className="w-4 h-4 mr-2" /> Saqlash
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
