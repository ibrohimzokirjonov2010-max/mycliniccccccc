import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageSquare, Plus, Clock, User, Calendar, 
  CheckCircle2, Send, Phone, Tag, Trash2, Edit2,
  Check, AlertCircle, ArrowRight, UserCheck, Sparkles, X
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

const QUICK_TEMPLATES = [
  "3 kundan keyin qo'ng'iroq qilish",
  "3 kundan keyin klinika boradi",
  "Narx haqida o'ylayapti",
  "Konsultatsiyaga yozildi",
  "Qayta bog'lanish kerak",
  "Telefon ko'tarmadi",
  "Kelishga rozi bo'ldi"
];

const STATUS_OPTIONS = [
  { id: 'new', label: 'Yangi', color: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500' },
  { id: 'contacted', label: "Bog'lanildi", color: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-500' },
  { id: 'qualified', label: 'Qiziqqan', color: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500' },
  { id: 'converted', label: 'Bemor', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500' },
  { id: 'lost', label: 'Rad etildi', color: 'bg-slate-100 text-slate-600 border-slate-200 ring-slate-400' }
];

export function parseLeadNotes(lead) {
  if (!lead) return [];
  if (Array.isArray(lead.notes_history)) return lead.notes_history;
  
  if (typeof lead.notes === 'string' && lead.notes.trim()) {
    try {
      const parsed = JSON.parse(lead.notes);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Legacy single text note
      return [{
        id: 'note_init',
        text: lead.notes,
        created_at: lead.visit_date || lead.created_date || new Date().toISOString(),
        created_by: lead.created_by_name || 'Admin',
        status: lead.status || 'new'
      }];
    }
  }
  return [];
}

export default function LeadNotesModal({ 
  lead, 
  open, 
  onClose, 
  onSaveLead,
  onConvertToPatient 
}) {
  const { language } = useTranslation();
  const { user } = useAuth();
  
  const [notesHistory, setNotesHistory] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [currentStatus, setCurrentStatus] = useState('new');
  const [followUpDate, setFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setNotesHistory(parseLeadNotes(lead));
      setCurrentStatus(lead.status || 'new');
      setNewNoteText('');
      setFollowUpDate('');
    }
  }, [lead, open]);

  if (!lead) return null;

  const handleAddNote = async (e) => {
    e?.preventDefault();
    if (!newNoteText.trim() && currentStatus === lead.status) {
      toast.warning("Iltimos, izoh matnini kiriting!");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const userName = user?.name || user?.full_name || 'Administrator';
      
      let updatedHistory = [...notesHistory];
      let latestNoteText = lead.notes || '';

      if (newNoteText.trim()) {
        const newNoteItem = {
          id: 'note_' + Date.now(),
          text: newNoteText.trim(),
          created_at: now,
          created_by: userName,
          status: currentStatus,
          follow_up_date: followUpDate || null
        };
        updatedHistory = [newNoteItem, ...notesHistory];
        latestNoteText = newNoteText.trim();
      }

      const payload = {
        status: currentStatus,
        notes: latestNoteText,
        notes_history: updatedHistory
      };

      await onSaveLead(lead.id, payload);
      toast.success("Izoh va holat muvaffaqiyatli saqlandi!");
      setNewNoteText('');
      setFollowUpDate('');
      setNotesHistory(updatedHistory);
    } catch (err) {
      console.error(err);
      toast.error("Izohni saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNoteItem = async (noteId) => {
    if (!window.confirm("Ushbu izohni o'chirmoqchimisiz?")) return;
    try {
      const updatedHistory = notesHistory.filter(n => n.id !== noteId);
      const latestNoteText = updatedHistory[0]?.text || '';
      
      const payload = {
        notes: latestNoteText,
        notes_history: updatedHistory
      };

      await onSaveLead(lead.id, payload);
      setNotesHistory(updatedHistory);
      toast.success("Izoh o'chirildi");
    } catch (err) {
      console.error(err);
      toast.error("O'chirishda xatolik");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl rounded-3xl p-0 border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* ── Dialog Header ── */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-black text-white">
                  {lead.name}
                </DialogTitle>
                <span className="text-[10px] font-mono font-bold bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                  {lead.phone || "Telefon yo'q"}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-300 mt-0.5">
                Mijoz bilan suhbat izohlari, qaydlari va holat tarixi
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-all border-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Main Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar bg-slate-50/50">
          
          {/* 1. Holat (Status) Switcher */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              Mijozning Joriy Holati (Status):
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {STATUS_OPTIONS.map(st => {
                const isSelected = currentStatus === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setCurrentStatus(st.id)}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer text-center",
                      isSelected
                        ? `${st.color} shadow-xs ring-2 ring-indigo-500/30 scale-[1.02]`
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/80"
                    )}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Yangi Izoh Yozish Maydoni */}
          <form onSubmit={handleAddNote} className="bg-white p-4 rounded-2xl border-2 border-indigo-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" /> Yangi Izoh / Qayd Qo'shish:
              </Label>
              <span className="text-[10px] font-bold text-slate-400">
                Masalan: "3 kundan keyin tel qiling", "3 kundan keyin boraman"...
              </span>
            </div>

            <Textarea
              rows={3}
              placeholder="Mijoz nima dedi? Qachon qo'ng'iroq qilish yoki kelish kerak? Izohni shu yerga yozing..."
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              className="bg-slate-50/50 border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800"
              autoFocus
            />

            {/* Tezkor Shablon Tugmalari */}
            <div className="space-y-1.5">
              <span className="text-[9.5px] font-bold text-slate-400 block">Tezkor shablonlar (bitta bosishda kiritish):</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {QUICK_TEMPLATES.map(tpl => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setNewNoteText(prev => prev ? `${prev} | ${tpl}` : tpl)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 transition-all cursor-pointer active:scale-95"
                  >
                    + {tpl}
                  </button>
                ))}
              </div>
            </div>

            {/* Qayta bog'lanish sanasi & Saqlash tugmasi */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                  Eslatma sanasi (ixtiyoriy):
                </Label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="h-8 w-36 rounded-lg text-xs font-mono font-bold bg-slate-50 border-slate-200"
                />
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 px-5 font-black text-xs shadow-md shadow-indigo-500/20 cursor-pointer active:scale-95 transition-all ml-auto"
              >
                {saving ? "Saqlanmoqda..." : "Izohni Saqlash"}
              </Button>
            </div>
          </form>

          {/* 3. Izohlar Tarixi (Notes Timeline) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Izohlar & Suhbat Tarixi ({notesHistory.length})
              </h4>
            </div>

            {notesHistory.length > 0 ? (
              <div className="space-y-2.5">
                {notesHistory.map((item, idx) => {
                  const isLatest = idx === 0;
                  const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('uz-UZ', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '—';

                  return (
                    <motion.div
                      key={item.id || idx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-3.5 rounded-2xl border transition-all relative group",
                        isLatest 
                          ? "bg-white border-indigo-200 shadow-xs ring-1 ring-indigo-50" 
                          : "bg-white/80 border-slate-200/80"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-600" />
                          <span className="font-black text-slate-900 text-xs">
                            {item.created_by || 'Admin'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {dateStr}
                          </span>
                          {isLatest && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Oxirgi izoh
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {item.status && (
                            <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {item.status}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteNoteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-600 transition-opacity cursor-pointer rounded"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-slate-800 leading-relaxed pl-4">
                        {item.text}
                      </p>

                      {item.follow_up_date && (
                        <div className="mt-2 pl-4 text-[10.5px] font-bold text-amber-700 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>Eslatma belgilangan: {new Date(item.follow_up_date).toLocaleDateString('uz-UZ')}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-white rounded-2xl border border-slate-200/80 text-slate-400 font-bold text-xs space-y-1">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p>Hozircha hech qanday izoh yozilmagan</p>
                <p className="text-[10px] text-slate-400">Yuqoridagi maydonga mijoz bilan suhbat tafsilotlarini yozib saqlang</p>
              </div>
            )}
          </div>

        </div>

        {/* ── Dialog Footer ── */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          {onConvertToPatient && lead.status !== 'converted' && (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onConvertToPatient(lead);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black h-9.5 px-4 gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Bemorlar bazasiga o'tkazish</span>
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl text-xs font-bold h-9.5 px-4"
            >
              Yopish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
