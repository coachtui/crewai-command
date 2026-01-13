import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, UserX, ArrowRightLeft, Clock, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Worker, DailyHours as DailyHoursType, Task } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { toast } from 'sonner';

interface WorkerDayStatus {
  worker: Worker;
  dailyHours?: DailyHoursType;
}

export function DailyHours() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [workers, setWorkers] = useState<WorkerDayStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  
  // Modal states
  const [offModalOpen, setOffModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  
  // Form states
  const [notes, setNotes] = useState('');
  const [transferTaskId, setTransferTaskId] = useState('');
  const [workTaskId, setWorkTaskId] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8');

  // Weekly chart data
  const [weeklyData, setWeeklyData] = useState<{
    worker: Worker;
    hours: { date: string; hours: number }[];
    totalHours: number;
  }[]>([]);
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    // Get current user ID
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's org_id
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      // Load workers
      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('*')
        .eq('org_id', userData.org_id)
        .eq('status', 'active')
        .order('name');

      if (workersError) throw workersError;

      // Load daily hours for selected date
      const { data: dailyHoursData, error: dailyHoursError } = await supabase
        .from('daily_hours')
        .select('*, worker:workers(*), task:tasks!task_id(*), transferred_to_task:tasks!transferred_to_task_id(*)')
        .eq('org_id', userData.org_id)
        .eq('log_date', selectedDate);

      if (dailyHoursError) throw dailyHoursError;

      // Load tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('org_id', userData.org_id)
        .in('status', ['active', 'planned'])
        .order('name');

      if (tasksError) throw tasksError;

      // Combine workers with their daily hours
      const workerStatuses: WorkerDayStatus[] = (workersData || []).map((worker) => ({
        worker,
        dailyHours: (dailyHoursData || []).find((dh) => dh.worker_id === worker.id),
      }));

      setWorkers(workerStatuses);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadWeeklyData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      // Calculate start of week (Sunday)
      const date = new Date(selectedDate);
      const dayOfWeek = date.getDay();
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // Load all daily hours for the week
      const { data: weeklyHours, error } = await supabase
        .from('daily_hours')
        .select('*, worker:workers(*)')
        .eq('org_id', userData.org_id)
        .gte('log_date', startOfWeek.toISOString().split('T')[0])
        .lte('log_date', endOfWeek.toISOString().split('T')[0]);

      if (error) throw error;

      // Group by worker
      const workerHoursMap = new Map<string, { worker: Worker; hours: { date: string; hours: number }[] }>();
      
      workers.forEach(({ worker }) => {
        workerHoursMap.set(worker.id, { worker, hours: [] });
      });

      (weeklyHours || []).forEach((dh) => {
        if (dh.worker && dh.status === 'worked') {
          const workerData = workerHoursMap.get(dh.worker_id);
          if (workerData) {
            workerData.hours.push({
              date: dh.log_date,
              hours: dh.hours_worked || 0,
            });
          }
        }
      });

      const weeklyDataArray = Array.from(workerHoursMap.values()).map((data) => ({
        worker: data.worker,
        hours: data.hours,
        totalHours: data.hours.reduce((sum, h) => sum + h.hours, 0),
      }));

      setWeeklyData(weeklyDataArray);
      setShowWeeklyChart(true);
    } catch (error) {
      console.error('Error loading weekly data:', error);
      toast.error('Failed to load weekly data');
    }
  };

  const handleMarkOff = (worker: Worker) => {
    setSelectedWorker(worker);
    setNotes('');
    setOffModalOpen(true);
  };

  const handleMarkTransferred = (worker: Worker) => {
    setSelectedWorker(worker);
    setNotes('');
    setTransferTaskId('');
    setTransferModalOpen(true);
  };

  const handleLogHours = (worker: Worker) => {
    setSelectedWorker(worker);
    const existing = workers.find((w) => w.worker.id === worker.id)?.dailyHours;
    setWorkTaskId(existing?.task_id || '');
    setHoursWorked(existing?.hours_worked?.toString() || '8');
    setNotes(existing?.notes || '');
    setHoursModalOpen(true);
  };

  const saveOffStatus = async () => {
    if (!selectedWorker) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      // Check if entry exists
      const existing = workers.find((w) => w.worker.id === selectedWorker.id)?.dailyHours;

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('daily_hours')
          .update({
            status: 'off',
            notes,
            hours_worked: 0,
            task_id: null,
            transferred_to_task_id: null,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('daily_hours')
          .insert({
            org_id: userData.org_id,
            worker_id: selectedWorker.id,
            log_date: selectedDate,
            status: 'off',
            notes,
            hours_worked: 0,
            logged_by: userId,
          });

        if (error) throw error;
      }

      toast.success(`${selectedWorker.name} marked as off`);
      setOffModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving off status:', error);
      toast.error('Failed to save status');
    }
  };

  const saveTransferStatus = async () => {
    if (!selectedWorker || !transferTaskId) {
      toast.error('Please select a task to transfer to');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      const existing = workers.find((w) => w.worker.id === selectedWorker.id)?.dailyHours;

      if (existing) {
        const { error } = await supabase
          .from('daily_hours')
          .update({
            status: 'transferred',
            notes,
            transferred_to_task_id: transferTaskId,
            hours_worked: 8,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_hours')
          .insert({
            org_id: userData.org_id,
            worker_id: selectedWorker.id,
            log_date: selectedDate,
            status: 'transferred',
            notes,
            transferred_to_task_id: transferTaskId,
            hours_worked: 8,
            logged_by: userId,
          });

        if (error) throw error;
      }

      toast.success(`${selectedWorker.name} marked as transferred`);
      setTransferModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving transfer status:', error);
      toast.error('Failed to save status');
    }
  };

  const saveHours = async () => {
    if (!selectedWorker) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      const existing = workers.find((w) => w.worker.id === selectedWorker.id)?.dailyHours;
      const hours = parseFloat(hoursWorked) || 8;

      if (existing) {
        const { error } = await supabase
          .from('daily_hours')
          .update({
            status: 'worked',
            notes,
            task_id: workTaskId || null,
            hours_worked: hours,
            transferred_to_task_id: null,
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_hours')
          .insert({
            org_id: userData.org_id,
            worker_id: selectedWorker.id,
            log_date: selectedDate,
            status: 'worked',
            notes,
            task_id: workTaskId || null,
            hours_worked: hours,
            logged_by: userId,
          });

        if (error) throw error;
      }

      toast.success(`Hours logged for ${selectedWorker.name}`);
      setHoursModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving hours:', error);
      toast.error('Failed to save hours');
    }
  };

  const getStatusBadge = (status?: DailyHoursType) => {
    if (!status) {
      return <span className="px-2 py-1 text-xs rounded bg-gray-500 text-white">Not Logged</span>;
    }
    
    switch (status.status) {
      case 'worked':
        return <span className="px-2 py-1 text-xs rounded bg-green-500 text-white">Worked</span>;
      case 'off':
        return <span className="px-2 py-1 text-xs rounded bg-red-500 text-white">Off</span>;
      case 'transferred':
        return <span className="px-2 py-1 text-xs rounded bg-blue-500 text-white">Transferred</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded bg-gray-500 text-white">Unknown</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Daily Hours Log</h1>
        <p className="text-text-secondary">Track worker hours, days off, and job transfers</p>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon size={20} className="text-text-secondary" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button onClick={loadWeeklyData} variant="secondary">
          View Weekly Summary
        </Button>
      </div>

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 font-semibold">Worker</th>
                <th className="text-left p-4 font-semibold">Role</th>
                <th className="text-left p-4 font-semibold">Status</th>
                <th className="text-left p-4 font-semibold">Hours</th>
                <th className="text-left p-4 font-semibold">Task/Notes</th>
                <th className="text-right p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(({ worker, dailyHours }) => (
                <tr key={worker.id} className="border-b border-border hover:bg-bg-hover">
                  <td className="p-4 font-medium">{worker.name}</td>
                  <td className="p-4 text-text-secondary capitalize">{worker.role}</td>
                  <td className="p-4">{getStatusBadge(dailyHours)}</td>
                  <td className="p-4">
                    {dailyHours?.status === 'worked' || dailyHours?.status === 'transferred'
                      ? `${dailyHours.hours_worked || 0}h`
                      : '-'}
                  </td>
                  <td className="p-4 text-text-secondary text-sm max-w-xs truncate">
                    {dailyHours?.status === 'transferred' && dailyHours.transferred_to_task
                      ? `→ ${dailyHours.transferred_to_task.name}`
                      : dailyHours?.task
                      ? dailyHours.task.name
                      : dailyHours?.notes || '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleLogHours(worker)}
                        title="Log hours"
                      >
                        <Clock size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkOff(worker)}
                        title="Mark as off"
                      >
                        <UserX size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleMarkTransferred(worker)}
                        title="Mark as transferred"
                      >
                        <ArrowRightLeft size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Off Modal */}
      <Modal
        isOpen={offModalOpen}
        onClose={() => setOffModalOpen(false)}
        title={`Mark ${selectedWorker?.name} as Off`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for being off (sick, vacation, etc.)"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setOffModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveOffStatus}>
              <Save size={16} className="mr-2" />
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title={`Transfer ${selectedWorker?.name}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Transfer To Task *</label>
            <select
              value={transferTaskId}
              onChange={(e) => setTransferTaskId(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="">Select a task</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name} {task.location ? `- ${task.location}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for transfer"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTransferStatus}>
              <Save size={16} className="mr-2" />
              Save Transfer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hours Modal */}
      <Modal
        isOpen={hoursModalOpen}
        onClose={() => setHoursModalOpen(false)}
        title={`Log Hours for ${selectedWorker?.name}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Task (Optional)</label>
            <select
              value={workTaskId}
              onChange={(e) => setWorkTaskId(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="">No specific task</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name} {task.location ? `- ${task.location}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Hours Worked</label>
            <Input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about the work"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setHoursModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveHours}>
              <Save size={16} className="mr-2" />
              Save Hours
            </Button>
          </div>
        </div>
      </Modal>

      {/* Weekly Summary Modal */}
      <Modal
        isOpen={showWeeklyChart}
        onClose={() => setShowWeeklyChart(false)}
        title="Weekly Hours Summary"
        size="lg"
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-semibold">Worker</th>
                  <th className="text-left p-3 font-semibold">Role</th>
                  <th className="text-center p-3 font-semibold">Days Worked</th>
                  <th className="text-right p-3 font-semibold">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map(({ worker, hours, totalHours }) => (
                  <tr key={worker.id} className="border-b border-border">
                    <td className="p-3 font-medium">{worker.name}</td>
                    <td className="p-3 text-text-secondary capitalize">{worker.role}</td>
                    <td className="p-3 text-center">{hours.length}</td>
                    <td className="p-3 text-right font-semibold">{totalHours.toFixed(1)}h</td>
                  </tr>
                ))}
                {weeklyData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-text-secondary">
                      No hours logged this week
                    </td>
                  </tr>
                )}
              </tbody>
              {weeklyData.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td colSpan={3} className="p-3 text-right">Total:</td>
                    <td className="p-3 text-right">
                      {weeklyData.reduce((sum, w) => sum + w.totalHours, 0).toFixed(1)}h
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
