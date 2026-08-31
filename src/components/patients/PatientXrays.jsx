import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Image, Trash2, Loader2, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmptyState from '../ui/EmptyState';

/**
 * PatientXrays Component
 * 
 * Manages patient X-ray images with upload, view, and delete functionality.
 * Displays X-rays in a responsive grid layout.
 * 
 * @param {Object} props
 * @param {string} props.patientId - Patient ID
 */
export default function PatientXrays({ patientId }) {
  const [xrays, setXrays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedXray, setSelectedXray] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedTooth, setSelectedTooth] = useState('all');

  /**
   * Load patient X-rays
   */
  const loadXrays = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Xray.filter(
        { patient_id: patientId }, 
        '-created_date', 
        50
      );
      setXrays(data);
    } catch (error) {
      console.error('Failed to load X-rays:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { 
    loadXrays(); 
  }, [loadXrays]);

  /**
   * Handle file upload
   */
  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const file_url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await base44.entities.Xray.create({
        patient_id: patientId,
        image_url: file_url,
        description: description.trim(),
        tooth_number: selectedTooth !== 'all' ? selectedTooth : null,
        date: new Date().toISOString().split('T')[0]
      });
      setDescription('');
      setModalOpen(false);
      await loadXrays();
    } catch (error) {
      console.error('Failed to upload X-ray:', error);
    } finally {
      setUploading(false);
    }
  }, [patientId, description, loadXrays]);

  /**
   * Delete X-ray
   */
  const deleteXray = useCallback(async (id) => {
    setDeletingId(id);
    try {
      await base44.entities.Xray.delete(id);
      await loadXrays();
    } catch (error) {
      console.error('Failed to delete X-ray:', error);
    } finally {
      setDeletingId(null);
    }
  }, [loadXrays]);

  /**
   * Open X-ray viewer
   */
  const viewXray = useCallback((xray) => {
    setSelectedXray(xray);
  }, []);

  /**
   * Close modal and reset state
   */
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setDescription('');
    setSelectedTooth('all');
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {xrays.length > 0 && `Jami: ${xrays.length} ta rentgen`}
        </span>
        <Button 
          onClick={() => setModalOpen(true)} 
          className="bg-primary hover:bg-primary/90" 
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" /> Rentgen qo'shish
        </Button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : xrays.length === 0 ? (
        <EmptyState 
          icon={Image} 
          variant="blue"
          title={t('patientXrays.emptyTitle') || "Rentgen rasmlari yo'q"} 
          description={t('patientXrays.emptyDesc') || "Ushbu bemor uchun hali rentgen yoki diagnostika rasmlari yuklanmagan."}
        />
      ) : (
        /* X-ray Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {xrays.map((xray) => (
            <div 
              key={xray.id} 
              className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden group hover:border-primary/20 transition-colors"
            >
              {/* Image Container */}
              <div className="relative">
                <img 
                  src={xray.image_url} 
                  alt={`X-ray ${xray.date}`} 
                  className="w-full h-48 object-cover cursor-pointer"
                  onClick={() => viewXray(xray)}
                />
                
                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 bg-white/90 text-foreground hover:bg-white"
                    onClick={() => viewXray(xray)}
                  >
                    <ZoomIn className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 bg-red-500/90 text-white hover:bg-red-600"
                    onClick={() => deleteXray(xray.id)}
                    disabled={deletingId === xray.id}
                  >
                    {deletingId === xray.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Info */}
              <div className="p-3">
                <p className="text-sm truncate">
                  {xray.description || "Tavsif yo'q"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(xray.date).toLocaleDateString('uz-UZ', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={modalOpen} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rentgen yuklash</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="xray-description">Tavsif</Label>
              <Input 
                id="xray-description"
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Rentgen haqida..." 
                disabled={uploading}
              />
            </div>
            <div>
              <Label>Tish raqami (ixtiyoriy)</Label>
              <Select value={selectedTooth} onValueChange={setSelectedTooth} disabled={uploading}>
                <SelectTrigger>
                  <SelectValue placeholder="Barcha tishlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Umumiy (Barcha tishlar)</SelectItem>
                  {[...Array(8)].map((_, i) => (
                    <optgroup key={i} label={["Yuqori o'ng", "Yuqori chap", "Pastki chap", "Pastki o'ng"][i]}>
                      {[1,2,3,4,5,6,7,8].map(num => {
                        const fdi = (i + 1) * 10 + num;
                        return <SelectItem key={fdi} value={fdi.toString()}>{fdi}-tish</SelectItem>;
                      })}
                    </optgroup>
                  ))}
                  <optgroup label="Bolalar tishlari">
                    {[5,6,7,8].map(quad => [1,2,3,4,5].map(num => {
                      const fdi = quad * 10 + num;
                      return <SelectItem key={fdi} value={fdi.toString()}>{fdi}-tish (Sut tishi)</SelectItem>;
                    }))}
                  </optgroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="xray-file">Rasm</Label>
              <Input 
                id="xray-file"
                type="file" 
                accept="image/*" 
                onChange={handleUpload} 
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Rasm formati: JPG, PNG, WEBP (max 10MB)
              </p>
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Yuklanmoqda...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Modal */}
      <Dialog open={!!selectedXray} onOpenChange={() => setSelectedXray(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          {selectedXray && (
            <div className="flex flex-col h-full">
              <DialogHeader className="p-4 border-b">
                <DialogTitle className="text-base">
                  {selectedXray.description || "Rentgen rasmi"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {new Date(selectedXray.date).toLocaleDateString('uz-UZ', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </DialogHeader>
              <div className="flex-1 overflow-auto p-4 bg-muted/50">
                <img 
                  src={selectedXray.image_url} 
                  alt="X-ray Full View" 
                  className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
