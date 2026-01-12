# Voice API Fixes - January 11, 2026

## Issues Fixed

### 1. JSON Parsing Error in parse.ts
**Error**: `SyntaxError: Unexpected token '`', "```json { "... is not valid JSON`

**Root Cause**: Claude's API was returning JSON wrapped in markdown code fences (```json ... ```), but the code was trying to parse it directly.

**Solution**: Added code fence stripping logic before JSON parsing:
```typescript
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
```

### 2. Database Constraint Violation in execute.ts
**Error**: `null value in column "end_date" of relation "tasks" violates not-null constraint`

**Root Cause**: The `handleCreateTask` function was only setting `start_date` but the database requires `end_date` to be NOT NULL.

**Solution**: Modified task creation to always provide an `end_date`:
- If `end_date` is provided in the voice command data, it uses the parsed date
- If no `end_date` is provided, it defaults to the same date as `start_date` (single-day task)

```typescript
// If no end_date provided, default to same as start_date (single-day task)
let taskEndDate = dates[0];
if (end_date) {
  const endDates = parseRelativeDate(end_date);
  taskEndDate = endDates[0];
}

const { data: task, error } = await client
  .from('tasks')
  .insert({
    org_id: user.org_id,
    name: task_name,
    location: location || null,
    start_date: dates[0],
    end_date: taskEndDate,  // Now always provided
    required_operators: required_operators || 0,
    required_laborers: required_laborers || 0,
    status: 'planned',
    created_by: user.id,
  })
```

## Files Modified
- `api/voice/parse.ts` - Added JSON code fence stripping
- `api/voice/execute.ts` - Added end_date handling in handleCreateTask function

## Deployment
- Committed: `d744f9f` - "Fix voice API errors: JSON parsing and end_date constraint"
- Pushed to GitHub: main branch
- Vercel: Auto-deployment triggered

## Testing
After deployment completes, test:
1. Voice command parsing to ensure JSON is correctly extracted
2. Task creation via voice command to ensure end_date is properly set
3. Verify no more 500 errors in Vercel logs

## Notes
- These were production errors discovered in Vercel run logs on Jan 11, 2026
- The JSON parsing issue likely occurs intermittently depending on Claude's response format
- The end_date issue would occur every time a task is created via voice command
