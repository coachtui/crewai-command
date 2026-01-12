import { useState, useRef } from 'react';
import { format } from 'date-fns';
import type { Task, Assignment } from '../../types';
import {
  transformTasksToGantt,
  calculateTimelineRange,
  calculateTaskBarPosition,
  formatDateHeader,
  isWeekend,
  isToday,
  getColorByStatus,
  type GanttTask,
} from '../../lib/ganttHelpers';
import { Badge } from '../ui/Badge';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface GanttChartViewProps {
  tasks: Task[];
  assignments: Assignment[];
  onTaskClick?: (taskId: string) => void;
}

export function GanttChartView({ tasks, assignments, onTaskClick }: GanttChartViewProps) {
  const [dayWidth, setDayWidth] = useState(40); // pixels per day
  const ganttRef = useRef<HTMLDivElement>(null);
  
  const ganttTasks = transformTasksToGantt(tasks, assignments);
  const { startDate, endDate, days } = calculateTimelineRange(ganttTasks);

  const handleExportPDF = async () => {
    if (!ganttRef.current) return;

    try {
      toast.loading('Generating PDF...');
      
      const canvas = await html2canvas(ganttRef.current, {
        scale: 2,
        backgroundColor: '#121212',
        logging: false,
      });

      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`gantt-chart-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast.dismiss();
      toast.success('PDF exported successfully!');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export PDF');
      console.error(error);
    }
  };

  const handlePrint = () => {
    window.print();
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
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div className="flex items-center gap-4">
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

        <div className="flex items-center gap-2">
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

      {/* Legend */}
      <div className="flex items-center gap-6 p-4 bg-bg-secondary border border-border rounded-lg no-print">
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
      </div>

      {/* Gantt Chart */}
      <div
        ref={ganttRef}
        className="bg-bg-secondary border border-border rounded-lg overflow-x-auto"
      >
        <div className="min-w-max">
          {/* Header */}
          <div className="flex border-b border-border sticky top-0 bg-bg-secondary z-10">
            {/* Task names column */}
            <div className="w-64 flex-shrink-0 p-4 border-r border-border font-semibold">
              Task
            </div>
            
            {/* Timeline header */}
            <div className="flex">
              {days.map((day, index) => {
                const weekend = isWeekend(day);
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`flex-shrink-0 p-2 border-r border-border text-center ${
                      today
                        ? 'bg-primary/20 font-bold'
                        : weekend
                        ? 'bg-gray-800/50'
                        : ''
                    }`}
                    style={{ width: `${dayWidth}px` }}
                  >
                    <div className={`text-xs font-medium ${weekend ? 'text-gray-500' : ''}`}>
                      {formatDateHeader(day, index)}
                    </div>
                    <div className={`text-xs ${weekend ? 'text-gray-600' : 'text-text-secondary'}`}>
                      {format(day, 'EEE')[0]}
                    </div>
                    {weekend && (
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
                startDate={startDate}
                days={days}
                dayWidth={dayWidth}
                isEven={taskIndex % 2 === 0}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-6 p-4 bg-bg-secondary border border-border rounded-lg text-sm no-print">
        <div>
          <span className="text-text-secondary">Total Tasks:</span>{' '}
          <span className="font-semibold">{ganttTasks.length}</span>
        </div>
        <div>
          <span className="text-text-secondary">Date Range:</span>{' '}
          <span className="font-semibold">
            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
          </span>
        </div>
        <div>
          <span className="text-text-secondary">Duration:</span>{' '}
          <span className="font-semibold">{days.length} days</span>
        </div>
      </div>
    </div>
  );
}

interface GanttRowProps {
  task: GanttTask;
  startDate: Date;
  days: Date[];
  dayWidth: number;
  isEven: boolean;
  onTaskClick?: (taskId: string) => void;
}

function GanttRow({ task, startDate, days, dayWidth, isEven, onTaskClick }: GanttRowProps) {
  const { left, width } = calculateTaskBarPosition(task, startDate, dayWidth);
  const color = getColorByStatus(task.staffingStatus);

  return (
    <div
      className={`flex border-b border-border ${
        isEven ? 'bg-bg-primary' : 'bg-bg-secondary'
      } hover:bg-bg-hover transition-colors`}
    >
      {/* Task name */}
      <div className="w-64 flex-shrink-0 p-4 border-r border-border">
        <div className="font-medium text-sm truncate">{task.name}</div>
        {task.location && (
          <div className="text-xs text-text-secondary truncate">{task.location}</div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={task.status === 'completed' ? 'success' : 'info'} className="text-xs">
            {task.status}
          </Badge>
          <span className="text-xs text-text-secondary">
            {task.assignedOperators + task.assignedLaborers}/{task.requiredOperators + task.requiredLaborers} crew
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative flex">
        {/* Background grid */}
        {days.map((day) => {
          const weekend = isWeekend(day);
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`flex-shrink-0 border-r ${
                weekend ? 'border-gray-700' : 'border-border'
              } ${
                today
                  ? 'bg-primary/10'
                  : weekend
                  ? 'bg-gray-800/50'
                  : ''
              }`}
              style={{ width: `${dayWidth}px`, height: '100%' }}
            />
          );
        })}

        {/* Task bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-8 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center px-2"
          style={{
            left: `${left}px`,
            width: `${width}px`,
            backgroundColor: color,
            minWidth: '20px',
          }}
          onClick={() => onTaskClick?.(task.id)}
          title={`${task.name}\n${format(task.startDate, 'MMM d')} - ${format(
            task.endDate,
            'MMM d'
          )}\nOperators: ${task.assignedOperators}/${task.requiredOperators}\nLaborers: ${task.assignedLaborers}/${task.requiredLaborers}\nWorking Days: ${task.workingDays} (${task.duration} total)`}
        >
          <span className="text-white text-xs font-medium truncate">
            {width > 100 ? task.name : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
