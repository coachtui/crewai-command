import Anthropic from '@anthropic-ai/sdk';

export const config = {
  runtime: 'edge',
};

interface VoiceIntent {
  action: string;
  confidence: number;
  data: any;
  summary: string;
  needs_confirmation: boolean;
  question?: string;
  options?: string[];
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { transcript, clientDate } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'No transcript provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'API not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Use client's local date (from Hawaii timezone) instead of server UTC
    const todayDate = clientDate || new Date().toISOString().split('T')[0];
    const today = new Date(todayDate + 'T00:00:00');
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    const systemPrompt = `You are parsing voice commands for CrewAI Command, a construction crew scheduling app used by superintendents and foremen in the field.

Parse natural language commands into structured actions.

CONTEXT:
- Users are on construction sites (noisy, wearing gloves, rushed)
- Worker names may be partial ("Jose" could be "Jose Martinez")
- Commands are casual ("move Jose to concrete" not "reassign Jose Martinez from task A to task B")
- Dates are relative ("tomorrow", "next week", "Monday", "rest of this week")
- Current date: ${todayDate}
- Tomorrow's date: ${tomorrowDate}

AVAILABLE ACTIONS:

1. reassign_worker
   - Move worker from one task to another
   - Example: "Move Jose to concrete pour tomorrow"
   - data schema: { worker_name, to_task_name, dates (array of ISO date strings) }

2. create_task
   - Create new task with crew requirements
   - Example: "Create welding task at HCC next week, 2 welders"
   - data schema: { task_name, location, start_date (ISO or relative string), end_date (ISO or relative string, defaults to same as start_date), required_operators, required_laborers }

3. query_info
   - Answer questions about workers, tasks, schedules
   - Example: "Where is Panama today?" or "Show me Friday's schedule"
   - data schema: { query_type ("worker_location"|"worker_assignment"), worker_name, date }

4. update_timesheet
   - Modify hours worked or mark worker status
   - Example: "Mark Jose sick on Tuesday" or "Panama worked 10 hours Thursday"
   - data schema: { worker_name, date, hours?, status? }

5. approve_request
   - Approve a foreman's pending reassignment request
   - Example: "Approve Carlos's request"
   - data schema: { worker_name }

6. create_worker
   - Add a new worker to the crew
   - Example: "Add Miguel Santos as a laborer" or "New worker Carlos, operator, 808-555-1234"
   - data schema: { worker_name, role ("operator"|"laborer"|"carpenter"|"mason"), phone? }

7. edit_worker
   - Change a worker's role, phone, or status
   - Example: "Change Jose to operator" or "Mark Carlos inactive" or "Update Panama's phone to 808-555-9876"
   - data schema: { worker_name, updates: { role?, phone?, status? } }

8. create_job_site
   - Create a new job site / project
   - Example: "Create job site downtown hospital" or "New project Queen's Medical Center, starts Monday"
   - data schema: { site_name, address?, start_date? }

9. invite_user
   - Invite a new user (admin, superintendent, engineer, foreman, or worker account)
   - Example: "Invite john@example.com as foreman, name John Smith"
   - data schema: { email, name, role ("admin"|"superintendent"|"engineer"|"foreman"|"worker") }

10. open_file
    - Open or find a file from shared files
    - Example: "Open the safety plan" or "Show me the site drawings" or "Find the RFI log"
    - data schema: { file_name }

11. navigate
    - Navigate to a section of the app
    - Example: "Go to workers" or "Open the calendar" or "Show daily hours" or "Take me to tasks"
    - data schema: { page ("dashboard"|"workers"|"tasks"|"calendar"|"activities"|"daily-hours"|"files"|"today"|"profile") }

PARSING RULES:
- If worker name is partial, include likely full name in response
- Parse relative dates to actual dates (tomorrow = ${tomorrowDate})
- Default to 8 hours per day unless specified
- If confidence < 0.7, ask for clarification
- Be lenient with casual phrasing
- "Inactive" / "deactivate" / "remove" a worker → edit_worker with status: "inactive"
- "Go to", "show me", "open", "take me to" a page → navigate
- "Find file", "show file", "open file" → open_file

OUTPUT FORMAT (respond with ONLY JSON, no other text):
{
  "action": "reassign_worker" | "create_task" | "query_info" | "update_timesheet" | "approve_request" | "create_worker" | "edit_worker" | "create_job_site" | "invite_user" | "open_file" | "navigate" | "clarify",
  "confidence": 0.0 to 1.0,
  "data": {
    // Action-specific structured data per schema above
  },
  "summary": "Human-readable summary of what will happen",
  "needs_confirmation": true/false
}

If unclear or confidence < 0.7:
{
  "action": "clarify",
  "question": "Did you mean to move Jose Martinez or Jose Silva?",
  "options": ["Jose Martinez", "Jose Silva"]
}`;

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: transcript,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Strip markdown code fences if present (```json ... ```)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      // Remove opening ```json or ```
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '');
      // Remove closing ```
      jsonText = jsonText.replace(/\n?```$/, '');
      jsonText = jsonText.trim();
    }

    const intent: VoiceIntent = JSON.parse(jsonText);

    return new Response(JSON.stringify(intent), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Parse API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to parse command',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
