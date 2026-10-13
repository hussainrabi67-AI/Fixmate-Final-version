import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import {
  Loader2, AlertCircle, ArrowLeft, CheckCircle2, XCircle, Star,
  Briefcase, MapPin, CheckCircle, Clock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchQuotesForRequest, acceptQuote } from '../lib/jobService'
import { REQUEST_STATUS_LABELS } from '../types/job'
import type { QuoteWithTechnician, ServiceRequestWithCategory } from '../types/job'
import { supabase } from '../lib/supabase'
import ServiceImageLogo from '../components/ServiceImageLogo'

export default function QuotesPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const { session, loading: authLoading } = useAuth()

  const [quotes, setQuotes] = useState<QuoteWithTechnician[]>([])
  const [request, setRequest] = useState<ServiceRequestWithCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState<string | null>(null)
  const [acceptedBookingId, setAcceptedBookingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (!requestId) return
    let cancelled = false

    async function load() {
      try {
        // Fetch the request
        const { data: req, error: reqErr } = await supabase
          .from('service_requests')
          .select(`
            id, user_id, category_id, title, description, image_url, location, status,
            created_at, updated_at,
            service_categories!left(name, icon)
          `)
          .eq('id', requestId!)
          .maybeSingle()

        if (reqErr) throw new Error(reqErr.message)
        if (!req) {
          if (!cancelled) setError('Request not found.')
          return
        }

        const reqData = req as unknown as {
          id: string
          user_id: string
          category_id: string | null
          title: string | null
          description: string | null
          image_url: string | null
          location: string | null
          status: string
          created_at: string
          updated_at: string
          service_categories: { name: string; icon: string | null } | null
        }

        if (!cancelled) {
          setRequest({
            id: reqData.id,
            user_id: reqData.user_id,
            category_id: reqData.category_id,
            title: reqData.title,
            description: reqData.description,
            image_url: reqData.image_url,
            location: reqData.location,
            status: reqData.status,
            created_at: reqData.created_at,
            updated_at: reqData.updated_at,
            category_name: reqData.service_categories?.name ?? null,
            category_icon: reqData.service_categories?.icon ?? null,
            diagnosis_summary: null,
            diagnosis_urgency: null,
            diagnosis_professional: null,
          })
        }

        // Fetch quotes
        const qs = await fetchQuotesForRequest(requestId!)
        if (!cancelled) setQuotes(qs)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load quotes.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [requestId])

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="section py-16">
        <div className="mx-auto max-w-md rounded-2xl bg-error/10 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-error" />
          <p className="text-sm text-error">{error}</p>
          <Link to="/dashboard" className="btn-secondary mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Verify ownership
  if (request && request.user_id !== session.user.id) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleAcceptQuote(quoteId: string) {
    setAccepting(quoteId)
    setActionError('')

    try {
      const bookingId = await acceptQuote(quoteId)
      setAcceptedBookingId(bookingId)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not accept quote.')
    } finally {
      setAccepting(null)
    }
  }

  if (acceptedBookingId) {
    return (
      <div className="section py-16">
        <div className="mx-auto max-w-md rounded-3xl bg-success/10 p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-success" />
          <p className="mt-4 text-xl font-bold text-ink">Quote Accepted!</p>
          <p className="mt-2 text-sm text-ink/60">
            Your booking has been created. The technician will update the status as they progress.
          </p>
          <Link to={`/bookings/${acceptedBookingId}`} className="btn-primary mt-6">
            View Booking <ArrowLeft className="h-4 w-4 rotate-180" />
          </Link>
        </div>
      </div>
    )
  }

  const pendingQuotes = quotes.filter((q) => q.status === 'pending')
  const hasAccepted = quotes.some((q) => q.status === 'accepted')

  return (
    <div className="section py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        {/* Request header */}
        {request && (
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <ServiceImageLogo name={request.category_name || 'Service Request'} icon={request.category_icon} size="md" />
                <div>
                  <h1 className="text-xl font-bold text-ink">{request.category_name || 'Service Request'}</h1>
                  {request.location && (
                    <p className="text-xs text-ink/50 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {request.location}
                    </p>
                  )}
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                request.status === 'booked' ? 'bg-success/10 text-success' :
                request.status === 'quoted' ? 'bg-amber-100 text-amber-700' :
                'bg-primary-light text-primary-dark'
              }`}>
                {REQUEST_STATUS_LABELS[request.status] || request.status}
              </span>
            </div>
            {request.description && (
              <p className="mt-2 text-sm text-ink/70">{request.description}</p>
            )}
            {request.image_url && (
              <img src={request.image_url} alt="Problem" className="mt-3 h-24 w-24 rounded-xl object-cover ring-1 ring-primary/10" />
            )}
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-error/10 p-3 text-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Quotes */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-ink">
            Quotes for Your Request ({pendingQuotes.length} active)
          </h2>

          {quotes.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-primary-light/30 p-8 text-center">
              <Clock className="mx-auto h-10 w-10 text-primary/40" />
              <p className="mt-3 font-semibold text-ink">No quotes yet</p>
              <p className="mt-1 text-sm text-ink/60">
                Technicians will see your request and send quotes. Check back soon!
              </p>
            </div>
          ) : hasAccepted ? (
            <div className="mt-4 rounded-2xl bg-success/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <p className="mt-3 font-semibold text-ink">You've already accepted a quote for this request.</p>
              <Link to="/dashboard" className="btn-secondary mt-4">
                View Your Bookings
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {quotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  onAccept={() => handleAcceptQuote(quote.id)}
                  accepting={accepting === quote.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuoteCard({
  quote, onAccept, accepting,
}: {
  quote: QuoteWithTechnician
  onAccept: () => void
  accepting: boolean
}) {
  const initials = (quote.technician_name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const isPending = quote.status === 'pending'
  const isRejected = quote.status === 'rejected'

  return (
    <div className={`card p-5 ${isRejected ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        {/* Technician info */}
        <div className="flex items-start gap-3">
          {quote.technician_avatar ? (
            <img src={quote.technician_avatar} alt={quote.technician_name || 'Tech'} className="h-12 w-12 rounded-2xl object-cover ring-1 ring-primary/10" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-sm font-bold text-primary">
              {initials}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-ink">{quote.technician_name || 'Technician'}</p>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <p className="text-sm text-ink/60">{quote.technician_profession || 'Professional'}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/50">
              {quote.technician_rating !== null && quote.technician_review_count > 0 ? (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  {quote.technician_rating} ({quote.technician_review_count})
                </span>
              ) : (
                <span>New Technician</span>
              )}
              {quote.technician_experience !== null && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {quote.technician_experience}y exp
                </span>
              )}
              {quote.technician_service_area && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {quote.technician_service_area}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right">
          <p className="text-2xl font-extrabold text-primary">
            {quote.amount !== null ? `Rs ${quote.amount}` : '—'}
          </p>
          <p className="text-xs text-ink/50">{new Date(quote.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Message */}
      {quote.message && (
        <p className="mt-3 rounded-xl bg-background p-3 text-sm text-ink/70">{quote.message}</p>
      )}

      {/* Actions */}
      {isPending && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={onAccept}
            disabled={accepting}
            className="btn-primary flex-1 text-sm"
          >
            {accepting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Accepting...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Accept Quote</>
            )}
          </button>
          <button className="btn-secondary text-sm" disabled>
            <XCircle className="h-4 w-4" /> Decline
          </button>
        </div>
      )}
      {quote.status === 'accepted' && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> This quote was accepted
        </div>
      )}
      {isRejected && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-error/10 p-3 text-sm text-error">
          <XCircle className="h-4 w-4" /> Declined
        </div>
      )}
    </div>
  )
}
