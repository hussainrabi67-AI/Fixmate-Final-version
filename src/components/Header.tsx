import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, LayoutDashboard, MapPin } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'
import { useLocation } from '../context/LocationContext'

import NotificationBell from './NotificationBell'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Find Technicians', to: '/technicians' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'For Technicians', to: '/technician' },
]

export default function Header() {
  const [open, setOpen] = useState(false)
  const { session, profile, signOut } = useAuth()
  const { userLocation, openLocationModal } = useLocation()
  const navigate = useNavigate()

  const userRole = profile?.role ?? (session?.user?.user_metadata?.role as string | undefined) ?? 'user'
  const dashboardLink =
    userRole === 'technician' ? '/technician' : userRole === 'admin' ? '/admin' : '/dashboard'

  async function handleSignOut() {
    await signOut()
    setOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-primary/10 bg-background/90 backdrop-blur-md">
      <div className="section flex h-16 items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-ink/70 hover:text-primary hover:bg-primary-light'
                }`
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={openLocationModal}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1.5 text-xs font-bold text-ink/80 hover:bg-primary-light hover:text-primary border border-slate-200/80 transition-all shrink-0"
            title="Click to update your current location"
          >
            <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span className="truncate max-w-[120px]">
              {userLocation?.city ? `📍 ${userLocation.city}` : '📍 Set Location'}
            </span>
          </button>

          {session ? (
            <>
              <NotificationBell />
              <Link to={dashboardLink} className="btn-ghost text-sm font-semibold">
                <LayoutDashboard className="h-4 w-4" />
                {userRole === 'technician' ? 'Technician Dashboard' : userRole === 'admin' ? 'Admin Portal' : 'My Dashboard'}
              </Link>
              <button onClick={handleSignOut} className="btn-secondary text-sm">
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost text-sm">
                Login
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Get Started
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={openLocationModal}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-ink/80 border border-slate-200"
            title="Update Location"
          >
            <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            <span className="truncate max-w-[80px]">
              {userLocation?.city || 'Location'}
            </span>
          </button>
          {session && <NotificationBell />}
          <button
            onClick={() => setOpen(!open)}
            className="rounded-xl p-2 text-ink transition-colors hover:bg-primary-light"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-primary/10 bg-background md:hidden">
          <div className="section flex flex-col gap-1 py-4">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-ink/80 hover:bg-primary-light hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {session ? (
                <>
                  <Link to={dashboardLink} onClick={() => setOpen(false)} className="btn-secondary">
                    <LayoutDashboard className="h-4 w-4" />
                    {userRole === 'technician' ? 'Technician Dashboard' : userRole === 'admin' ? 'Admin Portal' : 'My Dashboard'}
                  </Link>
                  <button onClick={handleSignOut} className="btn-primary">
                    <LogOut className="h-4 w-4" /> Log out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary">
                    Login
                  </Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="btn-primary">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
