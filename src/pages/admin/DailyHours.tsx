import { useState, useEffect, Fragment } from 'react';
import { Calendar as CalendarIcon, UserX, ArrowRightLeft, Clock, Save, Download, RefreshCw, FileText, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useJobSite } from '../../contexts';
import type { Worker, DailyHours as DailyHoursType, Task, User } from '../../types';
import { canEdit, isViewer } from '../../lib/roleHelpers';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface WorkerDayStatus {
  worker: Worker;
  dailyHours?: DailyHoursType;
}

interface EditedHours {
  workerId: string;
  hours: string;
  taskId?: string;
  notes?: string;
}

export function DailyHours() {
  const { currentJobSite } = useJobSite();

  // Use local date instead of UTC to avoid timezone issues
  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(
    getLocalDateString()
  );
  const [workers, setWorkers] = useState<WorkerDayStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
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

  // Inline editing states
  const [editedHours, setEditedHours] = useState<Map<string, EditedHours>>(new Map());

  // Group by role
  const [groupByRole, setGroupByRole] = useState(false);

  // Weekly chart data
  const [weeklyData, setWeeklyData] = useState<{
    worker: Worker;
    hours: { date: string; hours: number; notes?: string; status?: string }[];
    totalHours: number;
  }[]>([]);
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);

  useEffect(() => {
    if (currentJobSite) {
      loadData();
    }
  }, [selectedDate, currentJobSite?.id]);

  useEffect(() => {
    // Get current user ID and role
    const loadCurrentUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUserId(authUser.id);
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();
        if (userData) {
          setCurrentUser(userData);
        }
      }
    };
    loadCurrentUser();
  }, []);

  const loadData = async () => {
    if (!currentJobSite) {
      setWorkers([]);
      setTasks([]);
      setLoading(false);
      return;
    }

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

      // Load workers filtered by current job site
      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('*')
        .eq('organization_id', userData.org_id)
        .eq('job_site_id', currentJobSite.id)
        .eq('status', 'active')
        .order('name');

      if (workersError) throw workersError;

      // Load daily hours for selected date (filtered via worker join)
      const workerIds = (workersData || []).map(w => w.id);
      const { data: dailyHoursData, error: dailyHoursError } = await supabase
        .from('daily_hours')
        .select('*, worker:workers(*), task:tasks!task_id(*), transferred_to_task:tasks!transferred_to_task_id(*)')
        .eq('organization_id', userData.org_id)
        .eq('log_date', selectedDate)
        .in('worker_id', workerIds.length > 0 ? workerIds : ['00000000-0000-0000-0000-000000000000']);

      if (dailyHoursError) throw dailyHoursError;

      // Load tasks filtered by current job site
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', userData.org_id)
        .eq('job_site_id', currentJobSite.id)
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
    if (!currentJobSite) {
      toast.error('No job site selected');
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

      // Calculate start of week (Sunday) using local dates
      const [year, month, day] = selectedDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const startOfWeek = new Date(year, month - 1, day - dayOfWeek);
      const endOfWeek = new Date(year, month - 1, day - dayOfWeek + 6);

      // Get worker IDs for current job site
      const workerIds = workers.map(w => w.worker.id);

      // Load all daily hours for the week (filtered by workers in current job site)
      const { data: weeklyHours, error } = await supabase
        .from('daily_hours')
        .select('*, worker:workers(*)')
        .eq('organization_id', userData.org_id)
        .in('worker_id', workerIds.length > 0 ? workerIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('log_date', getLocalDateString(startOfWeek))
        .lte('log_date', getLocalDateString(endOfWeek));

      if (error) throw error;

      // Create a map to store hours by worker and date
      const workerHoursMap = new Map<string, {
        worker: Worker;
        hoursByDate: Map<string, { hours: number; notes?: string; status?: string }>
      }>();

      workers.forEach(({ worker }) => {
        workerHoursMap.set(worker.id, {
          worker,
          hoursByDate: new Map()
        });
      });

      (weeklyHours || []).forEach((dh) => {
        if (dh.worker) {
          const workerData = workerHoursMap.get(dh.worker_id);
          if (workerData) {
            workerData.hoursByDate.set(dh.log_date, {
              hours: dh.status === 'worked' ? (dh.hours_worked || 0) : 0,
              notes: dh.notes,
              status: dh.status
            });
          }
        }
      });

      // Convert to array format with all 7 days
      const weeklyDataArray = Array.from(workerHoursMap.values()).map((data) => {
        const hours: { date: string; hours: number; notes?: string; status?: string }[] = [];
        let totalHours = 0;

        // Generate all 7 days of the week
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
          const dateStr = getLocalDateString(currentDate);
          const dayData = data.hoursByDate.get(dateStr);
          const hoursForDay = dayData?.hours || 0;
          hours.push({
            date: dateStr,
            hours: hoursForDay,
            notes: dayData?.notes,
            status: dayData?.status
          });
          totalHours += hoursForDay;
        }

        return {
          worker: data.worker,
          hours,
          totalHours,
        };
      });

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

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('daily_hours')
        .upsert({
          worker_id: selectedWorker.id,
          organization_id: userData.org_id,
          log_date: selectedDate,
          status: 'off',
          notes,
          hours_worked: 0,
          task_id: null,
          transferred_to_task_id: null,
          logged_by: userId,
        }, {
          onConflict: 'worker_id,log_date,organization_id'
        });

      if (error) throw error;

      toast.success(`${selectedWorker.name} marked as off`);
      setOffModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving off status:', error);
      toast.error('Failed to save status');
    }
  };

  const saveTransferStatus = async () => {
    if (!selectedWorker) {
      toast.error('Please select a worker');
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

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('daily_hours')
        .upsert({
          worker_id: selectedWorker.id,
          organization_id: userData.org_id,
          log_date: selectedDate,
          status: 'transferred',
          notes,
          transferred_to_task_id: transferTaskId || null,
          hours_worked: 8,
          task_id: null,
          logged_by: userId,
        }, {
          onConflict: 'worker_id,log_date,organization_id'
        });

      if (error) throw error;

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

      const hours = parseFloat(hoursWorked) || 8;

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('daily_hours')
        .upsert({
          worker_id: selectedWorker.id,
          organization_id: userData.org_id,
          log_date: selectedDate,
          status: 'worked',
          notes,
          task_id: workTaskId || null,
          hours_worked: hours,
          transferred_to_task_id: null,
          logged_by: userId,
        }, {
          onConflict: 'worker_id,log_date,organization_id'
        });

      if (error) throw error;

      toast.success(`Hours logged for ${selectedWorker.name}`);
      setHoursModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving hours:', error);
      toast.error('Failed to save hours');
    }
  };

  const handleInlineHoursChange = (workerId: string, hours: string) => {
    const newEditedHours = new Map(editedHours);
    const existing = newEditedHours.get(workerId) || { workerId, hours: '8' };
    newEditedHours.set(workerId, { ...existing, hours });
    setEditedHours(newEditedHours);
  };

  const saveAllHours = async () => {
    if (editedHours.size === 0) {
      toast.info('No hours to save');
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

      // Prepare all records for batch upsert
      const records = Array.from(editedHours.values()).map((edit) => ({
        worker_id: edit.workerId,
        organization_id: userData.org_id,
        log_date: selectedDate,
        status: 'worked' as const,
        hours_worked: parseFloat(edit.hours) || 0,
        task_id: edit.taskId || null,
        notes: edit.notes || null,
        transferred_to_task_id: null,
        logged_by: userId,
      }));

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('daily_hours')
        .upsert(records, {
          onConflict: 'worker_id,log_date,organization_id'
        });

      if (error) throw error;

      toast.success(`Hours saved for ${editedHours.size} worker(s)`);
      setEditedHours(new Map());
      loadData();
    } catch (error) {
      console.error('Error saving all hours:', error);
      toast.error('Failed to save hours');
    }
  };

  const exportToCSV = () => {
    if (weeklyData.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Calculate start of week for the filename using local dates
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(year, month - 1, day - dayOfWeek);

    // Create CSV content
    const headers = ['Worker', 'Role', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Total'];
    const rows = weeklyData.map(({ worker, hours, totalHours }) => [
      worker.name,
      worker.role,
      ...hours.map(h => h.hours > 0 ? h.hours.toFixed(1) : '0'),
      totalHours.toFixed(1)
    ]);

    // Add totals row
    const dayTotals = [0, 1, 2, 3, 4, 5, 6].map(dayIndex => 
      weeklyData.reduce((sum, w) => sum + (w.hours[dayIndex]?.hours || 0), 0).toFixed(1)
    );
    const grandTotal = weeklyData.reduce((sum, w) => sum + w.totalHours, 0).toFixed(1);
    rows.push(['TOTAL', '', ...dayTotals, grandTotal]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `weekly_hours_${getLocalDateString(startOfWeek)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Weekly hours exported to CSV');
  };

  const exportToPDF = () => {
    if (weeklyData.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Calculate start of week for the filename using local dates
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(year, month - 1, day - dayOfWeek);
    const endOfWeek = new Date(year, month - 1, day - dayOfWeek + 6);

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text('Weekly Hours Summary', 14, 15);
    
    doc.setFontSize(10);
    const formatDate = (d: Date) => {
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const y = String(d.getFullYear()).slice(-2);
      return `${m}/${day}/${y}`;
    };
    doc.text(`Week: ${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`, 14, 22);
    
    // Table headers with dates
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const headers = ['Worker', 'Role'];
    
    // Add day headers with dates in MM/DD/YY format
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
      const dateStr = formatDate(currentDate);
      headers.push(`${dayNames[i]}\n${dateStr}`);
    }
    headers.push('Total');
    let yPosition = 32;
    
    // Draw header row
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const colWidths = [35, 20, 12, 12, 12, 12, 12, 12, 12, 15];
    let xPosition = 14;
    
    headers.forEach((header, i) => {
      const lines = header.split('\n');
      doc.text(lines[0], xPosition, yPosition);
      if (lines[1]) {
        doc.setFontSize(7);
        doc.text(lines[1], xPosition, yPosition + 3);
        doc.setFontSize(8);
      }
      xPosition += colWidths[i];
    });
    
    yPosition += 9;
    doc.setFont('helvetica', 'normal');
    
    // Draw data rows
    weeklyData.forEach(({ worker, hours, totalHours }) => {
      xPosition = 14;
      
      // Check if we need a new page
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      
      const row = [
        worker.name,
        worker.role,
        ...hours.map(h => h.hours > 0 ? h.hours.toFixed(1) : '-'),
        totalHours.toFixed(1)
      ];
      
      row.forEach((cell, i) => {
        const text = String(cell);
        doc.text(text, xPosition, yPosition);
        xPosition += colWidths[i];
      });
      
      yPosition += 6;
    });
    
    // Draw totals row
    yPosition += 2;
    doc.setFont('helvetica', 'bold');
    xPosition = 14;

    const dayTotals = [0, 1, 2, 3, 4, 5, 6].map(dayIndex =>
      weeklyData.reduce((sum, w) => sum + (w.hours[dayIndex]?.hours || 0), 0).toFixed(1)
    );
    const grandTotal = weeklyData.reduce((sum, w) => sum + w.totalHours, 0).toFixed(1);

    const totalRow = ['TOTAL', '', ...dayTotals, grandTotal];
    totalRow.forEach((cell, i) => {
      doc.text(String(cell), xPosition, yPosition);
      xPosition += colWidths[i];
    });

    // Collect all notes
    const allNotes: { worker: string; day: string; date: string; notes: string }[] = [];
    weeklyData.forEach(({ worker, hours }) => {
      hours.forEach((day, index) => {
        if (day.notes) {
          const noteDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + index);
          allNotes.push({
            worker: worker.name,
            day: dayNames[index],
            date: formatDate(noteDate),
            notes: day.notes
          });
        }
      });
    });

    // Add notes section if there are any
    if (allNotes.length > 0) {
      yPosition += 15;

      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      // Notes header
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes', 14, yPosition);
      yPosition += 8;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');

      allNotes.forEach(({ worker, day, date, notes }) => {
        // Check if we need a new page
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        // Worker and day
        doc.setFont('helvetica', 'bold');
        doc.text(`${worker} - ${day} (${date}):`, 14, yPosition);
        yPosition += 4;

        // Note text - wrap long notes
        doc.setFont('helvetica', 'normal');
        const maxWidth = 180;
        const splitNotes = doc.splitTextToSize(notes, maxWidth);
        splitNotes.forEach((line: string) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 18, yPosition);
          yPosition += 4;
        });

        yPosition += 3;
      });
    }

    // Save the PDF
    doc.save(`weekly_hours_${getLocalDateString(startOfWeek)}.pdf`);
    toast.success('Weekly hours exported to PDF');
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

      {/* Read-only notice for viewers */}
      {isViewer(currentUser) && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            You are viewing in read-only mode. You can view hours and export reports, but cannot log or modify hours.
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon size={20} className="text-text-secondary" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button onClick={loadData} variant="ghost" title="Refresh worker list">
            <RefreshCw size={16} />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {canEdit(currentUser) && editedHours.size > 0 && (
            <Button onClick={saveAllHours} variant="primary">
              <Check size={16} className="mr-2" />
              Accept All ({editedHours.size})
            </Button>
          )}
          <Button onClick={loadWeeklyData} variant="secondary">
            View Weekly Summary
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-center p-4 font-semibold w-12">#</th>
                <th className="text-left p-4 font-semibold">Worker</th>
                <th
                  className="text-left p-4 font-semibold cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => setGroupByRole(!groupByRole)}
                  title={groupByRole ? 'Click to ungroup' : 'Click to group by role'}
                >
                  <span className="inline-flex items-center gap-1">
                    Role
                    {groupByRole ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </th>
                <th className="text-left p-4 font-semibold">Status</th>
                <th className="text-left p-4 font-semibold">Hours</th>
                <th className="text-left p-4 font-semibold">Task/Notes</th>
                <th className="text-right p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const renderWorkerRow = ({ worker, dailyHours }: WorkerDayStatus, rowNum: number) => {
                  const edited = editedHours.get(worker.id);
                  const currentHours = edited?.hours || dailyHours?.hours_worked?.toString() || '8';
                  const isEdited = edited !== undefined;

                  return (
                    <tr key={worker.id} className={`border-b border-border hover:bg-bg-hover ${isEdited ? 'bg-yellow-500/5' : ''}`}>
                      <td className="p-4 text-center text-text-secondary">{rowNum}</td>
                      <td className="p-4 font-medium">{worker.name}</td>
                      <td className="p-4 text-text-secondary capitalize">{worker.role}</td>
                      <td className="p-4">{getStatusBadge(dailyHours)}</td>
                      <td className="p-4">
                        {canEdit(currentUser) && (!dailyHours || dailyHours.status === 'worked') ? (
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={currentHours}
                            onChange={(e) => handleInlineHoursChange(worker.id, e.target.value)}
                            className="w-20"
                            placeholder="8"
                          />
                        ) : dailyHours?.status === 'worked' || dailyHours?.status === 'transferred' ? (
                          `${dailyHours.hours_worked || 0}h`
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-4 text-text-secondary text-sm max-w-xs truncate">
                        {dailyHours?.status === 'transferred'
                          ? dailyHours.transferred_to_task
                            ? `→ ${dailyHours.transferred_to_task.name}`
                            : `→ ${dailyHours.notes || 'Transferred to another project'}`
                          : dailyHours?.task
                          ? dailyHours.task.name
                          : dailyHours?.notes || '-'}
                      </td>
                      <td className="p-4">
                        {canEdit(currentUser) ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleLogHours(worker)}
                              title="Log hours with details"
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
                        ) : (
                          <div className="text-text-secondary text-sm text-right">View only</div>
                        )}
                      </td>
                    </tr>
                  );
                };

                if (groupByRole) {
                  const roleGroups = new Map<string, WorkerDayStatus[]>();
                  workers.forEach((ws) => {
                    const role = ws.worker.role || 'unassigned';
                    if (!roleGroups.has(role)) roleGroups.set(role, []);
                    roleGroups.get(role)!.push(ws);
                  });

                  let runningIndex = 0;
                  return Array.from(roleGroups.entries()).map(([role, group]) => {
                    const rows = group.map((ws) => {
                      runningIndex++;
                      return renderWorkerRow(ws, runningIndex);
                    });
                    return (
                      <Fragment key={role}>
                        <tr className="bg-bg-secondary">
                          <td colSpan={7} className="p-3 font-semibold capitalize">
                            {role}
                            <span className="ml-2 text-xs font-normal text-text-secondary">
                              ({group.length} {group.length === 1 ? 'person' : 'people'})
                            </span>
                          </td>
                        </tr>
                        {rows}
                      </Fragment>
                    );
                  });
                }

                return workers.map((ws, index) => renderWorkerRow(ws, index + 1));
              })()}
            </tbody>
            {workers.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={7} className="p-4 font-semibold text-right text-text-secondary">
                    Total on site: {workers.length} {workers.length === 1 ? 'person' : 'people'}
                  </td>
                </tr>
              </tfoot>
            )}
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
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-text-secondary">
              Transfer worker to another project for the day or week. Task selection is optional.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Transfer To Task (Optional)</label>
            <select
              value={transferTaskId}
              onChange={(e) => setTransferTaskId(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="">No specific task - Transferred to another project</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name} {task.location ? `- ${task.location}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Where are they being transferred? (e.g., 'Working at XYZ project', 'Helping ABC Construction')"
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
          <div className="flex justify-end gap-2 mb-4">
            <Button onClick={exportToCSV} variant="secondary">
              <Download size={16} className="mr-2" />
              CSV
            </Button>
            <Button onClick={exportToPDF} variant="secondary">
              <FileText size={16} className="mr-2" />
              PDF
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-semibold sticky left-0 bg-bg-secondary">Worker</th>
                  {(() => {
                    const [year, month, day] = selectedDate.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    const dayOfWeek = date.getDay();
                    const startOfWeek = new Date(year, month - 1, day - dayOfWeek);
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    
                    return dayNames.map((dayName, i) => {
                      const currentDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
                      const m = String(currentDate.getMonth() + 1).padStart(2, '0');
                      const d = String(currentDate.getDate()).padStart(2, '0');
                      const y = String(currentDate.getFullYear()).slice(-2);
                      const dateStr = `${m}/${d}/${y}`;
                      
                      return (
                        <th key={i} className="text-center p-2 font-semibold">
                          <div>{dayName}</div>
                          <div className="text-xs font-normal text-text-secondary">{dateStr}</div>
                        </th>
                      );
                    });
                  })()}
                  <th className="text-right p-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map(({ worker, hours, totalHours }) => (
                  <tr key={worker.id} className="border-b border-border">
                    <td className="p-2 font-medium sticky left-0 bg-bg-secondary">{worker.name}</td>
                    {hours.map((day, index) => (
                      <td key={index} className="p-2 text-center align-top">
                        <div className="flex flex-col items-center gap-1">
                          <div className="font-medium">
                            {day.hours > 0 ? day.hours.toFixed(1) : '-'}
                          </div>
                          {day.notes && (
                            <div className="text-xs text-text-secondary max-w-[100px] truncate" title={day.notes}>
                              {day.notes}
                            </div>
                          )}
                          {day.status === 'off' && (
                            <div className="text-xs px-1 rounded bg-red-500/20 text-red-600 dark:text-red-400">
                              Off
                            </div>
                          )}
                          {day.status === 'transferred' && (
                            <div className="text-xs px-1 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">
                              Transferred
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold">{totalHours.toFixed(1)}h</td>
                  </tr>
                ))}
                {weeklyData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-text-secondary">
                      No hours logged this week
                    </td>
                  </tr>
                )}
              </tbody>
              {weeklyData.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td className="p-2 text-right">Total:</td>
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                      const dayTotal = weeklyData.reduce((sum, w) => sum + (w.hours[dayIndex]?.hours || 0), 0);
                      return (
                        <td key={dayIndex} className="p-2 text-center">
                          {dayTotal > 0 ? dayTotal.toFixed(1) : '-'}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right">
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
