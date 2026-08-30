import { useState, useMemo, memo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  FileText, Plus, Search,
  ArrowUpDown, Trash2, User, AlertTriangle, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * ExcelNotesView Component
 * High-productivity Excel Spreadsheet View for Patient Clinical & Administrative Notes.
 */
function ExcelNotesView({
  patient: _patient,
  patientId,
}) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'clinical' | 'warning' | 'general'
  const [sortAsc, setSortAsc] = useState(false);
  const [density, setDensity] = useState('compact');

  // Local state for interactive notes
  const [notesList, setNotesList] = useState(() => {
    try {
      const stored = localStorage.getItem(`shifo_patient_notes_${patientId}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: 'note-1',
        category: 'clinical',
        text: "Bemor birinchi tashrifda yuqori tishlardagi sezuvchanlikdan shikoyat qildi.",
        author: "Dr. Shahobiddin",
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'note-2',
        category: 'warning',
        text: "Allergiya: Penitsillin guruhidagi antibiotiklarga sezuvchanlik bor.",
        author: "Administrator",
        date: new Date(Date.now() - 86400000 * 5).toISOString(),
      }
    ];
  });

  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('clinical');

  const saveNotes = (updated) => {
    setNotesList(updated);
    try {
      localStorage.setItem(`shifo_patient_notes_${patientId}`, JSON.stringify(updated));
    } catch {}
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) {
      toast.error(language === 'ru' ? "Пожалуйста, введите текст заметки" : language === 'en' ? "Please enter note text" : "Iltimos, eslatma matnini kiriting");
      return;
    }

    const newNote = {
      id: `note-${Date.now()}`,
      category: newNoteCategory,
      text: newNoteText.trim(),
      author: language === 'ru' ? "Врач" : language === 'en' ? "Doctor" : "Shifokor",
      date: new Date().toISOString(),
    };

    const updated = [newNote, ...notesList];
    saveNotes(updated);
    setNewNoteText('');
    toast.success(language === 'ru' ? "Заметка добавлена" : language === 'en' ? "Note added" : "Eslatma qo'shildi");
  };

  const handleDeleteNote = (id) => {
    const updated = notesList.filter(n => n.id !== id);
    saveNotes(updated);
    toast.success(language === 'ru' ? "Заметка удалена" : language === 'en' ? "Note deleted" : "Eslatma o'chirildi");
  };

  const filteredNotes = useMemo(() => {
    let list = [...notesList];

    if (categoryFilter !== 'all') {
      list = list.filter(n => n.category === categoryFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(n => 
        n.text.toLowerCase().includes(q) ||
        (n.author && n.author.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      const valA = new Date(a.date || 0).getTime();
      const valB = new Date(b.date || 0).getTime();
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [notesList, search, categoryFilter, sortAsc]);

  const getCategoryBadge = (cat) => {
    if (cat === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>{language === 'ru' ? 'ПРЕДУПРЕЖДЕНИЕ' : language === 'en' ? 'WARNING' : 'OGOHLANTIRISH'}</span>
        </span>
      );
    }
    if (cat === 'clinical') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
          <Activity className="w-3 h-3 text-blue-600 shrink-0" />
          <span>{language === 'ru' ? 'Клинический диагноз' : language === 'en' ? 'Clinical diagnosis' : 'Klinik tashxis'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px]">
        <FileText className="w-3 h-3 text-slate-600 shrink-0" />
        <span>{language === 'ru' ? 'Общая заметка' : language === 'en' ? 'General note' : 'Umumiy eslatma'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ══ TOOLBAR CONTROLS & FILTERS ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Action Controls & Filters */}
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === 'ru' ? "Поиск заметки, автора..." : language === 'en' ? "Search note text, author..." : "Eslatma matni, muallif qidirish..."}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
          </div>
        </div>
      </div>

      {/* ══ INLINE QUICK ADD ENTRY ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-3">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <select
            value={newNoteCategory}
            onChange={(e) => setNewNoteCategory(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
          >
            <option value="clinical">{language === 'ru' ? "🔬 Клинический диагноз / План" : language === 'en' ? "🔬 Clinical Diagnosis / Plan" : "🔬 Klinik Tashxis / Reja"}</option>
            <option value="warning">{language === 'ru' ? "⚠️ Внимание / Предупреждение" : language === 'en' ? "⚠️ Warning / Alert" : "⚠️ Diqqat / Ogohlantirish"}</option>
            <option value="general">{language === 'ru' ? "📝 Общая заметка" : language === 'en' ? "📝 General Note" : "📝 Umumiy Eslatma"}</option>
          </select>
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
            placeholder={language === 'ru' ? "Напишите новую клиническую или административную заметку (нажмите Enter)..." : language === 'en' ? "Write a new clinical or admin note (Press Enter)..." : "Yangi klinik yoki ma'muriy eslatma yozing (Enter bosing)..."}
            className="flex-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
          />
          <button
            onClick={handleAddNote}
            className="w-full sm:w-auto px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? "Добавить" : language === 'en' ? "Add Note" : "Kiritish"}</span>
          </button>
        </div>
      </div>

      {/* ══ EXCEL SPREADSHEET TABLE ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-left font-sans text-sm">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-xs">
                <th className="py-3 px-3.5 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[140px]">{language === 'ru' ? "Категория" : language === 'en' ? "Category" : "Kategoriya"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[280px]">{language === 'ru' ? "Текст заметки" : language === 'en' ? "Note Text" : "Eslatma / Qayd Matni"}</th>
                <th className="py-3 px-3.5 border-r border-slate-200 min-w-[120px]">{language === 'ru' ? "Автор" : language === 'en' ? "Author" : "Muallif"}</th>
                <th 
                  className="py-3 px-3.5 border-r border-slate-200 font-mono cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[120px]"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>{t('common.dateTime') || "Sana & Vaqt"}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3.5 text-center w-16">{language === 'ru' ? "Удалить" : language === 'en' ? "Delete" : "O'chirish"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {language === 'ru' ? "Заметки не найдены." : language === 'en' ? "No notes found." : "Eslatmalar topilmadi."}
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note, idx) => {
                  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
                  const dateStr = note.date ? new Date(note.date).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

                  return (
                    <tr
                      key={note.id || idx}
                      className={cn(
                        "border-b border-slate-200/70 hover:bg-sky-50/40 transition-colors",
                        idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                      )}
                    >
                      {/* Row Index */}
                      <td className={cn(
                        "border-r border-slate-200 text-center font-mono font-bold text-slate-500 bg-slate-100/40 text-xs",
                        density === 'compact' ? 'py-3.5 px-3' : 'py-4.5 px-3.5'
                      )}>
                        {idx + 1}
                      </td>

                      {/* Category */}
                      <td className={cn("border-r border-slate-200 text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        {getCategoryBadge(note.category)}
                      </td>

                      {/* Text */}
                      <td className={cn("border-r border-slate-200 font-semibold text-slate-900 text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        {note.text}
                      </td>

                      {/* Author */}
                      <td className={cn("border-r border-slate-200 text-slate-800 font-semibold text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{note.author}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className={cn("border-r border-slate-200 font-mono font-semibold text-slate-700 text-xs sm:text-sm", density === 'compact' ? 'py-3.5 px-3.5' : 'py-4.5 px-4')}>
                        {dateStr}
                      </td>

                      {/* Action */}
                      <td className={cn("text-center", density === 'compact' ? 'py-3 px-3' : 'py-4 px-3.5')}>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={language === 'ru' ? "Удалить" : "O'chirish"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default memo(ExcelNotesView);
