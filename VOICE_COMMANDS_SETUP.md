# Voice Commands Setup Guide

## Overview

The voice command feature allows mobile users (foremen and superintendents) to control CrewAI Command using natural language voice commands. This is specifically designed for construction site use where typing is difficult.

## Features

- 🎤 **Mobile-Only** - Floating voice button appears only on mobile devices (< 768px width)
- 🗣️ **Natural Language** - Speak casually: "Move Jose to concrete pour tomorrow"
- 🤖 **AI-Powered** - Claude Sonnet 4 parses commands intelligently
- ✅ **Confirmation** - All commands show confirmation before executing
- 🎯 **Fuzzy Matching** - Partial names work ("Jose" finds "Jose Martinez")
- 📅 **Smart Dates** - Relative dates: "tomorrow", "Monday", "next week"

## Supported Commands

### 1. Reassign Worker
Move a worker from one task to another.

**Examples:**
- "Move Jose to concrete pour tomorrow"
- "Assign Panama to welding on Monday"
- "Put Carlos on HCC for the rest of the week"

### 2. Query Information
Get information about workers or schedules.

**Examples:**
- "Where is Panama today?"
- "Show me Friday's schedule"
- "Is Jose assigned tomorrow?"

### 3. Create Task
Create a new task with crew requirements.

**Examples:**
- "Create welding task at HCC next week, 2 welders"
- "New concrete pour tomorrow, 1 operator 3 laborers"

### 4. Update Timesheet
Mark attendance or hours worked.

**Examples:**
- "Mark Jose sick on Tuesday"
- "Panama worked 10 hours Thursday"

### 5. Approve Request
Approve a foreman's pending reassignment request.

**Examples:**
- "Approve Carlos's request"
- "Approve the latest request"

## Prerequisites

1. **Anthropic API Key** - Required for Claude AI
2. **Vercel Deployment** - API routes use Vercel Edge functions
3. **Modern Browser** - Chrome or Edge for Web Speech API
4. **HTTPS** - Required for microphone access

## Installation

### 1. Install Dependencies

Already installed with the project:
```bash
npm install @anthropic-ai/sdk
```

### 2. Environment Variables

Add to `.env.local`:
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Get an API key:**
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy and paste into `.env.local`

### 3. Vercel Environment Variables

If deploying to Vercel:

1. Go to your Vercel project
2. Settings → Environment Variables
3. Add `ANTHROPIC_API_KEY` with your key
4. Select "Production", "Preview", and "Development"
5. Click "Save"
6. Redeploy the app

### 4. Supabase Environment Variables

Make sure these are already set (should be):
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## File Structure

```
/Users/tui/Desktop/DevProjects/crewai/
├── api/voice/
│   ├── parse.ts          # Claude AI parsing endpoint
│   └── execute.ts        # Command execution endpoint
├── src/
│   ├── components/mobile/
│   │   ├── VoiceFloatingButton.tsx   # Floating mic button
│   │   └── VoiceCommandModal.tsx     # Voice UI modal
│   ├── lib/
│   │   └── voiceHelpers.ts           # Fuzzy matching & date parsing
│   └── App.tsx                       # Integrated voice button
```

## How It Works

### 1. User Flow

```
1. User taps floating mic button (bottom-right)
2. Modal opens → "Tap to Speak"
3. User taps → Browser requests microphone permission
4. User speaks command → Web Speech API transcribes
5. Transcript sent to /api/voice/parse → Claude parses intent
6. Modal shows confirmation → User reviews and confirms
7. Intent sent to /api/voice/execute → Command executed
8. Success toast → Real-time data updates
```

### 2. API Flow

**Parse API (`/api/voice/parse`):**
```
Input:  { transcript: "Move Jose to concrete tomorrow" }
        ↓
Claude: Analyzes with construction context
        ↓
Output: {
  action: "reassign_worker",
  confidence: 0.95,
  data: {
    worker_name: "Jose",
    to_task_name: "concrete",
    dates: ["2026-01-12"]
  },
  summary: "Move Jose to concrete on 2026-01-12",
  needs_confirmation: true
}
```

**Execute API (`/api/voice/execute`):**
```
Input:  { intent: {...} }
        ↓
1. Get current user from Supabase session
2. Fuzzy match worker name → Find "Jose Martinez"
3. Fuzzy match task name → Find "Concrete Pour - Building A"
4. Delete old assignment for that date
5. Create new assignment
        ↓
Output: {
  success: true,
  message: "Worker reassigned successfully",
  data: {...}
}
```

## Browser Compatibility

| Browser | Android | iOS | Desktop |
|---------|---------|-----|---------|
| Chrome  | ✅ Full | ⚠️ Limited | ✅ Full |
| Edge    | ✅ Full | ❌ No | ✅ Full |
| Safari  | ❌ No | ⚠️ Limited | ⚠️ Limited |
| Firefox | ❌ No | ❌ No | ❌ No |

**Recommended:** Chrome or Edge on Android/Desktop

**Note:** Web Speech API requires internet (uses Google's servers)

## Testing

### Local Testing

1. Start dev server:
```bash
npm run dev
```

2. Open in mobile view:
- Chrome DevTools → Toggle device toolbar (Cmd+Shift+M)
- Select "iPhone 12 Pro" or similar
- Look for floating mic button (bottom-right)

3. Test commands:
- Click mic button
- Allow microphone access
- Speak: "Where is Panama today?"
- Verify: Modal shows transcription and parsing

### Production Testing

1. Deploy to Vercel
2. Access from actual mobile device
3. Test in different environments:
   - Quiet office
   - Noisy construction site (important!)
   - With gloves on (tap targets)

### Test Commands

**Basic:**
- "Where is Panama?"
- "Move Jose to concrete tomorrow"

**Edge Cases:**
- Partial names: "Move Jose..." (multiple Joses?)
- Unclear: "Move that guy to the thing" (should ask for clarification)
- Invalid dates: "Move Jose yesterday" (past date)

## Troubleshooting

### Voice Button Not Visible

**Problem:** Floating mic button doesn't appear

**Solutions:**
1. Check window width: `console.log(window.innerWidth)` - must be < 768
2. Check component import in `App.tsx`
3. Check z-index conflicts
4. Try hard refresh (Cmd+Shift+R)

### Microphone Permission Denied

**Problem:** "Microphone access denied" error

**Solutions:**
1. Check browser permissions: Site Settings → Microphone → Allow
2. Check system permissions: Mac/iPhone Settings → Privacy → Microphone
3. Must use HTTPS (not http://) for production
4. localhost works without HTTPS for development

### "API not configured" Error

**Problem:** Parse endpoint returns error

**Solutions:**
1. Check `.env.local` has `ANTHROPIC_API_KEY`
2. Restart dev server after adding env var
3. For Vercel: Check environment variables in dashboard
4. Verify API key is valid: https://console.anthropic.com/

### Commands Not Parsing Correctly

**Problem:** Low confidence or wrong action

**Solutions:**
1. Speak clearly and slowly
2. Use full sentences: "Move Jose to concrete pour tomorrow"
3. Check Claude's system prompt in `api/voice/parse.ts`
4. Add common worker/task names to context
5. Test in quieter environment

### Commands Not Executing

**Problem:** Parse works but execute fails

**Solutions:**
1. Check Supabase connection
2. Verify user is authenticated
3. Check worker/task names exist in database
4. Review browser console for errors
5. Check Network tab for API responses

### Worker Name Not Found

**Problem:** "Worker 'Jose' not found"

**Solutions:**
1. Verify worker exists in database
2. Try full name: "Jose Martinez"
3. Check worker status is 'active'
4. Review fuzzy matching logic in `voiceHelpers.ts`

## Security Considerations

### Authentication
- All API routes verify Supabase session
- No commands execute without valid user
- User can only affect their organization's data

### Input Validation
- Claude output is parsed and validated
- Worker/task IDs are verified before database operations
- Dates are validated and normalized

### Rate Limiting
- Consider adding rate limits to API routes
- Prevent abuse of Claude API (costs money)
- Monitor API usage in Anthropic dashboard

### Audit Trail
- All voice commands should be logged
- Track who executed what command when
- Store original transcript for review

## Performance

### Expected Response Times
- Voice recognition: ~1-2 seconds
- Claude parsing: ~1-2 seconds
- Command execution: ~0.5-1 seconds
- **Total: ~3-5 seconds** from speak to completion

### Optimization Tips
1. Keep Claude prompts concise
2. Cache common worker/task names
3. Use Supabase indexes for fast lookups
4. Consider edge functions for faster response

## Cost Considerations

### Anthropic API Pricing (as of 2026)
- Claude Sonnet 4: ~$3 per million input tokens
- Average command: ~500 tokens
- **~$0.0015 per command**

### Budget Estimates
- 100 commands/day = $4.50/month
- 500 commands/day = $22.50/month
- 1000 commands/day = $45/month

**Recommended:** Set usage limits in Anthropic dashboard

## Future Enhancements

### Planned (Not Yet Implemented)
- [ ] Offline voice recognition (no internet required)
- [ ] Multi-language support (Spanish for construction crews)
- [ ] Voice feedback (speak results back to user)
- [ ] Desktop voice button (if requested)
- [ ] Custom wake word ("Hey CrewAI")
- [ ] Batch commands ("Move Jose and Panama to concrete")
- [ ] Voice shortcuts (saved common commands)

### Request Features
Contact the development team or create a GitHub issue.

## Support

### Getting Help
1. Check this documentation first
2. Review browser console for errors
3. Check Network tab for API responses
4. Test with example commands
5. Contact support with:
   - Browser and device info
   - Command transcript
   - Error messages
   - Screenshots

### Common Issues
See Troubleshooting section above.

## Credits

- **Web Speech API**: Browser-native speech recognition
- **Claude AI**: Natural language understanding
- **Supabase**: Database and authentication
- **Vercel**: Edge function hosting

---

## Quick Start Checklist

✅ Step-by-step setup:

1. [ ] `npm install` (Anthropic SDK already installed)
2. [ ] Add `ANTHROPIC_API_KEY` to `.env.local`
3. [ ] Restart dev server: `npm run dev`
4. [ ] Open in mobile view (< 768px width)
5. [ ] Look for floating mic button (bottom-right)
6. [ ] Click mic, allow permissions
7. [ ] Say: "Where is Panama today?"
8. [ ] Verify it works!

For deployment:
9. [ ] Add `ANTHROPIC_API_KEY` to Vercel environment variables
10. [ ] Deploy: `vercel --prod`
11. [ ] Test on actual mobile device
12. [ ] Test in noisy environment

---

**Last Updated:** January 11, 2026
**Version:** 1.0.0
