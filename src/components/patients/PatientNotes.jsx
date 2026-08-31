import { useState, useEffect, useCallback, memo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Trash2, Loader2 } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { useTranslation } from '@/i18n/LanguageContext';

/**
 * PatientNotes Component
 * 
 * Displays and manages notes for a specific patient.
 * Supports adding new notes and deleting existing ones.
 * 
 * @param {Object} props
 * @param {string} props.patientId - Patient ID
 */
function PatientNotes({ patientId }) {
  const { t, language } = useTranslation();
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /**
   * Load patient notes
   */
  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.Note.filter(
        { patient_id: patientId }, 
        '-created_date', 
        50
      );
      setNotes(data);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { 
    loadNotes(); 
  }, [loadNotes]);

  /**
   * Add new note
   */
  const addNote = useCallback(async () => {
    if (!newNote.trim()) return;
    
    setSaving(true);
    try {
      await base44.entities.Note.create({ 
        patient_id: patientId, 
        content: newNote.trim(), 
        type: 'General' 
      });
      setNewNote('');
      await loadNotes();
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setSaving(false);
    }
  }, [newNote, patientId, loadNotes]);

  /**
   * Delete note
   */
  const deleteNote = useCallback(async (id) => {
    setDeletingId(id);
    try {
      await base44.entities.Note.delete(id);
      await loadNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setDeletingId(null);
    }
  }, [loadNotes]);

  /**
   * Handle key press (Ctrl+Enter to submit)
   */
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey && e.key === 'Enter' && newNote.trim()) {
      addNote();
    }
  }, [newNote, addNote]);

  return (
    <div className="space-y-4">
      {/* New Note Input */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <Textarea 
          value={newNote} 
          onChange={e => setNewNote(e.target.value)} 
          onKeyDown={handleKeyDown}
          placeholder={t('patientNotes.placeholder')} 
          rows={3}
          disabled={saving}
        />
        <div className="flex justify-between items-center mt-3">
          <span className="text-xs text-muted-foreground">
            {t('patientNotes.charCount', { count: newNote.length })}
          </span>
          <Button 
            onClick={addNote} 
            disabled={!newNote.trim() || saving} 
            className="bg-primary hover:bg-primary/90" 
            size="sm"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            {t('patientNotes.add')}
          </Button>
        </div>
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="h-32 bg-muted rounded-2xl animate-pulse" />
      ) : notes.length === 0 ? (
        <EmptyState 
          icon={FileText} 
          variant="amber"
          title={t('patientNotes.emptyTitle') || "Eslatmalar mavjud emas"} 
          description={t('patientNotes.emptyDesc') || "Bemor bo'yicha muhim eslatma yoki qo'shimcha yozuvlar kiritilmagan."}
        />
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div 
              key={note.id} 
              className="bg-card rounded-2xl border border-border p-4 shadow-sm flex justify-between items-start group hover:border-primary/20 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(note.created_date).toLocaleString(language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteNote(note.id)}
                disabled={deletingId === note.id}
              >
                {deletingId === note.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(PatientNotes);
