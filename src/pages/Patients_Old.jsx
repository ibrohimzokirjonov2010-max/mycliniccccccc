import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Phone, Edit2, Trash2, MessageCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import PatientModal from '../components/patients/PatientModal';
import NewPatientFlow from '../components/patients/NewPatientFlow';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function Patients() {
  const navigate = useNavigate();
  const location = useLocation();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  // Check for navigation state to open modal
  useEffect(() => {
    if (location.state?.openAddModal) {
      setFlowOpen(true);
      // Clear state to avoid reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const load = async () => {
    const data = await base44.entities.Patient.list('-created_date', 100);
    setPatients(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = patients.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  );

  const handleDelete = async () => {
    await base44.entities.Patient.delete(deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bemorlar</h1>
          <p className="text-sm text-muted-foreground mt-1">Barcha bemorlar ro'yxati</p>
        </div>
        <Button onClick={() => setFlowOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Yangi bemor
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Bemor topilmadi" description="Yangi bemor qo'shing" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Bemor</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Telefon</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3 hidden md:table-cell">Oxirgi tashrif</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => navigate(`/patients/${p.id}`)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                          {p.full_name?.charAt(0) || '?'}
                        </div>
                        <span className="font-medium text-sm">{p.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{p.phone}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{p.last_visit || '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={p.status || 'New'} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {/* Phone Call Button */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" 
                          onClick={() => window.open(`tel:${p.phone}`, '_self')}
                          title="Qo'ng'iroq qilish"
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                        {/* Telegram Button */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" 
                          onClick={() => {
                            const phone = p.phone?.replace(/\D/g, '');
                            if (phone) {
                              window.open(`https://t.me/+${phone}`, '_blank');
                            }
                          }}
                          title="Telegramda yozish"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        {/* Edit Button */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" 
                          onClick={() => { setEditPatient(p); setModalOpen(true); }}
                          title="Tahrirlash"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {/* Delete Button */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive" 
                          onClick={() => setDeleteId(p.id)}
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit existing patient */}
      <PatientModal open={modalOpen} onClose={() => setModalOpen(false)} patient={editPatient} onSaved={load} />

      {/* New patient flow: bemor → reja → to'lov */}
      <NewPatientFlow open={flowOpen} onClose={() => setFlowOpen(false)} onSaved={load} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bemorni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>Haqiqatan ham bu bemorni o'chirmoqchimisiz?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">O'chirish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
