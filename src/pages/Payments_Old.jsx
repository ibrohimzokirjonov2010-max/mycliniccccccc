import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Search, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import PatientModal from '../components/patients/PatientModal';

const TYPE_LABELS = { Income: "To'lov", Debt: "Qarz", Expense: "Chiqim", Refund: "Qaytarish" };
const METHOD_LABELS = { Cash: "Naqd", Card: "Karta", Transfer: "O'tkazma" };

export default function Payments() {
  const location = useLocation();
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [form, setForm] = useState({
    patient_id: '', patient_name: '', type: 'Income', category: '',
    amount: 0, method: 'Cash', date: new Date().toISOString().split('T')[0], notes: ''
  });
  const [saving, setSaving] = useState(false);

  // Check for navigation state to open modal
  useEffect(() => {
    if (location.state?.openAddModal) {
      setModalOpen(true);
      // Clear state to avoid reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const load = async () => {
    const [pays, pats, svcs] = await Promise.all([
      base44.entities.Payment.list('-date', 200),
      base44.entities.Patient.list('full_name', 200),
      base44.entities.Service.filter({ is_active: true }, 'name', 100),
    ]);
    setPayments(pays);
    setPatients(pats);
    setServices(svcs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalIncome = payments.filter(p => p.type === 'Income').reduce((s, p) => s + (p.amount || 0), 0);
  const totalRefunds = payments.filter(p => p.type === 'Refund').reduce((s, p) => s + (p.amount || 0), 0);
  const netIncome = totalIncome - totalRefunds;

  const filtered = payments.filter(p =>
    p.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleService = (svc) => {
    let updated;
    if (selectedServices.find(s => s.id === svc.id)) {
      updated = selectedServices.filter(s => s.id !== svc.id);
    } else {
      updated = [...selectedServices, svc];
    }
    setSelectedServices(updated);
    const total = updated.reduce((sum, s) => sum + (s.price || 0), 0);
    const names = updated.map(s => s.name).join(', ');
    setForm(prev => ({ ...prev, amount: total, category: names }));
  };

  const resetModal = () => {
    setModalOpen(false);
    setSelectedServices([]);
    setForm({ patient_id: '', patient_name: '', type: 'Income', category: '', amount: 0, method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' });
  };

  const recalcPatient = async (patientId) => {
    if (!patientId) return;
    const allPays = await base44.entities.Payment.filter({ patient_id: patientId }, '-date', 500);
    const totalPaid = allPays.filter(p => p.type === 'Income').reduce((s, p) => s + (p.amount || 0), 0);
    const totalDebt = allPays.filter(p => p.type === 'Debt').reduce((s, p) => s + (p.amount || 0), 0);
    const totalRefund = allPays.filter(p => p.type === 'Refund').reduce((s, p) => s + (p.amount || 0), 0);
    const debt = Math.max(0, totalDebt - totalPaid - totalRefund);
    await base44.entities.Patient.update(patientId, { total_paid: totalPaid, total_debt: debt });
  };

  const handleSave = async () => {
    if (!form.amount || !form.date) return;
    setSaving(true);
    await base44.entities.Payment.create(form);
    await recalcPatient(form.patient_id);
    setSaving(false);
    resetModal();
    load();
  };

  const handleNewPatientSaved = async () => {
    const pats = await base44.entities.Patient.list('full_name', 200);
    setPatients(pats);
    // auto-select newest
    const newest = pats[pats.length - 1];
    if (newest) setForm(prev => ({ ...prev, patient_id: newest.id, patient_name: newest.full_name }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">To'lovlar</h1>
          <p className="text-sm text-muted-foreground mt-1">Moliyaviy boshqaruv</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Yangi to'lov
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Jami kirim" value={`${totalIncome.toLocaleString()} so'm`} icon={TrendingUp} />
        <StatCard title="Qaytarilgan" value={`${totalRefunds.toLocaleString()} so'm`} icon={TrendingDown} />
        <StatCard title="Sof daromad" value={`${netIncome.toLocaleString()} so'm`} icon={DollarSign} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={DollarSign} title="To'lovlar yo'q" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">Sana</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">Bemor</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">Tur</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3 hidden md:table-cell">Kategoriya</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">Summa</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3 hidden md:table-cell">To'lov usuli</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm">{p.date}</td>
                    <td className="px-5 py-3.5 text-sm font-medium">{p.patient_name || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        p.type === 'Income' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        p.type === 'Debt' ? 'bg-red-50 text-red-700 border-red-200' :
                        p.type === 'Expense' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                        'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>{TYPE_LABELS[p.type] || p.type}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm hidden md:table-cell">{p.category || '—'}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold">{p.amount?.toLocaleString()} so'm</td>
                    <td className="px-5 py-3.5 text-sm hidden md:table-cell">{METHOD_LABELS[p.method] || p.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Payment Modal */}
      <Dialog open={modalOpen} onOpenChange={resetModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Yangi to'lov</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Patient + add new */}
            <div>
              <Label>Bemor</Label>
              <div className="flex gap-2 mt-1">
                <Select value={form.patient_id} onValueChange={v => {
                  const pat = patients.find(p => p.id === v);
                  setForm({ ...form, patient_id: v, patient_name: pat?.full_name || '' });
                }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Bemor tanlang" /></SelectTrigger>
                  <SelectContent>
                    {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name} — {p.phone}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  type="button" variant="outline" size="icon"
                  title="Yangi bemor qo'shish"
                  onClick={() => setNewPatientOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Services auto-price */}
            <div>
              <Label>Xizmatlar (narx avtomatik hisoblanadi)</Label>
              <div className="mt-2 border border-border rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                {services.map(svc => (
                  <div key={svc.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={!!selectedServices.find(s => s.id === svc.id)}
                      onCheckedChange={() => toggleService(svc)}
                    />
                    <span className="text-sm flex-1">{svc.name}</span>
                    <span className="text-sm font-medium text-primary">{svc.price?.toLocaleString()} so'm</span>
                  </div>
                ))}
                {services.length === 0 && <p className="text-xs text-muted-foreground">Xizmatlar yo'q</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tur</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Income">To'lov (kirim)</SelectItem>
                    <SelectItem value="Debt">Qarz yozish</SelectItem>
                    <SelectItem value="Expense">Chiqim</SelectItem>
                    <SelectItem value="Refund">Qaytarish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>To'lov usuli</Label>
                <Select value={form.method} onValueChange={v => setForm({ ...form, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Naqd</SelectItem>
                    <SelectItem value="Card">Karta</SelectItem>
                    <SelectItem value="Transfer">O'tkazma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Summa *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Kategoriya</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>

            <div><Label>Sana *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Izoh</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>

            {/* Total preview */}
            {form.amount > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm font-medium">Jami summa:</span>
                <span className="text-lg font-bold text-primary">{form.amount.toLocaleString()} so'm</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetModal}>Bekor</Button>
              <Button onClick={handleSave} disabled={saving || !form.amount} className="bg-primary hover:bg-primary/90">
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Patient inline */}
      <PatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        patient={null}
        onSaved={handleNewPatientSaved}
      />
    </div>
  );
}
