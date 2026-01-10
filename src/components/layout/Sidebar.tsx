import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Calendar, 
  CheckSquare,
  LogOut,
  Building2
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
    <div className="w-[220px] h-screen bg-bg-secondary border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">CrewAI</h1>
            <p className="text-xs text-text-secondary">Command</p>
          </div>
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
  );
}
