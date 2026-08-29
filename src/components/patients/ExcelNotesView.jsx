import { useState, useMemo, memo } from 'react';
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
      toast.error("Iltimos, eslatma matnini kiriting");
      return;
    }

    const newNote = {
      id: `note-${Date.now()}`,
      category: newNoteCategory,
      text: newNoteText.trim(),
      author: "Shifokor",
      date: new Date().toISOString(),
    };

    const updated = [newNote, ...notesList];
    saveNotes(updated);
    setNewNoteText('');
    toast.success("Eslatma qo'shildi");
  };

  const handleDeleteNote = (id) => {
    const updated = notesList.filter(n => n.id !== id);
    saveNotes(updated);
    toast.success("Eslatma o'chirildi");
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
          <span>OGOHLANTIRISH</span>
        </span>
      );
    }
    if (cat === 'clinical') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
          <Activity className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Klinik tashxis</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px]">
        <FileText className="w-3 h-3 text-slate-600 shrink-0" />
        <span>Umumiy eslatma</span>
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
            <span>JAMI QAYDLAR: <b className="text-slate-900 font-black">{notesList.length} ta</b></span>
            <span className="text-slate-300">|</span>
            <span>MUHIM OGOHLANTIRISHLAR: <b className="text-rose-600 font-black">{notesList.filter(n => n.category === 'warning').length} ta</b></span>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Eslatma matni, muallif qidirish..."
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
                { id: 'clinical', label: 'Klinik' },
                { id: 'warning', label: 'Diqqat' },
                { id: 'general', label: 'Umumiy' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setCategoryFilter(f.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                    categoryFilter === f.id
                      ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-black"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDensity(d => d === 'compact' ? 'normal' : 'compact')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              {density === 'compact' ? '☷ Ixcham' : '☰ Keng'}
            </button>
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
            <option value="clinical">🔬 Klinik Tashxis / Reja</option>
            <option value="warning">⚠️ Diqqat / Ogohlantirish</option>
            <option value="general">📝 Umumiy Eslatma</option>
          </select>
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
            placeholder="Yangi klinik yoki ma'muriy eslatma yozing (Enter bosing)..."
            className="flex-1 w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
          />
          <button
            onClick={handleAddNote}
            className="w-full sm:w-auto px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Kiritish</span>
          </button>
        </div>
      </div>

      {/* ══ EXCEL SPREADSHEET TABLE ══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse text-left font-sans text-xs">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10.5px]">
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 bg-slate-200/60 font-mono">№</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[130px]">Kategoriya</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[280px]">Eslatma / Qayd Matni</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[120px]">Muallif</th>
                <th 
                  className="py-2.5 px-3 border-r border-slate-200 font-mono cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[120px]"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>Sana & Vaqt</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center w-16">O'chirish</th>
              </tr>
            </thead>
            <tbody>
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic bg-slate-50/50">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Eslatmalar topilmadi.
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note, idx) => {
                  const dateStr = note.date ? new Date(note.date).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

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
                        "border-r border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-100/40 text-[11px]",
                        density === 'compact' ? 'py-2 px-2' : 'py-3 px-3'
                      )}>
                        {idx + 1}
                      </td>

                      {/* Category */}
                      <td className={cn("border-r border-slate-200", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                        {getCategoryBadge(note.category)}
                      </td>

                      {/* Text */}
                      <td className={cn("border-r border-slate-200 font-medium text-slate-800", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                        {note.text}
                      </td>

                      {/* Author */}
                      <td className={cn("border-r border-slate-200 text-slate-600 font-medium", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{note.author}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className={cn("border-r border-slate-200 font-mono text-slate-600", density === 'compact' ? 'py-2 px-3' : 'py-3 px-3')}>
                        {dateStr}
                      </td>

                      {/* Action */}
                      <td className={cn("text-center", density === 'compact' ? 'py-1.5 px-2' : 'py-2 px-2')}>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
