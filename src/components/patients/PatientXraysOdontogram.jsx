import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Image, Trash2, Loader2, ZoomIn, Upload, X,
  Camera, Info
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Tish ma'lumotlari (FDI raqamlar bilan)
// ──────────────────────────────────────────────────────────────────────────────
const UPPER_RIGHT = [
  { id: 'ur8', fdi: 18, src: 'kamron/tepa_ong_8' },
  { id: 'ur7', fdi: 17, src: 'kamron/tepa_ong_7' },
  { id: 'ur6', fdi: 16, src: 'kamron/tepa_ong_6' },
  { id: 'ur5', fdi: 15, src: 'kamron/tepa_ong_5' },
  { id: 'ur4', fdi: 14, src: 'kamron/tepa_ong_4' },
  { id: 'ur3', fdi: 13, src: 'kamron/tepa_ong_3' },
  { id: 'ur2', fdi: 12, src: 'kamron/tepa_ong_2' },
  { id: 'ur1', fdi: 11, src: 'kamron/tepa_ong_1' },
];
const UPPER_LEFT = [
  { id: 'ul1', fdi: 21, src: 'kamron/tepa_chap_1' },
  { id: 'ul2', fdi: 22, src: 'kamron/tepa_chap_2' },
  { id: 'ul3', fdi: 23, src: 'kamron/tepa_chap_3' },
  { id: 'ul4', fdi: 24, src: 'kamron/tepa_chap_4' },
  { id: 'ul5', fdi: 25, src: 'kamron/tepa_chap_5' },
  { id: 'ul6', fdi: 26, src: 'kamron/tepa_chap_6' },
  { id: 'ul7', fdi: 27, src: 'kamron/tepa_chap_7' },
  { id: 'ul8', fdi: 28, src: 'kamron/tepa_chap_8' },
];
const LOWER_RIGHT = [
  { id: 'lr8', fdi: 48, src: 'kamron/pas_ong_8' },
  { id: 'lr7', fdi: 47, src: 'kamron/pas_ong_7' },
  { id: 'lr6', fdi: 46, src: 'kamron/pas_ong_6' },
  { id: 'lr5', fdi: 45, src: 'kamron/pas_ong_5' },
  { id: 'lr4', fdi: 44, src: 'kamron/pas_ong_4' },
  { id: 'lr3', fdi: 43, src: 'kamron/pas_ong_3' },
  { id: 'lr2', fdi: 42, src: 'kamron/pas_ong_2' },
  { id: 'lr1', fdi: 41, src: 'kamron/pas_ong_1' },
];
const LOWER_LEFT = [
  { id: 'll1', fdi: 31, src: 'kamron/pas_chap_1' },
  { id: 'll2', fdi: 32, src: 'kamron/pas_chap_2' },
  { id: 'll3', fdi: 33, src: 'kamron/pas_chap_3' },
  { id: 'll4', fdi: 34, src: 'kamron/pas_chap_4' },
  { id: 'll5', fdi: 35, src: 'kamron/pas_chap_5' },
  { id: 'll6', fdi: 36, src: 'kamron/pas_chap_6' },
  { id: 'll7', fdi: 37, src: 'kamron/pas_chap_7' },
  { id: 'll8', fdi: 38, src: 'kamron/pas_chap_8' },
];
const UPPER_RIGHT_CHILD = [
  { id: 'ur5c', fdi: 55, src: 'kamron/tepa_ong_5' },
  { id: 'ur4c', fdi: 54, src: 'kamron/tepa_ong_4' },
  { id: 'ur3c', fdi: 53, src: 'kamron/tepa_ong_3' },
  { id: 'ur2c', fdi: 52, src: 'kamron/tepa_ong_2' },
  { id: 'ur1c', fdi: 51, src: 'kamron/tepa_ong_1' },
];
const UPPER_LEFT_CHILD = [
  { id: 'ul1c', fdi: 61, src: 'kamron/tepa_chap_1' },
  { id: 'ul2c', fdi: 62, src: 'kamron/tepa_chap_2' },
  { id: 'ul3c', fdi: 63, src: 'kamron/tepa_chap_3' },
  { id: 'ul4c', fdi: 64, src: 'kamron/tepa_chap_4' },
  { id: 'ul5c', fdi: 65, src: 'kamron/tepa_chap_5' },
];
const LOWER_RIGHT_CHILD = [
  { id: 'lr5c', fdi: 85, src: 'kamron/pas_ong_5' },
  { id: 'lr4c', fdi: 84, src: 'kamron/pas_ong_4' },
  { id: 'lr3c', fdi: 83, src: 'kamron/pas_ong_3' },
  { id: 'lr2c', fdi: 82, src: 'kamron/pas_ong_2' },
  { id: 'lr1c', fdi: 81, src: 'kamron/pas_ong_1' },
];
const LOWER_LEFT_CHILD = [
  { id: 'll1c', fdi: 71, src: 'kamron/pas_chap_1' },
  { id: 'll2c', fdi: 72, src: 'kamron/pas_chap_2' },
  { id: 'll3c', fdi: 73, src: 'kamron/pas_chap_3' },
  { id: 'll4c', fdi: 74, src: 'kamron/pas_chap_4' },
  { id: 'll5c', fdi: 75, src: 'kamron/pas_chap_5' },
];

const ALL_ADULT = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT];
const ALL_CHILD = [...UPPER_RIGHT_CHILD, ...UPPER_LEFT_CHILD, ...LOWER_RIGHT_CHILD, ...LOWER_LEFT_CHILD];

// ──────────────────────────────────────────────────────────────────────────────
// Ana komponent
// ──────────────────────────────────────────────────────────────────────────────
export default function PatientXraysOdontogram({ patientId }) {
  const [xrays, setXrays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientType, setPatientType] = useState('adult');

  // Tanlangan tish (panel ko'rish uchun)
  const [activeTooth, setActiveTooth]   = useState(null); // { id, fdi }
  const [hoveredTooth, setHoveredTooth] = useState(null);

  // Upload modal
  const [uploadOpen,   setUploadOpen]   = useState(false);
  const [uploadTooth,  setUploadTooth]  = useState(null); // { id, fdi }
  const [description,  setDescription]  = useState('');
  const [uploading,    setUploading]    = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of files
  const [previewUrls,   setPreviewUrls]   = useState([]);   // Array of dataURLs
  const fileInputRef = useRef(null);

  // Viewer modal
  const [viewerXray, setViewerXray] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // ── Ma'lumotlarni yuklash ──────────────────────────────────────────────────
  const loadXrays = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Xray.filter(
        { patient_id: patientId },
        '-created_date',
        200
      );
      setXrays(data || []);
    } catch (err) {
      console.error('Rentgen yuklashda xato:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { loadXrays(); }, [loadXrays]);

  // ── Yordamchi funksiyalar ─────────────────────────────────────────────────
  const xraysForTooth = (toothId) =>
    xrays.filter(x => x.tooth_number === String(toothId));

  const xraysGeneral = () =>
    xrays.filter(x => !x.tooth_number || x.tooth_number === 'all');


  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Limit to 6 files total
    const totalSelected = [...selectedFiles, ...files].slice(0, 6);
    setSelectedFiles(totalSelected);

    const newPreviews = [];
    totalSelected.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === totalSelected.length) {
          setPreviewUrls(newPreviews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const performUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    try {
      const fdiValue = uploadTooth ? String(uploadTooth.fdi) : 'all';
      const today = new Date().toISOString().split('T')[0];
      
      // Parallel upload
      await Promise.all(previewUrls.map((pUrl, idx) => {
        return base44.entities.Xray.create({
          patient_id:   patientId,
          image_url:    pUrl,
          description:  description.trim() || (uploadTooth ? `${uploadTooth.fdi}-tish rentgeni (${idx + 1})` : `Umumiy rentgen (${idx + 1})`),
          tooth_number: fdiValue,
          date: today,
        });
      }));
      
      setDescription('');
      setSelectedFiles([]);
      setPreviewUrls([]);
      setUploadOpen(false);
      await loadXrays();
    } catch (err) {
      console.error('Yuklashda xato:', err);
      alert('Yuklashda xato yuz berdi');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openUpload = (tooth) => {
    setUploadTooth(tooth);
    setDescription('');
    setSelectedFiles([]);
    setPreviewUrls([]);
    setUploadOpen(true);
  };

  const deleteXray = useCallback(async (id) => {
    if (!confirm("Rentgenni o'chirishni tasdiqlaysizmi?")) return;
    setDeletingId(id);
    try {
      await base44.entities.Xray.delete(id);
      await loadXrays();
      if (viewerXray?.id === id) setViewerXray(null);
    } catch (err) {
      console.error("O'chirishda xato:", err);
    } finally {
      setDeletingId(null);
    }
  }, [loadXrays, viewerXray]);

  // ── Tish kartochkasi ───────────────────────────────────────────────────────
  const renderTooth = (toothObj) => {
    const { id, fdi, src } = toothObj;
    const isActive  = activeTooth?.id === id;
    const isHovered = hoveredTooth === id;
    const count = xraysForTooth(fdi).length;

    return (
      <div
        key={id}
        className="flex flex-col items-center gap-0.5 sm:gap-1"
        onMouseEnter={() => setHoveredTooth(id)}
        onMouseLeave={() => setHoveredTooth(null)}
      >
        {/* FDI raqam */}
        <span className={`text-[8px] sm:text-[9px] font-bold transition-colors ${
          isActive ? 'text-cyan-600' : count > 0 ? 'text-emerald-600' : 'text-slate-400'
        }`}>
          {fdi}
        </span>

        {/* Tish tugmasi */}
        <button
          type="button"
          onClick={() => setActiveTooth(isActive ? null : { id, fdi, src })}
          className={`relative inline-flex items-center justify-center p-1 sm:p-1.5 transition-all duration-200 rounded-lg sm:rounded-xl border-2 ${
            isActive
              ? 'border-cyan-500 bg-cyan-50 shadow-lg shadow-cyan-200 scale-110 z-10'
              : count > 0
                ? 'border-emerald-400 bg-emerald-50 shadow-sm hover:scale-105'
                : isHovered
                  ? 'border-cyan-300 bg-cyan-50/50 scale-105'
                  : 'border-slate-200 bg-white hover:border-cyan-300'
          }`}
          title={`${fdi}-tish — bosib rentgen ko'ring yoki yuklang`}
        >
          <img
            src={`/teeth/${src}.png`}
            alt={`Tish ${fdi}`}
            className="w-6 h-8 sm:w-8 sm:h-10 object-contain pointer-events-none"
            draggable={false}
          />

          {/* Rentgen soni badge */}
          {count > 0 && (
            <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black shadow-sm ${
              isActive ? 'bg-cyan-500 text-white' : 'bg-emerald-500 text-white'
            }`}>
              {count}
            </span>
          )}
        </button>
      </div>
    );
  };

  const renderQuadrant = (teeth, label) => (
    <div className="min-w-max">
      <p className="text-[8px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-1 sm:mb-2">
        {label}
      </p>
      <div className={`grid ${teeth.length === 8 ? 'grid-cols-8' : 'grid-cols-5'} gap-0.5 sm:gap-1.5 justify-items-center`}>
        {teeth.map(t => renderTooth(t))}
      </div>
    </div>
  );

  // ── Aktiv tish panel ───────────────────────────────────────────────────────
  const toothXrays = activeTooth ? xraysForTooth(activeTooth.fdi) : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Tish diagrammasi ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">

        {/* Sarlavha + toggle */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <span className="text-base">🦷</span>
            <h3 className="text-sm font-bold text-slate-800">
              Tish diagrammasi – Rentgen yuklash
            </h3>
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => { setPatientType('adult'); setActiveTooth(null); }}
              className={`px-3 py-1 rounded-md transition-all ${
                patientType === 'adult' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
              }`}
            >
              🧑 Kattalar
            </button>
            <button
              onClick={() => { setPatientType('child'); setActiveTooth(null); }}
              className={`px-3 py-1 rounded-md transition-all ${
                patientType === 'child' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
              }`}
            >
              👶 Bolalar
            </button>
          </div>
        </div>

        {/* Yuqori jag' */}
        <div className="px-3 pt-4 pb-1">
          <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest text-center mb-2">
            ▲ Yuqori jag'
          </div>
          <div className="overflow-x-auto touch-pan-x">
            <div className="flex w-max mx-auto gap-2 sm:gap-5 pb-1">
              {renderQuadrant(
                patientType === 'adult' ? UPPER_RIGHT : UPPER_RIGHT_CHILD,
                patientType === 'adult' ? "O'ng (18–11)" : "O'ng (55–51)"
              )}
              <div className="w-px bg-slate-200 self-stretch my-2 shrink-0" />
              {renderQuadrant(
                patientType === 'adult' ? UPPER_LEFT : UPPER_LEFT_CHILD,
                patientType === 'adult' ? 'Chap (21–28)' : 'Chap (61–65)'
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-dashed border-slate-200 mx-4" />

        {/* Pastki jag' */}
        <div className="px-3 pt-2 pb-4">
          <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-center mb-2">
            ▼ Pastki jag'
          </div>
          <div className="overflow-x-auto touch-pan-x">
            <div className="flex w-max mx-auto gap-2 sm:gap-5 pb-1">
              {renderQuadrant(
                patientType === 'adult' ? LOWER_RIGHT : LOWER_RIGHT_CHILD,
                patientType === 'adult' ? "O'ng (48–41)" : "O'ng (85–81)"
              )}
              <div className="w-px bg-slate-200 self-stretch my-2 shrink-0" />
              {renderQuadrant(
                patientType === 'adult' ? LOWER_LEFT : LOWER_LEFT_CHILD,
                patientType === 'adult' ? 'Chap (31–38)' : 'Chap (71–75)'
              )}
            </div>
          </div>
        </div>

        {/* Hint */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-50 px-4 py-2 border-t border-slate-100">
          <Info className="w-3 h-3 shrink-0" />
          <span>Rentgen yuklash yoki ko'rish uchun tishga bosing. Yashil raqam — shu tishda rentgen bor.</span>
        </div>
      </div>

      {/* ── Aktiv tish paneli ── */}
      {activeTooth && (
        <div className="bg-white rounded-2xl border border-cyan-200 shadow-lg overflow-hidden">
          {/* Panel sarlavhasi */}
          <div className="flex items-center justify-between px-4 py-3 bg-cyan-50 border-b border-cyan-200">
            <div className="flex items-center gap-3">
              <img
                src={`/teeth/${activeTooth.src}.png`}
                alt={`Tish ${activeTooth.fdi}`}
                className="w-8 h-10 object-contain"
              />
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  {activeTooth.fdi}-tish rentgenlari
                </h4>
                <p className="text-xs text-slate-500">
                  {toothXrays.length > 0
                    ? `${toothXrays.length} ta rentgen mavjud`
                    : 'Hali rentgen yuklanmagan'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => openUpload(activeTooth)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8 px-3 flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                Yuklash
              </Button>
              <button
                onClick={() => setActiveTooth(null)}
                className="p-1.5 rounded-lg hover:bg-cyan-100 transition-colors text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rentgenlar grid */}
          <div className="p-4">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : toothXrays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Camera className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm font-semibold text-slate-400">Rentgen rasmlari yo'q</p>
                <p className="text-xs text-slate-300 mt-1">
                  "Yuklash" tugmasini bosib rentgen qo'shing
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {toothXrays.map(xray => (
                  <XrayCard
                    key={xray.id}
                    xray={xray}
                    deletingId={deletingId}
                    onView={() => setViewerXray(xray)}
                    onDelete={() => deleteXray(xray.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Umumiy (tishsiz) rentgenlar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-slate-500" />
            <h4 className="text-sm font-bold text-slate-700">Umumiy rentgenlar</h4>
            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {xraysGeneral().length}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openUpload(null)}
            className="text-xs h-8 px-3 flex items-center gap-1 border-slate-200"
          >
            <Upload className="w-3.5 h-3.5" />
            Yuklash
          </Button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-36 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : xraysGeneral().length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Image className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Umumiy rentgen yo'q</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {xraysGeneral().map(xray => (
                <XrayCard
                  key={xray.id}
                  xray={xray}
                  deletingId={deletingId}
                  onView={() => setViewerXray(xray)}
                  onDelete={() => deleteXray(xray.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Yuklash modali ─────────────────────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={() => { setUploadOpen(false); setDescription(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-600" />
              {uploadTooth
                ? `${uploadTooth.fdi}-tish uchun rentgen yuklash`
                : 'Umumiy rentgen yuklash'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="xray-desc" className="text-sm font-semibold">Tavsif (ixtiyoriy)</Label>
              <Input
                id="xray-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Rentgen haqida eslatma..."
                disabled={uploading}
                className="mt-1.5"
              />
            </div>

            {/* Fayl tanlash zona */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer overflow-hidden min-h-[160px] flex flex-col items-center justify-center ${
                uploading
                  ? 'border-slate-200 bg-slate-50'
                  : previewUrls.length > 0 
                    ? 'border-emerald-300 bg-emerald-50/20'
                    : 'border-cyan-300 hover:border-cyan-500 hover:bg-cyan-50/40'
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                  <p className="text-sm text-slate-500 font-medium">Yuklanmoqda...</p>
                </div>
              ) : previewUrls.length > 0 ? (
                <div className="w-full">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {previewUrls.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-emerald-100 shadow-sm">
                        <img src={url} alt="Xray Preview" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-emerald-600 font-bold">
                    {previewUrls.length} ta rasm tanlandi. Yana qo'shish uchun bosing (max 6).
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="w-10 h-10 text-cyan-400" />
                  <p className="text-sm font-semibold text-slate-600">Fayllarni tanlash uchun bosing</p>
                  <p className="text-xs text-slate-400">Har xil rakursdan 6 tagacha rasm</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </div>

            {/* Yuklash tugmasi */}
            <Button
              onClick={performUpload}
              disabled={uploading || selectedFiles.length === 0}
              className={`w-full h-12 rounded-xl font-bold transition-all shadow-lg ${
                selectedFiles.length > 0 
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-200' 
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Yuklanmoqda...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  {selectedFiles.length > 0 ? `${selectedFiles.length} ta rasmni yuklash` : 'Yuklash'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Rasm viewer modali ── */}
      <Dialog open={!!viewerXray} onOpenChange={() => setViewerXray(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          {viewerXray && (
            <div className="flex flex-col h-full">
              <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between pr-10">
                <div className="flex-1">
                  <DialogTitle className="text-base truncate">
                    {viewerXray.description || 'Rentgen rasmi'}
                  </DialogTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {viewerXray.tooth_number && viewerXray.tooth_number !== 'all'
                      ? `${viewerXray.tooth_number}-tish • `
                      : ''}
                    {new Date(viewerXray.date).toLocaleDateString('uz-UZ', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => deleteXray(viewerXray.id)}
                  disabled={deletingId === viewerXray.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all mr-2"
                >
                  {deletingId === viewerXray.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                  <span className="text-[11px] font-bold">O'chirish</span>
                </button>
              </DialogHeader>
              <div className="flex-1 overflow-auto p-4 bg-black/5 flex items-center justify-center">
                <img
                  src={viewerXray.image_url}
                  alt="Rentgen"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xl"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Rentgen kartochkasi (mini komponent)
// ──────────────────────────────────────────────────────────────────────────────
function XrayCard({ xray, deletingId, onView, onDelete }) {
  return (
    <div className="group relative rounded-xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-slate-50">
      <img
        src={xray.image_url}
        alt={xray.description || 'Rentgen'}
        className="w-full h-32 object-cover cursor-pointer"
        onClick={onView}
      />
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={onView}
          className="w-9 h-9 rounded-xl bg-white/90 flex items-center justify-center text-slate-700 hover:bg-white"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={deletingId === xray.id}
          className="w-9 h-9 rounded-xl bg-red-500/90 flex items-center justify-center text-white hover:bg-red-600"
        >
          {deletingId === xray.id
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
      {/* Info */}
      <div className="px-2 py-1.5 bg-white border-t border-slate-100">
        <p className="text-[10px] text-slate-500 truncate">
          {xray.description || "Tavsif yo'q"}
        </p>
        <p className="text-[9px] text-slate-400">
          {new Date(xray.date).toLocaleDateString('uz-UZ')}
        </p>
      </div>
    </div>
  );
}
