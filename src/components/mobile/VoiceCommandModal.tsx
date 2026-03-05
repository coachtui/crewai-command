import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mic, Loader2, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { parseRelativeDate } from '../../lib/voiceHelpers';

type ModalState = 'idle' | 'listening' | 'processing' | 'questioning' | 'confirming' | 'error';

interface VoiceIntent {
  action: string;
  confidence: number;
  data: any;
  summary: string;
  needs_confirmation: boolean;
  question?: string;
  options?: string[];
}

type QuestionField =
  | 'task_name' | 'start_date' | 'crew'
  | 'worker_name' | 'worker_role'
  | 'site_name'
  | 'user_email' | 'user_name' | 'user_role';

interface PendingQuestion {
  field: QuestionField;
  question: string;
  placeholder: string;
}

interface VoiceCommandModalProps {
  onClose: () => void;
}

// Extend Window type for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// ── Answer parsers ────────────────────────────────────────────────────────────

// Parse "2 operators and 3 laborers" → { required_operators: 2, required_laborers: 3 }
function parseCrewAnswer(answer: string): Record<string, number> {
  const n = answer.toLowerCase();
  const result: Record<string, number> = {};

  const op = n.match(/(\d+)\s*operator/);   if (op) result.required_operators = parseInt(op[1]);
  const lb = n.match(/(\d+)\s*laborer/);    if (lb) result.required_laborers = parseInt(lb[1]);
  const cp = n.match(/(\d+)\s*carpenter/);  if (cp) result.required_carpenters = parseInt(cp[1]);
  const ms = n.match(/(\d+)\s*mason/);      if (ms) result.required_masons = parseInt(ms[1]);

  // Bare number → default to laborers
  if (Object.keys(result).length === 0) {
    const bare = answer.trim().match(/^(\d+)$/);
    if (bare) result.required_laborers = parseInt(bare[1]);
  }
  return result;
}

// Build follow-up questions for any action that has missing required fields
function buildQuestionQueue(action: string, data: any): PendingQuestion[] {
  const q: PendingQuestion[] = [];

  if (action === 'create_task') {
    if (!data.task_name?.trim())
      q.push({ field: 'task_name', question: "What's the name of this task?", placeholder: 'e.g. Concrete pour, Rebar install...' });
    if (!data.start_date?.trim())
      q.push({ field: 'start_date', question: 'When does this task start?', placeholder: "e.g. tomorrow, Monday, March 10..." });
    const hasAnyCrew = (data.required_operators || 0) + (data.required_laborers || 0) +
                       (data.required_carpenters || 0) + (data.required_masons || 0) > 0;
    if (!hasAnyCrew)
      q.push({ field: 'crew', question: 'How many workers are needed?', placeholder: 'e.g. 2 operators, 3 laborers...' });
  }

  if (action === 'create_worker') {
    if (!data.worker_name?.trim())
      q.push({ field: 'worker_name', question: "What's the worker's full name?", placeholder: 'e.g. Miguel Santos' });
    if (!data.role?.trim())
      q.push({ field: 'worker_role', question: "What's their role?", placeholder: 'operator, laborer, carpenter, or mason' });
  }

  if (action === 'create_job_site') {
    if (!data.site_name?.trim())
      q.push({ field: 'site_name', question: "What's the name of this job site?", placeholder: 'e.g. Queen\'s Medical Center, Downtown Hotel...' });
  }

  if (action === 'invite_user') {
    if (!data.email?.trim())
      q.push({ field: 'user_email', question: "What's their email address?", placeholder: 'e.g. john@example.com' });
    if (!data.name?.trim())
      q.push({ field: 'user_name', question: "What's their full name?", placeholder: 'e.g. John Smith' });
    if (!data.role?.trim())
      q.push({ field: 'user_role', question: "What role should they have?", placeholder: 'admin, superintendent, engineer, foreman, or worker' });
  }

  return q;
}

// Apply a question answer back into the intent data
function applyAnswer(field: QuestionField, answer: string, data: any): any {
  const updated = { ...data };

  switch (field) {
    case 'task_name':    updated.task_name = answer.trim(); break;
    case 'worker_name':  updated.worker_name = answer.trim(); break;
    case 'site_name':    updated.site_name = answer.trim(); break;
    case 'user_email':   updated.email = answer.trim(); break;
    case 'user_name':    updated.name = answer.trim(); break;
    case 'worker_role':
    case 'user_role':    updated.role = answer.trim().toLowerCase(); break;
    case 'start_date': {
      const parsed = parseRelativeDate(answer.trim());
      updated.start_date = parsed[0];
      if (!updated.end_date) updated.end_date = parsed[0];
      break;
    }
    case 'crew': {
      const crew = parseCrewAnswer(answer.trim());
      Object.assign(updated, crew);
      break;
    }
  }
  return updated;
}

// Rebuild the human-readable summary after filling in missing fields
function rebuildSummary(action: string, data: any): string {
  switch (action) {
    case 'create_task': {
      const crewParts: string[] = [];
      if (data.required_operators > 0) crewParts.push(`${data.required_operators} operator${data.required_operators !== 1 ? 's' : ''}`);
      if (data.required_laborers > 0)  crewParts.push(`${data.required_laborers} laborer${data.required_laborers !== 1 ? 's' : ''}`);
      if (data.required_carpenters > 0) crewParts.push(`${data.required_carpenters} carpenter${data.required_carpenters !== 1 ? 's' : ''}`);
      if (data.required_masons > 0)    crewParts.push(`${data.required_masons} mason${data.required_masons !== 1 ? 's' : ''}`);
      return `Create task "${data.task_name}"${data.location ? ` at ${data.location}` : ''}${data.start_date ? ` starting ${data.start_date}` : ''}${crewParts.length ? ` with ${crewParts.join(', ')}` : ''}`;
    }
    case 'create_worker':
      return `Add ${data.worker_name} as a ${data.role || 'laborer'}${data.phone ? ` (${data.phone})` : ''}`;
    case 'create_job_site':
      return `Create job site "${data.site_name}"${data.address ? ` at ${data.address}` : ''}${data.start_date ? ` starting ${data.start_date}` : ''}`;
    case 'invite_user':
      return `Invite ${data.name} (${data.email}) as ${data.role || 'worker'}`;
    default:
      return '';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceCommandModal({ onClose }: VoiceCommandModalProps) {
  const navigate = useNavigate();

  const [state, setState] = useState<ModalState>('idle');
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  // Tracks whether onresult already fired — used by onend to avoid spurious errors
  const hasResultRef = useRef(false);

  // Question queue state (used for actions with missing required fields)
  const [questionQueue, setQuestionQueue] = useState<PendingQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');

  // Check browser support
  const isSpeechSupported = () => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  };

  // Initialize speech recognition
  const initRecognition = () => {
    if (!isSpeechSupported()) {
      setError('Voice commands require Chrome or Edge browser');
      setState('error');
      return null;
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      hasResultRef.current = true;
      const resultTranscript = event.results[0][0].transcript;
      setTranscript(resultTranscript);

      // Clear ref BEFORE abort so onend knows this was intentional
      recognitionRef.current = null;
      try {
        recognition.abort();
      } catch (err) {
        console.error('Error aborting recognition after result:', err);
      }

      setState('processing');
      parseCommand(resultTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      // Clear ref BEFORE setting state so onend doesn't double-handle
      recognitionRef.current = null;

      switch (event.error) {
        case 'not-allowed':
          setError('Microphone access denied. Please enable microphone permissions.');
          break;
        case 'no-speech':
          setError('No speech detected. Please try again.');
          break;
        case 'network':
          setError('Network error. Please check your internet connection.');
          break;
        default:
          setError('Voice recognition failed. Please try again.');
      }

      setState('error');
    };

    recognition.onend = () => {
      // Only handle unexpected end: no result fired AND this instance is still active.
      // Uses refs (not stale state/transcript) to avoid closure capture bugs.
      if (!hasResultRef.current && recognitionRef.current === recognition) {
        recognitionRef.current = null;
        setError('No speech detected. Please try again.');
        setState('error');
      }
    };

    return recognition;
  };

  // Start listening
  const startListening = () => {
    setTranscript('');
    setError('');
    setIntent(null);
    hasResultRef.current = false;

    const recognition = initRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    setState('listening');

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      recognitionRef.current = null;
      setError('Failed to start voice recognition. Please try again.');
      setState('error');
    }
  };

  // Stop listening and cleanup
  const stopListening = () => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      // Clear ref BEFORE abort so onend doesn't trigger the "no speech" error path
      recognitionRef.current = null;
      try {
        r.abort();
      } catch (err) {
        console.error('Error stopping recognition:', err);
      }
    }
  };

  // After parsing, check if any required fields are missing for this action
  const maybeEnterQuestionFlow = (parsedIntent: VoiceIntent) => {
    const questions = buildQuestionQueue(parsedIntent.action, parsedIntent.data || {});
    if (questions.length > 0) {
      setIntent(parsedIntent);
      setQuestionQueue(questions);
      setQuestionIndex(0);
      setCurrentAnswer('');
      setState('questioning');
    } else {
      setIntent(parsedIntent);
      setState('confirming');
    }
  };

  // Parse command with Claude API
  const parseCommand = async (text: string) => {
    try {
      const today = new Date();
      const clientDate = today.toLocaleDateString('en-CA'); // YYYY-MM-DD

      const response = await fetch('/api/voice/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, clientDate }),
      });

      if (!response.ok) throw new Error('Failed to parse command');

      const parsedIntent: VoiceIntent = await response.json();

      if (parsedIntent.action === 'clarify') {
        setError(parsedIntent.question || 'Please clarify your command');
        setState('error');
      } else {
        maybeEnterQuestionFlow(parsedIntent);
      }
    } catch (err) {
      console.error('Parse error:', err);
      setError('Failed to understand command. Please try again.');
      setState('error');
    }
  };

  // Submit answer to the current question and advance the queue
  const handleQuestionSubmit = () => {
    if (!intent || !currentAnswer.trim()) return;

    const current = questionQueue[questionIndex];
    const updatedData = applyAnswer(current.field, currentAnswer, intent.data || {});
    const updatedIntent: VoiceIntent = { ...intent, data: updatedData };
    setIntent(updatedIntent);

    const nextIndex = questionIndex + 1;
    if (nextIndex < questionQueue.length) {
      setQuestionIndex(nextIndex);
      setCurrentAnswer('');
    } else {
      // All questions answered — rebuild summary and confirm
      const newSummary = rebuildSummary(updatedIntent.action, updatedData);
      if (newSummary) updatedIntent.summary = newSummary;
      setIntent(updatedIntent);
      setQuestionQueue([]);
      setState('confirming');
    }
  };

  // Execute the confirmed intent
  const executeCommand = async () => {
    if (!intent) return;

    setState('processing');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/voice/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ intent }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to execute command');
      }

      // Handle special result types
      if (result.data?.navigate_to) {
        toast.success(`Opening ${result.data.page || result.data.navigate_to}...`);
        handleClose();
        navigate(result.data.navigate_to);
      } else if (result.data?.file_url) {
        toast.success(`Opening "${result.data.file_name}"...`);
        window.open(result.data.file_url, '_blank');
        handleClose();
      } else if (result.data && intent.action === 'query_info') {
        const { worker, task, location, date } = result.data;
        toast.success(
          `${worker} is working at ${task}${location ? ` (${location})` : ''} on ${date}`,
          { duration: 6000 }
        );
        handleClose();
      } else {
        toast.success(result.message || 'Command executed successfully');
        handleClose();
      }
    } catch (err) {
      console.error('Execute error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute command. Please try again.';
      setError(errorMessage);
      setState('error');
    }
  };

  // Cancel and return to idle
  const cancelCommand = () => {
    setTranscript('');
    setIntent(null);
    setError('');
    setQuestionQueue([]);
    setQuestionIndex(0);
    setCurrentAnswer('');
    setState('idle');
  };

  const handleClose = () => {
    stopListening();
    onClose();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopListening(); };
  }, []);

  // Cleanup when app goes to background or loses visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopListening();
        if (state === 'listening') setState('idle');
      }
    };
    const handleBeforeUnload = () => { stopListening(); };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    // NOTE: Do NOT listen to window 'blur' here — fires on permission dialog
    // before React re-renders, causing a permanent "Listening..." freeze.

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [state]);

  const exampleCommands = [
    "Move Jose to concrete pour tomorrow",
    "Add Miguel Santos as a laborer",
    "Create job site downtown hospital",
    "Open the safety plan",
    "Go to workers",
  ];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary w-full max-w-md rounded-lg shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Voice Command</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[300px]">

          {state === 'idle' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Mic className="text-primary" size={48} />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Ready to Listen</h3>
                <p className="text-text-secondary">Tap the button below to start speaking</p>
              </div>
              <Button onClick={startListening} className="w-full max-w-xs h-14 text-lg">
                <Mic className="mr-2" size={24} />
                Tap to Speak
              </Button>
            </div>
          )}

          {state === 'listening' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-error/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Mic className="text-error" size={48} />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Listening...</h3>
                <p className="text-text-secondary">Speak your command now</p>
              </div>
              <Button
                onClick={() => { stopListening(); setState('idle'); }}
                variant="secondary"
                className="w-full max-w-xs"
              >
                Cancel
              </Button>
            </div>
          )}

          {state === 'processing' && (
            <div className="text-center space-y-6">
              <Loader2 className="text-primary animate-spin mx-auto" size={64} />
              <div>
                <h3 className="text-2xl font-bold mb-2">Processing...</h3>
                {transcript && (
                  <div className="mt-4 p-4 bg-bg-primary border border-border rounded-lg">
                    <p className="text-sm text-text-secondary mb-1">You said:</p>
                    <p className="text-text-primary italic">"{transcript}"</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {state === 'questioning' && questionQueue.length > 0 && (
            <div className="space-y-6 w-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <HelpCircle className="text-primary" size={36} />
                </div>
                <p className="text-xs text-text-secondary">
                  Question {questionIndex + 1} of {questionQueue.length}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">
                  {questionQueue[questionIndex].question}
                </h3>
                {transcript && (
                  <p className="text-xs text-text-secondary italic mb-3">From: "{transcript}"</p>
                )}
                <input
                  autoFocus
                  type="text"
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleQuestionSubmit(); }}
                  placeholder={questionQueue[questionIndex].placeholder}
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary text-base"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={cancelCommand} className="flex-1">
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleQuestionSubmit}
                  disabled={!currentAnswer.trim()}
                  className="flex-1"
                >
                  {questionIndex + 1 < questionQueue.length ? 'Next' : 'Done'}
                </Button>
              </div>
            </div>
          )}

          {state === 'confirming' && intent && (
            <div className="text-center space-y-6 w-full">
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="text-success" size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Confirm Action</h3>
                <div className="mt-4 p-4 bg-bg-primary border border-border rounded-lg text-left">
                  <p className="text-sm text-text-secondary mb-2">You said:</p>
                  <p className="text-text-primary italic mb-4">"{transcript}"</p>
                  <p className="text-sm text-text-secondary mb-2">This will:</p>
                  <p className="text-text-primary font-medium">{intent.summary}</p>
                  {intent.confidence < 0.9 && (
                    <p className="text-xs text-warning mt-2">
                      ⚠️ Medium confidence — please verify
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 w-full max-w-xs mx-auto">
                <Button onClick={cancelCommand} variant="secondary" className="flex-1">
                  ❌ Cancel
                </Button>
                <Button onClick={executeCommand} className="flex-1">
                  ✅ Confirm
                </Button>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-error/20 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="text-error" size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Error</h3>
                <p className="text-text-secondary">{error}</p>
              </div>
              <Button onClick={cancelCommand} className="w-full max-w-xs">
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer - Example Commands */}
        {state === 'idle' && (
          <div className="p-4 border-t border-border bg-bg-primary/50">
            <p className="text-xs text-text-secondary mb-2 font-medium">Example commands:</p>
            <div className="space-y-1">
              {exampleCommands.map((cmd, i) => (
                <p key={i} className="text-xs text-text-secondary italic">• "{cmd}"</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
