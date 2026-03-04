// ============================================================================
// CruWork: Founder Console — Auth Guard
// Blocks non-founders from /founder routes.
// This is a UI convenience gate — real security is in the edge function.
// ============================================================================

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts'
import { isFounderEmail } from '../../lib/api/founder'

interface FounderGuardProps {
  children: React.ReactNode
}

export function FounderGuard({ children }: FounderGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth()

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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isFounderEmail(user?.email)) {
    return <Navigate to="/workers" replace />
  }

  return <>{children}</>
}
