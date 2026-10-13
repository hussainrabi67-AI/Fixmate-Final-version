import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type UserRole } from '../context/AuthContext'

interface ProtectedRouteProps {
  allowedRoles: UserRole[]
  children: ReactNode
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  const effectiveRole: UserRole =
    profile?.role ?? (session.user?.user_metadata?.role as UserRole | undefined) ?? 'user'

  if (!allowedRoles.includes(effectiveRole)) {
    const homeByRole: Record<UserRole, string> = {
      user: '/dashboard',
      technician: '/technician',
      admin: '/admin',
    }
    return <Navigate to={homeByRole[effectiveRole]} replace />
  }

  return <>{children}</>
}
