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
   
2. create_task
   - Create new task with crew requirements
   - Example: "Create welding task at HCC next week, 2 welders"
   
3. query_info
   - Answer questions about workers, tasks, schedules
   - Example: "Where is Panama today?" or "Show me Friday's schedule"
   
4. update_timesheet
   - Modify hours worked
   - Example: "Mark Jose sick on Tuesday" or "Panama worked 10 hours Thursday"

5. approve_request
   - Approve a foreman's pending reassignment request
   - Example: "Approve Carlos's request"

PARSING RULES:
- If worker name is partial, include likely full name in response
- Parse relative dates to actual dates (tomorrow = ${tomorrowDate})
- Default to 8 hours per day unless specified
- If confidence < 0.7, ask for clarification
- Be lenient with casual phrasing

OUTPUT FORMAT (respond with ONLY JSON, no other text):
{
  "action": "reassign_worker" | "create_task" | "query_info" | "update_timesheet" | "approve_request" | "clarify",
  "confidence": 0.0 to 1.0,
  "data": {
    // Action-specific structured data
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
