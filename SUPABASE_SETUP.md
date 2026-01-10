# Supabase Setup Guide for CrewAI

Follow these steps to get your Supabase backend configured and running.

## Step 1: Create Supabase Account & Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign In"
3. Sign in with GitHub (recommended) or create an account
4. Click "New Project"
5. Fill in:
   - **Name:** `CrewAI` (or your choice)
   - **Database Password:** Create a strong password (save this!)
   - **Region:** Choose closest to you
   - **Pricing Plan:** Free tier is perfect for development
6. Click "Create new project"
7. Wait 2-3 minutes for project to provision

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, click **Settings** (gear icon in sidebar)
2. Click **API** in the settings menu
3. You'll see two keys:
   - **Project URL** - Copy this (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key - Copy this (long string starting with `eyJ...`)

## Step 3: Configure Environment Variables

1. Open `.env.local` in your project root
2. Replace the placeholders with your actual values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Save the file
4. **Restart your dev server** (Ctrl+C, then `npm run dev`)

## Step 4: Create Database Schema

1. In Supabase dashboard, click **SQL Editor** in the sidebar
2. Click "New query"
3. Copy and paste this entire SQL script:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'foreman')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workers table
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('operator', 'laborer')) NOT NULL,
  skills JSONB DEFAULT '[]',
  phone TEXT,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  required_operators INT DEFAULT 0,
  required_laborers INT DEFAULT 0,
  status TEXT CHECK (status IN ('planned', 'active', 'completed')) DEFAULT 'planned',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Assignments table
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL,
  status TEXT CHECK (status IN ('assigned', 'completed', 'reassigned')) DEFAULT 'assigned',
  assigned_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, assigned_date, task_id)
);

-- Assignment Requests table (for foreman workflow)
CREATE TABLE assignment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  from_task_id UUID REFERENCES tasks(id),
  to_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_assignments_task ON assignments(task_id);
CREATE INDEX idx_assignments_worker ON assignments(worker_id);
CREATE INDEX idx_assignments_date ON assignments(assigned_date);
CREATE INDEX idx_tasks_dates ON tasks(start_date, end_date);
CREATE INDEX idx_requests_status ON assignment_requests(status);

-- Enable Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Simplified for demo - allows all authenticated users)
-- In production, you'd want more restrictive policies based on org_id

CREATE POLICY "Allow all for authenticated users" ON organizations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON users
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON workers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON tasks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON assignments
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON assignment_requests
  FOR ALL USING (auth.role() = 'authenticated');
```

4. Click **RUN** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned" - that's perfect!

## Step 5: Create Test Organization & Data

1. In SQL Editor, create a new query with this:

```sql
-- Insert a test organization
INSERT INTO organizations (id, name) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Demo Construction Co.')
RETURNING *;

-- Insert some sample workers
INSERT INTO workers (org_id, name, role, skills, phone, status) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'John Smith', 'operator', '["Excavator", "Bulldozer"]', '555-123-4567', 'active'),
('550e8400-e29b-41d4-a716-446655440000', 'Jane Doe', 'laborer', '["Concrete", "Framing"]', '555-987-6543', 'active'),
('550e8400-e29b-41d4-a716-446655440000', 'Mike Johnson', 'operator', '["Crane", "Forklift"]', '555-555-1234', 'active'),
('550e8400-e29b-41d4-a716-446655440000', 'Sarah Williams', 'laborer', '["Welding", "Electrical"]', '555-444-3333', 'active'),
('550e8400-e29b-41d4-a716-446655440000', 'Bob Martinez', 'operator', '["Backhoe", "Grader"]', '555-222-8888', 'active'),
('550e8400-e29b-41d4-a716-446655440000', 'Lisa Brown', 'laborer', '["Painting", "Drywall"]', '555-777-9999', 'active')
RETURNING *;

-- Insert sample tasks
INSERT INTO tasks (org_id, name, location, start_date, end_date, required_operators, required_laborers, status) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Foundation Pour', '123 Main St', CURRENT_DATE, CURRENT_DATE + 3, 2, 4, 'planned'),
('550e8400-e29b-41d4-a716-446655440000', 'Site Excavation', '456 Oak Ave', CURRENT_DATE + 1, CURRENT_DATE + 5, 3, 2, 'planned'),
('550e8400-e29b-41d4-a716-446655440000', 'Steel Framing', '789 Pine Rd', CURRENT_DATE + 7, CURRENT_DATE + 14, 1, 3, 'planned')
RETURNING *;
```

2. Click **RUN**
3. You should see your test data returned!

## Step 6: Create Authentication User (Optional)

For now, the app will work without authentication. But if you want to test login:

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Enter:
   - **Email:** admin@demo.com
   - **Password:** (choose a password)
   - **Auto Confirm User:** ✅ Check this box
4. Click "Create user"

Note: The current login page is set up but not fully integrated with Supabase Auth yet. You can skip past it for now by going directly to `/workers` in the browser.

## Step 7: Test Your Setup

1. Make sure dev server is running: `npm run dev`
2. Visit: http://localhost:5173
3. Navigate to `/workers` in the browser
4. You should see 6 workers displayed!
5. Click "+ Add Worker" to test creating a new worker
6. Navigate to `/tasks` to see your 3 sample tasks
7. Click a task card to test the assignment modal

## Troubleshooting

### "Failed to load workers"
- ✅ Check `.env.local` has correct URL and API key
- ✅ Restart dev server after changing `.env.local`
- ✅ Verify schema was created (check Tables in Supabase dashboard)

### Can't see data
- ✅ Check RLS policies are created
- ✅ Verify data was inserted (go to Table Editor in Supabase)

### CORS errors
- Supabase should handle this automatically
- If issues persist, check Project Settings → API → CORS settings

## Next Steps

Once Supabase is working:
- ✅ Create more workers in the Workers page
- ✅ Create tasks in the Tasks page
- ✅ Assign workers to tasks (click task card)
- ✅ View calendar to see assignments
- ✅ Test removing workers from tasks

You're all set! 🎉
