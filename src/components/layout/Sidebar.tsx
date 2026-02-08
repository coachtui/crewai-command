// ============================================================================
// CRU: Sidebar Navigation
// Includes Job Site Selector for multi-tenant navigation
// ============================================================================

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Clock,
  LogOut,
  Menu,
  X,
  CircleUser
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Badge } from '../ui/Badge';
import { JobSiteSelector, JobSiteSelectorMobile } from '../navigation/JobSiteSelector';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  type NavItem = {
    path: string;
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    badge?: number;
  };

  const navItems: NavItem[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/workers', icon: Users, label: 'Workers' },
    { path: '/tasks', icon: Briefcase, label: 'Tasks' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/daily-hours', icon: Clock, label: 'Daily Hours' },
  ];

  return (
    <>
      {/* Mobile menu button - shows when sidebar is hidden */}
      {isMobile && !isVisible && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-bg-secondary border-b border-border shadow-subtle">
          <button
            onClick={() => setIsVisible(true)}
            className="w-10 h-10 bg-primary rounded-md flex items-center justify-center shadow-sm-soft hover:bg-primary-hover transition-all duration-150"
          >
            <Menu size={20} className="text-white" />
          </button>

          {/* Mobile Job Site Selector */}
          <JobSiteSelectorMobile />
        </div>
      )}

      {/* Overlay for mobile when sidebar is visible */}
      {isMobile && isVisible && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 transition-opacity duration-150"
          onClick={() => setIsVisible(false)}
        />
      )}

      <div
        ref={sidebarRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`
          w-[240px] h-screen bg-bg-secondary border-r border-border flex flex-col shadow-sm-soft
          transition-transform duration-300 ease-in-out
          ${isMobile ? 'fixed left-0 top-0 z-40' : 'relative'}
          ${isMobile && !isVisible ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        {/* Close button for mobile */}
        {isMobile && isVisible && (
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-4 right-4 z-10 w-8 h-8 bg-bg-hover rounded-md flex items-center justify-center hover:bg-bg-subtle transition-all duration-150"
          >
            <X size={16} className="text-text-secondary" />
          </button>
        )}

        {/* Logo */}
        <div className="px-6 py-3 border-b border-border">
          <div className="flex items-center justify-center">
            <img
              src="/image/cru-logo-tiff.png"
              alt="CRU"
              className="h-32 w-auto object-contain"
            />
          </div>
        </div>

        {/* Job Site Selector (Desktop) */}
        <div className="px-4 py-4 border-b border-border">
          <JobSiteSelector compact={false} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => isMobile && setIsVisible(false)}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 ease-smooth
                  ${isActive
                    ? 'bg-primary-subtle text-primary font-medium border border-primary/20'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }
                `}
              >
                <item.icon size={20} />
                <span className="text-[14px] flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <Badge variant={isActive ? 'default' : 'warning'} className="ml-auto">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile and Logout */}
        <div className="p-4 border-t border-border space-y-2">
          {/* User Profile */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-bg-hover transition-all duration-150">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || 'User'}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-border"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-subtle border border-primary/20 flex items-center justify-center flex-shrink-0">
                <CircleUser size={18} className="text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-text-primary truncate">
                {user?.name || 'User'}
              </p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-150"
          >
            <LogOut size={18} />
            <span className="text-[14px]">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
