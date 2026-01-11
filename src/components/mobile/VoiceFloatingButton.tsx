import { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { VoiceCommandModal } from './VoiceCommandModal';

export function VoiceFloatingButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Voice command"
      >
        <Mic className="text-bg-primary" size={24} />
      </button>

      {isModalOpen && (
        <VoiceCommandModal onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
