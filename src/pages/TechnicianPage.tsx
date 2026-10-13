import { useEffect, useState, useRef } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  Wrench, LogOut, Clock, User, Camera, CheckCircle2, Loader2,
  AlertCircle, Star, MapPin, Briefcase, Save, ClipboardList,
  Calendar, Check, ShieldCheck, Sparkles, ArrowRight, TrendingUp, Menu, X, DollarSign,
  PhoneCall, Layers, Shield, Activity, BarChart3, ChevronRight, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchServiceCategories, fetchOwnTechnicianRecord, fetchOwnTechnicianServices,
  updateTechnicianProfile, setTechnicianServices, uploadTechnicianAvatar,
} from '../lib/technicianService'
import { fetchTechnicianBookings, updateBookingStatus } from '../lib/jobService'
import { BOOKING_STATUS_LABELS } from '../types/job'
import type { BookingWithDetails } from '../types/job'
import TechnicianRequests from '../components/TechnicianRequests'
import type { ServiceCategoryDB } from '../types/technician'
import { supabase } from '../lib/supabase'
import ServiceImageLogo from '../components/ServiceImageLogo'
import ChatSection from '../components/chat/ChatSection'
import { fetchTotalUnreadCount, getOrCreateConversation } from '../lib/chatService'

export default function TechnicianPage() {
  const { profile, session, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const role = profile?.role ?? (session?.user?.user_metadata?.role as string | undefined)

  if (session && role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (role !== 'technician') {
    return (
      <div className="section py-12 sm:py-16 animate-fade-in">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">For Technicians</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              Grow your repair business with FixMate
            </h1>
            <p className="mt-4 max-w-lg text-base text-ink/60 leading-relaxed">
              Join FixMate to receive direct service requests from local customers verified by AI diagnostics. Submit quotes, manage customer bookings, and build a trusted reputation.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Create your professional trade profile & select services',
                'Receive matching service requests from nearby customers',
                'Submit competitive quotes and schedule on-site visits',
                'Build verified 5-star reputation from completed jobs',
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm font-medium text-ink/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/technician/register" className="btn-primary text-sm">
                <Wrench className="h-4 w-4" /> Register as a Technician
              </Link>
              {session && (
                <Link to="/dashboard" className="btn-secondary text-sm">
                  Go to Customer Dashboard
                </Link>
              )}
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="mx-auto flex max-w-xs items-center justify-center rounded-4xl bg-gradient-to-br from-primary to-primary-dark p-10 text-white shadow-lift">
              <div className="text-center">
                <Wrench className="mx-auto h-16 w-16" strokeWidth={1.5} />
                <p className="mt-4 text-xl font-black">Be the Expert</p>
                <p className="mt-1 text-xs text-white/75">Your local community trusts</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const activeProfile = profile || {
    id: session?.user?.id || '',
    user_id: session?.user?.id || '',
    name: (session?.user?.user_metadata?.name as string) || null,
    email: session?.user?.email || null,
    phone: null,
    role: 'technician' as const,
    avatar_url: null,
  }

  return <TechnicianDashboard profile={activeProfile} onSignOut={signOut} />
}

function TechnicianDashboard({
  profile, onSignOut,
}: {
  profile: { id: string; name: string | null; email: string | null; user_id?: string }
  onSignOut: () => Promise<void>
}) {
  const [technician, setTechnician] = useState<Record<string, unknown> | null>(null)
  const [categories, setCategories] = useState<ServiceCategoryDB[]>([])
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<'requests' | 'jobs' | 'messages' | 'profile'>('requests')
  const [jobs, setJobs] = useState<BookingWithDetails[]>([])
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [jobFilter, setJobFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [unreadCount, setUnreadCount] = useState(0)
  const [targetConversationId, setTargetConversationId] = useState<string | null>(null)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const convIdParam = searchParams.get('convId')
    if (tabParam === 'messages') {
      setActiveTab('messages')
    }
    if (convIdParam) {
      setTargetConversationId(convIdParam)
    }
  }, [searchParams])

  // Form fields
  const [fullName, setFullName] = useState('')
  const [profession, setProfession] = useState('')
  const [bio, setBio] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [availability, setAvailability] = useState('available')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const cats = await fetchServiceCategories()
        setCategories(cats)

        const lookupId = profile.id || profile.user_id || ''
        if (lookupId) {
          const tech = await fetchOwnTechnicianRecord(lookupId)
          if (tech) {
            setTechnician(tech)
            setFullName(tech.name || profile.name || '')
            setProfession(tech.profession || '')
            setBio(tech.bio || '')
            setExperienceYears(tech.experience_years?.toString() || '')
            setServiceArea(tech.service_area || '')
            setWhatsappNumber(tech.whatsapp_number || '')
            setAvailability(tech.availability || 'available')
            setAvatarUrl(tech.avatar_url || null)

            const [services, techBookings, totalUnread] = await Promise.all([
              fetchOwnTechnicianServices(tech.id),
              fetchTechnicianBookings(tech.id),
              fetchTotalUnreadCount(profile.user_id || profile.id).catch(() => 0),
            ])
            setSelectedServices(new Set(services.map((s) => s.id)))
            setJobs(techBookings)
            setUnreadCount(totalUnread)
          } else {
            setFullName(profile.name || '')
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your technician profile.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile])

  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null)

  async function handleAvailabilityChange(newAvail: string) {
    setAvailability(newAvail)
    if (technician?.id) {
      try {
        await updateTechnicianProfile(technician.id as string, { availability: newAvail })
        setSuccess(`Status updated to ${newAvail}`)
        setTimeout(() => setSuccess(''), 2500)
      } catch {
        // ignore
      }
    }
  }

  async function handleQuickStatusUpdate(jobId: string, newStatus: string) {
    setUpdatingJobId(jobId)
    setError('')
    try {
      await updateBookingStatus(jobId, newStatus)
      if (technician?.id) {
        const updated = await fetchTechnicianBookings(technician.id as string)
        setJobs(updated)
      }
      setSuccess(
        newStatus === 'completed'
          ? '🎉 Job marked as accomplished and completed successfully! Customer has been notified.'
          : `Job status updated to ${BOOKING_STATUS_LABELS[newStatus] || newStatus}.`
      )
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update job status.')
    } finally {
      setUpdatingJobId(null)
    }
  }

  async function handleJobAccepted() {
    if (technician?.id) {
      const techBookings = await fetchTechnicianBookings(technician.id as string)
      setJobs(techBookings)
      setActiveTab('jobs')
    }
  }

  function toggleService(id: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''
    const objectUrl = URL.createObjectURL(file)
    setAvatarUrl(objectUrl)
    setSaving(true)
    setError('')
    try {
      const authUserRes = await supabase.auth.getUser()
      const authUserId = authUserRes.data?.user?.id || profile?.user_id || profile?.id || 'tech'
      const techId = (technician?.id as string) || undefined

      const url = await uploadTechnicianAvatar(file, authUserId, techId)
      setAvatarUrl(url)

      if (authUserId) {
        try {
          await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', authUserId)
        } catch {}
      }
      if (profile?.id) {
        try {
          await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
        } catch {}
      }

      if (techId) {
        await updateTechnicianProfile(techId, { avatar_url: url, name: fullName.trim() || undefined })
      } else {
        const lookupId = profile?.id || authUserId
        if (lookupId) {
          const freshTech = await fetchOwnTechnicianRecord(lookupId)
          if (freshTech) {
            setTechnician(freshTech)
            await updateTechnicianProfile(freshTech.id as string, { avatar_url: url, name: fullName.trim() || undefined })
          }
        }
      }

      setSuccess('Profile photo uploaded and saved successfully!')
      setTimeout(() => setSuccess(''), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const authUserRes = await supabase.auth.getUser()
      const authUserId = authUserRes.data?.user?.id || profile?.user_id

      if (authUserId) {
        try {
          const profUpdates: Record<string, any> = {}
          if (fullName.trim()) profUpdates.name = fullName.trim()
          if (whatsappNumber.trim()) profUpdates.phone = whatsappNumber.trim()
          if (avatarUrl) profUpdates.avatar_url = avatarUrl
          if (Object.keys(profUpdates).length > 0) {
            await supabase.from('profiles').update(profUpdates).eq('user_id', authUserId)
          }
        } catch {}
      }
      if (profile?.id) {
        try {
          const profUpdates: Record<string, any> = {}
          if (fullName.trim()) profUpdates.name = fullName.trim()
          if (whatsappNumber.trim()) profUpdates.phone = whatsappNumber.trim()
          if (avatarUrl) profUpdates.avatar_url = avatarUrl
          if (Object.keys(profUpdates).length > 0) {
            await supabase.from('profiles').update(profUpdates).eq('id', profile.id)
          }
        } catch {}
      }

      if (technician?.id) {
        await updateTechnicianProfile(technician.id as string, {
          name: fullName.trim() || null,
          profession: profession.trim() || null,
          bio: bio.trim() || null,
          experience_years: experienceYears ? parseInt(experienceYears, 10) : null,
          service_area: serviceArea.trim() || null,
          whatsapp_number: whatsappNumber.trim() || null,
          availability,
          avatar_url: avatarUrl,
        })

        await setTechnicianServices(technician.id as string, Array.from(selectedServices))
      } else if (profile?.id) {
        if (avatarUrl) {
          try {
            await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id)
          } catch {}
        }

        const bioParts: string[] = []
        if (fullName.trim()) bioParts.push(`Name: ${fullName.trim()}`)
        if (avatarUrl) bioParts.push(`Photo: ${avatarUrl}`)
        if (bio.trim()) bioParts.push(bio.trim())
        else bioParts.push('Specialist ready for service.')
        const bioWithMeta = bioParts.join(' | ')

        const { data: createdTech, error: createErr } = await supabase
          .from('technicians')
          .insert({
            profile_id: profile.id,
            profession: profession.trim() || 'Specialist',
            bio: bioWithMeta,
            experience_years: experienceYears ? parseInt(experienceYears, 10) : null,
            service_area: serviceArea.trim() || null,
            whatsapp_number: whatsappNumber.trim() || null,
            availability,
            verification_status: 'approved',
          })
          .select('*')
          .maybeSingle()

        if (createErr) throw createErr
        if (createdTech) {
          setTechnician(createdTech)
          await setTechnicianServices(createdTech.id, Array.from(selectedServices))
        }
      }

      setSuccess('Profile details saved successfully!')
      setTimeout(() => setSuccess(''), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center animate-fade-in">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const verificationStatus = (technician?.verification_status as string) || 'pending'
  const activeJobsCount = jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').length
  const completedJobsCount = jobs.filter((j) => j.status === 'completed').length

  const filteredJobs = jobs.filter((job) => {
    if (jobFilter === 'active') return job.status !== 'completed' && job.status !== 'cancelled'
    if (jobFilter === 'completed') return job.status === 'completed'
    return true
  })

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 pb-12 animate-fade-in">
      {/* Mobile Top Navigation Header */}
      <div className="md:hidden bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-primary text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="font-extrabold text-sm text-ink">Technician Portal</p>
            <p className="text-[10px] text-ink/60 truncate">{fullName || profile.name}</p>
          </div>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-ink hover:bg-slate-100"
        >
          {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 p-4 md:p-8">
        {/* Sidebar Container */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200/80 p-5 shadow-lg md:shadow-none md:static md:z-0 md:w-64 md:shrink-0 md:rounded-3xl md:border md:border-slate-200/80 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="space-y-6">
            {/* Technician Profile Card Header */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-soft">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-12 w-12 rounded-xl object-cover ring-2 ring-primary/40"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-primary/20 text-primary font-bold flex items-center justify-center text-lg border border-primary/30">
                    {fullName ? fullName.slice(0, 2).toUpperCase() : 'T'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-sm truncate text-white">{fullName || profile.name || 'Technician'}</p>
                  <p className="text-xs text-slate-300 truncate">{profession || 'Trade Specialist'}</p>
                  <span
                    className={`inline-block mt-1.5 px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                      verificationStatus === 'approved' || verificationStatus === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : verificationStatus === 'rejected'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {verificationStatus}
                  </span>
                </div>
              </div>

              {/* Quick Availability Selector */}
              <div className="mt-3 pt-3 border-t border-slate-700/80">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Duty Status
                </label>
                <select
                  value={availability}
                  onChange={(e) => handleAvailabilityChange(e.target.value)}
                  className="w-full bg-slate-800 text-xs text-white font-semibold rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="available">🟢 Available for Bookings</option>
                  <option value="busy">🟡 Busy / On Duty</option>
                  <option value="unavailable">🔴 Offline / Unavailable</option>
                </select>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-1.5">
              <p className="px-3 text-[10px] font-extrabold text-ink/40 uppercase tracking-wider">Dashboard Menu</p>
              <button
                onClick={() => {
                  setActiveTab('requests')
                  setMobileSidebarOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === 'requests'
                    ? 'bg-primary text-white shadow-soft'
                    : 'text-ink/75 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  <span>Customer Requests</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('jobs')
                  setMobileSidebarOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === 'jobs'
                    ? 'bg-primary text-white shadow-soft'
                    : 'text-ink/75 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <span>Assigned Jobs</span>
                </div>
                {jobs.length > 0 && (
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      activeTab === 'jobs' ? 'bg-white/20 text-white' : 'bg-primary-light text-primary'
                    }`}
                  >
                    {jobs.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('messages')
                  setMobileSidebarOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === 'messages'
                    ? 'bg-primary text-white shadow-soft'
                    : 'text-ink/75 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span>In-App Messages</span>
                </div>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 text-[10px] rounded-full font-black bg-purple-600 text-white animate-pulse">
                    {unreadCount} New
                  </span>
                ) : (
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                      activeTab === 'messages' ? 'bg-white/20 text-white' : 'bg-slate-100 text-ink/60'
                    }`}
                  >
                    💬
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('profile')
                  setMobileSidebarOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === 'profile'
                    ? 'bg-primary text-white shadow-soft'
                    : 'text-ink/75 hover:bg-slate-100 hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 shrink-0" />
                  <span>Profile & Trade Services</span>
                </div>
              </button>
            </nav>

            {/* Quick Details Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Trade Summary</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink/60">Service Area:</span>
                <span className="font-semibold text-ink truncate max-w-[120px]">{serviceArea || 'General'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink/60">Rating:</span>
                <span className="font-bold text-amber-600 flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {technician?.rating ? String(technician.rating) : '5.0'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink/60">Offered Trades:</span>
                <span className="font-bold text-primary">{selectedServices.size} Categories</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200/80 space-y-2">
            <Link
              to="/dashboard"
              className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium text-ink/60 hover:bg-slate-100 transition-colors"
            >
              <span>Customer View</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Dashboard */}
        <main className="flex-1 space-y-6 min-w-0">
          {/* Header Banner */}
          <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white via-white to-purple-50/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="eyebrow">Technician Console</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  <Activity className="h-3 w-3 text-emerald-600" /> Live Updates
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-black text-ink">
                {activeTab === 'requests'
                  ? 'Incoming Customer Requests'
                  : activeTab === 'jobs'
                  ? 'My Assigned Jobs'
                  : 'Profile & Offered Trade Services'}
              </h1>
              <p className="mt-1 text-xs text-ink/60">
                {activeTab === 'requests'
                  ? 'Direct service dispatch requests from customers. Accept directly or send custom quotes.'
                  : activeTab === 'jobs'
                  ? 'Track scheduled repair jobs, update job status, and mark work accomplished.'
                  : 'Manage your real name, contact number, photo, bio, and service categories.'}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Profile
              </button>
            </div>
          </div>

          {/* Verification Status Banner */}
          <div
            className={`flex items-center gap-3 rounded-2xl p-4 shadow-soft ${
              verificationStatus === 'approved' || verificationStatus === 'verified'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : verificationStatus === 'rejected'
                ? 'bg-rose-50 text-rose-900 border border-rose-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            {verificationStatus === 'approved' || verificationStatus === 'verified' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : verificationStatus === 'rejected' ? (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            ) : (
              <Clock className="h-5 w-5 text-amber-600 shrink-0 animate-pulse" />
            )}
            <div className="min-w-0">
              <p className="font-bold text-xs">
                Account Status: <span className="uppercase">{verificationStatus}</span>
              </p>
              <p className="text-xs text-ink/70 mt-0.5">
                {verificationStatus === 'approved' || verificationStatus === 'verified'
                  ? 'Your profile is active and verified to receive direct service requests.'
                  : verificationStatus === 'rejected'
                  ? 'Your technician registration was rejected by admin. Please contact support.'
                  : 'Your account is under admin review. You can customize your profile and view customer requests in the meantime.'}
              </p>
            </div>
          </div>

          {/* KPI Stat Cards Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider block">Active Jobs</span>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-2xl font-black text-purple-700 tabular-nums">{activeJobsCount}</p>
                <Briefcase className="h-4 w-4 text-purple-400" />
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider block">Completed Jobs</span>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-2xl font-black text-emerald-700 tabular-nums">{completedJobsCount}</p>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
            </div>

            <div className="card p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider block">Selected Trades</span>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="text-2xl font-black text-ink tabular-nums">{selectedServices.size}</p>
                <Wrench className="h-4 w-4 text-ink/40" />
              </div>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-2 rounded-2xl bg-error/10 p-3.5 text-xs font-semibold text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-2xl bg-success/10 p-3.5 text-xs font-semibold text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Tab Views */}
          {!technician ? (
            <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-primary/5 shadow-soft">
              <Wrench className="mx-auto h-12 w-12 text-primary/40" />
              <p className="mt-3 font-bold text-ink">Technician Profile Not Initialized</p>
              <p className="mt-1 text-xs text-ink/50 max-w-sm mx-auto">
                You haven't set up your technician details yet. Register your specialization to begin receiving requests.
              </p>
              <Link to="/technician/register" className="btn-primary mt-4 text-xs">
                <Wrench className="h-4 w-4" /> Complete Technician Profile
              </Link>
            </div>
          ) : activeTab === 'requests' ? (
            <div className="space-y-4">
              <TechnicianRequests technicianId={technician.id as string} onJobAccepted={handleJobAccepted} />
            </div>
          ) : activeTab === 'jobs' ? (
            <div className="space-y-4">
              {/* Job Status Filter */}
              <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-2xl border border-slate-200/80">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setJobFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      jobFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    All Jobs ({jobs.length})
                  </button>
                  <button
                    onClick={() => setJobFilter('active')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      jobFilter === 'active' ? 'bg-primary text-white shadow-xs' : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    Active ({activeJobsCount})
                  </button>
                  <button
                    onClick={() => setJobFilter('completed')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      jobFilter === 'completed' ? 'bg-primary text-white shadow-xs' : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    Completed ({completedJobsCount})
                  </button>
                </div>
              </div>

              {filteredJobs.length === 0 ? (
                <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-primary/5 shadow-soft">
                  <Briefcase className="mx-auto h-10 w-10 text-primary/30" />
                  <p className="mt-3 font-bold text-sm text-ink">No Jobs Found in This Filter</p>
                  <p className="mt-1 text-xs text-ink/50">
                    Accept customer requests or submit quotes to populate your assigned job queue.
                  </p>
                </div>
              ) : (
                filteredJobs.map((job) => {
                  const isWorking = updatingJobId === job.id
                  const isFinished = job.status === 'completed'
                  const isCancelled = job.status === 'cancelled'

                  return (
                    <div
                      key={job.id}
                      className="card p-5 transition-all hover:shadow-lift"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <ServiceImageLogo name={job.request_category_name || 'Service Job'} icon={job.request_category_icon} size="md" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-ink">{job.request_category_name || 'Service Job'}</p>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                                  job.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : job.status === 'cancelled'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {BOOKING_STATUS_LABELS[job.status] || job.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-ink/75 line-clamp-1">{job.request_title || job.request_description}</p>
                            {job.location && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-ink/50">
                                <MapPin className="h-3 w-3 text-primary/70" /> {job.location}
                              </p>
                            )}
                            {job.quote_amount !== null && (
                              <p className="mt-1.5 text-sm font-black text-primary tabular-nums">
                                Job Value: Rs {job.quote_amount}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                          {!isFinished && !isCancelled && (
                            <>
                              {job.status === 'accepted' && (
                                <button
                                  onClick={() => handleQuickStatusUpdate(job.id, 'in_progress')}
                                  disabled={isWorking}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-soft hover:bg-primary-dark transition-all disabled:opacity-50"
                                >
                                  {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                                  Start Job
                                </button>
                              )}
                              <button
                                onClick={() => handleQuickStatusUpdate(job.id, 'completed')}
                                disabled={isWorking}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft hover:bg-emerald-700 transition-all disabled:opacity-50"
                              >
                                {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Accomplish & Complete
                              </button>
                            </>
                          )}

                          <Link
                            to={`/bookings/${job.id}`}
                            className="btn-secondary text-xs !py-1.5 !px-3"
                          >
                            Details <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ) : activeTab === 'messages' ? (
            <div className="animate-fade-in space-y-4">
              <ChatSection
                currentUserId={profile.user_id || profile.id}
                userRole="technician"
                technicianId={technician.id as string}
                initialConversationId={targetConversationId}
                onUnreadCountChange={(count) => setUnreadCount(count)}
              />
            </div>
          ) : (
            /* Profile and Services Editor */
            <div className="space-y-6">
              {/* Avatar Upload */}
              <div className="card p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink/70">Profile Photo</p>
                <div className="mt-3 flex items-center gap-4">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover ring-2 ring-primary/20 shadow-soft"
                    />
                  ) : (
                    <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-purple-100 font-bold text-primary text-xl">
                      {fullName ? fullName.slice(0, 2).toUpperCase() : (profile.name ? profile.name.slice(0, 2).toUpperCase() : 'T')}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={saving}
                      className="btn-secondary text-xs"
                    >
                      <Camera className="h-3.5 w-3.5" /> {saving ? 'Uploading...' : 'Upload Photo'}
                    </button>
                    <p className="text-[11px] text-ink/50">PNG, JPG or WebP. Photo is shown to customers on public profile.</p>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="card p-5 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-ink/70">Professional Details</p>

                <div>
                  <label className="block">
                    <span className="text-xs font-semibold text-ink/70">Full Name (Real Name)</span>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Tariq Khan"
                      className="mt-1 w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-ink ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-ink/70">Profession / Specialization</span>
                    <input
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="e.g. Master Plumber, Electrician"
                      className="mt-1 w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-ink ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-ink/70">Years of Experience</span>
                    <input
                      type="number"
                      min="0"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="5"
                      className="mt-1 w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-ink ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-ink/70">Service Area / City</span>
                    <input
                      value={serviceArea}
                      onChange={(e) => setServiceArea(e.target.value)}
                      placeholder="e.g. Downtown, North District"
                      className="mt-1 w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-ink ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-ink/70">WhatsApp / Direct Contact Number</span>
                    <input
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="mt-1 w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-ink ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-ink/70">Availability Status</span>
                  <select
                    value={availability}
                    onChange={(e) => handleAvailabilityChange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-ink focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="available">Available for New Bookings</option>
                    <option value="busy">Busy / High Load</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-ink/70">Professional Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Highlight your trade skills, certifications, and guarantees..."
                    rows={3}
                    className="mt-1 w-full resize-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-ink ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </label>
              </div>

              {/* Trade Categories Selector */}
              <div className="card p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink/70">Offered Repair Categories</p>
                <p className="text-xs text-ink/50 mt-0.5">Select all trades you service. Customer requests matching these trades will reach your dashboard.</p>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => toggleService(cat.id)}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                        selectedServices.has(cat.id)
                          ? 'bg-primary text-white shadow-soft scale-[1.01]'
                          : 'bg-slate-50 text-ink/75 ring-1 ring-slate-200/70 hover:bg-purple-50'
                      }`}
                    >
                      <ServiceImageLogo name={cat.name} icon={cat.icon} size="xs" />
                      <span className="truncate text-left">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Action */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary w-full text-xs !py-3"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving Changes...</>
                ) : (
                  <><Save className="h-4 w-4" /> Save Profile & Services</>
                )}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
