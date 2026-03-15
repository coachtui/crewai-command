// ============================================================================
// Daily Notes Modal
// Multi-tab notes for the job site lead (admin, superintendent, foreman)
// ============================================================================

import { useState, useEffect } from 'react';
import { FileText, Truck, Wrench, ShieldAlert, Cloud, Save, Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { supabase } from '../../lib/supabase';
import { useJobSite } from '../../contexts';
import type { DailyNote } from '../../types';
import { toast } from 'sonner';

interface DailyNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD
  readOnly?: boolean;
}

type NoteTab = 'general' | 'equipment' | 'tools' | 'safety' | 'weather';

const TABS: { id: NoteTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'general', label: 'General', icon: FileText },
  { id: 'equipment', label: 'Equipment', icon: Truck },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'safety', label: 'Safety', icon: ShieldAlert },
  { id: 'weather', label: 'Weather', icon: Cloud },
];

const TAB_PLACEHOLDERS: Record<NoteTab, string> = {
  general: 'Add general notes about the day — work progress, site conditions, visitor log, etc.',
  equipment: 'Note equipment used, issues, fuel consumption, downtime, deliveries, etc.',
  tools: 'Log tool usage, shortages, damaged tools, rentals needed, etc.',
  safety: 'Record safety incidents, near misses, toolbox talk topics, PPE compliance, etc.',
  weather: 'Describe weather conditions, delays caused by weather, temperature, rain, wind, etc.',
};

export function DailyNotesModal({ isOpen, onClose, date, readOnly = false }: DailyNotesModalProps) {
  const { currentJobSite } = useJobSite();
  const [activeTab, setActiveTab] = useState<NoteTab>('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);

  const [notes, setNotes] = useState<Record<NoteTab, string>>({
    general: '',
    equipment: '',
    tools: '',
    safety: '',
    weather: '',
  });

  const formatDisplayDate = (d: string) => {
    const [year, month, day] = d.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  useEffect(() => {
    if (isOpen && currentJobSite) {
      loadNotes();
    }
  }, [isOpen, date, currentJobSite?.id]);

  const loadNotes = async () => {
    if (!currentJobSite) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();
      if (!userData) return;

      const { data, error } = await supabase
        .from('daily_notes')
        .select('*')
        .eq('organization_id', userData.org_id)
        .eq('job_site_id', currentJobSite.id)
        .eq('note_date', date)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setNoteId(data.id);
        setNotes({
          general: data.general_notes || '',
          equipment: data.equipment_notes || '',
          tools: data.tools_notes || '',
          safety: data.safety_notes || '',
          weather: data.weather_notes || '',
        });
      } else {
        setNoteId(null);
        setNotes({ general: '', equipment: '', tools: '', safety: '', weather: '' });
      }
    } catch (err) {
      console.error('Failed to load daily notes:', err);
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentJobSite || readOnly) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();
      if (!userData) return;

      const payload: Partial<DailyNote> = {
        organization_id: userData.org_id,
        job_site_id: currentJobSite.id,
        note_date: date,
        general_notes: notes.general || undefined,
        equipment_notes: notes.equipment || undefined,
        tools_notes: notes.tools || undefined,
        safety_notes: notes.safety || undefined,
        weather_notes: notes.weather || undefined,
      };

      if (noteId) {
        const { error } = await supabase
          .from('daily_notes')
          .update(payload)
          .eq('id', noteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('daily_notes')
          .insert({ ...payload, created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        setNoteId(data.id);
      }

      toast.success('Notes saved');
      onClose();
    } catch (err) {
      console.error('Failed to save daily notes:', err);
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const hasContent = Object.values(notes).some((v) => v.trim().length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Daily Notes — ${formatDisplayDate(date)}`} size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border pb-0 -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isFilled = notes[tab.id].trim().length > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 transition-all duration-150
                    ${activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                    }
                  `}
                >
                  <Icon size={14} />
                  {tab.label}
                  {isFilled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Note textarea */}
          <Textarea
            value={notes[activeTab]}
            onChange={(e) => setNotes((prev) => ({ ...prev, [activeTab]: e.target.value }))}
            placeholder={readOnly ? 'No notes recorded.' : TAB_PLACEHOLDERS[activeTab]}
            rows={10}
            disabled={readOnly}
            className="resize-none"
          />

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[12px] text-text-tertiary">
              {hasContent ? 'Notes saved for this site and date.' : 'No notes yet for this date.'}
            </p>
            {!readOnly && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <Save size={16} className="mr-2" />
                  )}
                  Save Notes
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
