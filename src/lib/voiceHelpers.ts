import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fuzzy match worker name (simple Levenshtein-like matching)
export async function findWorkerByName(partialName: string, orgId: string) {
  const { data: workers, error } = await supabase
    .from('workers')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'active');

  if (error) throw error;
  if (!workers || workers.length === 0) {
    throw new Error(`No workers found`);
  }

  // Simple fuzzy matching
  const normalizedSearch = partialName.toLowerCase().trim();
  
  // First, try exact match
  const exactMatch = workers.find(w => 
    w.name.toLowerCase() === normalizedSearch
  );
  if (exactMatch) return exactMatch;

  // Then try contains
  const containsMatch = workers.find(w => 
    w.name.toLowerCase().includes(normalizedSearch)
  );
  if (containsMatch) return containsMatch;

  // Then try partial match (search term in worker name)
  const partialMatch = workers.find(w => {
    const workerNameParts = w.name.toLowerCase().split(' ');
    const searchParts = normalizedSearch.split(' ');
    return searchParts.every(part => 
      workerNameParts.some(namePart => namePart.includes(part))
    );
  });
  if (partialMatch) return partialMatch;

  // If still no match, return closest by first name
  const firstNameMatches = workers.filter(w => {
    const firstName = w.name.split(' ')[0].toLowerCase();
    return firstName.includes(normalizedSearch) || normalizedSearch.includes(firstName);
  });

  if (firstNameMatches.length === 1) {
    return firstNameMatches[0];
  }

  if (firstNameMatches.length > 1) {
    throw new Error(
      `Multiple workers found with name "${partialName}": ${firstNameMatches.map(w => w.name).join(', ')}. Please be more specific.`
    );
  }

  throw new Error(`Worker "${partialName}" not found`);
}

// Fuzzy match task name
export async function findTaskByName(partialName: string, orgId: string) {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('org_id', orgId)
    .in('status', ['planned', 'active']);

  if (error) throw error;
  if (!tasks || tasks.length === 0) {
    throw new Error(`No active tasks found`);
  }

  const normalizedSearch = partialName.toLowerCase().trim();
  
  // Try exact match
  const exactMatch = tasks.find(t => 
    t.name.toLowerCase() === normalizedSearch
  );
  if (exactMatch) return exactMatch;

  // Try contains
  const containsMatch = tasks.find(t => 
    t.name.toLowerCase().includes(normalizedSearch)
  );
  if (containsMatch) return containsMatch;

  // Try partial word match
  const partialMatch = tasks.find(t => {
    const taskNameParts = t.name.toLowerCase().split(' ');
    const searchParts = normalizedSearch.split(' ');
    return searchParts.every(part => 
      taskNameParts.some(namePart => namePart.includes(part))
    );
  });
  if (partialMatch) return partialMatch;

  // Check location as fallback
  const locationMatch = tasks.find(t => 
    t.location && t.location.toLowerCase().includes(normalizedSearch)
  );
  if (locationMatch) return locationMatch;

  throw new Error(`Task "${partialName}" not found`);
}

// Parse relative dates to absolute dates
export function parseRelativeDate(dateString: string): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const normalized = dateString.toLowerCase().trim();

  // Today
  if (normalized === 'today') {
    return [formatDate(today)];
  }

  // Tomorrow
  if (normalized === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return [formatDate(tomorrow)];
  }

  // Yesterday
  if (normalized === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return [formatDate(yesterday)];
  }

  // Specific day names
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = dayNames.findIndex(d => normalized.includes(d));
  if (dayIndex !== -1) {
    const targetDay = getNextWeekday(dayIndex);
    return [formatDate(targetDay)];
  }

  // Next week
  if (normalized.includes('next week')) {
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + 7 + i - today.getDay());
      dates.push(formatDate(date));
    }
    return dates;
  }

  // This week / rest of week
  if (normalized.includes('this week') || normalized.includes('rest of')) {
    const dates = [];
    const daysLeft = 7 - today.getDay();
    for (let i = 0; i < daysLeft; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(formatDate(date));
    }
    return dates;
  }

  // If it's already a date string, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return [normalized];
  }

  // Default to today
  return [formatDate(today)];
}

function getNextWeekday(targetDay: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();
  
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Next occurrence
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntilTarget);
  return targetDate;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get current user from Supabase session
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('Not authenticated');
  }

  // Get user details from users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    throw new Error('User not found');
  }

  return userData;
}
