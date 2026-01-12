import { useState, useEffect, useRef } from 'react';
import { X, Mic, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

type ModalState = 'idle' | 'listening' | 'processing' | 'confirming' | 'error';

interface VoiceIntent {
  action: string;
  confidence: number;
  data: any;
  summary: string;
  needs_confirmation: boolean;
  question?: string;
  options?: string[];
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

export function VoiceCommandModal({ onClose }: VoiceCommandModalProps) {
  const [state, setState] = useState<ModalState>('idle');
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);

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
      const resultTranscript = event.results[0][0].transcript;
      setTranscript(resultTranscript);
      
      // Immediately stop the recognition after getting result
      // This releases the microphone right away
      try {
        recognition.stop();
        recognition.abort();
      } catch (err) {
        console.error('Error stopping recognition after result:', err);
      }
      
      setState('processing');
      parseCommand(resultTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
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
      if (state === 'listening') {
        // If ended unexpectedly during listening, show error
        if (!transcript) {
          setError('No speech detected. Please try again.');
          setState('error');
        }
      }
    };

    return recognition;
  };

  // Start listening
  const startListening = () => {
    setTranscript('');
    setError('');
    setIntent(null);
    
    const recognition = initRecognition();
    if (!recognition) return;
    
    recognitionRef.current = recognition;
    setState('listening');
    
    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError('Failed to start voice recognition. Please try again.');
      setState('error');
    }
  };

  // Stop listening and cleanup
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort(); // Force abort to ensure cleanup
      } catch (err) {
        console.error('Error stopping recognition:', err);
      }
      recognitionRef.current = null;
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
        // App went to background, stop microphone immediately
        stopListening();
        if (state === 'listening') {
          setState('idle');
        }
      }
    };

    const handleBeforeUnload = () => {
      stopListening();
    };

    const handlePause = () => {
      stopListening();
      if (state === 'listening') {
        setState('idle');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    window.addEventListener('blur', handlePause);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      window.removeEventListener('blur', handlePause);
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
                onClick={stopListening}
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
