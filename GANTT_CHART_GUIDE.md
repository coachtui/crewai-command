# Gantt Chart Feature - CrewAI Command

## Overview

A professional-grade Gantt chart visualization has been added to the Calendar page, allowing you to view tasks as horizontal timeline bars. This provides a clear visual representation of project schedules, task durations, and crew assignments.

---

## Features

### ✅ View Toggle
- Switch between **Calendar View** (4-week grid) and **Gantt Chart View** (timeline)
- Toggle buttons located in the header
- State is maintained while navigating

### ✅ Visual Timeline
- **Horizontal task bars** showing duration from start to end date
- **Color-coded by staffing status:**
  - 🟢 Green: Fully staffed (crew = required)
  - 🟠 Orange: Understaffed (some crew assigned)
  - 🔴 Red: Not staffed (no crew assigned)
- **Date headers** showing days, weeks, and months
- **Weekend highlighting** (lighter background)
- **Today marker** (highlighted column)

### ✅ Interactive Controls
- **Zoom slider**: Adjust day width (20px - 60px per day)
- **Click task bars**: View task details (can be extended to show modal)
- **Hover tooltips**: Show task info on hover
- **Responsive layout**: Horizontal scroll for long timelines

### ✅ Print & Export
- **Print button**: Optimized for landscape printing
- **Export PDF button**: Download as PDF file
- **Print styles**: Hides buttons/controls, shows only chart
- **Color preservation**: Task colors maintained in PDF

### ✅ Task Information Display
- Task name and location
- Crew count (assigned/required)
- Task status badge (planned/active/completed)
- Visual duration on timeline

---

## File Structure

```
src/
├── lib/
│   └── ganttHelpers.ts              # Utility functions
├── components/
│   └── calendar/
│       └── GanttChartView.tsx       # Main Gantt component
└── pages/
    └── admin/
        └── Calendar.tsx             # Updated with view toggle
```

---

## How to Use

### For End Users

1. **Navigate to Calendar**
   - Go to the Calendar page from the sidebar
   - You'll see the traditional 4-week calendar view by default

2. **Switch to Gantt View**
   - Click the "Gantt Chart" button in the top-right header
   - The view will switch to show the timeline

3. **Adjust Zoom**
   - Use the zoom slider to make days wider or narrower
   - Helps with viewing long or short timeframes

4. **Interact with Tasks**
   - Click on any task bar to view details
   - Hover over bars to see full task information

5. **Print or Export**
   - Click "Print" to print the chart (landscape mode)
   - Click "Export PDF" to download as PDF file
   - Share the PDF with superintendents, clients, or stakeholders

---

## Technical Details

### Dependencies

```json
{
  "html2canvas": "^1.4.1",   // For capturing chart as image
  "jspdf": "^2.5.2"           // For PDF generation
}
```

### Key Functions (ganttHelpers.ts)

```typescript
// Transform database tasks to Gantt format
transformTasksToGantt(tasks, assignments): GanttTask[]

// Calculate timeline date range
calculateTimelineRange(tasks): { startDate, endDate, days }

// Get task bar position and width
calculateTaskBarPosition(task, timelineStart, dayWidth): { left, width }

// Get color based on staffing
getColorByStatus(status): string

// Check if date is today/weekend
isToday(date): boolean
isWeekend(date): boolean
```

### Component Props

```typescript
interface GanttChartViewProps {
  tasks: Task[];              // Array of tasks from database
  assignments: Assignment[];  // Array of assignments
  onTaskClick?: (taskId: string) => void;  // Optional click handler
}
```

---

## Customization

### Change Colors

Edit `src/lib/ganttHelpers.ts`:

```typescript
export function getColorByStatus(status: 'full' | 'partial' | 'empty'): string {
  switch (status) {
    case 'full':
      return '#10b981'; // Change to your green
    case 'partial':
      return '#f59e0b'; // Change to your orange
    case 'empty':
      return '#ef4444'; // Change to your red
  }
}
```

### Adjust Default Zoom

Edit `src/components/calendar/GanttChartView.tsx`:

```typescript
const [dayWidth, setDayWidth] = useState(40); // Change default (20-60)
```

### Modify Date Range Padding

Edit `src/lib/ganttHelpers.ts`:

```typescript
// Add more/less padding before first task
const startDate = addDays(minStart, -3); // Change -3 to your preference
const endDate = addDays(maxEnd, 3);       // Change 3 to your preference
```

---

## Print Styles

The chart uses special print media queries for optimal printing:

```css
@media print {
  @page {
    size: landscape;        /* Force landscape orientation */
    margin: 0.5in;         /* Set margins */
  }
  
  .no-print {
    display: none !important;  /* Hide controls */
  }
  
  [style*="backgroundColor"] {
    print-color-adjust: exact;  /* Preserve task colors */
  }
}
```

Add `.no-print` class to any element you don't want printed.

---

## Future Enhancements

### Potential Features to Add:

1. **Drag & Drop**
   - Allow admins to drag task bars to change dates
   - Update database on drop

2. **Filtering**
   - Filter by project/location
   - Filter by superintendent
   - Filter by status (planned/active/completed)

3. **Grouping**
   - Group tasks by project
   - Collapsible project groups

4. **Dependencies**
   - Show task dependencies with arrows
   - Highlight critical path

5. **Milestone Markers**
   - Add diamond markers for key dates
   - Project completion markers

6. **Resource View**
   - Show crew members as rows
   - Tasks as bars on crew timeline

7. **Share Links**
   - Generate shareable read-only links
   - Public view for clients/stakeholders

---

## Troubleshooting

### Tasks Not Showing
- **Check dates**: Tasks need both `start_date` and `end_date`
- **Check permissions**: Ensure user can view tasks
- **Check data**: Verify tasks exist in database

### PDF Export Not Working
- **Browser compatibility**: Works best in Chrome/Edge
- **Canvas issues**: Some elements may not render in canvas
- **Large charts**: Very long timelines may be cut off

### Print Layout Issues
- **Use landscape**: Set printer to landscape mode
- **Check zoom**: Browser zoom affects print layout
- **Use Chrome**: Chrome has best print support

### Colors Not Showing
- **Check CSS**: Ensure color utility classes are defined
- **Print settings**: Enable "Background graphics" in print dialog
- **Browser**: Some browsers don't preserve colors when printing

---

## Performance Notes

- **Large datasets**: 100+ tasks render well
- **Long timelines**: 12+ months may be slow to render
- **PDF export**: Takes 2-3 seconds for typical chart
- **Real-time updates**: Chart updates when tasks change

---

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ Mobile: Limited (horizontal scroll)

---

## Credits

- Built for **CrewAI Command** crew scheduling platform
- Uses **date-fns** for date calculations
- Uses **html2canvas** for chart capture
- Uses **jsPDF** for PDF generation

---

## Support

For issues or feature requests:
1. Check this guide first
2. Review the code comments
3. Test in Chrome DevTools
4. Check browser console for errors

---

## Examples

### Basic Usage

```typescript
import { GanttChartView } from './components/calendar/GanttChartView';

function MyCalendar() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  return (
    <GanttChartView 
      tasks={tasks} 
      assignments={assignments}
    />
  );
}
```

### With Click Handler

```typescript
<GanttChartView 
  tasks={tasks} 
  assignments={assignments}
  onTaskClick={(taskId) => {
    console.log('Task clicked:', taskId);
    // Open modal, navigate, etc.
  }}
/>
```

---

**Last Updated**: January 2026  
**Version**: 1.0.0
