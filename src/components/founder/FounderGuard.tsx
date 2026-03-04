// ============================================================================
// CruWork: Founder Console — Auth Guard
// Uses raw Supabase session + VITE_FOUNDER_EMAILS allowlist.
// Falls back gracefully if env var is not set in some environments.
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
    const evaluate = (email: string | null | undefined) => {
      if (!email) {
        setState('unauthenticated')
        return
      }
      setState(isFounderEmail(email) ? 'ok' : 'forbidden')
    }

    // Check current session immediately (works on page reload too)
    supabase.auth.getSession().then(({ data: { session } }) => {
      evaluate(session?.user?.email)
    })

    // Stay in sync if auth changes (sign-out in another tab, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      evaluate(session?.user?.email)
    })

    return () => subscription.unsubscribe()
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
