import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  Camera, Upload, Search,
  X, Eye, Download, Trash2, LayoutGrid, 
  Table as TableIcon, Scan, ScanLine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { XrayIcon } from '@/components/ui/Icons';
import EmptyState from '../ui/EmptyState';

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
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'photo' | 'xray' | 'ct' | 'panoramic'
  const [viewMode, setViewMode] = useState('grid'); // 'table' | 'grid' — default grid for mobile
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const filteredPhotos = useMemo(() => {
    let list = [...xrays];

    if (typeFilter !== 'all') {
      list = list.filter(p => {
        const t = (p.type || '').toLowerCase();
        if (typeFilter === 'photo') {
          return !t || t === 'photo' || t === 'image' || t === 'foto';
        }
        if (typeFilter === 'xray') {
          return t.includes('xray') || t.includes('rentgen') || (!t && (p.notes || p.description || '').toLowerCase().includes('rentgen'));
        }
        if (typeFilter === 'ct') {
          return t.includes('ct') || t.includes('kt');
        }
        if (typeFilter === 'panoramic') {
          return t.includes('panoramic') || t.includes('optg') || t.includes('pano');
        }
        return t === typeFilter.toLowerCase();
      });
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q)) ||
        (p.tooth_number && String(p.tooth_number).includes(q)) ||
        (p.doctor_name && p.doctor_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [xrays, search, typeFilter]);

  const handleDelete = async (photo) => {
    const confirmMsg = language === 'ru' ? "Вы действительно хотите удалить этот снимок?" : language === 'en' ? "Are you sure you want to delete this image?" : "Haqiqatan ham ushbu tasvirni o'chirmoqchimisiz?";
    if (!confirm(confirmMsg)) return;
    try {
      await base44.entities.Xray.delete(photo.id);
      toast.success(language === 'ru' ? "Снимок удален" : language === 'en' ? "Image deleted" : "Tasvir muvaffaqiyatli o'chirildi");
      if (onReload) onReload();
    } catch {
      toast.error(language === 'ru' ? "Ошибка при удалении" : "O'chirishda xatolik yuz berdi");
    }
  };

  const getTypeLabel = (type) => {
    const tVal = (type || 'photo').toLowerCase();
    if (tVal.includes('xray') || tVal.includes('rentgen')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold text-[10px]">
          <XrayIcon className="w-3 h-3 text-cyan-600 shrink-0" />
          <span>{language === 'ru' ? 'Рентген' : language === 'en' ? 'X-Ray' : 'Rentgen'}</span>
        </span>
      );
    }
    if (tVal.includes('ct') || tVal.includes('kt')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px]">
          <Scan className="w-3 h-3 text-purple-600 shrink-0" />
          <span>{language === 'ru' ? '3D КТ снимок' : language === 'en' ? '3D CT Scan' : '3D KT tasvir'}</span>
        </span>
      );
    }
    if (tVal.includes('panoramic') || tVal.includes('optg')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]">
          <ScanLine className="w-3 h-3 text-indigo-600 shrink-0" />
          <span>{language === 'ru' ? 'Панорамный ОПТГ' : language === 'en' ? 'Panoramic OPTG' : 'Panoramik OPTG'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px]">
        <Camera className="w-3 h-3 text-slate-600 shrink-0" />
        <span>{language === 'ru' ? 'Фото' : language === 'en' ? 'Photo' : 'Foto'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* ── TOOLBAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={language === 'ru' ? "Поиск..." : language === 'en' ? "Search..." : "Qidirish..."}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 focus:border-[#1499AD] transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 text-xs">✕</button>
            )}
          </div>
          {/* View Toggle */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 gap-0.5 shrink-0">
            <button onClick={() => setViewMode('grid')} className={cn("p-2 rounded-lg text-xs font-bold transition-all cursor-pointer", viewMode === 'grid' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('table')} className={cn("p-2 rounded-lg text-xs font-bold transition-all cursor-pointer", viewMode === 'table' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30"
          >
            <option value="all">{language === 'ru' ? "Все типы" : language === 'en' ? "All types" : "Barcha turlar"}</option>
            <option value="photo">{language === 'ru' ? "Клинические фото" : "Klinik Rasmlar"}</option>
            <option value="xray">{language === 'ru' ? "Рентген снимки" : "Rentgen Tasvirlar"}</option>
            <option value="ct">{language === 'ru' ? "3D КТ томография" : "3D KT Tomografiya"}</option>
            <option value="panoramic">{language === 'ru' ? "Панорамный" : "Panoramik OPTG"}</option>
          </select>
          {/* Upload Button */}
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1499AD] hover:bg-[#117a8c] text-white rounded-xl text-sm font-black shadow-sm shadow-[#1499AD]/20 transition-all cursor-pointer whitespace-nowrap shrink-0">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">+ {language === 'ru' ? "Загрузить" : language === 'en' ? "Upload" : "Rasm"}</span>
            <span className="sm:hidden">+</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={onPhotoUpload} />
          </label>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-left font-sans text-xs">
              <thead>
                <tr className="bg-slate-100/95 border-b border-slate-300 text-slate-800 font-extrabold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/70 font-mono">№</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-16">{language === 'ru' ? "Миниатюра" : language === 'en' ? "Thumbnail" : "Miniatyura"}</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[200px]">{language === 'ru' ? "Файл / Примечание" : language === 'en' ? "File / Notes" : "Fayl / Izoh"}</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">{language === 'ru' ? "Тип снимка" : language === 'en' ? "Image Type" : "Tasvir Turi"}</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-mono text-center w-20">{language === 'ru' ? "Зуб #" : language === 'en' ? "Tooth #" : "Tish #"}</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-mono min-w-[120px]">{language === 'ru' ? "Дата загрузки" : language === 'en' ? "Upload Date" : "Yuklangan sana"}</th>
                  <th className="py-2.5 px-3 text-center min-w-[100px]">{language === 'ru' ? "Действия" : language === 'en' ? "Actions" : "Amallar"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhotos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 bg-slate-50/40">
                      <EmptyState
                        icon={Camera}
                        variant="blue"
                        title={t('patientProfile.photos.emptyTitle') || "Rentgen va rasmlar yo'q"}
                        description={
                          search || typeFilter !== 'all'
                            ? "Qidiruv yoki tanlangan filtr bo'yicha rasmlar topilmadi."
                            : (t('patientProfile.noPhotosFound') || "Bu bemor uchun hali rentgen yoki klinik suratlar yuklanmagan.")
                        }
                        secondaryActionText={(search || typeFilter !== 'all') ? "Filtrlarni tozalash" : undefined}
                        onSecondaryAction={() => { setSearch(''); setTypeFilter('all'); }}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredPhotos.map((photo, idx) => {
                    const imgUrl = photo.image_url || photo.url || photo.image;
                    const photoTitle = photo.notes || photo.description || photo.title || (language === 'ru' ? `Клинический снимок #${idx + 1}` : `Klinik tasvir #${idx + 1}`);
                    const rawDate = photo.created_date || photo.date || photo.created_at;
                    const d = rawDate ? new Date(rawDate) : new Date();
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    const dateStr = !isNaN(d.getTime()) ? `${day}.${month}.${year}` : '—';

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
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt="thumb"
                              className="w-10 h-10 object-cover rounded border border-slate-200 shadow-2xs mx-auto cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => setLightboxPhoto(photo)}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                              <Camera className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* Notes / Title */}
                        <td className="border-r border-slate-200 font-bold text-slate-800 py-2 px-3">
                          {photoTitle}
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
                            {imgUrl && (
                              <button
                                onClick={() => setLightboxPhoto(photo)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                                title={language === 'ru' ? "Просмотреть" : "Kattalashtirib ko'rish"}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {imgUrl && (
                              <a
                                href={imgUrl}
                                download={`Bemor_${patient?.full_name}_rasm.jpg`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                                title={language === 'ru' ? "Скачать" : "Yuklab olish"}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDelete(photo)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                              title={language === 'ru' ? "Удалить" : "O'chirish"}
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
            {filteredPhotos.map((photo, idx) => {
              const imgUrl = photo.image_url || photo.url || photo.image;
              const photoTitle = photo.notes || photo.description || photo.title || (language === 'ru' ? `Снимок #${idx + 1}` : `Rasm #${idx + 1}`);

              return (
                <div
                  key={photo.id || idx}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setLightboxPhoto(photo)}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={photoTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Camera className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end text-white text-[10px]">
                    <span className="font-bold truncate">{photoTitle}</span>
                    <span className="text-[9px] text-slate-300">{photo.tooth_number ? `#${photo.tooth_number}` : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ LIGHTBOX MODAL ══ */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black text-white rounded-full transition-colors z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxPhoto.image_url || lightboxPhoto.url || lightboxPhoto.image}
              alt="fullscreen"
              className="max-h-[75vh] object-contain rounded-xl"
            />
            <div className="mt-3 text-center">
              <p className="text-xs font-bold text-slate-800">{lightboxPhoto.notes || lightboxPhoto.description || (language === 'ru' ? "Клинический снимок" : "Klinik tasvir")}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{lightboxPhoto.tooth_number ? `Tish #${lightboxPhoto.tooth_number}` : ''}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ExcelPhotosView);
