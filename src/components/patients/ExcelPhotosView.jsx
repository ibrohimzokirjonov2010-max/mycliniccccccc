import { useState, useMemo, memo } from 'react';
import { 
  Camera, Upload, Search,
  X, Eye, Download, Trash2, LayoutGrid, 
  Table as TableIcon, Scan, ScanLine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { XrayIcon } from '@/components/ui/Icons';

/**
 * ExcelPhotosView Component
 * High-productivity Excel Spreadsheet View and Gallery for Patient X-Rays & Clinical Media.
 */
function ExcelPhotosView({
  patient,
  xrays = [],
  onPhotoUpload,
  onReload,
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'photo' | 'xray' | 'ct' | 'panoramic'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const filteredPhotos = useMemo(() => {
    let list = [...xrays];

    if (typeFilter !== 'all') {
      list = list.filter(p => (p.type || 'photo').toLowerCase() === typeFilter.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q)) ||
        (p.tooth_number && String(p.tooth_number).includes(q)) ||
        (p.doctor_name && p.doctor_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [xrays, search, typeFilter]);

  const handleDelete = async (photo) => {
    if (!confirm("Haqiqatan ham ushbu tasvirni o'chirmoqchimisiz?")) return;
    try {
      await base44.entities.Xray.delete(photo.id);
      toast.success("Tasvir muvaffaqiyatli o'chirildi");
      if (onReload) onReload();
    } catch {
      toast.error("O'chirishda xatolik yuz berdi");
    }
  };

  const getTypeLabel = (type) => {
    const t = (type || 'photo').toLowerCase();
    if (t.includes('xray') || t.includes('rentgen')) {
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-purple-700">
          <XrayIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>Rentgen (Periapikal)</span>
        </span>
      );
    }
    if (t.includes('ct') || t.includes('3d') || t.includes('kt')) {
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700">
          <Scan className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>3D Tomografiya (KT)</span>
        </span>
      );
    }
    if (t.includes('panoram') || t.includes('opg')) {
      return (
        <span className="inline-flex items-center gap-1.5 font-semibold text-sky-700">
          <ScanLine className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>Panoramik (OPG)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
        <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Bemor fotosi (Intraoral)</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ══ EXCEL SPREADSHEET TOOLBAR ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Formula Bar */}
        <div className="bg-slate-50/90 px-4 py-2 border-b border-slate-200 flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400 font-black shrink-0">
            <span className="text-[#1a73e8] italic font-serif text-sm">fx</span>
            <span>=</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap text-slate-700 overflow-x-auto no-scrollbar">
            <span>JAMI TASVIRLAR: <b className="text-slate-900 font-black">{xrays.length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>FOTOLAR: <b className="text-blue-700 font-black">{xrays.filter(x => x.type === 'photo').length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>RENTGEN / KT: <b className="text-purple-700 font-black">{xrays.filter(x => x.type !== 'photo').length} ta</b></span>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rasm izohi, tish # qidirish..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 gap-0.5">
              {[
                { id: 'all', label: 'Barchasi' },
                { id: 'photo', label: 'Fotolar', icon: Camera, iconColor: 'text-emerald-600' },
                { id: 'xray', label: 'Rentgen & KT', icon: XrayIcon, iconColor: 'text-purple-600' },
              ].map(f => {
                const IconComp = f.icon;
                return (
                  <button
                    key={f.id}
                    onClick={() => setTypeFilter(f.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5",
                      typeFilter === f.id
                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-black"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {IconComp && <IconComp className={cn("w-3 h-3", f.iconColor)} />}
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 gap-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={cn("px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer", viewMode === 'table' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500")}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Jadval</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn("px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer", viewMode === 'grid' ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500")}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Galereya</span>
              </button>
            </div>

            {/* Upload Button */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg text-xs font-black shadow-2xs transition-all cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>+ Rasm Yuklash</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onPhotoUpload} />
            </label>
          </div>
        </div>
      </div>

      {/* ══ VIEW MODE 1: EXCEL SPREADSHEET TABLE ══ */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10.5px]">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-16">Miniatyura</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">Fayl / Izoh</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Tasvir Turi</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center w-20">Tish #</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-mono min-w-[120px]">Yuklangan sana</th>
                  <th className="py-2.5 px-3 text-center min-w-[100px]">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhotos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <XrayIcon className="w-8 h-8 text-slate-300" />
                        <span>Hech qanday rasmlar yoki rentgen tasvirlari topilmadi.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPhotos.map((photo, idx) => {
                    const dateStr = photo.created_date ? new Date(photo.created_date).toLocaleDateString('uz-UZ') : new Date().toLocaleDateString('uz-UZ');

                    return (
                      <tr
                        key={photo.id || idx}
                        className={cn(
                          "border-b border-slate-200/70 hover:bg-sky-50/40 transition-colors",
                          idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                        )}
                      >
                        {/* Row Index */}
                        <td className="border-r border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-100/40 text-[11px] py-2 px-2">
                          {idx + 1}
                        </td>

                        {/* Thumbnail Preview */}
                        <td className="border-r border-slate-200 text-center py-1.5 px-2">
                          <img
                            src={photo.image_url}
                            alt="thumb"
                            className="w-10 h-10 object-cover rounded border border-slate-200 shadow-2xs mx-auto cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setLightboxPhoto(photo)}
                          />
                        </td>

                        {/* Notes / Title */}
                        <td className="border-r border-slate-200 font-bold text-slate-800 py-2 px-3">
                          {photo.notes || `Klinik tasvir #${idx + 1}`}
                        </td>

                        {/* Type */}
                        <td className="border-r border-slate-200 font-medium text-slate-700 py-2 px-3">
                          {getTypeLabel(photo.type)}
                        </td>

                        {/* Tooth # */}
                        <td className="border-r border-slate-200 font-mono font-black text-center text-indigo-700 py-2 px-2">
                          {photo.tooth_number ? `#${photo.tooth_number}` : '—'}
                        </td>

                        {/* Date */}
                        <td className="border-r border-slate-200 font-mono text-slate-600 py-2 px-3">
                          {dateStr}
                        </td>

                        {/* Actions */}
                        <td className="text-center py-1.5 px-2">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setLightboxPhoto(photo)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                              title="Kattalashtirib ko'rish"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={photo.image_url}
                              download={`Bemor_${patient?.full_name}_rasm.jpg`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                              title="Yuklab olish"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleDelete(photo)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ══ VIEW MODE 2: INTERACTIVE GALLERY GRID ══ */
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {filteredPhotos.map((photo, idx) => (
              <div
                key={photo.id || idx}
                className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 cursor-pointer shadow-2xs hover:border-[#1a73e8] transition-all"
                onClick={() => setLightboxPhoto(photo)}
              >
                <img
                  src={photo.image_url}
                  alt={photo.notes || `Rasm ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute top-1 left-1 px-1.5 py-0.2 bg-black/60 text-white rounded text-[9px] font-mono font-bold">
                  #{idx + 1}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-600/80 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="O'chirish"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <img
              src={lightboxPhoto.image_url}
              alt="Preview"
              className="w-full h-full object-contain rounded-xl"
              style={{ maxHeight: '85vh' }}
            />
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ExcelPhotosView);
