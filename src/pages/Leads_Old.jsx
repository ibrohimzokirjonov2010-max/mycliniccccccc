import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', visit_date: '', source: 'Call', status: 'New', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await base44.entities.Lead.list('-created_date', 100);
    setLeads(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editLead) {
      setForm({ name: editLead.name || '', phone: editLead.phone || '', visit_date: editLead.visit_date || '', source: editLead.source || 'Call', status: editLead.status || 'New', notes: editLead.notes || '' });
    } else {
      setForm({ name: '', phone: '', visit_date: '', source: 'Call', status: 'New', notes: '' });
    }
  }, [editLead, modalOpen]);

  const filtered = leads.filter(l => l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search));

  const handleSave = async () => {
    if (!form.name || !form.phone) return;
    setSaving(true);
    if (editLead) {
      await base44.entities.Lead.update(editLead.id, form);
    } else {
      await base44.entities.Lead.create(form);
    }
    setSaving(false);
    setModalOpen(false);
    setEditLead(null);
    load();
  };

  const handleDelete = async () => {
    await base44.entities.Lead.delete(deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leadlar</h1>
          <p className="text-sm text-muted-foreground mt-1">Potentsial bemorlar</p>
        </div>
        <Button onClick={() => { setEditLead(null); setModalOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Yangi lead
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Lead topilmadi" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">Ism</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">Telefon</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3 hidden md:table-cell">Tashrif sanasi</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">Manba</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">Status</th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase px-5 py-3">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium">{l.name}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{l.phone}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{l.visit_date || '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={l.source} type="source" /></td>
                    <td className="px-5 py-3.5"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditLead(l); setModalOpen(true); }}>Tahrirlash</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(l.id)}>O'chirish</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={() => { setModalOpen(false); setEditLead(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editLead ? "Lead tahrirlash" : "Yangi lead"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Ism *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Telefon *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Tashrif sanasi</Label><Input type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} /></div>
            <div>
              <Label>Manba</Label>
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Telegram', 'Instagram', 'Website', 'Call', 'Other'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['New', 'Contacted', 'Interested', 'Converted', 'Lost'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Izohlar</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setModalOpen(false); setEditLead(null); }}>Bekor</Button>
              <Button onClick={handleSave} disabled={saving || !form.name || !form.phone} className="bg-primary hover:bg-primary/90">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Leadni o'chirish</AlertDialogTitle><AlertDialogDescription>Haqiqatan ham o'chirmoqchimisiz?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">O'chirish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
