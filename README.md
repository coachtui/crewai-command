# CrewAI Command 🏗️

> **Real-time crew scheduling platform for construction superintendents**

A production-ready Progressive Web App (PWA) that enables construction superintendents and foremen to manage 60+ workers, schedule tasks, and track crew movements in real-time.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PWA](https://img.shields.io/badge/PWA-enabled-purple)

---

## ✨ Features

### 👷 Worker Management
- **CRUD Operations** - Create, read, update, delete workers
- **Role Assignment** - Operators vs. Laborers
- **Skills Tracking** - Tag workers with equipment/trade skills
- **Contact Info** - Store phone numbers and notes
- **Search & Filter** - Find workers instantly by name or role
- **Real-Time Sync** - Changes appear immediately across all users

### 📋 Task Scheduling
- **Weekly Views** - Tasks grouped by week (next 4 weeks)
- **Date Ranges** - Multi-day task support
- **Location Tracking** - Job site addresses
- **Staffing Requirements** - Define needed operators/laborers
- **Status Indicators** - Visual progress tracking (Green/Yellow/Red)
- **Smart Assignment** - Click-to-assign interface

### 📅 Calendar View
- **4-Week Layout** - Horizontal scrollable calendar
- **Color Coding** - Instant staffing status visibility
- **Daily Breakdown** - See all tasks per day
- **Today Highlighting** - Current day emphasized
- **Task Chips** - Quick overview of daily schedule

### 👔 Superintendent Dashboard
- **Activity Feed** - See all worker movements (last 7 days)
- **Acknowledgment System** - Review and acknowledge changes
- **Filter Tabs** - Pending / Acknowledged / All Activity
- **Real-Time Updates** - New assignments appear instantly
- **Summary Stats** - Total, pending, acknowledged counts
- **Timeline View** - "2 minutes ago", "1 hour ago" timestamps

### 📱 Foreman Mobile View
- **Today's Schedule** - Focus on current day only
- **Crew Lists** - See operators and laborers per task
- **Progress Indicators** - (2/3 operators), (4/5 laborers)
- **Worker Details** - Names, roles, skills displayed
- **Mobile-Optimized** - Touch-friendly interface
- **Real-Time Updates** - Schedule syncs automatically

### ⚡ Real-Time Collaboration
- **Sub-Second Sync** - Changes propagate instantly
- **Multi-User Support** - Team collaboration enabled
- **Automatic Refresh** - No page reloads needed
- **Console Logging** - See events in developer tools
- **Conflict Prevention** - Can't double-book workers

### 🔒 Conflict Prevention
- **Date Range Checking** - Prevents overlapping assignments
- **Unique Constraints** - Worker can't be in two places
- **Error Toasts** - Clear feedback on conflicts
- **Smart Validation** - Client and server-side checks

### 📱 Progressive Web App
- **Installable** - Add to home screen (mobile/desktop)
- **Offline Support** - Basic functionality without internet
- **App Shortcuts** - Quick access to key features
- **Standalone Mode** - Runs like a native app
- **Fast Loading** - Service worker caching

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free tier works)
- Modern browser (Chrome, Firefox, Safari, Edge)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd crewai
npm install
```

### 2. Set Up Supabase

Follow the complete guide in **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**

Quick steps:
1. Create Supabase project
2. Run SQL schema (creates 6 tables)
3. Insert test data (6 workers, 3 tasks)
4. Get API keys

### 3. Configure Environment

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Start Development Server

```bash
npm run dev
```

Visit: **http://localhost:5173**

### 5. Create App Icons (Optional)

See **[PWA_GUIDE.md](./PWA_GUIDE.md)** for creating icons

---

## 📖 User Guide

### For Superintendents

**Manage Workers** (`/workers`)
1. Click "+ Add Worker"
2. Fill name, role, skills, phone
3. Worker appears in grid instantly
4. Search or filter by role
5. Click card to edit details

**Schedule Tasks** (`/tasks`)
1. Click "New Task"
2. Set name, location, dates, requirements
3. Task appears in weekly view
4. **Click task card** to assign workers
5. Watch status change colors

**Assign Workers** (Click any task)
1. Assignment modal opens
2. Click "+ Add" next to Operators/Laborers
3. Select available workers
4. Worker assigned to all task dates
5. Remove with X button

**Review Activities** (`/activities`)
1. See all worker movements
2. Filter: Pending / Acknowledged / All
3. Click "Acknowledge" on each item
4. Or "Acknowledge All" button
5. Activities turn green when acknowledged

**View Calendar** (`/calendar`)
1. See 4 weeks side-by-side
2. Scroll horizontally
3. Color indicates staffing status
4. Today is highlighted

### For Foremen

**Check Today's Schedule** (`/foreman/today`)
1. Visit foreman today view
2. See tasks for current date
3. Review crew assignments
4. Check operator/laborer counts
5. View worker skills

---

## 🏗️ Architecture

### Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, shadcn/ui components
- **Icons:** Lucide React
- **Backend:** Supabase (PostgreSQL + Realtime + Auth)
- **Deployment:** Vercel (frontend) + Supabase Cloud (backend)
- **PWA:** Service Worker, Manifest

### Database Schema

```
organizations → users
    ↓             ↓
  workers      tasks
      ↘        ↙
     assignments
         ↓
  assignment_requests
```

**6 Main Tables:**
- `organizations` - Multi-tenant support
- `users` - Admins and foremen
- `workers` - Crew members
- `tasks` - Work to be done
- `assignments` - Worker→Task mappings
- `assignment_requests` - Foreman requests

See **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** for complete schema.

### File Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   ├── layout/          # Sidebar navigation
│   ├── workers/         # Worker CRUD components
│   ├── tasks/           # Task management
│   └── assignments/     # Assignment modal
├── pages/
│   ├── admin/           # Superintendent views
│   │   ├── Workers.tsx
│   │   ├── Tasks.tsx
│   │   ├── Calendar.tsx
│   │   └── Activities.tsx
│   └── foreman/         # Foreman views
│       └── Today.tsx
├── lib/
│   ├── supabase.ts      # Supabase client
│   ├── utils.ts         # Helper functions
│   └── hooks/           # Custom React hooks
│       └── useRealtime.ts
├── types/
│   └── index.ts         # TypeScript definitions
└── App.tsx              # Routes and layout
```

---

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Adding New Features

1. **New Component**: `src/components/[category]/ComponentName.tsx`
2. **New Page**: `src/pages/[role]/PageName.tsx`
3. **Add Route**: Update `src/App.tsx`
4. **Add to Sidebar**: Update `src/components/layout/Sidebar.tsx`

### Real-Time Setup

Use custom hooks for real-time data:

```typescript
import { useRealtimeSubscription } from './lib/hooks/useRealtime';

// In your component:
useRealtimeSubscription('workers', () => {
  fetchWorkers(); // Refresh data
});
```

---

## 📱 PWA Installation

See complete guide: **[PWA_GUIDE.md](./PWA_GUIDE.md)**

**Quick Install:**
1. Create app icons (192x192, 512x512)
2. Place in `/public/` as `icon-192.png` and `icon-512.png`
3. Deploy to production (HTTPS required)
4. Install button appears in browser

**Test Locally:**
- Service worker works on localhost
- Check DevTools → Application → Service Workers
- Manifest visible in Application → Manifest

---

## 🚀 Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Environment Variables

Add to Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Post-Deployment

1. Test real-time sync
2. Try PWA installation
3. Test on mobile device
4. Run Lighthouse audit (aim for 90+)

---

## 🐛 Troubleshooting

See detailed guide: **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**

**Common Issues:**

**Workers not loading?**
- Check Supabase API key
- Verify database schema created
- Disable RLS for testing
- Restart dev server

**Real-time not working?**
- Check console for subscription logs
- Verify Supabase Realtime enabled
- Test with 2 browser tabs

**PWA not installing?**
- Requires HTTPS (or localhost)
- Check manifest.json accessible
- Verify service worker registered
- Create app icons

---

## 📊 Project Stats

- **Components:** 25+
- **Pages:** 6 (Admin: 5, Foreman: 1)
- **Database Tables:** 6
- **Real-Time Subscriptions:** 5
- **PWA Features:** 4 (Manifest, SW, Icons, Shortcuts)
- **Lines of Code:** ~3,500+
- **Development Time:** 4-week sprint

---

## 🎯 Use Cases

### Construction Companies
- 60+ crew members across multiple sites
- Daily crew scheduling
- Equipment operator tracking
- Laborer assignments
- Superintendent oversight

### Scenarios
1. **Morning Planning** - Superintendent assigns crews
2. **Field Updates** - Foremen check today's schedule
3. **Change Management** - Workers reassigned mid-day
4. **Activity Review** - Super acknowledges all changes
5. **Multi-Site** - Real-time coordination across locations

---

## 🔐 Security

### Row-Level Security (RLS)

Production setup should use proper RLS policies:

```sql
-- Restrict to authenticated users
CREATE POLICY "Authenticated access" ON workers
  FOR ALL USING (auth.role() = 'authenticated');

-- Org-level isolation
CREATE POLICY "Org isolation" ON workers
  FOR ALL USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));
```

**Current Setup:**
- RLS disabled for development
- All tables publicly accessible
- **Enable RLS before production!**

### Best Practices
- ✅ API keys in environment variables
- ✅ HTTPS in production (Vercel provides)
- ✅ Input validation on forms
- ⚠️ Enable RLS policies
- ⚠️ Implement proper authentication

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - feel free to use for your projects!

---

## 🙏 Acknowledgments

- **Supabase** - Amazing backend-as-a-service
- **shadcn/ui** - Beautiful component library
- **Tailwind CSS** - Utility-first styling
- **Lucide** - Icon set

---

## 📞 Support

- **Documentation:** See setup guides in repo
- **Issues:** Open a GitHub issue
- **Supabase:** [https://supabase.com/docs](https://supabase.com/docs)

---

## 🎉 What's Next?

### Phase 2 Ideas
- [ ] Equipment tracking
- [ ] Time tracking integration
- [ ] Push notifications
- [ ] Photo attachments
- [ ] Weather integration
- [ ] Daily reports
- [ ] Analytics dashboard
- [ ] Multi-language support

---

**Built with ❤️ for construction teams everywhere**

*"Because good crew management shouldn't be hard."*
