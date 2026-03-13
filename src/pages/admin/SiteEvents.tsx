import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
} from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Clock, MapPin, Edit2, Trash2, CalendarDays, BarChart2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth, useJobSite } from '../../contexts';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TaskDetailsModal } from '../../components/tasks/TaskDetailsModal';
import type { SiteEvent, Task } from '../../types';
import { toast } from 'sonner';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Can this user create/edit site events?
function useCanManageEvents() {
  const { canManageSite, userSiteRole } = useJobSite();
  return canManageSite || userSiteRole === 'engineer';
}

// ─── Event Form ───────────────────────────────────────────────────────────────

interface EventFormData {
  title: string;
  event_date: string;
  start_time: string;
  location: string;
}

interface EventFormProps {
  initial?: Partial<EventFormData>;
  onSave: (data: EventFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function EventForm({ initial, onSave, onCancel, saving }: EventFormProps) {
  const [form, setForm] = useState<EventFormData>({
    title: initial?.title || '',
    event_date: initial?.event_date || format(new Date(), 'yyyy-MM-dd'),
    start_time: initial?.start_time || '',
    location: initial?.location || '',
  });

  const set = (key: keyof EventFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[13px] font-medium text-text-secondary mb-1">
          Title <span className="text-error">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={set('title')}
          placeholder="e.g. Concrete Pour — Grid C4"
          required
          className="w-full h-10 px-3 bg-bg-secondary border border-gray-200 rounded-xl text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1">Date</label>
          <input
            type="date"
            value={form.event_date}
            onChange={set('event_date')}
            required
            className="w-full h-10 px-3 bg-bg-secondary border border-gray-200 rounded-xl text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-text-secondary mb-1">
            Start Time <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <input
            type="time"
            value={form.start_time}
            onChange={set('start_time')}
            className="w-full h-10 px-3 bg-bg-secondary border border-gray-200 rounded-xl text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-text-secondary mb-1">
          Location / Area <span className="text-text-secondary font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={form.location}
          onChange={set('location')}
          placeholder="e.g. Grid C4 — Foundation"
          className="w-full h-10 px-3 bg-bg-secondary border border-gray-200 rounded-xl text-[14px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={saving || !form.title.trim()} className="flex-1">
          {saving ? 'Saving...' : 'Save Event'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Event Detail ─────────────────────────────────────────────────────────────

interface EventDetailProps {
  event: SiteEvent;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function EventDetail({ event, canEdit, onEdit, onDelete, onClose }: EventDetailProps) {
  const dateLabel = format(parseISO(event.event_date), 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[17px] font-semibold text-text-primary">{event.title}</h3>
        <p className="text-[14px] text-text-secondary mt-0.5">{dateLabel}</p>
      </div>

      {(event.start_time || event.location) && (
        <div className="space-y-2">
          {event.start_time && (
            <div className="flex items-center gap-2 text-[14px] text-text-secondary">
              <Clock size={14} className="text-amber-500 flex-shrink-0" />
              <span>{formatTime(event.start_time)}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2 text-[14px] text-text-secondary">
              <MapPin size={14} className="text-amber-500 flex-shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="secondary"
            onClick={onEdit}
            className="flex-1"
          >
            <Edit2 size={14} className="mr-1.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onDelete}
            className="flex-1 text-error hover:bg-error/10"
          >
            <Trash2 size={14} className="mr-1.5" />
            Delete
          </Button>
        </div>
      )}

      <Button variant="secondary" onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalMode =
  | { type: 'closed' }
  | { type: 'create'; defaultDate?: string }
  | { type: 'detail'; event: SiteEvent }
  | { type: 'edit'; event: SiteEvent };

export function SiteEvents() {
  const { user } = useAuth();
  const { currentJobSite } = useJobSite();
  const canEdit = useCanManageEvents();
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalMode>({ type: 'closed' });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (currentJobSite && user?.org_id) {
      fetchEvents();
      fetchTasks();
    }
  }, [currentJobSite?.id, user?.org_id, currentMonth]);

  const fetchEvents = async () => {
    if (!currentJobSite || !user?.org_id) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('site_events')
        .select('*')
        .eq('organization_id', user.org_id)
        .eq('job_site_id', currentJobSite.id)
        .gte('event_date', monthStart)
        .lte('event_date', monthEnd)
        .order('event_date')
        .order('start_time', { nullsFirst: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      toast.error('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (!currentJobSite || !user?.org_id) { setTasks([]); return; }
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', user.org_id)
        .eq('job_site_id', currentJobSite.id)
        .lte('start_date', monthEnd)
        .gte('end_date', monthStart);
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Failed to load tasks for schedule', err);
    }
  };

  const handleCreate = async (form: EventFormData) => {
    if (!currentJobSite || !user?.org_id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('site_events').insert({
        job_site_id: currentJobSite.id,
        organization_id: user.org_id,
        title: form.title.trim(),
        event_date: form.event_date,
        start_time: form.start_time || null,
        location: form.location.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success('Event created');
      setModal({ type: 'closed' });
      fetchEvents();
    } catch (err) {
      toast.error('Failed to create event');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: EventFormData) => {
    if (modal.type !== 'edit') return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_events')
        .update({
          title: form.title.trim(),
          event_date: form.event_date,
          start_time: form.start_time || null,
          location: form.location.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', modal.event.id);
      if (error) throw error;
      toast.success('Event updated');
      setModal({ type: 'closed' });
      fetchEvents();
    } catch (err) {
      toast.error('Failed to update event');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      const { error } = await supabase.from('site_events').delete().eq('id', eventId);
      if (error) throw error;
      toast.success('Event deleted');
      setModal({ type: 'closed' });
      fetchEvents();
    } catch (err) {
      toast.error('Failed to delete event');
      console.error(err);
    }
  };

  // Build calendar grid: weeks covering the full month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Mon
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Group events by date string
  const eventsByDate = new Map<string, SiteEvent[]>();
  events.forEach(ev => {
    const list = eventsByDate.get(ev.event_date) || [];
    list.push(ev);
    eventsByDate.set(ev.event_date, list);
  });

  // Group tasks by date (any day within their start_date–end_date range)
  const tasksByDate = new Map<string, Task[]>();
  calDays.forEach(day => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayTasks = tasks.filter(t =>
      t.start_date && t.end_date && dateKey >= t.start_date && dateKey <= t.end_date
    );
    if (dayTasks.length > 0) tasksByDate.set(dateKey, dayTasks);
  });

  const today = new Date();

  const modalTitle =
    modal.type === 'create' ? 'New Site Event'
    : modal.type === 'edit' ? 'Edit Event'
    : modal.type === 'detail' ? modal.event.title
    : '';

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-1">
            Site Schedule
          </h1>
          <p className="text-[14px] text-text-secondary">
            Concrete pours, inspections, tie-ins, and other site events
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            onClick={() => navigate('/calendar')}
            className="whitespace-nowrap flex-shrink-0 h-10"
          >
            <CalendarDays size={16} className="mr-2" />
            Calendar
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/calendar', { state: { defaultView: 'gantt' } })}
            className="whitespace-nowrap flex-shrink-0 h-10"
          >
            <BarChart2 size={16} className="mr-2" />
            Gantt Chart
          </Button>
          {canEdit && currentJobSite && (
            <Button
              onClick={() => setModal({ type: 'create' })}
              className="whitespace-nowrap flex-shrink-0"
            >
              <Plus size={18} className="mr-2" />
              Add Event
            </Button>
          )}
        </div>
      </div>

      {/* No job site selected */}
      {!currentJobSite && (
        <div className="text-center py-16">
          <p className="text-text-secondary">Select a job site to view the schedule.</p>
        </div>
      )}

      {currentJobSite && (
        <>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors"
            >
              <ChevronLeft size={18} className="text-text-secondary" />
            </button>

            <h2 className="text-[16px] font-semibold text-text-primary">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>

            <button
              onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-bg-hover transition-colors"
            >
              <ChevronRight size={18} className="text-text-secondary" />
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(d => (
              <div
                key={d}
                className="text-center text-[12px] font-medium text-text-secondary py-2"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="text-center py-16">
              <p className="text-text-secondary">Loading...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 border-l border-t border-gray-100 rounded-xl overflow-hidden">
              {calDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, today);

                return (
                  <div
                    key={dateKey}
                    className={`
                      min-h-[80px] md:min-h-[100px] p-1.5 border-r border-b border-gray-100
                      ${isCurrentMonth ? 'bg-bg-secondary' : 'bg-bg-primary'}
                    `}
                  >
                    {/* Date number */}
                    <div className="flex justify-end mb-1">
                      <span
                        className={`
                          w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-medium
                          ${isToday
                            ? 'bg-amber-500 text-white'
                            : isCurrentMonth
                              ? 'text-text-primary'
                              : 'text-text-secondary/40'
                          }
                        `}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Site Events */}
                    <div className="space-y-0.5">
                      {dayEvents.map(ev => (
                        <button
                          key={ev.id}
                          onClick={() => setModal({ type: 'detail', event: ev })}
                          className="w-full text-left px-1.5 py-1 rounded-md bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors group"
                        >
                          <p className="text-[11px] font-medium text-amber-900 truncate leading-tight">
                            {ev.title}
                          </p>
                          {ev.start_time && (
                            <p className="text-[10px] text-amber-700 leading-tight">
                              {formatTime(ev.start_time)}
                            </p>
                          )}
                          {ev.location && (
                            <p className="text-[10px] text-amber-600 truncate leading-tight">
                              {ev.location}
                            </p>
                          )}
                        </button>
                      ))}

                      {/* Tap empty day to add event (editors only) */}
                      {canEdit && isCurrentMonth && dayEvents.length === 0 && (tasksByDate.get(dateKey) || []).length === 0 && (
                        <button
                          onClick={() => setModal({ type: 'create', defaultDate: dateKey })}
                          className="w-full h-6 rounded-md text-[11px] text-text-secondary/0 hover:text-text-secondary/40 hover:bg-bg-hover transition-colors"
                          title={`Add event on ${format(day, 'MMM d')}`}
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* Task badges */}
                    {(() => {
                      const dayTasks = tasksByDate.get(dateKey) || [];
                      if (dayTasks.length === 0) return null;
                      const visible = dayTasks.slice(0, 2);
                      const extra = dayTasks.length - 2;
                      return (
                        <div className={`space-y-0.5 ${dayEvents.length > 0 ? 'mt-1 pt-1 border-t border-gray-100' : ''}`}>
                          {visible.map(t => (
                            <button
                              key={t.id}
                              onClick={() => setSelectedTask(t)}
                              className="w-full text-left px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                              title={t.name}
                            >
                              <p className="text-[10px] font-medium text-indigo-800 truncate leading-tight">
                                {t.name}
                              </p>
                            </button>
                          ))}
                          {extra > 0 && (
                            <button
                              onClick={() => navigate('/calendar')}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 pl-0.5 transition-colors"
                            >
                              +{extra} more
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {/* Upcoming events list (below calendar for quick reference) */}
          {!loading && events.length > 0 && (
            <div className="mt-6">
              <h3 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wide mb-3">
                This Month — {events.length} event{events.length !== 1 ? 's' : ''}
              </h3>
              <div className="space-y-2">
                {events.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setModal({ type: 'detail', event: ev })}
                    className="w-full text-left p-3 bg-bg-secondary border border-gray-100 rounded-xl hover:bg-bg-hover transition-colors flex items-start gap-3"
                  >
                    <div className="flex-shrink-0 w-10 text-center">
                      <p className="text-[11px] text-amber-600 font-semibold uppercase leading-none">
                        {format(parseISO(ev.event_date), 'MMM')}
                      </p>
                      <p className="text-[20px] font-bold text-text-primary leading-tight">
                        {format(parseISO(ev.event_date), 'd')}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-text-primary truncate">{ev.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {ev.start_time && (
                          <span className="flex items-center gap-1 text-[12px] text-text-secondary">
                            <Clock size={11} />
                            {formatTime(ev.start_time)}
                          </span>
                        )}
                        {ev.location && (
                          <span className="flex items-center gap-1 text-[12px] text-text-secondary truncate">
                            <MapPin size={11} />
                            {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <Modal
        isOpen={modal.type !== 'closed'}
        onClose={() => setModal({ type: 'closed' })}
        title={modalTitle}
      >
        {modal.type === 'create' && (
          <EventForm
            initial={{ event_date: modal.defaultDate }}
            onSave={handleCreate}
            onCancel={() => setModal({ type: 'closed' })}
            saving={saving}
          />
        )}
        {modal.type === 'edit' && (
          <EventForm
            initial={{
              title: modal.event.title,
              event_date: modal.event.event_date,
              start_time: modal.event.start_time || '',
              location: modal.event.location || '',
            }}
            onSave={handleUpdate}
            onCancel={() => setModal({ type: 'closed' })}
            saving={saving}
          />
        )}
        {modal.type === 'detail' && (
          <EventDetail
            event={modal.event}
            canEdit={canEdit}
            onEdit={() => setModal({ type: 'edit', event: modal.event })}
            onDelete={() => handleDelete(modal.event.id)}
            onClose={() => setModal({ type: 'closed' })}
          />
        )}
      </Modal>

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          assignments={[]}
        />
      )}
    </div>
  );
}
