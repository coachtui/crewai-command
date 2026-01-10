import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Calendar, 
  CheckSquare,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Badge } from '../ui/Badge';
import { toast } from 'sonner';

interface SidebarProps {
  pendingCount?: number;
}

export function Sidebar({ pendingCount = 0 }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Detect if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle touch events for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    // Swipe left to hide sidebar
    if (swipeDistance > minSwipeDistance && isVisible) {
      setIsVisible(false);
    }
  };

  // Handle swipe right from edge to show sidebar
  useEffect(() => {
    if (!isMobile) return;

    const handleEdgeSwipe = (e: TouchEvent) => {
      const startX = e.touches[0].clientX;
      
      // Only trigger if swipe starts from the left edge (within 20px)
      if (startX < 20 && !isVisible) {
        let endX = startX;
        
        const handleMove = (e: TouchEvent) => {
          endX = e.touches[0].clientX;
        };
        
        const handleEnd = () => {
          const swipeDistance = endX - startX;
          if (swipeDistance > 50) {
            setIsVisible(true);
          }
          document.removeEventListener('touchmove', handleMove);
          document.removeEventListener('touchend', handleEnd);
        };
        
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('touchend', handleEnd);
      }
    };

    document.addEventListener('touchstart', handleEdgeSwipe);
    
    return () => {
      document.removeEventListener('touchstart', handleEdgeSwipe);
    };
  }, [isMobile, isVisible]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/workers', icon: Users, label: 'Workers' },
    { path: '/tasks', icon: Briefcase, label: 'Tasks' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/activities', icon: CheckSquare, label: 'Activities', badge: pendingCount },
  ];

  return (
    <>
      {/* Mobile menu button - shows when sidebar is hidden */}
      {isMobile && !isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg"
        >
          <Menu size={20} className="text-white" />
        </button>
      )}

      {/* Overlay for mobile when sidebar is visible */}
      {isMobile && isVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsVisible(false)}
        />
      )}

      <div
        ref={sidebarRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`
          w-[220px] h-screen bg-bg-secondary border-r border-border flex flex-col
          transition-transform duration-300 ease-in-out
          ${isMobile ? 'fixed left-0 top-0 z-40' : 'relative'}
          ${isMobile && !isVisible ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        {/* Close button for mobile */}
        {isMobile && isVisible && (
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-4 right-4 z-10 w-8 h-8 bg-bg-hover rounded-lg flex items-center justify-center"
          >
            <X size={16} className="text-text-secondary" />
          </button>
        )}
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-center">
            <img 
              src="/image/crewai-command-logo.png" 
              alt="CrewAI Command" 
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setIsVisible(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-primary text-white' 
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }
                `}
              >
                <item.icon size={20} />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <Badge variant={isActive ? 'default' : 'warning'} className="ml-auto">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
