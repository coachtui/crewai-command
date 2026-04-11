import { useState, useEffect, Fragment } from 'react';
import { Calendar as CalendarIcon, UserX, ArrowRightLeft, Clock, Save, Download, RefreshCw, FileText, Check, ChevronDown, ChevronRight, NotebookPen, Printer } from 'lucide-react';
import { DailyNotesModal } from '../../components/daily-notes/DailyNotesModal';
import { supabase } from '../../lib/supabase';
import { useJobSite } from '../../contexts';
import type { Worker, DailyHours as DailyHoursType, Task, User, Crew, JobSite, DailyNote } from '../../types';
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
  otHours?: string;
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
  const [transferJobSiteId, setTransferJobSiteId] = useState('');
  const [workTaskId, setWorkTaskId] = useState('');
  const [hoursWorked, setHoursWorked] = useState('8');
  const [otHoursWorked, setOtHoursWorked] = useState('0');

  // Job sites for transfer dropdown
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [transferSiteTasks, setTransferSiteTasks] = useState<Task[]>([]);

  // Inline editing states
  const [editedHours, setEditedHours] = useState<Map<string, EditedHours>>(new Map());

  // Group by role
  const [groupByRole, setGroupByRole] = useState(false);

  // Group by crew
  const [groupByCrew, setGroupByCrew] = useState(false);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [collapsedCrews, setCollapsedCrews] = useState<Set<string>>(new Set());
  // workerId → crewId at current site
  const [siteCrewMap, setSiteCrewMap] = useState<Map<string, string>>(new Map());

  // Daily notes modal
  const [dailyNotesOpen, setDailyNotesOpen] = useState(false);

  // PDF preview modal
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  // Worker weekly summary modal
  const [workerSummaryOpen, setWorkerSummaryOpen] = useState(false);
  const [workerSummaryWorker, setWorkerSummaryWorker] = useState<Worker | null>(null);
  const [workerSummaryLoading, setWorkerSummaryLoading] = useState(false);
  const [workerSummaryDates, setWorkerSummaryDates] = useState<string[]>([]);
  const [workerSummaryRows, setWorkerSummaryRows] = useState<{
    siteId: string;
    siteName: string;
    days: (number | null)[];
    otDays: (number | null)[];
    total: number;
    totalOt: number;
  }[]>([]);

  // Daily notes summary (displayed inline below the worker list)
  const [dailyNote, setDailyNote] = useState<DailyNote | null>(null);
  const [dailyNoteError, setDailyNoteError] = useState(false);

  // Weekly chart data
  const [weeklyData, setWeeklyData] = useState<{
    worker: Worker;
    hours: { date: string; hours: number; otHours: number; notes?: string; status?: string }[];
    totalHours: number;
    totalOtHours: number;
  }[]>([]);
  const [showWeeklyChart, setShowWeeklyChart] = useState(false);
  const [weeklyViewMode, setWeeklyViewMode] = useState<'flat' | 'crew' | 'role'>('flat');

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
      setEditedHours(new Map()); // clear pending edits when site or date changes
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's org_id
      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (!userData) return;

      // Load workers and daily notes in parallel — both only need orgId + siteId
      setDailyNoteError(false);
      const [workersResult, noteResult] = await Promise.all([
        supabase
          .from('workers')
          .select('*, crew:crews(id, name, color)')
          .eq('organization_id', userData.org_id)
          .eq('job_site_id', currentJobSite.id)
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('daily_notes')
          .select('*')
          .eq('organization_id', userData.org_id)
          .eq('job_site_id', currentJobSite.id)
          .eq('note_date', selectedDate)
          .maybeSingle(),
      ]);

      const { data: workersData, error: workersError } = workersResult;
      if (noteResult.error) {
        setDailyNoteError(true);
        setDailyNote(null);
      } else {
        setDailyNote(noteResult.data ?? null);
      }

      if (workersError) throw workersError;

      // Build combined worker list: primary site workers + any temp-assigned workers
      let allWorkers = [...(workersData || [])];

      const { data: tempAssignments, error: tempErr } = await supabase
        .from('worker_site_assignments')
        .select('worker_id')
        .eq('job_site_id', currentJobSite.id)
        .eq('is_active', true)
        .or(`and(start_date.is.null,end_date.is.null),and(start_date.lte.${selectedDate},end_date.is.null),and(start_date.is.null,end_date.gte.${selectedDate}),and(start_date.lte.${selectedDate},end_date.gte.${selectedDate})`);

      if (tempErr) console.error('worker_site_assignments fetch error:', tempErr);

      if (tempAssignments?.length) {
        const primaryIds = new Set(allWorkers.map(w => w.id));
        const extraIds = tempAssignments.map(a => a.worker_id).filter(id => !primaryIds.has(id));
        if (extraIds.length) {
          const { data: extraWorkers, error: extraErr } = await supabase
            .from('workers')
            .select('*, crew:crews(id, name, color)')
            .in('id', extraIds)
            .eq('organization_id', userData.org_id)
            .eq('status', 'active')
            .order('name');
          if (extraErr) console.error('extra workers fetch error:', extraErr);
          if (extraWorkers?.length) {
            allWorkers = [...allWorkers, ...extraWorkers];
          }
        }
      }

      // Load daily hours for selected date (filtered via worker join)
      const workerIds = allWorkers.map(w => w.id);
      const { data: dailyHoursData, error: dailyHoursError } = await supabase
        .from('daily_hours')
        .select('*, worker:workers(*), task:tasks!task_id(*), transferred_to_task:tasks!transferred_to_task_id(*), transferred_to_job_site:job_sites!transferred_to_job_site_id(*)')
        .eq('organization_id', userData.org_id)
        .eq('job_site_id', currentJobSite.id)
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

      // Load crews for current job site
      const { data: crewsData, error: crewsError } = await supabase
        .from('crews')
        .select('*')
        .eq('job_site_id', currentJobSite.id)
        .order('name');
      if (crewsError) throw crewsError;
      setCrews(crewsData || []);
      // Collapse named crews by default, but keep "No Crew" expanded so temp-assigned workers are visible
      setCollapsedCrews(new Set((crewsData || []).map(c => c.id)));

      // Fetch per-site crew assignments for all workers at this site
      const allWorkerIds = allWorkers.map(w => w.id);
      const { data: crewAssignments } = allWorkerIds.length
        ? await supabase
            .from('worker_crew_assignments')
            .select('worker_id, crew_id')
            .eq('job_site_id', currentJobSite.id)
            .in('worker_id', allWorkerIds)
        : { data: [] };

      const crewMap = new Map<string, string>();
      (crewAssignments || []).forEach(a => crewMap.set(a.worker_id, a.crew_id));
      setSiteCrewMap(crewMap);

      // Load active job sites for transfer dropdown
      const { data: jobSitesData } = await supabase
        .from('job_sites')
        .select('*')
        .eq('organization_id', userData.org_id)
        .eq('status', 'active')
        .order('name');
      setJobSites(jobSitesData || []);

      // Combine workers with their daily hours
      const workerStatuses: WorkerDayStatus[] = allWorkers.map((worker) => ({
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
        .eq('job_site_id', currentJobSite.id)
        .in('worker_id', workerIds.length > 0 ? workerIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('log_date', getLocalDateString(startOfWeek))
        .lte('log_date', getLocalDateString(endOfWeek));

      if (error) throw error;

      // Create a map to store hours by worker and date
      const workerHoursMap = new Map<string, {
        worker: Worker;
        hoursByDate: Map<string, { hours: number; otHours: number; notes?: string; status?: string }>
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
              otHours: dh.status === 'worked' ? (dh.ot_hours || 0) : 0,
              notes: dh.notes,
              status: dh.status
            });
          }
        }
      });

      // Convert to array format with all 7 days
      const weeklyDataArray = Array.from(workerHoursMap.values()).map((data) => {
        const hours: { date: string; hours: number; otHours: number; notes?: string; status?: string }[] = [];
        let totalHours = 0;
        let totalOtHours = 0;

        // Generate all 7 days of the week
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
          const dateStr = getLocalDateString(currentDate);
          const dayData = data.hoursByDate.get(dateStr);
          const hoursForDay = dayData?.hours || 0;
          const otForDay = dayData?.otHours || 0;
          hours.push({
            date: dateStr,
            hours: hoursForDay,
            otHours: otForDay,
            notes: dayData?.notes,
            status: dayData?.status
          });
          totalHours += hoursForDay;
          totalOtHours += otForDay;
        }

        return {
          worker: data.worker,
          hours,
          totalHours,
          totalOtHours,
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
    setTransferJobSiteId('');
    setTransferSiteTasks([]);
    setTransferModalOpen(true);
  };

  const handleTransferJobSiteChange = async (siteId: string) => {
    setTransferJobSiteId(siteId);
    setTransferTaskId('');
    if (!siteId) {
      setTransferSiteTasks([]);
      return;
    }
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('job_site_id', siteId)
      .in('status', ['active', 'planned'])
      .order('name');
    setTransferSiteTasks(data || []);
  };

  const handleLogHours = (worker: Worker) => {
    setSelectedWorker(worker);
    const existing = workers.find((w) => w.worker.id === worker.id)?.dailyHours;
    setWorkTaskId(existing?.task_id || '');
    setHoursWorked(existing?.hours_worked?.toString() || '8');
    setOtHoursWorked(existing?.ot_hours?.toString() || '0');
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
          job_site_id: currentJobSite?.id ?? null,
          status: 'off',
          notes,
          hours_worked: 0,
          ot_hours: 0,
          task_id: null,
          transferred_to_task_id: null,
          transferred_to_job_site_id: null,
          logged_by: userId,
        }, {
          onConflict: 'worker_id,log_date,organization_id,job_site_id'
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
          job_site_id: currentJobSite?.id ?? null,
          status: 'transferred',
          notes,
          transferred_to_task_id: transferTaskId || null,
          transferred_to_job_site_id: transferJobSiteId || null,
          hours_worked: 8,
          ot_hours: 0,
          task_id: null,
          logged_by: userId,
        }, {
          onConflict: 'worker_id,log_date,organization_id,job_site_id'
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
      const otHours = parseFloat(otHoursWorked) || 0;

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('daily_hours')
        .upsert({
          worker_id: selectedWorker.id,
          organization_id: userData.org_id,
          log_date: selectedDate,
          job_site_id: currentJobSite?.id ?? null,
          status: 'worked',
          notes,
          task_id: workTaskId || null,
          hours_worked: hours,
          ot_hours: otHours,
          transferred_to_task_id: null,
          transferred_to_job_site_id: null,
          logged_by: userId,
        }, {
          onConflict: 'worker_id,log_date,organization_id,job_site_id'
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

  const handleInlineNotesChange = (workerId: string, notes: string, currentHours: string) => {
    const newEditedHours = new Map(editedHours);
    const existing = newEditedHours.get(workerId) || { workerId, hours: currentHours };
    newEditedHours.set(workerId, { ...existing, notes });
    setEditedHours(newEditedHours);
  };

  const handleInlineOtHoursChange = (workerId: string, otHours: string, currentHours: string) => {
    const newEditedHours = new Map(editedHours);
    const existing = newEditedHours.get(workerId) || { workerId, hours: currentHours };
    newEditedHours.set(workerId, { ...existing, otHours });
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
        job_site_id: currentJobSite?.id ?? null,
        status: 'worked' as const,
        hours_worked: parseFloat(edit.hours) || 0,
        ot_hours: parseFloat(edit.otHours || '0') || 0,
        task_id: edit.taskId || null,
        notes: edit.notes || null,
        transferred_to_task_id: null,
        logged_by: userId,
      }));

      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('daily_hours')
        .upsert(records, {
          onConflict: 'worker_id,log_date,organization_id,job_site_id'
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

  const openWorkerSummary = async (worker: Worker) => {
    setWorkerSummaryWorker(worker);
    setWorkerSummaryOpen(true);
    setWorkerSummaryLoading(true);
    setWorkerSummaryRows([]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();
      if (!userData) return;

      // Derive Sun–Sat week from selectedDate
      const [yr, mo, dy] = selectedDate.split('-').map(Number);
      const pivot = new Date(yr, mo - 1, dy);
      const dow = pivot.getDay();
      const weekStart = new Date(yr, mo - 1, dy - dow);
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
        dates.push(getLocalDateString(d));
      }
      setWorkerSummaryDates(dates);

      const { data: records, error } = await supabase
        .from('daily_hours')
        .select('log_date, status, hours_worked, ot_hours, job_site_id, transferred_to_job_site:job_sites!transferred_to_job_site_id(id, name)')
        .eq('organization_id', userData.org_id)
        .eq('worker_id', worker.id)
        .gte('log_date', dates[0])
        .lte('log_date', dates[6]);

      if (error) throw error;

      // Collect all unique job site IDs to look up names
      // Fall back to worker's primary job_site_id for legacy records that predate job_site_id being written
      const siteIds = [...new Set(
        (records || [])
          .filter(dh => dh.status === 'worked')
          .map(dh => (dh.job_site_id as string | null) ?? worker.job_site_id ?? null)
          .filter((id): id is string => id !== null)
      )];

      const siteNameMap = new Map<string, string>();
      if (siteIds.length > 0) {
        const { data: sitesData } = await supabase
          .from('job_sites')
          .select('id, name')
          .in('id', siteIds);
        (sitesData || []).forEach(s => siteNameMap.set(s.id, s.name));
      }

      const siteMap = new Map<string, { siteName: string; days: (number | null)[]; otDays: (number | null)[] }>();

      (records || []).forEach((dh) => {
        if (dh.status !== 'worked' && dh.status !== 'transferred') return;

        const dayIndex = dates.indexOf(dh.log_date);
        if (dayIndex === -1) return;

        let siteId: string;
        let siteName: string;

        if (dh.status === 'transferred') {
          const site = (dh.transferred_to_job_site as unknown) as { id: string; name: string } | null;
          siteId = site?.id ?? '__transferred__';
          siteName = site?.name ?? 'Transferred (Unknown)';
        } else {
          siteId = (dh.job_site_id as string | null) ?? worker.job_site_id ?? '__unknown__';
          siteName = siteNameMap.get(siteId) ?? 'Unknown Site';
        }

        if (!siteMap.has(siteId)) {
          siteMap.set(siteId, { siteName, days: Array(7).fill(null), otDays: Array(7).fill(null) });
        }
        const entry = siteMap.get(siteId)!;
        entry.days[dayIndex] = dh.hours_worked || 0;
        entry.otDays[dayIndex] = dh.ot_hours || 0;
      });

      setWorkerSummaryRows(
        Array.from(siteMap.entries()).map(([siteId, { siteName, days, otDays }]) => ({
          siteId,
          siteName,
          days,
          otDays,
          total: days.reduce<number>((sum, h) => sum + (h ?? 0), 0),
          totalOt: otDays.reduce<number>((sum, h) => sum + (h ?? 0), 0),
        }))
      );
    } catch (err) {
      console.error('Error loading worker summary:', err);
      toast.error('Failed to load weekly summary');
    } finally {
      setWorkerSummaryLoading(false);
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
    const headers = ['Worker', 'Role', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Total', 'OT Total'];
    const rows = weeklyData.map(({ worker, hours, totalHours, totalOtHours }) => [
      worker.name,
      worker.role,
      ...hours.map(h => h.hours > 0 ? h.hours.toFixed(1) : '0'),
      totalHours.toFixed(1),
      totalOtHours > 0 ? totalOtHours.toFixed(1) : '0',
    ]);

    // Add totals row
    const dayTotals = [0, 1, 2, 3, 4, 5, 6].map(dayIndex =>
      weeklyData.reduce((sum, w) => sum + (w.hours[dayIndex]?.hours || 0), 0).toFixed(1)
    );
    const grandTotal = weeklyData.reduce((sum, w) => sum + w.totalHours, 0).toFixed(1);
    const grandOtTotal = weeklyData.reduce((sum, w) => sum + w.totalOtHours, 0).toFixed(1);
    rows.push(['TOTAL', '', ...dayTotals, grandTotal, grandOtTotal]);

    const siteRow = currentJobSite ? [`"${currentJobSite.name}"`, ...Array(headers.length - 1).fill('""')].join(',') + '\n' : '';
    const csvContent = siteRow + [
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

  const downloadDailyPDF = () => {
    if (workers.length === 0) {
      toast.error('No workers to export');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const [yr, mo, dy] = selectedDate.split('-').map(Number);
    const displayDate = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    let y = 18;

    // ── HEADER ──────────────────────────────────────────────────────────────
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Daily Hours Report', margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    if (currentJobSite) {
      doc.text(currentJobSite.name, margin, y);
      y += 6;
    }
    doc.text(displayDate, margin, y);
    y += 5;

    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);
    doc.setTextColor(20, 20, 20);
    y += 7;

    // Divider
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;

    // ── MANHOURS TABLE ───────────────────────────────────────────────────────
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Manhours', margin, y);
    y += 6;

    // Column x-positions
    const col = {
      num:    margin,
      name:   margin + 9,
      role:   margin + 60,
      status: margin + 84,
      hours:  margin + 108,
      ot:     margin + 122,
      notes:  margin + 138,
    };

    // Header row
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110, 110, 110);
    doc.text('#',           col.num,    y);
    doc.text('Worker',      col.name,   y);
    doc.text('Role',        col.role,   y);
    doc.text('Status',      col.status, y);
    doc.text('Hours',       col.hours,  y);
    doc.text('OT',          col.ot,     y);
    doc.text('Task / Notes',col.notes,  y);
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    doc.setTextColor(20, 20, 20);

    let totalHoursWorked = 0;
    let totalOtWorked = 0;
    const notesColWidth = pageWidth - margin - col.notes;

    workers.forEach((ws, index) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      const { worker, dailyHours: dh } = ws;
      const hoursVal = dh?.status === 'worked' ? (dh.hours_worked || 0) : 0;
      const otVal = dh?.status === 'worked' ? (dh.ot_hours || 0) : 0;
      totalHoursWorked += hoursVal;
      totalOtWorked += otVal;

      const statusLabel =
        dh?.status === 'worked'      ? 'Worked' :
        dh?.status === 'off'         ? 'Off' :
        dh?.status === 'transferred' ? 'Transferred' :
        'Not Logged';

      const noteText =
        (dh?.task as Task | undefined)?.name ||
        (dh?.transferred_to_task as Task | undefined)?.name ||
        (dh?.transferred_to_job_site as JobSite | undefined)?.name ||
        dh?.notes || '';

      // Alternating row tint
      if (index % 2 === 0) {
        doc.setFillColor(248, 249, 250);
        doc.rect(margin, y - 3.5, contentWidth, 7, 'F');
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(String(index + 1),                       col.num,    y);
      doc.text(worker.name.substring(0, 28),            col.name,   y);
      doc.text(worker.role.charAt(0).toUpperCase() + worker.role.slice(1), col.role, y);
      doc.text(statusLabel,                             col.status, y);
      doc.text(hoursVal > 0 ? `${hoursVal.toFixed(1)}h` : '-', col.hours, y);
      doc.text(otVal > 0 ? `${otVal.toFixed(1)}h` : '-',       col.ot,    y);
      if (noteText) {
        doc.text(doc.splitTextToSize(noteText, notesColWidth)[0], col.notes, y);
      }

      y += 6.5;
    });

    // Totals row
    y += 1;
    doc.setDrawColor(80, 80, 80);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`${workers.length} ${workers.length === 1 ? 'worker' : 'workers'}`, col.name, y);
    doc.text(`${totalHoursWorked.toFixed(1)}h`, col.hours, y);
    if (totalOtWorked > 0) doc.text(`${totalOtWorked.toFixed(1)}h OT`, col.ot, y);
    y += 10;

    // ── DAILY NOTES ─────────────────────────────────────────────────────────
    const NOTE_SECTIONS: { key: keyof DailyNote; label: string }[] = [
      { key: 'general_notes',   label: 'General' },
      { key: 'equipment_notes', label: 'Equipment' },
      { key: 'tools_notes',     label: 'Tools' },
      { key: 'safety_notes',    label: 'Safety' },
      { key: 'weather_notes',   label: 'Weather' },
    ];

    const filledSections = NOTE_SECTIONS.filter(s => dailyNote?.[s.key]?.toString().trim());

    if (filledSections.length > 0) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(210, 210, 210);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text('Daily Notes', margin, y);
      y += 7;

      filledSections.forEach(({ key, label }) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(label.toUpperCase(), margin, y);
        y += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(20, 20, 20);
        const lines = doc.splitTextToSize(dailyNote![key] as string, contentWidth);
        lines.forEach((line: string) => {
          if (y > pageHeight - 15) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin, y);
          y += 5;
        });
        y += 5;
      });
    } else if (!dailyNote) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);

      doc.setDrawColor(210, 210, 210);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text('Daily Notes', margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text('No notes recorded for this day.', margin, y);
    }

    // ── FOOTER on every page ─────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `${currentJobSite?.name || ''} · ${displayDate} · Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    }

    doc.save(`daily_report_${selectedDate}.pdf`);
    toast.success('Daily report exported');
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
    if (currentJobSite) {
      doc.text(currentJobSite.name, 14, 22);
      doc.text(`Week: ${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`, 14, 28);
    } else {
      doc.text(`Week: ${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`, 14, 22);
    }
    
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
    headers.push('OT');
    let yPosition = currentJobSite ? 38 : 32;

    // Draw header row
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const colWidths = [33, 18, 12, 12, 12, 12, 12, 12, 12, 14, 13];
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
    weeklyData.forEach(({ worker, hours, totalHours, totalOtHours }) => {
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
        totalHours.toFixed(1),
        totalOtHours > 0 ? totalOtHours.toFixed(1) : '-',
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
    const grandOtTotal = weeklyData.reduce((sum, w) => sum + w.totalOtHours, 0);

    const totalRow = ['TOTAL', '', ...dayTotals, grandTotal, grandOtTotal > 0 ? grandOtTotal.toFixed(1) : '-'];
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

  // Crew grouping helpers
  const workersGroupedByCrew = new Map<string, WorkerDayStatus[]>();
  const noCrewWorkers: WorkerDayStatus[] = [];
  workers.forEach((ws) => {
    const siteCrewId = siteCrewMap.get(ws.worker.id);
    if (siteCrewId) {
      if (!workersGroupedByCrew.has(siteCrewId)) workersGroupedByCrew.set(siteCrewId, []);
      workersGroupedByCrew.get(siteCrewId)!.push(ws);
    } else {
      noCrewWorkers.push(ws);
    }
  });
  const crewsWithWorkers = crews.filter((c) => workersGroupedByCrew.has(c.id));

  const toggleCrew = (crewId: string) => {
    setCollapsedCrews((prev) => {
      const next = new Set(prev);
      if (next.has(crewId)) next.delete(crewId);
      else next.add(crewId);
      return next;
    });
  };

  // Pre-compute weekly groups (derived from weeklyData + crews)
  const weeklyCrewGroups = (() => {
    const crewMap = new Map<string, typeof weeklyData>();
    weeklyData.forEach(row => {
      const key = siteCrewMap.get(row.worker.id) || '__no_crew__';
      const list = crewMap.get(key) || [];
      list.push(row);
      crewMap.set(key, list);
    });
    const result: { groupId: string; groupName: string; groupColor: string; rows: typeof weeklyData }[] = [];
    crews.forEach(crew => {
      if (crewMap.has(crew.id)) {
        result.push({ groupId: crew.id, groupName: crew.name, groupColor: crew.color || '#6366f1', rows: crewMap.get(crew.id)! });
      }
    });
    const noCrewRows = crewMap.get('__no_crew__');
    if (noCrewRows?.length) {
      result.push({ groupId: '__no_crew__', groupName: 'No Crew', groupColor: '#9ca3af', rows: noCrewRows });
    }
    return result;
  })();

  const ROLE_COLORS: Record<string, string> = {
    operator: '#3b82f6', laborer: '#eab308', carpenter: '#22c55e', mason: '#8b5cf6',
    mechanic: '#f97316', driver: '#14b8a6',
  };
  const ROLE_NAMES: Record<string, string> = {
    operator: 'Operators', laborer: 'Laborers', carpenter: 'Carpenters', mason: 'Masons',
    mechanic: 'Mechanics', driver: 'Drivers',
  };
  const weeklyRoleGroups = (['operator', 'laborer', 'carpenter', 'mason', 'mechanic', 'driver'] as const)
    .map(role => ({ groupId: role, groupName: ROLE_NAMES[role], groupColor: ROLE_COLORS[role], rows: weeklyData.filter(r => r.worker.role === role) }))
    .filter(g => g.rows.length > 0);

  // Shared weekly row renderer
  const renderWeeklyWorkerRow = ({ worker, hours, totalHours, totalOtHours }: typeof weeklyData[0], indent = false) => (
    <tr key={worker.id} className="border-b border-border hover:bg-bg-hover">
      <td className={`p-2 font-medium sticky left-0 bg-bg-secondary ${indent ? 'pl-6' : ''}`}>{worker.name}</td>
      {hours.map((day, i) => (
        <td key={i} className="p-2 text-center align-top">
          <div className="flex flex-col items-center gap-0.5">
            <div className="font-medium">{day.hours > 0 ? day.hours.toFixed(1) : '-'}</div>
            {day.otHours > 0 && <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{day.otHours.toFixed(1)} OT</div>}
            {day.notes && <div className="text-[10px] text-text-secondary max-w-[80px] truncate" title={day.notes}>{day.notes}</div>}
            {day.status === 'off' && <div className="text-[10px] px-1 rounded bg-red-500/20 text-red-600 dark:text-red-400">Off</div>}
            {day.status === 'transferred' && <div className="text-[10px] px-1 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">Trans.</div>}
          </div>
        </td>
      ))}
      <td className="p-2 text-right font-semibold">
        <div>{totalHours.toFixed(1)}h</div>
        {totalOtHours > 0 && <div className="text-[11px] text-amber-600 dark:text-amber-400">{totalOtHours.toFixed(1)} OT</div>}
      </td>
    </tr>
  );

  const renderWorkerRow = ({ worker, dailyHours }: WorkerDayStatus, rowNum?: number) => {
    const edited = editedHours.get(worker.id);
    // Show empty when no record exists so it doesn't look like hours crossed from another site.
    // '8' only pre-fills when a saved 'worked' record exists but hours_worked is somehow null.
    const currentHours = edited?.hours ?? (dailyHours != null ? (dailyHours.hours_worked?.toString() ?? '8') : '');
    const currentOtHours = edited?.otHours ?? dailyHours?.ot_hours?.toString() ?? '0';
    const isEdited = edited !== undefined;
    return (
      <tr key={worker.id} className={`border-b border-border hover:bg-bg-hover ${isEdited ? 'bg-yellow-500/5' : ''}`}>
        {rowNum !== undefined && (
          <td className="p-4 text-center text-text-secondary">{rowNum}</td>
        )}
        <td className="p-4 font-medium">
          <button
            type="button"
            onClick={() => openWorkerSummary(worker)}
            className="hover:text-primary hover:underline text-left transition-colors"
            title="View weekly summary"
          >
            {worker.name}
          </button>
        </td>
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
        <td className="p-4">
          {canEdit(currentUser) && (!dailyHours || dailyHours.status === 'worked') ? (
            <Input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={currentOtHours}
              onChange={(e) => handleInlineOtHoursChange(worker.id, e.target.value, currentHours)}
              className="w-20"
              placeholder="0"
            />
          ) : dailyHours?.status === 'worked' && (dailyHours.ot_hours || 0) > 0 ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">{dailyHours.ot_hours}h</span>
          ) : (
            '-'
          )}
        </td>
        <td className="p-4 text-text-secondary text-sm max-w-xs">
          {dailyHours?.status === 'transferred' ? (
            <span className="truncate block">
              {dailyHours.transferred_to_task
                ? `→ ${dailyHours.transferred_to_task.name}`
                : dailyHours.transferred_to_job_site
                ? `→ ${dailyHours.transferred_to_job_site.name}`
                : `→ ${dailyHours.notes || 'Transferred to another project'}`}
            </span>
          ) : canEdit(currentUser) && (!dailyHours || dailyHours.status === 'worked') ? (
            <input
              type="text"
              value={edited?.notes ?? dailyHours?.notes ?? ''}
              onChange={(e) => handleInlineNotesChange(worker.id, e.target.value, currentHours)}
              placeholder="Add note..."
              className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-border-focus focus:outline-none text-text-primary placeholder-text-tertiary py-0.5 text-sm"
            />
          ) : dailyHours?.task ? (
            dailyHours.task.name
          ) : (
            <span className="truncate block">{dailyHours?.notes || '-'}</span>
          )}
        </td>
        <td className="p-4">
          {canEdit(currentUser) ? (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleLogHours(worker)} title="Log hours with details">
                <Clock size={16} />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleMarkOff(worker)} title="Mark as off">
                <UserX size={16} />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleMarkTransferred(worker)} title="Mark as transferred">
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

  const crewTableHeader = (
    <tr className="border-b border-border">
      <th className="text-left p-3 font-medium text-[12px] text-text-secondary uppercase tracking-wide">Worker</th>
      <th className="text-left p-3 font-medium text-[12px] text-text-secondary uppercase tracking-wide">Role</th>
      <th className="text-left p-3 font-medium text-[12px] text-text-secondary uppercase tracking-wide">Status</th>
      <th className="text-left p-3 font-medium text-[12px] text-text-secondary uppercase tracking-wide">Hours</th>
      <th className="text-left p-3 font-medium text-[12px] text-text-secondary uppercase tracking-wide">OT</th>
      <th className="text-left p-3 font-medium text-[12px] text-text-secondary uppercase tracking-wide">Task/Notes</th>
      <th className="text-right p-3 font-medium text-[12px] text-text-secondary uppercase tracking-wide">Actions</th>
    </tr>
  );

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary mb-1">Daily Hours Log</h1>
        <p className="text-[14px] text-text-secondary">Track worker hours, days off, and job transfers</p>
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
        <div className="flex flex-wrap items-center gap-2">
          {canEdit(currentUser) && editedHours.size > 0 && (
            <Button onClick={saveAllHours} variant="primary">
              <Check size={16} className="mr-2" />
              Accept All ({editedHours.size})
            </Button>
          )}
          <Button
            onClick={() => {
              if (workers.length === 0) { toast.error('No workers to export'); return; }
              setPdfPreviewOpen(true);
            }}
            variant="secondary"
            title="Preview and export daily report as PDF"
          >
            <FileText size={16} className="mr-2" />
            Export PDF
          </Button>
          <Button
            onClick={() => setDailyNotesOpen(true)}
            variant="secondary"
            title="Add or view daily notes"
          >
            <NotebookPen size={16} className="mr-2" />
            Daily Notes
          </Button>
          <Button
            onClick={() => setGroupByCrew(!groupByCrew)}
            variant={groupByCrew ? 'primary' : 'secondary'}
            title={groupByCrew ? 'Switch to flat view' : 'Group by crew'}
          >
            {groupByCrew ? 'Flat View' : 'Group by Crew'}
          </Button>
          <Button onClick={loadWeeklyData} variant="secondary">
            View Weekly Summary
          </Button>
        </div>
      </div>

      {groupByCrew ? (
        <div className="space-y-3 mb-6">
          {crewsWithWorkers.map((crew) => {
            const crewWorkers = workersGroupedByCrew.get(crew.id) || [];
            const isCollapsed = collapsedCrews.has(crew.id);
            const crewTotalHours = crewWorkers.reduce(
              (sum, ws) => sum + (ws.dailyHours?.status === 'worked' ? ws.dailyHours.hours_worked || 0 : 0),
              0
            );
            return (
              <div key={crew.id} className="border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
                  onClick={() => toggleCrew(crew.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: crew.color || '#6366f1' }} />
                    <span className="text-[14px] font-semibold text-text-primary">{crew.name}</span>
                    <span className="text-[12px] text-text-secondary">
                      {crewWorkers.length} {crewWorkers.length === 1 ? 'worker' : 'workers'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {crewTotalHours > 0 && (
                      <span className="text-[13px] text-text-secondary font-medium">{crewTotalHours.toFixed(1)}h</span>
                    )}
                    {isCollapsed ? <ChevronRight size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>{crewTableHeader}</thead>
                      <tbody>{crewWorkers.map((ws) => renderWorkerRow(ws))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {noCrewWorkers.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary hover:bg-bg-hover transition-colors"
                onClick={() => toggleCrew('__no_crew__')}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-400" />
                  <span className="text-[14px] font-semibold text-text-primary">No Crew</span>
                  <span className="text-[12px] text-text-secondary">
                    {noCrewWorkers.length} {noCrewWorkers.length === 1 ? 'worker' : 'workers'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const t = noCrewWorkers.reduce(
                      (s, ws) => s + (ws.dailyHours?.status === 'worked' ? ws.dailyHours.hours_worked || 0 : 0),
                      0
                    );
                    return t > 0 ? <span className="text-[13px] text-text-secondary font-medium">{t.toFixed(1)}h</span> : null;
                  })()}
                  {collapsedCrews.has('__no_crew__') ? <ChevronRight size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
                </div>
              </button>
              {!collapsedCrews.has('__no_crew__') && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>{crewTableHeader}</thead>
                    <tbody>{noCrewWorkers.map((ws) => renderWorkerRow(ws))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {crewsWithWorkers.length === 0 && noCrewWorkers.length === 0 && (
            <Card>
              <p className="text-center text-text-secondary py-8">No workers on this job site.</p>
            </Card>
          )}
        </div>
      ) : (
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
                  <th className="text-left p-4 font-semibold">OT</th>
                  <th className="text-left p-4 font-semibold">Task/Notes</th>
                  <th className="text-right p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
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
                            <td colSpan={8} className="p-3 font-semibold capitalize">
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
                  <tr className="border-t-2 border-border bg-bg-hover/30">
                    <td colSpan={4} className="p-4 text-[13px] text-text-secondary">
                      {workers.length} {workers.length === 1 ? 'person' : 'people'} on site
                    </td>
                    <td className="p-4 font-semibold text-text-primary">
                      {workers.reduce((sum, ws) => sum + (ws.dailyHours?.status === 'worked' ? ws.dailyHours.hours_worked || 0 : 0), 0).toFixed(1)}h
                    </td>
                    <td className="p-4 font-semibold text-amber-600 dark:text-amber-400">
                      {(() => {
                        const tot = workers.reduce((sum, ws) => sum + (ws.dailyHours?.status === 'worked' ? ws.dailyHours.ot_hours || 0 : 0), 0);
                        return tot > 0 ? `${tot.toFixed(1)}h OT` : '-';
                      })()}
                    </td>
                    <td colSpan={2} className="p-4 font-semibold text-right text-text-primary">
                      Total: {(workers.reduce((sum, ws) => sum + (ws.dailyHours?.status === 'worked' ? ws.dailyHours.hours_worked || 0 : 0), 0) + workers.reduce((sum, ws) => sum + (ws.dailyHours?.status === 'worked' ? ws.dailyHours.ot_hours || 0 : 0), 0)).toFixed(1)}h incl. OT
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* Daily Notes Summary — rendered inline below worker list */}
      {!dailyNoteError && (() => {
        const NOTE_SECTIONS: { key: keyof DailyNote; label: string }[] = [
          { key: 'general_notes', label: 'General' },
          { key: 'equipment_notes', label: 'Equipment' },
          { key: 'tools_notes', label: 'Tools' },
          { key: 'safety_notes', label: 'Safety' },
          { key: 'weather_notes', label: 'Weather' },
        ];
        const filledSections = NOTE_SECTIONS.filter(s => dailyNote?.[s.key]?.toString().trim());
        const hasNotes = filledSections.length > 0;

        const formatTime = (ts: string) => {
          const d = new Date(ts);
          return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        };

        return (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <NotebookPen size={16} className="text-text-secondary" />
              <h2 className="text-[15px] font-semibold text-text-primary">Daily Notes</h2>
              {dailyNote && (
                <span className="text-[12px] text-text-tertiary ml-1">
                  last updated {formatTime(dailyNote.updated_at)}
                </span>
              )}
            </div>

            {!hasNotes ? (
              <div className="rounded-xl border border-border bg-bg-secondary px-5 py-6 text-center text-[14px] text-text-secondary">
                No notes recorded for this day.
              </div>
            ) : (
              <div className="space-y-3">
                {filledSections.map(({ key, label }) => (
                  <div key={key} className="rounded-xl border border-border bg-bg-secondary px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary mb-2">
                      {label}
                    </p>
                    <p className="text-[14px] text-text-primary whitespace-pre-wrap leading-relaxed">
                      {dailyNote![key] as string}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

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
            <label className="block text-sm font-medium mb-2">Transfer To Job Site</label>
            <select
              value={transferJobSiteId}
              onChange={(e) => handleTransferJobSiteChange(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            >
              <option value="">Select a job site...</option>
              {jobSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          {transferJobSiteId && (
            <div>
              <label className="block text-sm font-medium mb-2">Task (Optional)</label>
              <select
                value={transferTaskId}
                onChange={(e) => setTransferTaskId(e.target.value)}
                className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="">No specific task</option>
                {transferSiteTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name} {task.location ? `- ${task.location}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about the transfer"
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
          <div className="flex gap-3">
            <div className="flex-1">
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
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">OT Hours</label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={otHoursWorked}
                onChange={(e) => setOtHoursWorked(e.target.value)}
                placeholder="0"
              />
            </div>
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
        title={`Weekly Hours Summary${currentJobSite ? ` — ${currentJobSite.name}` : ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Controls: view toggle + export */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* 3-way view toggle */}
            <div className="flex items-center gap-0.5 bg-bg-secondary border border-border rounded-xl p-1">
              {(['flat', 'crew', 'role'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setWeeklyViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    weeklyViewMode === mode
                      ? 'bg-bg-primary shadow-sm text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {mode === 'flat' ? 'All Workers' : mode === 'crew' ? 'By Crew' : 'By Role'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={exportToCSV} variant="secondary">
                <Download size={16} className="mr-2" />
                CSV
              </Button>
              <Button onClick={exportToPDF} variant="secondary">
                <FileText size={16} className="mr-2" />
                PDF
              </Button>
            </div>
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
                      return (
                        <th key={i} className="text-center p-2 font-semibold">
                          <div>{dayName}</div>
                          <div className="text-xs font-normal text-text-secondary">{`${m}/${d}/${y}`}</div>
                        </th>
                      );
                    });
                  })()}
                  <th className="text-right p-2 font-semibold">Total</th>
                </tr>
              </thead>

              <tbody>
                {weeklyData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-text-secondary">
                      No hours logged this week
                    </td>
                  </tr>
                ) : weeklyViewMode === 'crew' ? (
                  <>
                    {weeklyCrewGroups.map(({ groupId, groupName, groupColor, rows }) => (
                      <Fragment key={groupId}>
                        {/* Group header row */}
                        <tr className="border-b border-border">
                          <td colSpan={9} className="p-0">
                            <div
                              className="flex items-center justify-between px-3 py-2"
                              style={{ backgroundColor: groupColor + '15', borderLeft: `3px solid ${groupColor}` }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
                                <span className="font-semibold text-[13px] text-text-primary">{groupName}</span>
                                <span className="text-[11px] text-text-secondary">
                                  {rows.length} worker{rows.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <span className="text-[13px] font-semibold pr-1" style={{ color: groupColor }}>
                                {rows.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}h
                              </span>
                            </div>
                          </td>
                        </tr>
                        {rows.map(row => renderWeeklyWorkerRow(row, true))}
                      </Fragment>
                    ))}
                  </>
                ) : weeklyViewMode === 'role' ? (
                  <>
                    {weeklyRoleGroups.map(({ groupId, groupName, groupColor, rows }) => (
                      <Fragment key={groupId}>
                        <tr className="border-b border-border">
                          <td colSpan={9} className="p-0">
                            <div
                              className="flex items-center justify-between px-3 py-2"
                              style={{ backgroundColor: groupColor + '15', borderLeft: `3px solid ${groupColor}` }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
                                <span className="font-semibold text-[13px] text-text-primary">{groupName}</span>
                                <span className="text-[11px] text-text-secondary">
                                  {rows.length} worker{rows.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <span className="text-[13px] font-semibold pr-1" style={{ color: groupColor }}>
                                {rows.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}h
                              </span>
                            </div>
                          </td>
                        </tr>
                        {rows.map(row => renderWeeklyWorkerRow(row, true))}
                      </Fragment>
                    ))}
                  </>
                ) : (
                  weeklyData.map(row => renderWeeklyWorkerRow(row))
                )}
              </tbody>

              {weeklyData.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td className="p-2 sticky left-0 bg-bg-secondary text-text-secondary text-[12px]">Total</td>
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                      const dayTotal = weeklyData.reduce((sum, w) => sum + (w.hours[dayIndex]?.hours || 0), 0);
                      const dayOt = weeklyData.reduce((sum, w) => sum + (w.hours[dayIndex]?.otHours || 0), 0);
                      return (
                        <td key={dayIndex} className="p-2 text-center align-top">
                          <div>{dayTotal > 0 ? dayTotal.toFixed(1) : '-'}</div>
                          {dayOt > 0 && <div className="text-[10px] text-amber-600 dark:text-amber-400">{dayOt.toFixed(1)} OT</div>}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right align-top">
                      <div>{weeklyData.reduce((sum, w) => sum + w.totalHours, 0).toFixed(1)}h</div>
                      {weeklyData.reduce((sum, w) => sum + w.totalOtHours, 0) > 0 && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400">
                          {weeklyData.reduce((sum, w) => sum + w.totalOtHours, 0).toFixed(1)} OT
                        </div>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Modal>

      {/* Daily Notes Modal */}
      <DailyNotesModal
        isOpen={dailyNotesOpen}
        onClose={() => setDailyNotesOpen(false)}
        date={selectedDate}
        readOnly={!canEdit(currentUser)}
      />

      {/* PDF Preview Modal */}
      <Modal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        title="Daily Report Preview"
        size="lg"
      >
        {(() => {
          const [yr, mo, dy] = selectedDate.split('-').map(Number);
          const displayDate = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          });
          const NOTE_SECTIONS: { key: keyof DailyNote; label: string }[] = [
            { key: 'general_notes',   label: 'General' },
            { key: 'equipment_notes', label: 'Equipment' },
            { key: 'tools_notes',     label: 'Tools' },
            { key: 'safety_notes',    label: 'Safety' },
            { key: 'weather_notes',   label: 'Weather' },
          ];
          const filledSections = NOTE_SECTIONS.filter(s => dailyNote?.[s.key]?.toString().trim());
          const totalHours = workers.reduce((sum, ws) => sum + (ws.dailyHours?.status === 'worked' ? ws.dailyHours.hours_worked || 0 : 0), 0);

          return (
            <div className="space-y-4">
              {/* Paper */}
              <div className="bg-white text-gray-900 rounded border border-gray-200 p-8 font-sans shadow-sm overflow-auto max-h-[60vh]">
                {/* Header */}
                <h1 className="text-2xl font-bold text-gray-900">Daily Hours Report</h1>
                {currentJobSite && <p className="text-sm mt-1 text-gray-700">{currentJobSite.name}</p>}
                <p className="text-sm text-gray-700">{displayDate}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Generated {new Date().toLocaleString()}</p>
                <hr className="border-gray-200 my-4" />

                {/* Manhours */}
                <h2 className="text-base font-bold text-gray-900 mb-3">Manhours</h2>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="text-left pb-1.5 pr-2 w-6 font-semibold">#</th>
                      <th className="text-left pb-1.5 pr-2 font-semibold">Worker</th>
                      <th className="text-left pb-1.5 pr-2 font-semibold">Role</th>
                      <th className="text-left pb-1.5 pr-2 font-semibold">Status</th>
                      <th className="text-left pb-1.5 pr-2 font-semibold">Hours</th>
                      <th className="text-left pb-1.5 pr-2 font-semibold">OT</th>
                      <th className="text-left pb-1.5 font-semibold">Task / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((ws, index) => {
                      const { worker, dailyHours: dh } = ws;
                      const hoursVal = dh?.status === 'worked' ? (dh.hours_worked || 0) : 0;
                      const otVal = dh?.status === 'worked' ? (dh.ot_hours || 0) : 0;
                      const statusLabel =
                        dh?.status === 'worked'      ? 'Worked' :
                        dh?.status === 'off'         ? 'Off' :
                        dh?.status === 'transferred' ? 'Transferred' :
                        'Not Logged';
                      const noteText =
                        (dh?.task as Task | undefined)?.name ||
                        (dh?.transferred_to_task as Task | undefined)?.name ||
                        (dh?.transferred_to_job_site as JobSite | undefined)?.name ||
                        dh?.notes || '';
                      return (
                        <tr key={worker.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                          <td className="py-1 pr-2">{index + 1}</td>
                          <td className="py-1 pr-2">{worker.name}</td>
                          <td className="py-1 pr-2">{worker.role.charAt(0).toUpperCase() + worker.role.slice(1)}</td>
                          <td className="py-1 pr-2">{statusLabel}</td>
                          <td className="py-1 pr-2">{hoursVal > 0 ? `${hoursVal.toFixed(1)}h` : '-'}</td>
                          <td className="py-1 pr-2">{otVal > 0 ? `${otVal.toFixed(1)}h` : '-'}</td>
                          <td className="py-1">{noteText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700 font-bold">
                      <td />
                      <td className="pt-2 pr-2">{workers.length} {workers.length === 1 ? 'worker' : 'workers'}</td>
                      <td colSpan={2} />
                      <td className="pt-2 pr-2">{totalHours.toFixed(1)}h</td>
                      <td className="pt-2 pr-2">
                        {(() => { const ot = workers.reduce((s, ws) => s + (ws.dailyHours?.status === 'worked' ? ws.dailyHours.ot_hours || 0 : 0), 0); return ot > 0 ? `${ot.toFixed(1)}h` : '-'; })()}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>

                {/* Daily Notes */}
                {filledSections.length > 0 && (
                  <>
                    <hr className="border-gray-200 my-4" />
                    <h2 className="text-base font-bold text-gray-900 mb-3">Daily Notes</h2>
                    <div className="space-y-3">
                      {filledSections.map(({ key, label }) => (
                        <div key={key}>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                          <p className="text-xs text-gray-800 whitespace-pre-wrap">{dailyNote![key] as string}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setPdfPreviewOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => { setPdfPreviewOpen(false); downloadDailyPDF(); }}
                >
                  <Download size={16} className="mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Worker Weekly Summary Modal */}
      {workerSummaryOpen && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body > * { visibility: hidden !important; }
            .worker-summary-printable, .worker-summary-printable * { visibility: visible !important; }
            .worker-summary-printable { position: fixed; inset: 0; background: white; padding: 32px; z-index: 99999; }
            .no-print { display: none !important; }
          }
        `}} />
      )}
      <Modal
        isOpen={workerSummaryOpen}
        onClose={() => setWorkerSummaryOpen(false)}
        title={`${workerSummaryWorker?.name ?? ''} – Weekly Summary`}
        size="lg"
      >
        {(() => {
          const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const colTotals = [0,1,2,3,4,5,6].map(i =>
            workerSummaryRows.reduce((sum, row) => sum + (row.days[i] ?? 0), 0)
          );
          const colOtTotals = [0,1,2,3,4,5,6].map(i =>
            workerSummaryRows.reduce((sum, row) => sum + (row.otDays[i] ?? 0), 0)
          );
          const grandTotal = workerSummaryRows.reduce((sum, row) => sum + row.total, 0);
          const grandOtTotal = workerSummaryRows.reduce((sum, row) => sum + row.totalOt, 0);
          const weekLabel = workerSummaryDates.length === 7
            ? (() => {
                const fmt = (d: string) => {
                  const [y, m, day] = d.split('-').map(Number);
                  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                };
                return `${fmt(workerSummaryDates[0])} – ${fmt(workerSummaryDates[6])}`;
              })()
            : '';

          return (
            <div className="space-y-4">
              <div className="worker-summary-printable bg-white text-gray-900 rounded border border-gray-200 p-6 font-sans">
                {/* Header */}
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{workerSummaryWorker?.name}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{weekLabel}</p>
                    {workerSummaryWorker && (
                      <p className="text-xs text-gray-400 capitalize mt-0.5">{workerSummaryWorker.role}</p>
                    )}
                  </div>
                  {!workerSummaryLoading && grandTotal > 0 && (
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-gray-900">
                        {grandTotal % 1 === 0 ? grandTotal : grandTotal.toFixed(1)}h
                      </div>
                      {grandOtTotal > 0 && (
                        <div className="text-sm font-medium text-amber-600">+{grandOtTotal.toFixed(1)}h OT</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">week total</div>
                    </div>
                  )}
                </div>
                <hr className="border-gray-200 mb-4" />

                {workerSummaryLoading ? (
                  <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
                ) : workerSummaryRows.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No hours recorded this week.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-left py-2 pr-4 font-semibold text-gray-700 min-w-[140px]">Job Site</th>
                          {workerSummaryDates.map((date, i) => {
                            const [y, m, d] = date.split('-').map(Number);
                            const label = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                            return (
                              <th key={date} className="text-center py-2 px-2 font-semibold text-gray-700 min-w-[52px]">
                                <div>{DAY_NAMES[i]}</div>
                                <div className="text-[10px] font-normal text-gray-400">{label}</div>
                              </th>
                            );
                          })}
                          <th className="text-right py-2 pl-4 font-semibold text-gray-700 min-w-[52px]">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerSummaryRows.map((row, idx) => (
                          <tr key={row.siteId} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                            <td className="py-2 pr-4 font-medium text-gray-800">{row.siteName}</td>
                            {row.days.map((h, i) => (
                              <td key={i} className="py-2 px-2 text-center text-gray-700 align-top">
                                <div>{h !== null && h > 0 ? `${h % 1 === 0 ? h : h.toFixed(1)}h` : <span className="text-gray-300">–</span>}</div>
                                {(row.otDays[i] ?? 0) > 0 && (
                                  <div className="text-[10px] text-amber-600 font-medium">{(row.otDays[i] as number).toFixed(1)} OT</div>
                                )}
                              </td>
                            ))}
                            <td className="py-2 pl-4 text-right font-semibold text-gray-800 align-top">
                              <div>{row.total > 0 ? `${row.total % 1 === 0 ? row.total : row.total.toFixed(1)}h` : '–'}</div>
                              {row.totalOt > 0 && <div className="text-[10px] text-amber-600">{row.totalOt.toFixed(1)} OT</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-400 font-bold bg-white">
                          <td className="py-2 pr-4 text-gray-700">Total</td>
                          {colTotals.map((t, i) => (
                            <td key={i} className="py-2 px-2 text-center text-gray-800 align-top">
                              <div>{t > 0 ? `${t % 1 === 0 ? t : t.toFixed(1)}h` : <span className="text-gray-300">–</span>}</div>
                              {colOtTotals[i] > 0 && <div className="text-[10px] text-amber-600">{colOtTotals[i].toFixed(1)} OT</div>}
                            </td>
                          ))}
                          <td className="py-2 pl-4 text-right text-gray-900 align-top">
                            <div>{grandTotal > 0 ? `${grandTotal % 1 === 0 ? grandTotal : grandTotal.toFixed(1)}h` : '–'}</div>
                            {grandOtTotal > 0 && <div className="text-[11px] text-amber-600">{grandOtTotal.toFixed(1)} OT</div>}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <div className="no-print flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setWorkerSummaryOpen(false)}>
                  Close
                </Button>
                {!workerSummaryLoading && workerSummaryRows.length > 0 && (
                  <Button variant="primary" onClick={() => window.print()}>
                    <Printer size={16} className="mr-2" />
                    Print
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
