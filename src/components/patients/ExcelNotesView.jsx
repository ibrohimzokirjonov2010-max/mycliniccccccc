import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  FileText, Plus, Search,
  Trash2, User, AlertTriangle, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function ExcelNotesView({
  patient: _patient,
  patientId,
}) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const [notesList, setNotesList] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('clinical');
  const [savingNote, setSavingNote] = useState(false);

  const mapNote = useCallback((row) => {
    const category = ['clinical', 'warning', 'general'].includes(row.type) ? row.type : (row.category || 'general');
    return {
      id: row.id,
      category,
      text: row.content || row.text || '',
      author: row.author || (language === 'ru' ? 'Врач' : language === 'en' ? 'Doctor' : 'Shifokor'),
      date: row.created_date || row.created_at || row.date || '',
    };
  }, [language]);

  const loadNotes = useCallback(async () => {
    if (!patientId) return;
    try {
      const rows = await base44.entities.Note.filter({ patient_id: patientId }, '-created_date', 50);
      const mapped = (rows || []).map(mapNote).filter((note) => note.text);
      setNotesList(mapped);
      const key = `shifo_patient_notes_${patientId}`;
      const stored = localStorage.getItem(key);
      if (stored && mapped.length === 0) {
        const local = JSON.parse(stored);
        if (Array.isArray(local) && local.length) {
          for (const note of local) {
            if (!note?.text) continue;
            await base44.entities.Note.create({
              patient_id: patientId,
              content: note.text,
              type: note.category || 'general',
            });
          }
          localStorage.removeItem(key);
          const refreshed = await base44.entities.Note.filter({ patient_id: patientId }, '-created_date', 50);
          setNotesList((refreshed || []).map(mapNote).filter((note) => note.text));
        }
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  }, [patientId, mapNote]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleAddNote = async () => {
    if (!newNoteText.trim()) {
      toast.error(language === 'ru' ? "Введите текст заметки" : "Iltimos, eslatma matnini kiriting");
      return;
    }
    setSavingNote(true);
    try {
      await base44.entities.Note.create({
        patient_id: patientId,
        content: newNoteText.trim(),
        type: newNoteCategory || 'general',
      });
      setNewNoteText('');
      toast.success(language === 'ru' ? "Заметка добавлена" : "Eslatma qo'shildi");
      await loadNotes();
    } catch (error) {
      console.error('Failed to add note:', error);
      toast.error(language === 'ru' ? "Не удалось сохранить" : "Eslatma saqlanmadi");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      await base44.entities.Note.delete(id);
      setNotesList((prev) => prev.filter((note) => note.id !== id));
      toast.success(language === 'ru' ? "Заметка удалена" : "Eslatma o'chirildi");
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error(language === 'ru' ? "Не удалось удалить" : "Eslatma o'chmadi");
    }
  };

  const filteredNotes = useMemo(() => {
    let list = [...notesList];
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
  }, [notesList, search, sortAsc]);

  const getCategoryInfo = (cat) => {
    if (cat === 'warning') return {
      label: language === 'ru' ? 'Предупреждение' : language === 'en' ? 'Warning' : 'Ogohlantirish',
      icon: <AlertTriangle className="w-3 h-3" />,
      cls: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    if (cat === 'clinical') return {
      label: language === 'ru' ? 'Klinik' : language === 'en' ? 'Clinical' : 'Klinik',
      icon: <Activity className="w-3 h-3" />,
      cls: 'bg-blue-50 text-blue-700 border-blue-200'
    };
    return {
      label: language === 'ru' ? 'Общая' : language === 'en' ? 'General' : 'Umumiy',
      icon: <FileText className="w-3 h-3" />,
      cls: 'bg-slate-100 text-slate-700 border-slate-200'
    };
  };

  return (
    <div className="space-y-3">

      {/* ── SEARCH ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === 'ru' ? "Поиск заметки..." : language === 'en' ? "Search note..." : "Eslatma qidirish..."}
            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 focus:border-[#1499AD] transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 text-xs">✕</button>
          )}
        </div>
      </div>

      {/* ── ADD NOTE FORM ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-2.5">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          + {language === 'ru' ? 'Новая заметка' : language === 'en' ? 'New Note' : 'Yangi eslatma'}
        </p>
        <select
          value={newNoteCategory}
          onChange={e => setNewNoteCategory(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 focus:border-[#1499AD] transition-all"
        >
          <option value="clinical">🔬 {language === 'ru' ? 'Клинический диагноз / План' : language === 'en' ? 'Clinical Diagnosis / Plan' : 'Klinik Tashxis / Reja'}</option>
          <option value="warning">⚠️ {language === 'ru' ? 'Предупреждение' : language === 'en' ? 'Warning' : 'Diqqat / Ogohlantirish'}</option>
          <option value="general">📝 {language === 'ru' ? 'Общая заметка' : language === 'en' ? 'General Note' : 'Umumiy Eslatma'}</option>
        </select>
        <textarea
          value={newNoteText}
          onChange={e => setNewNoteText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
          rows={2}
          placeholder={language === 'ru' ? "Напишите заметку (Enter для сохранения)..." : language === 'en' ? "Write a note (Enter to save)..." : "Eslatma yozing (Enter bosing)..."}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 focus:border-[#1499AD] transition-all"
        />
        <button
          type="button"
          onClick={handleAddNote}
          disabled={savingNote}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-sm font-black transition-all active:scale-95 disabled:opacity-60"
        >
          <Plus className="w-4 h-4" />
          {language === 'ru' ? 'Добавить' : language === 'en' ? 'Add Note' : 'Kiritish'}
        </button>
      </div>

      {/* ── NOTES LIST (Mobile + Desktop unified card view) ── */}
      <div className="space-y-2.5">
        {filteredNotes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 py-12 text-center flex flex-col items-center gap-3">
            <FileText className="w-9 h-9 text-slate-200" />
            <p className="text-slate-400 text-sm font-semibold">
              {language === 'ru' ? 'Заметки не найдены' : language === 'en' ? 'No notes found' : 'Eslatmalar topilmadi'}
            </p>
          </div>
        ) : (
          filteredNotes.map((note, idx) => {
            const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'uz-UZ';
            const dateStr = note.date
              ? new Date(note.date).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';
            const catInfo = getCategoryInfo(note.category);

            return (
              <div key={note.id || idx} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold text-[9px] uppercase tracking-wide", catInfo.cls)}>
                      {catInfo.icon}
                      {catInfo.label}
                    </span>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-900 leading-relaxed">{note.text}</p>
                </div>
                <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500">{note.author}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{dateStr}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

export default memo(ExcelNotesView);
