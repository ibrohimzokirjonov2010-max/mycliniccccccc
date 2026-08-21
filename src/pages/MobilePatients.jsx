import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Phone, Plus,
  User, Calendar, DollarSign, MessageCircle, Edit2, Database, QrCode
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import NewPatientFlow from '@/components/patients/NewPatientFlow';
import { runSeeder } from '@/utils/seedData';

/**
 * Mobile-optimized Patients List
 * Card-based layout with professional native app design
 */
export default function MobilePatients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFlow, setShowFlow] = useState(false);
  const [selectedPatientForBot, setSelectedPatientForBot] = useState(null);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Patient.list('-created_date', 100);
      setPatients(data);
    } catch (error) {
      console.error('Failed to load patients:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    window.addEventListener('crm-data-updated', loadPatients);
    return () => window.removeEventListener('crm-data-updated', loadPatients);
  }, [loadPatients]);

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.phone?.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    const colors = {
      'Active': 'bg-green-100 text-green-700 border-green-200',
      'New': 'bg-blue-100 text-blue-700 border-blue-200',
      'Inactive': 'bg-gray-100 text-gray-700 border-gray-200',
      'Waiting': 'bg-yellow-100 text-yellow-700 border-yellow-200'
    };
    return colors[status] || colors['New'];
  };

  const PatientCard = ({ patient, index }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 border border-slate-200/60 shadow-sm">
          {(patient.photo_url || patient.photo) ? (
            <img src={patient.photo_url || patient.photo} alt={patient.full_name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-gray-400" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div 
            onClick={() => navigate(`/patients/${patient.id}`)}
            className="cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate pr-2 text-base">{patient.full_name}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {patient.phone}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(patient.status)} whitespace-nowrap`}>
                {patient.status || 'New'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(`tel:${patient.phone}`, '_self');
              }}
              className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white font-semibold text-xs active:scale-95 transition-all shadow-md hover:shadow-lg min-h-[60px]"
            >
              <Phone className="w-5 h-5" />
              <span>Qo'ng'iroq</span>
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                const phone = patient.phone?.replace(/\D/g, '');
                if (phone) {
                  window.open(`https://t.me/+${phone}`, '_blank');
                }
              }}
              className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-semibold text-xs active:scale-95 transition-all shadow-md hover:shadow-lg min-h-[60px]"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Telegram</span>
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPatientForBot(patient);
              }}
              className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-xs active:scale-95 transition-all shadow-md hover:shadow-lg min-h-[60px]"
            >
              <QrCode className="w-5 h-5" />
              <span>Botga ulash</span>
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/patients/${patient.id}`);
              }}
              className="flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-gray-100 text-gray-700 font-semibold text-[10px] active:scale-95 transition-all min-h-[40px] mt-2 col-span-3"
            >
              <Edit2 className="w-4 h-4" />
              <span>Bemor kartasini ochish</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">
                {patient.last_visit || '—'}
              </span>
            </div>
            {patient.total_debt > 0 && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs text-red-600 font-semibold">
                  {formatCurrency(patient.total_debt)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="w-32 h-4 bg-gray-200 rounded" />
          <div className="w-24 h-3 bg-gray-200 rounded" />
          <div className="flex gap-4 pt-2">
            <div className="w-20 h-3 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={loadPatients}>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Bemorlar</h1>
                <p className="text-sm text-gray-500">{patients.length} ta bemor</p>
              </div>
              <Button 
                onClick={() => setShowFlow(true)}
                className="bg-teal-500 hover:bg-teal-600 rounded-full px-4 h-10"
              >
                <Plus className="w-4 h-4 mr-1" />
                Yangi
              </Button>
            </div>
            
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Bemor qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-gray-50 border-gray-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3">
              {[
                { id: 'all', label: 'Barchasi' },
                { id: 'Active', label: 'Faol' },
                { id: 'New', label: 'Yangi' },
                { id: 'Inactive', label: 'Nofaol' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setFilterStatus(filter.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    filterStatus === filter.id
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredPatients.length > 0 ? (
            <AnimatePresence>
              {filteredPatients.map((patient, index) => (
                <PatientCard key={patient.id} patient={patient} index={index} />
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">Bemor topilmadi</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Test ma'lumotlarini yuklash uchun tugmani bosing</p>
              <Button 
                onClick={runSeeder}
                variant="outline"
                className="gap-2"
              >
                <Database className="w-4 h-4" />
                Test ma'lumotlarni yuklash
              </Button>
            </div>
          )}
        </div>

        <div className="h-8" />

        <NewPatientFlow 
          open={showFlow} 
          onClose={() => setShowFlow(false)}
          onSaved={loadPatients}
        />
      </div>
    </PullToRefresh>
  );
}
