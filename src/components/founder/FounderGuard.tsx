// ============================================================================
// CruWork: Founder Console — Auth Guard
// Uses getSession() (localStorage) with getUser() server fallback.
// Does not depend on AuthContext or user_profiles RLS.
// Real security is enforced server-side by the founder-api edge function.
// ============================================================================

import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isFounderEmail } from '../../lib/api/founder'

type State = 'loading' | 'ok' | 'unauthenticated' | 'forbidden'

interface FounderGuardProps {
  children: React.ReactNode
}

export function FounderGuard({ children }: FounderGuardProps) {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    async function checkAuth() {
      // Primary: read from localStorage (instant)
      const { data: { session } } = await supabase.auth.getSession()
      const sessionEmail = session?.user?.email

      if (sessionEmail) {
        setState(isFounderEmail(sessionEmail) ? 'ok' : 'forbidden')
        return
      }

      // Fallback: verify with Supabase server (handles stale/uninitialized storage)
      const { data: { user } } = await supabase.auth.getUser()
      const userEmail = user?.email

      if (userEmail) {
        setState(isFounderEmail(userEmail) ? 'ok' : 'forbidden')
      } else {
        setState('unauthenticated')
      }
    }

    checkAuth()
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-[13px]">Loading...</span>
        </div>
      </div>
    )
  }

  if (state === 'unauthenticated') return <Navigate to="/login" replace />
  if (state === 'forbidden') return <Navigate to="/workers" replace />
  return <>{children}</>
}
