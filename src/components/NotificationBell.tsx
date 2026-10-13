import { useEffect, useState, useRef } from 'react'
import { Bell, CheckCheck, Loader2, Sparkles, Wrench, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchUserNotifications, markNotificationAsRead, markAllNotificationsAsRead,
} from '../lib/notificationService'
import type { NotificationItem } from '../types/notification'

export default function NotificationBell() {
  const { session } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!session?.user?.id) return
    loadNotifications()

    // Poll periodically or on focus
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [session?.user?.id])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function loadNotifications() {
    if (!session?.user?.id) return
    const data = await fetchUserNotifications(session.user.id)
    setNotifications(data)
  }

  async function handleToggle() {
    if (!open) {
      setLoading(true)
      await loadNotifications()
      setLoading(false)
    }
    setOpen(!open)
  }

  async function handleMarkAsRead(id: string) {
    await markNotificationAsRead(id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }

  async function handleMarkAllAsRead() {
    if (!session?.user?.id) return
    await markAllNotificationsAsRead(session.user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function getNotificationIcon(type: string | null) {
    switch (type) {
      case 'service_request_created':
      case 'new_matching_request':
        return <Wrench className="h-4 w-4 text-primary" />
      case 'new_quote':
      case 'quote_accepted':
      case 'quote_accepted_technician':
      case 'booking_confirmed':
      case 'booking_confirmed_technician':
        return <CheckCircle2 className="h-4 w-4 text-success" />
      case 'booking_cancelled':
        return <AlertCircle className="h-4 w-4 text-error" />
      case 'job_completed':
      case 'review_reminder':
        return <Sparkles className="h-4 w-4 text-amber-500" />
      default:
        return <Bell className="h-4 w-4 text-primary" />
    }
  }

  if (!session) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl text-ink/70 transition-colors hover:bg-primary-light hover:text-primary focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[11px] font-bold text-white shadow-soft">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white p-4 shadow-lift ring-1 ring-primary/10 z-50">
          <div className="flex items-center justify-between border-b border-primary/10 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-ink">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink/50">
                <Bell className="mx-auto mb-2 h-8 w-8 text-primary/30" />
                No notifications yet.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.read && handleMarkAsRead(item.id)}
                  className={`group relative flex items-start gap-3 rounded-2xl p-3 text-left transition-all ${
                    item.read
                      ? 'bg-background hover:bg-primary-light/30'
                      : 'bg-primary-light/50 ring-1 ring-primary/20 hover:bg-primary-light/70 cursor-pointer'
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-soft">
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${item.read ? 'font-medium text-ink' : 'font-bold text-ink'}`}>
                      {item.title || 'Notification'}
                    </p>
                    {item.message && (
                      <p className="mt-0.5 text-xs text-ink/70 line-clamp-2">{item.message}</p>
                    )}
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-ink/40">
                      <Clock className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {!item.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
