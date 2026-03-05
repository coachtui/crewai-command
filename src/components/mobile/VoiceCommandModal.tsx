import { useState, useEffect, useRef } from 'react';
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

interface PendingQuestion {
  field: 'task_name' | 'start_date' | 'crew';
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

// Parse a crew count answer like "2 operators and 3 laborers" into structured fields
function parseCrewAnswer(answer: string): Record<string, number> {
  const normalized = answer.toLowerCase();
  const result: Record<string, number> = {};

  const operatorMatch = normalized.match(/(\d+)\s*operator/);
  if (operatorMatch) result.required_operators = parseInt(operatorMatch[1]);

  const laborerMatch = normalized.match(/(\d+)\s*laborer/);
  if (laborerMatch) result.required_laborers = parseInt(laborerMatch[1]);

  const carpenterMatch = normalized.match(/(\d+)\s*carpenter/);
  if (carpenterMatch) result.required_carpenters = parseInt(carpenterMatch[1]);

  const masonMatch = normalized.match(/(\d+)\s*mason/);
  if (masonMatch) result.required_masons = parseInt(masonMatch[1]);

  // Bare number with no role → default to laborers
  if (Object.keys(result).length === 0) {
    const numMatch = answer.trim().match(/^(\d+)$/);
    if (numMatch) result.required_laborers = parseInt(numMatch[1]);
  }

  return result;
}

// Build a list of follow-up questions for missing create_task fields
function buildQuestionQueue(data: any): PendingQuestion[] {
  const questions: PendingQuestion[] = [];

  if (!data.task_name || data.task_name.trim() === '') {
    questions.push({
      field: 'task_name',
      question: "What's the name of this task?",
      placeholder: 'e.g. Concrete pour, Rebar install...',
    });
  }

  if (!data.start_date || data.start_date.trim() === '') {
    questions.push({
      field: 'start_date',
      question: 'When does this task start?',
      placeholder: "e.g. tomorrow, Monday, March 10...",
    });
  }

  const hasAnyCrew =
    (data.required_operators || 0) > 0 ||
    (data.required_laborers || 0) > 0 ||
    (data.required_carpenters || 0) > 0 ||
    (data.required_masons || 0) > 0;

  if (!hasAnyCrew) {
    questions.push({
      field: 'crew',
      question: 'How many workers are needed?',
      placeholder: 'e.g. 2 operators, 3 laborers...',
    });
  }

  return questions;
}

export function VoiceCommandModal({ onClose }: VoiceCommandModalProps) {
  const [state, setState] = useState<ModalState>('idle');
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  // Tracks whether onresult already fired — used by onend to avoid spurious errors
  const hasResultRef = useRef(false);

  // Question queue state (only used for create_task follow-ups)
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

  // Parse command with Claude API
  const parseCommand = async (text: string) => {
    try {
      // Get client's local date (not server UTC)
      const today = new Date();
      const clientDate = today.toLocaleDateString('en-CA'); // YYYY-MM-DD format

      const response = await fetch('/api/voice/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: text,
          clientDate: clientDate
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse command');
      }

      const parsedIntent: VoiceIntent = await response.json();

      if (parsedIntent.action === 'clarify') {
        setError(parsedIntent.question || 'Please clarify your command');
        setState('error');
      } else if (parsedIntent.action === 'create_task') {
        // Check if any required fields are missing and queue follow-up questions
        const questions = buildQuestionQueue(parsedIntent.data || {});
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
      } else {
        setIntent(parsedIntent);
        setState('confirming');
      }
    } catch (err) {
      console.error('Parse error:', err);
      setError('Failed to understand command. Please try again.');
      setState('error');
    }
  };

  // Handle a submitted answer to a follow-up question
  const handleQuestionSubmit = () => {
    if (!intent || !currentAnswer.trim()) return;

    const current = questionQueue[questionIndex];
    const updatedData = { ...intent.data };

    // Apply the answer to the appropriate field
    if (current.field === 'task_name') {
      updatedData.task_name = currentAnswer.trim();
    } else if (current.field === 'start_date') {
      // Parse relative date client-side using existing helper
      const parsed = parseRelativeDate(currentAnswer.trim());
      updatedData.start_date = parsed[0];
      if (!updatedData.end_date) {
        updatedData.end_date = parsed[0]; // default end to same day
      }
    } else if (current.field === 'crew') {
      const crew = parseCrewAnswer(currentAnswer.trim());
      Object.assign(updatedData, crew);
    }

    const updatedIntent: VoiceIntent = { ...intent, data: updatedData };
    setIntent(updatedIntent);

    const nextIndex = questionIndex + 1;
    if (nextIndex < questionQueue.length) {
      // More questions remaining
      setQuestionIndex(nextIndex);
      setCurrentAnswer('');
    } else {
      // All questions answered — rebuild summary and go to confirming
      // Rebuild a human-readable summary from the final data
      const d = updatedData;
      const crewParts = [];
      if (d.required_operators > 0) crewParts.push(`${d.required_operators} operator${d.required_operators !== 1 ? 's' : ''}`);
      if (d.required_laborers > 0) crewParts.push(`${d.required_laborers} laborer${d.required_laborers !== 1 ? 's' : ''}`);
      if (d.required_carpenters > 0) crewParts.push(`${d.required_carpenters} carpenter${d.required_carpenters !== 1 ? 's' : ''}`);
      if (d.required_masons > 0) crewParts.push(`${d.required_masons} mason${d.required_masons !== 1 ? 's' : ''}`);
      const crewText = crewParts.length > 0 ? ` with ${crewParts.join(', ')}` : '';
      const dateText = d.start_date ? ` starting ${d.start_date}` : '';
      const locationText = d.location ? ` at ${d.location}` : '';
      updatedIntent.summary = `Create task "${d.task_name}"${locationText}${dateText}${crewText}`;

      setIntent(updatedIntent);
      setQuestionQueue([]);
      setState('confirming');
    }
  };

  // Execute command
  const executeCommand = async () => {
    if (!intent) return;

    setState('processing');

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

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

      // For query results, show detailed information
      if (result.data && intent.action === 'query_info') {
        const { worker, task, location, date } = result.data;
        toast.success(
          `${worker} is working at ${task}${location ? ` (${location})` : ''} on ${date}`,
          { duration: 6000 }
        );
      } else {
        toast.success(result.message || 'Command executed successfully');
      }

      handleClose();
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

  // Enhanced close handler to ensure cleanup
  const handleClose = () => {
    stopListening();
    onClose();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Cleanup when app goes to background or loses visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background — stop microphone immediately
        stopListening();
        if (state === 'listening') {
          setState('idle');
        }
      }
    };

    const handleBeforeUnload = () => {
      stopListening();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    // NOTE: Do NOT listen to window 'blur' here.
    // When the browser shows the microphone permission dialog it fires window.blur
    // immediately — before React has re-rendered with state='listening'. The stale
    // closure would abort recognition but not reset state, permanently freezing the
    // UI in "Listening..." mode. visibilitychange is sufficient for backgrounding.

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [state]);

  // Example commands
  const exampleCommands = [
    "Move Jose to concrete pour tomorrow",
    "Where is Panama today?",
    "Show Friday's schedule"
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

        {/* Content - changes based on state */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[300px]">
          {state === 'idle' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Mic className="text-primary" size={48} />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Ready to Listen</h3>
                <p className="text-text-secondary">
                  Tap the button below to start speaking
                </p>
              </div>
              <Button
                onClick={startListening}
                className="w-full max-w-xs h-14 text-lg"
              >
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
                <p className="text-text-secondary">
                  Speak your command now
                </p>
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
              {/* Icon + progress */}
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <HelpCircle className="text-primary" size={36} />
                </div>
                <p className="text-xs text-text-secondary">
                  Question {questionIndex + 1} of {questionQueue.length}
                </p>
              </div>

              {/* Question */}
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-1">
                  {questionQueue[questionIndex].question}
                </h3>
                {transcript && (
                  <p className="text-xs text-text-secondary italic mb-3">
                    From: "{transcript}"
                  </p>
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

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelCommand}
                  className="flex-1"
                >
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
                      ⚠️ Medium confidence - please verify
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 w-full max-w-xs mx-auto">
                <Button
                  onClick={cancelCommand}
                  variant="secondary"
                  className="flex-1"
                >
                  ❌ Cancel
                </Button>
                <Button
                  onClick={executeCommand}
                  className="flex-1"
                >
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
              <Button
                onClick={cancelCommand}
                className="w-full max-w-xs"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>

        {/* Footer - Example Commands */}
        {state === 'idle' && (
          <div className="p-4 border-t border-border bg-bg-primary/50">
            <p className="text-xs text-text-secondary mb-2 font-medium">
              Example commands:
            </p>
            <div className="space-y-1">
              {exampleCommands.map((cmd, i) => (
                <p key={i} className="text-xs text-text-secondary italic">
                  • "{cmd}"
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
