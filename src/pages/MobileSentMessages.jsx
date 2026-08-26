import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Settings2,
  Send, CheckCheck, Clock, AlertCircle, User, RefreshCw
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const DAY_LABELS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(d) {
  return `${d.getDate()} ${MONTHS_UZ[d.getMonth()]} ${d.getFullYear()}`;
}

function getWeekDays(baseDate) {
  const d = new Date(baseDate);
  // Monday = 0
  const day = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(monday);
    nd.setDate(monday.getDate() + i);
    return nd;
  });
}

function isSameDay(a, b) {
  return toYMD(a) === toYMD(b);
}

function isToday(d) {
  return isSameDay(d, new Date());
}

const STATUS_CONFIG = {
  sent: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Yuborildi', icon: CheckCheck },
  pending: { color: 'text-amber-500', bg: 'bg-amber-50', label: 'Kutilmoqda', icon: Clock },
  failed: { color: 'text-red-500', bg: 'bg-red-50', label: 'Xato', icon: AlertCircle },
};

const TYPE_CONFIG = {
  sms: { color: 'text-blue-500', bg: 'bg-blue-50', label: 'SMS' },
  telegram: { color: 'text-purple-500', bg: 'bg-purple-50', label: 'Telegram' },
};

const formatHM = (iso) => {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return ''; }
};

const MessageCard = memo(({ msg }) => {
  const status = STATUS_CONFIG[msg.status] || STATUS_CONFIG.sent;
  const type = TYPE_CONFIG[msg.type] || TYPE_CONFIG.sms;
  const StatusIcon = status.icon;

  return (
    <div
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-slate-50 active:scale-[0.99] transition-transform duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-black text-slate-800 truncate">{msg.patient_name || 'Bemor'}</span>
            <span className="text-[10px] text-slate-400 ml-2 shrink-0">{formatHM(msg.sent_at)}</span>
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2">{msg.message || msg.text}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${type.bg} ${type.color}`}>{type.label}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.color} flex items-center gap-1`}>
              <StatusIcon className="w-3 h-3" />{status.label}
            </span>
            {msg.phone && <span className="text-[10px] text-slate-400">{msg.phone}</span>}
          </div>
        </div>
      </div>
    </div>
  );
});


export default function MobileSentMessages() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekBase, setWeekBase] = useState(new Date());
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const weekDays = getWeekDays(weekBase);

  const [visibleLimit, setVisibleLimit] = useState(20);

  const loadMessages = useCallback(async (date) => {
    setLoading(true);
    setVisibleLimit(20);
    try {
      const dateStr = toYMD(date);
      const res = await fetch(`${BACKEND_URL}/notifications/sent-messages?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : (data.messages || []));
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages(selectedDate);
  }, [selectedDate, loadMessages]);

  const selectDay = (day) => {
    setSelectedDate(day);
    setVisibleLimit(20);
  };

  const prevWeek = () => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() - 7);
    setWeekBase(d);
  };
  const nextWeek = () => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() + 7);
    setWeekBase(d);
  };

  return (
    <div className="min-h-screen bg-[#F4F5FA]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-[17px] font-black text-slate-800 tracking-tight">Yuborilgan xabarlar</h1>
        <button
          onClick={() => navigate('/sms-settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500 shadow-md active:scale-90 transition-transform"
        >
          <Settings2 className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Calendar */}
      <div className="mx-4 bg-white rounded-2xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevWeek} className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center active:scale-90">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="text-center">
            <p className="text-[13px] font-black text-slate-800">{formatDate(selectedDate)}</p>
            {isToday(selectedDate) && (
              <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">Bugun</span>
            )}
          </div>
          <button onClick={nextWeek} className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center active:scale-90">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-slate-400 mb-1">{d}</div>
          ))}
          {weekDays.map((day, i) => {
            const selected = isSameDay(day, selectedDate);
            const today = isToday(day);
            return (
              <button
                key={i}
                onClick={() => selectDay(day)}
                className={`flex flex-col items-center justify-center h-10 rounded-xl transition-all active:scale-90 ${
                  selected
                    ? 'bg-purple-600 text-white shadow-md'
                    : today
                    ? 'bg-slate-100 text-slate-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[13px] font-black ${selected ? 'text-white' : today ? 'text-purple-600' : 'text-slate-700'}`}>
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages List */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] font-black text-slate-400 uppercase tracking-wider">
            {selectedDate.getDate()}-{MONTHS_UZ[selectedDate.getMonth()]} — xabarlar
          </p>
          <button
            onClick={() => loadMessages(selectedDate)}
            className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center active:scale-90"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-purple-400 rounded-full animate-spin" />
                <div className="absolute inset-2 border-2 border-transparent border-t-purple-200 rounded-full animate-spin" style={{ animationDirection: 'reverse' }} />
              </div>
              <p className="text-[13px] text-slate-400 mt-4 font-semibold">Yuklanmoqda...</p>
            </motion.div>
          ) : messages.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative w-14 h-14 mb-4">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                <div className="absolute inset-0 border-4 border-transparent border-t-slate-200 rounded-full animate-spin" />
              </div>
              <p className="text-[14px] text-slate-400 font-semibold">Ma'lumot mavjud emas</p>
              <p className="text-[12px] text-slate-300 mt-1">Bu kunda xabar yuborilmagan</p>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-1.5 shadow-sm">
                  <Send className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-[12px] font-black text-slate-700">{messages.length} ta xabar</span>
                </div>
              </div>
              {messages.slice(0, visibleLimit).map((msg, i) => (
                <MessageCard key={msg.id || i} msg={msg} />
              ))}
              {messages.length > visibleLimit && (
                <button
                  onClick={() => setVisibleLimit(prev => prev + 20)}
                  className="w-full py-3.5 bg-white border border-slate-100 rounded-2xl text-[12px] font-black text-purple-600 active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-1.5 mt-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Yana ko'proq yuklash
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


