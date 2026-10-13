import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'user' | 'technician' | 'admin'

export interface Profile {
  id: string
  user_id: string
  name: string | null
  email: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string, userMeta?: Record<string, any>) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, email, phone, role, avatar_url')
        .eq('user_id', userId)
        .maybeSingle()

      if (!error && data) {
        let role = data.role as UserRole
        // Check if technician record exists for this profile
        const { data: techRecord } = await supabase
          .from('technicians')
          .select('id')
          .eq('profile_id', data.id)
          .maybeSingle()

        if (techRecord || userMeta?.role === 'technician') {
          role = 'technician'
          if (data.role !== 'technician') {
            await supabase.from('profiles').update({ role: 'technician' }).eq('id', data.id)
            data.role = 'technician'
          }
        }

        const profileObj = { ...data, role } as Profile
        setProfile(profileObj)
        return profileObj
      } else if (userMeta) {
        const fallbackProfile: Profile = {
          id: userId,
          user_id: userId,
          name: userMeta.name || null,
          email: userMeta.email || null,
          phone: null,
          role: (userMeta.role as UserRole) || 'user',
          avatar_url: null,
        }
        setProfile(fallbackProfile)
        return fallbackProfile
      } else {
        setProfile(null)
        return null
      }
    } catch {
      if (userMeta) {
        const fallbackProfile: Profile = {
          id: userId,
          user_id: userId,
          name: userMeta.name || null,
          email: userMeta.email || null,
          phone: null,
          role: (userMeta.role as UserRole) || 'user',
          avatar_url: null,
        }
        setProfile(fallbackProfile)
        return fallbackProfile
      }
      setProfile(null)
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data?.session ?? null)
      if (data?.session?.user) {
        await loadProfile(data.session.user.id, data.session.user.user_metadata)
      }
      if (mounted) setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      if (newSession?.user) {
        setLoading(true)
        await loadProfile(newSession.user.id, newSession.user.user_metadata)
        if (mounted) setLoading(false)
      } else {
        setProfile(null)
        if (mounted) setLoading(false)
      }
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
