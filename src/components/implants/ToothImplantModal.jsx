import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Box, Plus, Package } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getOrSeedImplantBrands, calculateBrandStockStats } from './ImplantBrandsModal';

const BONE_TYPES = ['D1', 'D2', 'D3', 'D4'];
const SERVICE_OPTIONS = [
  { id: 'Implant', label: '🔩 Implant (O\'rnatish)', defaultPrice: 1500000 },
  { id: 'Formik', label: '🩹 Formik (Formirovatel)', defaultPrice: 100000 },
  { id: 'Karonka', label: '👑 Karonka (Koronka/Tsirkon)', defaultPrice: 1500000 },
  { id: 'Abutment', label: '🔧 Abutment', defaultPrice: 300000 },
  { id: 'Sinus-lifting', label: '🩺 Sinus-lifting', defaultPrice: 2000000 },
  { id: 'Suyak ekish', label: '🧬 Suyak ekish (Graft)', defaultPrice: 1000000 },
  { id: 'Boshqa', label: '➕ Boshqa xizmat...', defaultPrice: 0 }
];

export default function ToothImplantModal({ open, onClose, toothId, fdiNumber, onSave, existingData }) {
  const [brands, setBrands] = useState([]);
  const [implants, setImplants] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [quickNewBrand, setQuickNewBrand] = useState(false);
  const [newBrandStock, setNewBrandStock] = useState(100);

  const [form, setForm] = useState({
    service_name: 'Implant',
    service_custom: '',
    price: 1500000,
    firma: 'Osstem', firma_custom: '', brend: '',
    diameter: '', length: '', lot_number: '',
    torque: '', isq: '', bone_type: 'D2',
    implant_type: 'Bone level', notes: ''
  });

  useEffect(() => {
    async function load() {
      if (!open) return;
      try {
        setLoadingBrands(true);
        const [bList, impList] = await Promise.all([
          getOrSeedImplantBrands(),
          base44.entities.Implant.list('-placement_date', 500).catch(() => [])
        ]);
        setBrands(bList || []);
        setImplants(impList || []);
      } catch (err) {
        console.error('Error loading implant brands in modal:', err);
      } finally {
        setLoadingBrands(false);
      }
    }
    load();
  }, [open]);

  const brandsWithStats = useMemo(() => {
    return calculateBrandStockStats(brands, implants);
  }, [brands, implants]);

  useEffect(() => {
    if (existingData) {
      setForm(existingData);
    } else {
      resetForm();
    }
  }, [open, existingData, brands]);

  const resetForm = () => {
    const defaultFirma = brands.length > 0 ? brands[0].name : 'Osstem';
    setForm({
      service_name: 'Implant',
      service_custom: '',
      price: 1500000,
      firma: defaultFirma, firma_custom: '', brend: '',
      diameter: '', length: '', lot_number: '',
      torque: '', isq: '', bone_type: 'D2',
      implant_type: 'Bone level', notes: ''
    });
    setQuickNewBrand(false);
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (form.firma === 'Boshqa' && !form.firma_custom?.trim()) {
      alert('Iltimos, firma / brend nomini kiriting!');
      return;
    }
    if (!form.firma) {
      alert('Iltimos, implant firmasini tanlang!');
      return;
    }

    let finalFirma = form.firma;
    let finalCustom = form.firma === 'Boshqa' ? form.firma_custom.trim() : '';
    let finalBrend = form.brend?.trim() || (form.firma === 'Boshqa' ? finalCustom : (form.firma || 'Standart'));
    let finalService = form.service_name === 'Boshqa' ? (form.service_custom?.trim() || 'Xizmat') : (form.service_name || 'Implant');

    // If user added a new brand via "Boshqa" or quick add, create it in ImplantBrand entity
    if (form.firma === 'Boshqa' && finalCustom) {
      finalFirma = finalCustom;
      try {
        const exists = brands.find(b => b.name?.toLowerCase() === finalCustom.toLowerCase());
        if (!exists) {
          await base44.entities.ImplantBrand.create({
            name: finalCustom,
            initial_stock: Math.max(1, parseInt(newBrandStock, 10) || 50),
            added_stock: 0,
            created_date: new Date().toISOString(),
            is_active: true
          });
        }
      } catch (e) {
        console.warn('Brand create background error:', e);
      }
    }

    onSave(toothId, {
      ...form,
      service_name: finalService,
      service_custom: form.service_custom,
      price: Number(form.price) || 0,
      firma: finalFirma,
      firma_custom: finalCustom,
      brend: finalBrend
    });
    onClose();
  };

  const isFirmaValid = form.firma === 'Boshqa' ? !!form.firma_custom?.trim() : !!form.firma;
  const isValid = isFirmaValid;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="w-[92vw] max-w-sm max-h-[88vh] p-0 border-none rounded-[2rem] bg-white shadow-2xl flex flex-col overflow-hidden"
        aria-describedby={undefined}
      >
        {/* Green Gradient Header */}
        <DialogHeader className="shrink-0">
          <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 py-4 flex items-center justify-between text-white rounded-t-[2rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm text-lg">
                🦷
              </div>
              <div>
                <DialogTitle className="text-[15px] font-black text-white uppercase leading-none tracking-tight">
                  Tish {fdiNumber}
                </DialogTitle>
                <p className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Xizmat va Implant ma'lumotlari</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center active:scale-90 transition-all border-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">

          {/* Hizmat turi (Service selector) */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2">
            <label className="text-slate-500 text-[9.5px] font-black uppercase tracking-wider block">
              1. Hizmat turi (Amaliyot) *
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {SERVICE_OPTIONS.map(opt => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    setForm(prev => ({
                      ...prev,
                      service_name: opt.id,
                      price: opt.defaultPrice !== undefined && opt.id !== 'Boshqa' ? opt.defaultPrice : prev.price
                    }));
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-left text-[11px] font-bold transition-all border ${
                    form.service_name === opt.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {form.service_name === 'Boshqa' && (
              <Input
                placeholder="Xizmat nomini kiriting..."
                value={form.service_custom}
                onChange={e => set('service_custom', e.target.value)}
                className="bg-white border-slate-300 h-9 rounded-xl text-xs font-bold"
              />
            )}
          </div>

          {/* Narxi */}
          <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-emerald-900 text-[9.5px] font-black uppercase tracking-wider block">
                2. Xizmat Narxi (so'm) *
              </label>
              <span className="text-[10px] font-mono font-black text-emerald-700">
                {(Number(form.price) || 0).toLocaleString()} so'm
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                step="10000"
                className="bg-white border-emerald-300 focus:border-emerald-500 h-10 rounded-xl font-mono font-black text-slate-900 text-sm pl-3 pr-14 shadow-sm"
                value={form.price}
                onChange={e => set('price', e.target.value)}
                placeholder="1500000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                SO'M
              </span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none">
              {[100000, 500000, 1000000, 1500000, 2000000, 3000000].map(amt => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => set('price', amt)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 transition-colors"
                >
                  {(amt / 1000).toLocaleString()}k
                </button>
              ))}
            </div>
          </div>

          {/* Firma (Loaded strictly from Brands section with stock!) */}
          <div>
            <div className="flex items-center justify-between ml-1 mb-1.5">
              <label className="text-slate-400 text-[9px] font-black uppercase tracking-[0.1em] block">
                Implant Firmasi *
              </label>
              {form.firma && form.firma !== 'Boshqa' && (
                (() => {
                  const curr = brandsWithStats.find(b => b.name === form.firma);
                  if (!curr) return null;
                  return (
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      curr.is_out_of_stock 
                        ? 'bg-rose-100 text-rose-700' 
                        : curr.is_low_stock 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {curr.remaining_stock} ta qoldi
                    </span>
                  );
                })()
              )}
            </div>

            <Select 
              value={form.firma} 
              onValueChange={v => {
                setForm(prev => ({
                  ...prev,
                  firma: v,
                  firma_custom: v === 'Boshqa' ? prev.firma_custom : '',
                  brend: v === 'Boshqa' ? (prev.firma_custom || prev.brend) : prev.brend
                }));
              }}
            >
              <SelectTrigger className="bg-white border-slate-200 h-11 rounded-xl shadow-sm font-bold text-sm focus:ring-emerald-400">
                <SelectValue placeholder="Implant firmasini tanlang" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-64">
                {brandsWithStats.map(b => (
                  <SelectItem key={b.id || b.name} value={b.name} className="font-bold cursor-pointer py-2.5">
                    <div className="flex items-center justify-between w-full gap-3">
                      <span>{b.name}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        b.remaining_stock <= 0 
                          ? 'bg-rose-100 text-rose-600' 
                          : b.remaining_stock <= 5 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {b.remaining_stock > 0 ? `${b.remaining_stock} ta qoldi` : 'Tugagan! (0 ta)'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="Boshqa" className="font-bold text-indigo-600 cursor-pointer py-2.5 border-t border-slate-100">
                  + Yangi brend / Boshqa firma...
                </SelectItem>
              </SelectContent>
            </Select>

            {form.firma === 'Boshqa' && (
              <div className="mt-2.5 space-y-2 bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <label className="text-emerald-800 text-[9px] font-black uppercase tracking-wider block mb-1">
                    ✍️ Yangi Brend / Firma nomini kiriting *
                  </label>
                  <Input
                    autoFocus
                    className="bg-white border-emerald-300 focus:border-emerald-500 focus-visible:ring-emerald-400 h-10 rounded-xl font-bold text-slate-800 text-sm placeholder:text-slate-400 shadow-sm"
                    value={form.firma_custom}
                    onChange={e => {
                      const val = e.target.value;
                      setForm(prev => ({
                        ...prev,
                        firma_custom: val,
                        brend: prev.brend && prev.brend !== prev.firma_custom ? prev.brend : val
                      }));
                    }}
                    placeholder="Masalan: Dentium, Megagen, Bredent, Neodent..."
                  />
                </div>

                <div>
                  <label className="text-emerald-800 text-[9px] font-black uppercase tracking-wider block mb-1">
                    📦 Boshlang'ich Zaxira Soni (dona)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    className="bg-white border-emerald-300 h-9 rounded-xl font-black text-slate-900 text-sm"
                    value={newBrandStock}
                    onChange={e => setNewBrandStock(e.target.value)}
                    placeholder="100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Brend */}
          <div>
            <label className="text-slate-400 text-[9px] font-black uppercase tracking-[0.1em] ml-1 mb-1.5 block">
              Brend / Model (ixtiyoriy)
            </label>
            <Input
              className="bg-white border-slate-200 h-10 rounded-xl font-medium text-sm focus-visible:ring-emerald-400"
              value={form.brend}
              onChange={e => set('brend', e.target.value)}
              placeholder={form.firma === 'Boshqa' ? "Masalan: SuperLine, AnyRidge..." : "Masalan: Replace CC, TSIII, SLA..."}
            />
          </div>

          {/* Diametr & Uzunlik */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-[1.25rem] space-y-1.5">
              <label className="text-[9px] font-black text-emerald-700 uppercase tracking-wider block">Diametr</label>
              <div className="relative">
                <Input
                  type="number" step="0.1"
                  className="bg-white border-emerald-200 h-9 rounded-lg pr-8 font-bold text-emerald-800 text-sm"
                  value={form.diameter}
                  onChange={e => set('diameter', e.target.value)}
                  placeholder="3.5"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500">mm</span>
              </div>
            </div>
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-[1.25rem] space-y-1.5">
              <label className="text-[9px] font-black text-teal-700 uppercase tracking-wider block">Uzunlik</label>
              <div className="relative">
                <Input
                  type="number" step="0.1"
                  className="bg-white border-teal-200 h-9 rounded-lg pr-8 font-bold text-teal-800 text-sm"
                  value={form.length}
                  onChange={e => set('length', e.target.value)}
                  placeholder="10"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-teal-500">mm</span>
              </div>
            </div>
          </div>

          {/* Lot & Suyak */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-slate-400 text-[9px] font-black uppercase tracking-[0.1em] ml-1 mb-1.5 block">Lot #</label>
              <Input
                className="bg-white border-slate-200 h-10 rounded-xl font-mono font-bold text-sm"
                value={form.lot_number}
                onChange={e => set('lot_number', e.target.value)}
                placeholder="LOT-123"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[9px] font-black uppercase tracking-[0.1em] ml-1 mb-1.5 block">Suyak turi</label>
              <Select value={form.bone_type} onValueChange={v => set('bone_type', v)}>
                <SelectTrigger className="bg-white border-slate-200 h-10 rounded-xl font-bold text-sm">
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
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-[1.25rem] space-y-1.5">
              <label className="text-[9px] font-black text-amber-700 uppercase tracking-wider block">Torque</label>
              <div className="relative">
                <Input
                  type="number"
                  className="bg-white border-amber-200 h-9 rounded-lg pr-10 font-bold text-amber-800 text-sm"
                  value={form.torque}
                  onChange={e => set('torque', e.target.value)}
                  placeholder="35"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-500">Ncm</span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-[1.25rem] space-y-1.5">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider block">ISQ</label>
              <Input
                type="number"
                className="bg-white border-slate-200 h-9 rounded-lg font-bold text-slate-800 text-sm"
                value={form.isq}
                onChange={e => set('isq', e.target.value)}
                placeholder="70"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-400 text-[9px] font-black uppercase tracking-[0.1em] ml-1 mb-1.5 block">Qo'shimcha izoh (ixtiyoriy)</label>
            <textarea
              className="w-full bg-white border border-slate-200 rounded-[1.25rem] p-3 text-sm font-medium text-slate-700 placeholder:text-slate-300 min-h-[70px] resize-none outline-none focus:border-emerald-400 transition-colors"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Muolaja haqida qisqacha..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-500 bg-white cursor-pointer transition-colors hover:bg-slate-50"
          >
            Bekor
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black uppercase tracking-wider text-xs shadow-md border-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" /> Saqlash
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
