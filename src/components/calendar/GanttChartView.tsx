import { useState, useRef, useEffect } from 'react';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import type { Task, Assignment, Holiday } from '../../types';
import {
  transformTasksToGantt,
  formatDateHeader,
  isWeekend,
  isToday,
  getColorByStatus,
  isWorkingDayForTask,
  type GanttTask,
} from '../../lib/ganttHelpers';
import { Badge } from '../ui/Badge';
import { TaskDetailsModal } from '../tasks/TaskDetailsModal';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { eachDayOfInterval } from 'date-fns';

interface GanttChartViewProps {
  tasks: Task[];
  assignments: Assignment[];
}

export function GanttChartView({ tasks, assignments }: GanttChartViewProps) {
  const [dayWidth, setDayWidth] = useState(40); // pixels per day
  const [includeSaturday, setIncludeSaturday] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('gantt_include_saturday');
    return saved === 'true';
  });
  const [includeSunday, setIncludeSunday] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('gantt_include_sunday');
    return saved === 'true';
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [showHolidayDetails, setShowHolidayDetails] = useState(false);
  
  // Time window controls - 4 weeks starting from Sunday
  const [windowStartDate, setWindowStartDate] = useState(() => {
    const today = new Date();
    // Get Sunday of current week
    return startOfWeek(today, { weekStartsOn: 0 });
  });
  
  const ganttRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const allGanttTasks = transformTasksToGantt(tasks, assignments);

  // Calculate 4-week window
  const windowEndDate = addDays(windowStartDate, 27); // 4 weeks = 28 days
  let days = eachDayOfInterval({ start: windowStartDate, end: windowEndDate });

  // Filter tasks to only show those that overlap with the current viewing window
  const ganttTasks = allGanttTasks.filter(task => {
    // Task overlaps with window if:
    // task.endDate >= windowStartDate AND task.startDate <= windowEndDate
    return task.endDate >= windowStartDate && task.startDate <= windowEndDate;
  });
  
  // Filter out Saturday and/or Sunday based on toggles
  days = days.filter(day => {
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 6 && !includeSaturday) return false; // Saturday
    if (dayOfWeek === 0 && !includeSunday) return false; // Sunday
    return true;
  });

  // Load holidays
  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('year', 2026)
        .order('date');
      
      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  // Save weekend preferences to localStorage
  useEffect(() => {
    localStorage.setItem('gantt_include_saturday', includeSaturday.toString());
  }, [includeSaturday]);

  useEffect(() => {
    localStorage.setItem('gantt_include_sunday', includeSunday.toString());
  }, [includeSunday]);

  const handleExportPDF = async () => {
    if (!ganttRef.current || !scrollContainerRef.current) return;

    try {
      toast.loading('Generating PDF...');

      // Store original styles
      const originalOverflow = scrollContainerRef.current.style.overflow;
      const originalMaxHeight = scrollContainerRef.current.style.maxHeight;

      // Temporarily expand container to show all content
      scrollContainerRef.current.style.overflow = 'visible';
      scrollContainerRef.current.style.maxHeight = 'none';

      // Add white background class for PDF capture
      ganttRef.current.classList.add('pdf-export-mode');

      // Small delay to ensure styles are applied
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(ganttRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: ganttRef.current.scrollWidth,
        height: ganttRef.current.scrollHeight,
      });

      // Restore original styles
      ganttRef.current.classList.remove('pdf-export-mode');
      scrollContainerRef.current.style.overflow = originalOverflow;
      scrollContainerRef.current.style.maxHeight = originalMaxHeight;

      // ALWAYS landscape orientation
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // Handle multi-page if content is too tall
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`gantt-chart-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast.dismiss();
      toast.success('PDF exported successfully!');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export PDF');
      console.error(error);
    }
  };

  const handlePrint = async () => {
    if (!ganttRef.current || !scrollContainerRef.current) return;

    try {
      // Store original styles
      const originalOverflow = scrollContainerRef.current.style.overflow;
      const originalMaxHeight = scrollContainerRef.current.style.maxHeight;

      // Temporarily expand container to show all content for printing
      scrollContainerRef.current.style.overflow = 'visible';
      scrollContainerRef.current.style.maxHeight = 'none';

      // Small delay to ensure layout is recalculated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger print
      window.print();

      // Restore original styles after print dialog closes
      // Note: This happens immediately, but the print dialog stays open
      scrollContainerRef.current.style.overflow = originalOverflow;
      scrollContainerRef.current.style.maxHeight = originalMaxHeight;
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print');
    }
  };

  const handleTaskClick = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setShowTaskDetails(true);
    }
  };

  const handleHolidayClick = (holiday: Holiday) => {
    setSelectedHoliday(holiday);
    setShowHolidayDetails(true);
  };

  const navigateWindow = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setWindowStartDate(addWeeks(windowStartDate, -4));
    } else {
      setWindowStartDate(addWeeks(windowStartDate, 4));
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    setWindowStartDate(startOfWeek(today, { weekStartsOn: 0 }));
  };

  // Check if a date is a holiday
  const getHolidayForDate = (date: Date): Holiday | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.find(h => h.date === dateStr);
  };

  if (ganttTasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary">No tasks with dates to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-wrap">
          {/* Weekend Toggles */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSaturday}
                onChange={(e) => setIncludeSaturday(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="font-medium">Saturday</span>
              <Badge variant={includeSaturday ? 'success' : 'default'}>
                {includeSaturday ? 'ON' : 'OFF'}
              </Badge>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSunday}
                onChange={(e) => setIncludeSunday(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="font-medium">Sunday</span>
              <Badge variant={includeSunday ? 'success' : 'default'}>
                {includeSunday ? 'ON' : 'OFF'}
              </Badge>
            </label>
          </div>

          {/* Zoom Control */}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Zoom:</span>
            <input
              type="range"
              min="20"
              max="60"
              value={dayWidth}
              onChange={(e) => setDayWidth(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-xs text-text-secondary">{dayWidth}px</span>
          </label>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-bg-secondary border border-border rounded-lg hover:bg-bg-hover transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* Time Window Navigation */}
      <div className="flex items-center justify-between p-4 bg-bg-secondary border border-border rounded-lg no-print">
        <button
          onClick={() => navigateWindow('prev')}
          className="px-4 py-2 bg-bg-primary border border-border rounded-lg hover:bg-bg-hover transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous 4 Weeks
        </button>
        
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="font-semibold text-lg">
              {format(windowStartDate, 'MMM d')} - {format(windowEndDate, 'MMM d, yyyy')}
            </div>
            <div className="text-sm text-text-secondary">
              4-week window • {days.length} days displayed
            </div>
          </div>
          <button
            onClick={jumpToToday}
            className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary-dark transition-colors"
          >
            Today
          </button>
        </div>
        
        <button
          onClick={() => navigateWindow('next')}
          className="px-4 py-2 bg-bg-primary border border-border rounded-lg hover:bg-bg-hover transition-colors flex items-center gap-2"
        >
          Next 4 Weeks
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 p-4 bg-bg-secondary border border-border rounded-lg flex-wrap no-print">
        <div className="font-medium text-sm">Staffing Status:</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
          <span className="text-sm">Fully Staffed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
          <span className="text-sm">Understaffed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
          <span className="text-sm">Not Staffed</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className="w-4 h-4 rounded bg-purple-600"></div>
          <span className="text-sm">Holiday</span>
        </div>
      </div>

      {/* Gantt Chart - with sticky scroll bar */}
      <div className="relative">
        <div
          ref={scrollContainerRef}
          className="bg-bg-secondary border border-border rounded-lg overflow-x-auto relative gantt-scroll-container"
          style={{ maxHeight: '70vh', overflowY: 'auto' }}
        >
          <div ref={ganttRef} className="min-w-max gantt-chart-export">
            {/* Header */}
            <div className="flex border-b border-border sticky top-0 bg-bg-secondary z-10 gantt-header">
              {/* Task names column */}
              <div className="task-name-column flex-shrink-0 p-4 border-r border-border font-semibold bg-bg-secondary" style={{ width: '300px' }}>
                Task
              </div>
              
              {/* Timeline header */}
              <div className="flex">
                {days.map((day, index) => {
                  const weekend = isWeekend(day);
                  const today = isToday(day);
                  const holiday = getHolidayForDate(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`flex-shrink-0 p-2 border-r border-border text-center cursor-pointer ${
                        today
                          ? 'bg-primary/20 font-bold'
                          : holiday
                          ? 'bg-purple-600/40'
                          : weekend
                          ? 'bg-gray-800/50'
                          : ''
                      }`}
                      style={{ width: `${dayWidth}px` }}
                      onClick={() => holiday && handleHolidayClick(holiday)}
                      title={holiday ? `${holiday.name} - Click for details` : ''}
                    >
                      <div className={`text-xs font-medium ${weekend ? 'text-gray-500' : holiday ? 'text-purple-400' : ''}`}>
                        {formatDateHeader(day, index)}
                      </div>
                      <div className={`text-xs ${weekend ? 'text-gray-600' : holiday ? 'text-purple-500' : 'text-text-secondary'}`}>
                        {format(day, 'EEE')[0]}
                      </div>
                      {holiday && (
                        <div className="text-[8px] text-purple-400 uppercase tracking-wider mt-0.5">
                          Holiday
                        </div>
                      )}
                      {weekend && !holiday && (
                        <div className="text-[8px] text-gray-600 uppercase tracking-wider mt-0.5">
                          Off
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task rows */}
            <div className="relative">
              {ganttTasks.map((task, taskIndex) => (
                <GanttRow
                  key={task.id}
                  task={task}
                  days={days}
                  dayWidth={dayWidth}
                  isEven={taskIndex % 2 === 0}
                  onTaskClick={handleTaskClick}
                  holidays={holidays}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Floating scroll bar - always visible at bottom */}
        <div className="sticky bottom-0 left-0 right-0 overflow-x-auto bg-bg-secondary border-t-2 border-primary no-print"
          style={{ 
            boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.3)',
            zIndex: 20
          }}
          onScroll={(e) => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
        >
          <div style={{ width: `${264 + (days.length * dayWidth)}px`, height: '20px' }}></div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-6 p-4 bg-bg-secondary border border-border rounded-lg text-sm flex-wrap no-print">
        <div>
          <span className="text-text-secondary">Total Tasks:</span>{' '}
          <span className="font-semibold">{ganttTasks.length}</span>
        </div>
        <div>
          <span className="text-text-secondary">Window:</span>{' '}
          <span className="font-semibold">
            {format(windowStartDate, 'MMM d')} - {format(windowEndDate, 'MMM d, yyyy')}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Duration:</span>{' '}
          <span className="font-semibold">{days.length} days</span>
        </div>
        <div>
          <span className="text-text-secondary">Weekends:</span>{' '}
          {includeSaturday && <Badge variant="success">Sat</Badge>}
          {includeSunday && <Badge variant="success">Sun</Badge>}
          {!includeSaturday && !includeSunday && <Badge variant="default">Hidden</Badge>}
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          isOpen={showTaskDetails}
          onClose={() => {
            setShowTaskDetails(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          assignments={assignments}
        />
      )}

      {/* Holiday Details Modal */}
      {selectedHoliday && (
        <HolidayDetailsModal
          isOpen={showHolidayDetails}
          onClose={() => {
            setShowHolidayDetails(false);
            setSelectedHoliday(null);
          }}
          holiday={selectedHoliday}
        />
      )}
    </div>
  );
}

interface GanttRowProps {
  task: GanttTask;
  days: Date[];
  dayWidth: number;
  isEven: boolean;
  onTaskClick?: (taskId: string) => void;
  holidays: Holiday[];
}

function GanttRow({ task, days, dayWidth, isEven, onTaskClick, holidays }: GanttRowProps) {
  const color = getColorByStatus(task.staffingStatus);
  
  // Check if task is active on a specific day and if it's a working day
  const isTaskActiveOnDay = (day: Date): boolean => {
    // Check if day is within task's date range
    const dayTime = day.getTime();
    const taskStartTime = task.startDate.getTime();
    const taskEndTime = task.endDate.getTime();
    
    if (dayTime < taskStartTime || dayTime > taskEndTime) {
      return false;
    }
    
    // Check if it's a working day for this task
    return isWorkingDayForTask(day, task, holidays);
  };

  return (
    <div
      className={`flex border-b border-border ${
        isEven ? 'bg-bg-primary' : 'bg-bg-secondary'
      } hover:bg-bg-hover transition-colors`}
    >
      {/* Task name */}
      <div className="task-name-column flex-shrink-0 p-4 border-r border-border" style={{ width: '300px', minHeight: '80px' }}>
        <div className="font-medium text-sm" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4' }}>
          {task.name}
        </div>
        {task.location && (
          <div className="text-xs text-text-secondary" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.3' }}>
            {task.location}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant={task.status === 'completed' ? 'success' : 'info'} className="text-xs">
            {task.status}
          </Badge>
          <span className="text-xs text-text-secondary">
            {task.totalAssigned}/{task.totalRequired} workers
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative flex">
        {/* Background grid and task bars rendered day-by-day */}
        {days.map((day, dayIndex) => {
          const weekend = isWeekend(day);
          const today = isToday(day);
          const dateStr = format(day, 'yyyy-MM-dd');
          const holiday = holidays.find(h => h.date === dateStr);
          const isActive = isTaskActiveOnDay(day);
          
          return (
            <div
              key={day.toISOString()}
              className={`flex-shrink-0 border-r ${
                weekend ? 'border-gray-700' : 'border-border'
              } ${
                today
                  ? 'bg-primary/10'
                  : holiday
                  ? 'bg-purple-600/30'
                  : weekend
                  ? 'bg-gray-800/50'
                  : ''
              } relative`}
              style={{ width: `${dayWidth}px`, minHeight: '80px' }}
            >
              {/* Render task bar segment only on working days */}
              {isActive && (
                <div
                  className="task-bar-segment"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '2px',
                    right: '2px',
                    transform: 'translateY(-50%)',
                    height: '32px',
                    backgroundColor: color,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                  onClick={() => onTaskClick?.(task.id)}
                  title={`${task.name}\n${format(task.startDate, 'MMM d')} - ${format(
                    task.endDate,
                    'MMM d'
                  )}\nOperators: ${task.assignedOperators}/${task.requiredOperators}\nLaborers: ${task.assignedLaborers}/${task.requiredLaborers}\n${task.requiredCarpenters > 0 ? `Carpenters: ${task.assignedCarpenters}/${task.requiredCarpenters}\n` : ''}${task.requiredMasons > 0 ? `Masons: ${task.assignedMasons}/${task.requiredMasons}\n` : ''}Total: ${task.totalAssigned}/${task.totalRequired} workers\nWorking Days: ${task.workingDays}\nClick for details`}
                >
                  {/* Show task name only on first day or if wide enough */}
                  {dayIndex === days.findIndex(d => isTaskActiveOnDay(d)) && dayWidth > 40 && (
                    <span style={{ 
                      color: '#ffffff', 
                      fontSize: '11px', 
                      fontWeight: 500, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      padding: '0 4px'
                    }}>
                      {task.name.length > 12 ? task.name.substring(0, 12) + '...' : task.name}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface HolidayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  holiday: Holiday;
}

function HolidayDetailsModal({ isOpen, onClose, holiday }: HolidayDetailsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">{holiday.name}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-900/30 rounded-lg">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">{format(new Date(holiday.date + 'T00:00:00'), 'MMMM d, yyyy')}</div>
              <div className="text-text-secondary">{format(new Date(holiday.date + 'T00:00:00'), 'EEEE')}</div>
            </div>
          </div>

          {holiday.notes && (
            <div className="p-4 bg-bg-primary rounded-lg border border-border">
              <div className="text-sm text-text-secondary">{holiday.notes}</div>
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-3">Pay Rates</h3>
            <div className="grid grid-cols-2 gap-3">
              {holiday.pay_rates.carpenters && (
                <div className="p-3 bg-bg-primary rounded-lg border border-border">
                  <div className="text-sm font-medium">Carpenters</div>
                  <div className="text-lg font-bold text-primary">{holiday.pay_rates.carpenters}</div>
                </div>
              )}
              {holiday.pay_rates.laborers && (
                <div className="p-3 bg-bg-primary rounded-lg border border-border">
                  <div className="text-sm font-medium">Laborers</div>
                  <div className="text-lg font-bold text-primary">{holiday.pay_rates.laborers}</div>
                </div>
              )}
              {holiday.pay_rates.masons && (
                <div className="p-3 bg-bg-primary rounded-lg border border-border">
                  <div className="text-sm font-medium">Masons</div>
                  <div className="text-lg font-bold text-primary">{holiday.pay_rates.masons}</div>
                </div>
              )}
              {holiday.pay_rates.operators && (
                <div className="p-3 bg-bg-primary rounded-lg border border-border">
                  <div className="text-sm font-medium">Operating Engineers</div>
                  <div className="text-lg font-bold text-primary">{holiday.pay_rates.operators}</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Applies To</h3>
            <div className="flex flex-wrap gap-2">
              {holiday.state_county && <Badge variant="info">State & County</Badge>}
              {holiday.federal && <Badge variant="info">Federal</Badge>}
              {holiday.gcla && <Badge variant="info">GCLA</Badge>}
              {holiday.four_basic_trades && <Badge variant="info">Four Basic Trades</Badge>}
            </div>
          </div>

          <div className="p-4 bg-warning/10 border border-warning rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="font-medium text-warning mb-1">Optional Work Day</div>
                <div className="text-sm text-text-secondary">
                  This is a holiday but you can still schedule work. Pay rates shown apply if work is performed.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
