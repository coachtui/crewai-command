// ============================================================================
// CruWork: Founder Console — Auth Guard
// Checks user.base_role === 'founder' from AuthContext.
// Real security is enforced server-side by the founder-api edge function.
// ============================================================================

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts'

interface FounderGuardProps {
  children: React.ReactNode
}

export function FounderGuard({ children }: FounderGuardProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-[13px]">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.base_role !== 'founder') return <Navigate to="/workers" replace />
  return <>{children}</>
}
