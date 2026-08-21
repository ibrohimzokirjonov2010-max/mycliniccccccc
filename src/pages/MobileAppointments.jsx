import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, User, Phone, ChevronLeft, ChevronRight,
  Plus, CheckCircle2, XCircle, Clock4, Edit2, Trash2, Loader2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PullToRefresh from '@/components/ui/PullToRefresh';
import AppointmentModal from '@/components/appointments/AppointmentModal';

/**
 * Mobile-optimized Appointments
 * Timeline view with professional native app design
 */
export default function MobileAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'list'
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [prefillTime, setPrefillTime] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [appData, patientData, serviceData] = await Promise.all([
        base44.entities.Appointment.list('-date', 200),
        base44.entities.Patient.list('full_name', 300),
        base44.entities.Service.list('name', 50)
      ]);
      setAppointments(appData);
      setPatients(patientData);
      setServices(serviceData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Delete appointment
   */
  const handleDeleteAppointment = useCallback(async (id) => {
    if (!window.confirm("Ushbu navbatni o'chirishga aminmisiz?")) return;
    
    try {
      await base44.entities.Appointment.delete(id);
      await loadAppointments();
    } catch (error) {
      console.error('Failed to delete appointment:', error);
      alert("O'chirishda xatolik yuz berdi");
    }
  }, [loadAppointments]);

  // Get week days
  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Filter appointments by selected date
  const filteredAppointments = appointments.filter(app => {
    const appDate = new Date(app.date);
    return appDate.toDateString() === selectedDate.toDateString();
  }).sort((a, b) => a.time.localeCompare(b.time));

  // Get status color and icon
  const getStatusStyle = (status) => {
    const styles = {
      'Scheduled': { color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', icon: Clock4 },
      'Waiting': { color: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock },
      'In Progress': { color: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', icon: User },
      'Completed': { color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 },
      'Cancelled': { color: 'bg-gray-500', bg: 'bg-gray-50', text: 'text-gray-700', icon: XCircle },
      'No-Show': { color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: XCircle }
    };
    return styles[status] || styles['Scheduled'];
  };

  // Format time
  const formatTime = (time) => {
    if (!time) return '--:--';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  // Week day names
  const weekDays = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
  const monthNames = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 
                      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

  // Check if date is today
  const isToday = (date) => {
    return date.toDateString() === new Date().toDateString();
  };

  // Check if date is selected
  const isSelected = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  // Appointment card
  const AppointmentCard = ({ app, index }) => {
    const style = getStatusStyle(app.status);
    const StatusIcon = style.icon;
    
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
        className="flex gap-4 mb-4"
      >
        {/* Time column */}
        <div className="flex flex-col items-center w-16 flex-shrink-0">
          <span className="text-lg font-bold text-gray-800">{formatTime(app.time)}</span>
          <div className="w-px h-full bg-gray-200 mt-2" />
        </div>
        
        {/* Card */}
        <div className={`flex-1 ${style.bg} rounded-2xl p-4 border-l-4 ${style.color.replace('bg-', 'border-')}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">{app.patient_name}</h3>
              <p className="text-sm text-gray-600 mt-1">{app.service_name}</p>
              <div className="flex items-center gap-2 mt-2">
                <StatusIcon className={`w-4 h-4 ${style.text}`} />
                <span className={`text-xs font-medium ${style.text}`}>{app.status}</span>
              </div>
            </div>
            <div className={`w-10 h-10 rounded-full ${style.color} bg-opacity-20 flex items-center justify-center`}>
              <User className={`w-5 h-5 ${style.text}`} />
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200/50">
            <button 
              onClick={() => {
                setEditingApp(app);
                setModalOpen(true);
              }}
              className="flex-1 py-2 bg-white rounded-lg text-sm font-medium text-gray-700 shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Tahrirlash
            </button>
            <button 
              onClick={() => handleDeleteAppointment(app.id)}
              className="p-2 bg-white rounded-lg shadow-sm active:scale-95 transition-transform text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => window.open(`tel:${app.phone || ''}`, '_self')}
              className="p-2 bg-white rounded-lg shadow-sm active:scale-95 transition-transform"
            >
              <Phone className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Skeleton
  const SkeletonCard = () => (
    <div className="flex gap-4 mb-4">
      <div className="w-16 flex-shrink-0">
        <div className="w-12 h-6 bg-gray-200 rounded" />
      </div>
      <div className="flex-1 bg-gray-100 rounded-2xl p-4 animate-pulse">
        <div className="w-32 h-5 bg-gray-200 rounded mb-2" />
        <div className="w-24 h-4 bg-gray-200 rounded" />
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={loadAppointments}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Kalendar</h1>
                <p className="text-sm text-gray-500">
                  {selectedDate.getDate()} {monthNames[selectedDate.getMonth()]}
                </p>
              </div>
              <Button 
                onClick={() => {
                  setEditingApp(null);
                  setPrefillTime('');
                  setModalOpen(true);
                }}
                className="bg-teal-500 hover:bg-teal-600 rounded-full px-4 h-10"
              >
                <Plus className="w-4 h-4 mr-1" />
                Yangi
              </Button>
            </div>

            {/* Week calendar */}
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() - 7);
                  setSelectedDate(newDate);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              
              <div className="flex-1 flex justify-center gap-2">
                {getWeekDays().map((day, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={`flex flex-col items-center justify-center w-12 h-16 rounded-2xl transition-all ${
                      isSelected(day)
                        ? 'bg-teal-500 text-white shadow-lg shadow-teal-200'
                        : isToday(day)
                        ? 'bg-teal-50 text-teal-600 border border-teal-200'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-xs font-medium">{weekDays[index]}</span>
                    <span className={`text-lg font-bold ${isSelected(day) ? 'text-white' : ''}`}>
                      {day.getDate()}
                    </span>
                    {isToday(day) && !isSelected(day) && (
                      <span className="w-1 h-1 bg-teal-500 rounded-full mt-1" />
                    )}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 7);
                  setSelectedDate(newDate);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Today button */}
            {!isToday(selectedDate) && (
              <button
                onClick={() => setSelectedDate(new Date())}
                className="w-full py-2 bg-teal-50 text-teal-600 rounded-xl text-sm font-medium mb-3"
              >
                Bugunga qaytish
              </button>
            )}

            {/* Stats */}
            <div className="flex gap-3">
              <div className="flex-1 bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{filteredAppointments.length}</p>
                <p className="text-xs text-blue-600/70">Jami</p>
              </div>
              <div className="flex-1 bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {filteredAppointments.filter(a => a.status === 'Waiting').length}
                </p>
                <p className="text-xs text-yellow-600/70">Kutmoqda</p>
              </div>
              <div className="flex-1 bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {filteredAppointments.filter(a => a.status === 'Completed').length}
                </p>
                <p className="text-xs text-green-600/70">Bajarildi</p>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments list */}
        <div className="p-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredAppointments.length > 0 ? (
            <AnimatePresence>
              {filteredAppointments.map((app, index) => (
                <AppointmentCard key={app.id} app={app} index={index} />
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">Navbatlar yo'q</p>
              <p className="text-sm text-gray-400 mt-1">Bu kun uchun navbatlar yo'q</p>
            </div>
          )}
        </div>

        {/* Unified Appointment Modal */}
        <AppointmentModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          appointment={editingApp}
          patients={patients}
          services={services}
          allAppointments={appointments}
          prefillDate={selectedDate.toISOString().split('T')[0]}
          prefillTime={prefillTime}
          onSaved={loadData}
        />

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </PullToRefresh>
  );
}
