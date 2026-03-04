// ============================================================================
// CruWork: Founder Console — Layout
// Minimal sidebar navigation for all /founder/* pages.
// ============================================================================

import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Building2, LayoutDashboard, LogOut, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const NAV_ITEMS = [
  { path: '/founder', label: 'Overview', icon: LayoutDashboard, exact: true },
  { path: '/founder/companies', label: 'Companies', icon: Building2, exact: false },
]

interface FounderLayoutProps {
  children: React.ReactNode
}

export function FounderLayout({ children }: FounderLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? '')
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col bg-bg-secondary border-r border-border">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">F</span>
            </div>
            <span className="text-[13px] font-semibold text-text-primary">Founder Console</span>
          </div>
          <div className="text-[11px] text-text-secondary truncate pl-7">{email}</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-1">
          <Link
            to="/workers"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-[12px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-150"
          >
            <ArrowLeft size={13} />
            Back to App
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[12px] text-text-secondary hover:bg-bg-hover hover:text-error transition-all duration-150"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
