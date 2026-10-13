import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard, Sparkles, Wrench, LogOut, User, Loader2,
  AlertCircle, Clock, MapPin, CheckCircle2, ArrowRight, ClipboardList,
  Calendar, Star, CheckCircle, Activity, Search, ShieldCheck, MessageSquare,
  ChevronRight, Phone, RefreshCw, XCircle, Filter, Zap, Menu, X, CheckCircle2 as CheckIcon
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchCustomerRequests, fetchCustomerBookings,
} from '../lib/jobService'
import {
  REQUEST_STATUS_LABELS, BOOKING_STATUS_LABELS, BOOKING_STEPS,
} from '../types/job'
import type { ServiceRequestWithCategory, BookingWithDetails } from '../types/job'
import type { PublicTechnician } from '../types/technician'
import { fetchVerifiedTechnicians, getTechnicianWhatsAppUrl } from '../lib/technicianService'
import TechnicianCard from '../components/TechnicianCard'
import ServiceImageLogo from '../components/ServiceImageLogo'
import ChatSection from '../components/chat/ChatSection'
import { getOrCreateConversation, fetchTotalUnreadCount } from '../lib/chatService'

type TabType = 'overview' | 'active-jobs' | 'requests' | 'messages' | 'history' | 'technicians'

export default function DashboardPage() {
  const { profile, session, signOut } = useAuth()
  const [requests, setRequests] = useState<ServiceRequestWithCategory[]>([])
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [availableTechnicians, setAvailableTechnicians] = useState<PublicTechnician[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [targetConversationId, setTargetConversationId] = useState<string | null>(null)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0)

  // Search & Filters
  const [requestSearch, setRequestSearch] = useState('')
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('all')
  const [techSearch, setTechSearch] = useState('')

  const effectiveUserId = profile?.user_id || session?.user?.id || profile?.id

  async function loadData(showRefreshing = false) {
    if (!effectiveUserId) return
    if (showRefreshing) setRefreshing(true)
    try {
      setError('')
      const [reqs, books, techs, unreadCount] = await Promise.all([
        fetchCustomerRequests(effectiveUserId),
        fetchCustomerBookings(effectiveUserId),
        fetchVerifiedTechnicians().catch(() => []),
        fetchTotalUnreadCount(effectiveUserId).catch(() => 0),
      ])
      setRequests(reqs)
      setBookings(books)
      setAvailableTechnicians(techs)
      setUnreadMessagesCount(unreadCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleStartChatWithTechnician(techId: string, requestId?: string, bookingId?: string) {
    if (!effectiveUserId) return
    try {
      const conv = await getOrCreateConversation({
        customerId: effectiveUserId,
        technicianId: techId,
        requestId,
        bookingId,
      })
      if (conv) {
        setTargetConversationId(conv.id)
      }
      setActiveTab('messages')
      setMobileMenuOpen(false)
    } catch (err) {
      console.error('Error starting chat:', err)
      setActiveTab('messages')
    }
  }

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

  useEffect(() => {
    if (!profile && !session?.user) return
    loadData()
  }, [profile, session])

  // Computed data
  const activeBookings = useMemo(() => {
    return bookings.filter((b) => b.status !== 'completed' && b.status !== 'cancelled')
  }, [bookings])

  const completedBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'completed')
  }, [bookings])

  const pastBookings = useMemo(() => {
    return bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled')
  }, [bookings])

  const pendingQuotesRequestsCount = useMemo(() => {
    return requests.filter((r) => r.status === 'quoted' || r.status === 'matching').length
  }, [requests])

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesStatus = requestStatusFilter === 'all' || req.status === requestStatusFilter
      const term = requestSearch.toLowerCase().trim()
      const matchesSearch =
        !term ||
        req.category_name?.toLowerCase().includes(term) ||
        req.description?.toLowerCase().includes(term) ||
        req.location?.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [requests, requestStatusFilter, requestSearch])

  // Filtered Technicians
  const filteredTechnicians = useMemo(() => {
    const term = techSearch.toLowerCase().trim()
    if (!term) return availableTechnicians
    return availableTechnicians.filter(
      (t) =>
        t.name?.toLowerCase().includes(term) ||
        t.profession?.toLowerCase().includes(term) ||
        t.service_area?.toLowerCase().includes(term)
    )
  }, [availableTechnicians, techSearch])

  const customerName = profile?.name || session?.user?.user_metadata?.name || 'Customer'
  const customerEmail = profile?.email || session?.user?.email || ''

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-semibold text-ink/60">Loading your FixMate portal...</p>
      </div>
    )
  }

  return (
    <div className="section min-h-[85vh] py-6 sm:py-8 max-w-7xl mx-auto animate-fade-in">
      {/* Top Welcome / Header Bar */}
      <div className="card p-5 sm:p-6 mb-6 bg-gradient-to-r from-primary/10 via-purple-50/50 to-blue-50/40 border border-primary/15 rounded-3xl shadow-soft">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* User Avatar Circle */}
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white text-xl font-black shadow-soft">
                {customerName.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white" title="Active Account">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-ink tracking-tight">
                  Welcome back, {customerName}!
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                  <ShieldCheck className="h-3 w-3 text-purple-700" /> Customer Portal
                </span>
              </div>
              <p className="text-xs text-ink/65 mt-0.5">
                {customerEmail ? `${customerEmail} • ` : ''}Manage your repairs, track technicians & review quotes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="btn-secondary text-xs !py-2 !px-3 border border-slate-200 shadow-xs"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-ink/70 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link to="/ai-assistant" className="btn-primary text-xs !py-2 !px-4 shadow-soft">
              <Sparkles className="h-4 w-4" /> Ask FixMate AI
            </Link>

            <button
              onClick={signOut}
              className="btn-secondary text-xs !py-2 !px-3 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-2xl bg-error/10 p-4 text-xs font-semibold text-error border border-error/20">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Sidebar Nav + Main Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Mobile Navigation Toggle Bar */}
        <div className="lg:hidden flex items-center justify-between card p-3.5 bg-white border border-slate-200">
          <span className="text-xs font-bold text-ink flex items-center gap-2 uppercase tracking-wider">
            <LayoutDashboard className="h-4 w-4 text-primary" /> Navigation
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="btn-secondary text-xs !p-1.5"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Sidebar */}
        <div className={`lg:col-span-3 space-y-1 ${mobileMenuOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="card p-3 bg-white border border-slate-200/90 rounded-3xl shadow-soft space-y-1">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink/40">Dashboard Menu</p>
            
            <button
              onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-ink/70 hover:bg-slate-100 hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Overview & Feed</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('active-jobs'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'active-jobs'
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-ink/70 hover:bg-slate-100 hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 shrink-0" />
                <span>Active Jobs</span>
              </div>
              {activeBookings.length > 0 && (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                  activeTab === 'active-jobs' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                }`}>
                  {activeBookings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('requests'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'requests'
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-ink/70 hover:bg-slate-100 hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className="h-4 w-4 shrink-0" />
                <span>Service Requests</span>
              </div>
              {pendingQuotesRequestsCount > 0 ? (
                <span className="px-2 py-0.5 text-[10px] rounded-full font-black bg-amber-100 text-amber-800 animate-pulse">
                  {pendingQuotesRequestsCount} Quoted
                </span>
              ) : (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                  activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-slate-100 text-ink/60'
                }`}>
                  {requests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('messages'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'messages'
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-ink/70 hover:bg-slate-100 hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span>In-App Messages</span>
              </div>
              {unreadMessagesCount > 0 ? (
                <span className="px-2 py-0.5 text-[10px] rounded-full font-black bg-purple-600 text-white animate-pulse">
                  {unreadMessagesCount} New
                </span>
              ) : (
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                  activeTab === 'messages' ? 'bg-white/20 text-white' : 'bg-slate-100 text-ink/60'
                }`}>
                  💬
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('history'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-ink/70 hover:bg-slate-100 hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>Job History</span>
              </div>
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-100 text-ink/60'
              }`}>
                {pastBookings.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('technicians'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'technicians'
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-ink/70 hover:bg-slate-100 hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wrench className="h-4 w-4 shrink-0" />
                <span>Verified Technicians</span>
              </div>
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                activeTab === 'technicians' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {availableTechnicians.length}
              </span>
            </button>
          </div>

          {/* Quick Help Card */}
          <div className="card p-4 bg-gradient-to-br from-purple-900 to-indigo-900 text-white rounded-3xl shadow-soft">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" /> Instant AI Help
            </div>
            <p className="mt-2 text-xs text-purple-100/90 leading-relaxed">
              Describe your appliance problem in Urdu or English to get safe DIY guidance & technician matching.
            </p>
            <Link
              to="/ai-assistant"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-white bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1.5 rounded-xl transition-all"
            >
              <span>Launch AI Assistant</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="lg:col-span-9 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Counters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card p-4 hover:shadow-soft transition-all bg-white border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Active Jobs</span>
                    <Clock className="h-4 w-4 text-purple-600" />
                  </div>
                  <p className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-purple-900">{activeBookings.length}</p>
                  <p className="text-[10px] text-purple-700 font-semibold mt-0.5">In progress & scheduled</p>
                </div>

                <div className="card p-4 hover:shadow-soft transition-all bg-white border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Requests</span>
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-ink">{requests.length}</p>
                  <p className="text-[10px] text-blue-700 font-semibold mt-0.5">Total repair requests</p>
                </div>

                <div className="card p-4 hover:shadow-soft transition-all bg-white border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Completed</span>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-emerald-900">{completedBookings.length}</p>
                  <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">Finished services</p>
                </div>

                <div className="card p-4 hover:shadow-soft transition-all bg-white border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Verified Techs</span>
                    <Wrench className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="mt-2 text-2xl sm:text-3xl font-black tabular-nums text-ink">{availableTechnicians.length}</p>
                  <p className="text-[10px] text-indigo-700 font-semibold mt-0.5">Pro specialists nearby</p>
                </div>
              </div>

              {/* Active Repairs Spotlight */}
              {activeBookings.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
                      <Clock className="h-4 w-4 text-primary animate-pulse" />
                      <span>Active Repair Spotlight ({activeBookings.length})</span>
                    </h2>
                    <button
                      onClick={() => setActiveTab('active-jobs')}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      View All <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {activeBookings.slice(0, 2).map((booking) => (
                      <ActiveJobCard key={booking.id} booking={booking} />
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Services Navigation */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  to="/ai-assistant"
                  className="card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift bg-gradient-to-br from-white via-purple-50/30 to-purple-100/30 border border-purple-200/80 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-soft group-hover:scale-105 transition-transform">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="mt-3 font-extrabold text-sm text-ink">Ask FixMate AI Diagnostic</p>
                  <p className="text-xs text-ink/65 mt-1 leading-relaxed">
                    Upload a photo or describe noise/leaks in English or Urdu. Get instant safe steps and match with certified technicians.
                  </p>
                </Link>

                <Link
                  to="/technicians"
                  className="card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift bg-gradient-to-br from-white via-blue-50/30 to-blue-100/30 border border-blue-200/80 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-soft group-hover:scale-105 transition-transform">
                      <Wrench className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="mt-3 font-extrabold text-sm text-ink">Browse Verified Technicians</p>
                  <p className="text-xs text-ink/65 mt-1 leading-relaxed">
                    Directly contact electricians, plumbers, AC repair specialists, and carpenters near your location via WhatsApp or phone.
                  </p>
                </Link>
              </div>

              {/* Recent Requests Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <span>Recent Repair Requests ({requests.length})</span>
                  </h2>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View All <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {requests.length === 0 ? (
                  <div className="card p-8 text-center bg-white border border-slate-200 rounded-3xl">
                    <ClipboardList className="mx-auto h-10 w-10 text-primary/30" />
                    <p className="mt-3 font-bold text-sm text-ink">No Repair Requests Submitted Yet</p>
                    <p className="mt-1 text-xs text-ink/60 max-w-sm mx-auto">
                      Use our FixMate AI assistant to diagnose issues or book a specialist directly.
                    </p>
                    <Link to="/ai-assistant" className="btn-primary mt-4 text-xs !py-2 !px-4">
                      <Sparkles className="h-4 w-4" /> Start AI Diagnosis
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.slice(0, 3).map((req) => (
                      <RequestCard key={req.id} request={req} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE REPAIR JOBS */}
          {activeTab === 'active-jobs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-black text-ink flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>Active Repair Jobs ({activeBookings.length})</span>
                  </h2>
                  <p className="text-xs text-ink/60 mt-0.5">Track live repair progress, arrival times, and assigned technician details</p>
                </div>
              </div>

              {activeBookings.length === 0 ? (
                <div className="card p-10 text-center bg-white border border-slate-200 rounded-3xl space-y-3">
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                    <CheckIcon className="h-6 w-6" />
                  </div>
                  <h3 className="font-extrabold text-base text-ink">No Active Jobs Right Now</h3>
                  <p className="text-xs text-ink/60 max-w-sm mx-auto">
                    When you accept a technician quote or confirm a booking, it will appear here with live tracking updates.
                  </p>
                  <button onClick={() => setActiveTab('requests')} className="btn-primary text-xs !py-2.5 !px-4">
                    View My Requests
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeBookings.map((b) => (
                    <ActiveJobCard key={b.id} booking={b} showFullDetails />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SERVICE REQUESTS & QUOTES */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-black text-ink flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <span>Service Requests & Quotes ({requests.length})</span>
                  </h2>
                  <p className="text-xs text-ink/60 mt-0.5">Review quotes submitted by technicians and confirm bookings</p>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/40" />
                  <input
                    type="text"
                    placeholder="Search requests by category or description..."
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 pl-9 pr-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
                  />
                  {requestSearch && (
                    <button
                      onClick={() => setRequestSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink text-xs"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={requestStatusFilter}
                  onChange={(e) => setRequestStatusFilter(e.target.value)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-xs text-ink font-semibold focus:border-primary focus:outline-none bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="quoted">Quoted / Matching</option>
                  <option value="requested">Requested</option>
                  <option value="booked">Booked</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="card p-10 text-center bg-white border border-slate-200 rounded-3xl">
                  <ClipboardList className="mx-auto h-10 w-10 text-ink/30" />
                  <p className="mt-3 font-bold text-sm text-ink">No requests match your filter</p>
                  <p className="mt-1 text-xs text-ink/60">
                    {requests.length === 0
                      ? 'You haven\'t created any service requests yet.'
                      : 'Try clearing your search query or status filter.'}
                  </p>
                  {requests.length > 0 && (
                    <button
                      onClick={() => { setRequestSearch(''); setRequestStatusFilter('all'); }}
                      className="btn-secondary mt-3 text-xs"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((req) => (
                    <RequestCard key={req.id} request={req} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: JOB HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-black text-ink flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <span>Completed & Past Repairs ({pastBookings.length})</span>
                  </h2>
                  <p className="text-xs text-ink/60 mt-0.5">History of completed services and receipt details</p>
                </div>
              </div>

              {pastBookings.length === 0 ? (
                <div className="card p-10 text-center bg-white border border-slate-200 rounded-3xl">
                  <CheckCircle className="mx-auto h-10 w-10 text-ink/20" />
                  <p className="mt-3 font-bold text-sm text-ink">No Past Jobs Found</p>
                  <p className="mt-1 text-xs text-ink/60">Completed repair services will be saved here for your records.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastBookings.map((b) => (
                    <div key={b.id} className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-soft bg-white border border-slate-200">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <ServiceImageLogo name={b.request_category_name || 'Booking'} icon={b.request_category_icon} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-extrabold text-sm text-ink">{b.request_category_name || 'Service Repair'}</p>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              b.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {BOOKING_STATUS_LABELS[b.status] || b.status}
                            </span>
                          </div>
                          <p className="text-xs text-ink/65 truncate mt-0.5">Technician: {b.technician_name}</p>
                          <p className="text-[11px] text-ink/45 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(b.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        {b.quote_amount !== null && (
                          <div className="text-right">
                            <span className="text-xs text-ink/50 block">Paid Amount</span>
                            <span className="text-base font-black text-ink tabular-nums">Rs {b.quote_amount}</span>
                          </div>
                        )}
                        <Link to={`/bookings/${b.id}`} className="btn-secondary text-xs !py-2 !px-3">
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: VERIFIED TECHNICIANS */}
          {activeTab === 'technicians' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-black text-ink flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    <span>Available Verified Technicians ({availableTechnicians.length})</span>
                  </h2>
                  <p className="text-xs text-ink/60 mt-0.5">Browse certified local professionals across all categories</p>
                </div>
                <Link to="/technicians" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  Full Directory <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
                <input
                  type="text"
                  placeholder="Search technicians by name, specialty (e.g., Electrician, AC Repair), or location..."
                  value={techSearch}
                  onChange={(e) => setTechSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 pl-10 pr-3 py-2.5 text-xs text-ink focus:border-primary focus:outline-none bg-white shadow-xs"
                />
              </div>

              {filteredTechnicians.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredTechnicians.map((tech) => (
                    <div key={tech.id} className="relative group">
                      <TechnicianCard technician={tech} />
                      <button
                        onClick={() => handleStartChatWithTechnician(tech.id)}
                        className="mt-2 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary-light py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all shadow-xs"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Chat Privately with {tech.name}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card p-8 text-center bg-white border border-slate-200 rounded-3xl">
                  <p className="text-xs text-ink/60">No technicians found matching "{techSearch}".</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: IN-APP REALTIME CHAT */}
          {activeTab === 'messages' && (
            <div className="animate-fade-in space-y-4">
              <ChatSection
                currentUserId={effectiveUserId || ''}
                userRole="user"
                initialConversationId={targetConversationId}
                onUnreadCountChange={(count) => setUnreadMessagesCount(count)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActiveJobCard({ booking, showFullDetails = false }: { booking: BookingWithDetails; showFullDetails?: boolean }) {
  const currentStepIndex = BOOKING_STEPS.indexOf(booking.status as typeof BOOKING_STEPS[number])
  const waMsg = encodeURIComponent(`Hi ${booking.technician_name || 'Technician'}, checking on my repair booking #${booking.id}`)
  const waUrl = getTechnicianWhatsAppUrl(null, booking.technician_name, `Hi ${booking.technician_name}, checking on my repair request #${booking.id}`) || `https://wa.me/?text=${waMsg}`

  return (
    <div className="card p-5 transition-all hover:shadow-lift bg-white border border-slate-200/90 rounded-3xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <ServiceImageLogo name={booking.request_category_name || 'Service Job'} icon={booking.request_category_icon} size="md" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-extrabold text-sm sm:text-base text-ink">{booking.request_category_name || 'Service Repair Job'}</p>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
                <Clock className="h-3 w-3 text-purple-700" />
                {BOOKING_STATUS_LABELS[booking.status] || booking.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink/65 font-medium">Technician: {booking.technician_name || 'Assigned Specialist'}</p>
          </div>
        </div>

        {booking.quote_amount !== null && (
          <div className="text-right shrink-0">
            <span className="text-[10px] text-ink/50 uppercase font-bold block">Quoted Price</span>
            <p className="text-lg font-black text-primary tabular-nums">Rs {booking.quote_amount}</p>
          </div>
        )}
      </div>

      {/* Step-by-Step Progress Bar */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-1.5">
          {BOOKING_STEPS.map((step, idx) => (
            <div key={step} className="flex items-center flex-1">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  idx < currentStepIndex
                    ? 'bg-emerald-600 text-white'
                    : idx === currentStepIndex
                    ? 'bg-primary text-white ring-2 ring-primary/30 shadow-xs'
                    : 'bg-slate-200 text-ink/40'
                }`}
                title={BOOKING_STATUS_LABELS[step]}
              >
                {idx < currentStepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              {idx < BOOKING_STEPS.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-1 rounded-full ${
                    idx < currentStepIndex ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-ink/70">
          <span>Stage: {BOOKING_STATUS_LABELS[booking.status] || booking.status}</span>
          <span className="text-primary font-bold">Step {Math.max(1, currentStepIndex + 1)} of {BOOKING_STEPS.length}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs text-ink/60">
          {booking.location && (
            <span className="flex items-center gap-1 truncate max-w-[200px]">
              <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate">{booking.location}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-xs"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>WhatsApp Technician</span>
          </a>

          <Link
            to={`/bookings/${booking.id}`}
            className="btn-primary text-xs !py-1.5 !px-3 shadow-soft"
          >
            <span>Live Details</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function RequestCard({ request }: { request: ServiceRequestWithCategory }) {
  const hasQuotes = request.status === 'quoted' || request.status === 'matching'
  const isDirectTarget = (request.description || '').includes('TechID:') || (request.description || '').includes('Direct Request')
  const cleanDescription = (request.description || '').replace(/^\[Direct Request for [^\]]+\]\s*/, '')

  return (
    <div className="card p-4 sm:p-5 transition-all hover:shadow-soft bg-white border border-slate-200 rounded-3xl space-y-3">
      {isDirectTarget && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-100 to-indigo-100 px-3 py-1 text-[11px] font-black text-purple-900 border border-purple-200">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>⚡ Direct Service Request Sent to Technician</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ServiceImageLogo name={request.category_name || 'Service'} icon={request.category_icon} size="sm" />
          <div>
            <p className="font-extrabold text-sm text-ink">{request.category_name || 'Service Repair'}</p>
            {request.location && (
              <p className="text-xs text-ink/50 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                <span className="truncate">{request.location}</span>
              </p>
            )}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
            request.status === 'completed'
              ? 'bg-emerald-100 text-emerald-800'
              : request.status === 'booked'
              ? 'bg-purple-100 text-purple-800'
              : request.status === 'quoted'
              ? 'bg-amber-100 text-amber-800 animate-pulse border border-amber-300'
              : request.status === 'cancelled'
              ? 'bg-rose-100 text-rose-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {REQUEST_STATUS_LABELS[request.status] || request.status}
        </span>
      </div>

      {cleanDescription && (
        <p className="text-xs text-ink/75 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-medium">
          {cleanDescription}
        </p>
      )}

      {/* AI Diagnosis Tag if exists */}
      {request.diagnosis_summary && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-purple-50/80 text-purple-900 border border-purple-100 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate font-medium">AI Diagnosis: {request.diagnosis_summary}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <span className="flex items-center gap-1 text-[11px] text-ink/50 tabular-nums">
          <Clock className="h-3 w-3" />
          Submitted {new Date(request.created_at).toLocaleDateString()}
        </span>

        {hasQuotes ? (
          <Link
            to={`/requests/${request.id}/quotes`}
            className="inline-flex items-center gap-1 font-bold text-xs text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-xl transition-all shadow-xs"
          >
            <span>Review Quotes</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="text-[11px] font-medium text-ink/50">Awaiting technician responses</span>
        )}
      </div>
    </div>
  )
}

