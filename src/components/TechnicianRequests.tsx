import { useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, MapPin, Clock, Camera, Sparkles,
  CheckCircle2, XCircle, Send, Wrench, User, Phone, MessageSquare,
} from 'lucide-react'
import {
  fetchRequestsForTechnician, createQuote, rejectRequestByTechnician,
  fetchQuotesByTechnician, acceptRequestDirectly,
} from '../lib/jobService'
import {
  REQUEST_STATUS_LABELS,
} from '../types/job'
import type { ServiceRequestWithCategory } from '../types/job'
import ServiceImageLogo from './ServiceImageLogo'

interface TechnicianRequestsProps {
  technicianId: string
  onJobAccepted?: () => void
}

export default function TechnicianRequests({ technicianId, onJobAccepted }: TechnicianRequestsProps) {
  const [requests, setRequests] = useState<ServiceRequestWithCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quoteFormFor, setQuoteFormFor] = useState<string | null>(null)
  const [quoteAmount, setQuoteAmount] = useState('')
  const [quoteMessage, setQuoteMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  useEffect(() => {
    loadRequests()
  }, [technicianId])

  async function loadRequests() {
    setLoading(true)
    setError('')
    try {
      const [reqs, myQuotes] = await Promise.all([
        fetchRequestsForTechnician(technicianId),
        fetchQuotesByTechnician(technicianId),
      ])

      // Mark requests we already quoted/rejected
      const quotedRequestIds = new Set(myQuotes.map((q) => q.request_id))
      const quotedMap = new Map(myQuotes.map((q) => [q.request_id, q.status]))

      setRequests(reqs.map((r) => ({
        ...r,
        // Use status field to carry our quote status if we already quoted
        _myQuoteStatus: quotedMap.get(r.id) ?? null,
      } as ServiceRequestWithCategory & { _myQuoteStatus: string | null })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load requests.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendQuote() {
    if (!quoteFormFor) return
    setSubmitting(true)
    setActionError('')
    setActionSuccess('')

    try {
      const amount = parseFloat(quoteAmount)
      if (isNaN(amount) || amount < 0) {
        throw new Error('Please enter a valid amount.')
      }

      await createQuote({
        requestId: quoteFormFor,
        technicianId,
        amount,
        message: quoteMessage.trim(),
      })

      setActionSuccess('Quote sent successfully!')
      setQuoteFormFor(null)
      setQuoteAmount('')
      setQuoteMessage('')
      setTimeout(() => setActionSuccess(''), 3000)
      await loadRequests()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not send quote.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAcceptDirectly(requestId: string) {
    setSubmitting(true)
    setActionError('')
    try {
      await acceptRequestDirectly({
        requestId,
        technicianId,
        amount: 1500,
        message: 'Accepted by technician. I will contact you to coordinate the visit.',
      })
      setActionSuccess('Service request accepted! Job has been added to your Assigned Jobs.')
      setTimeout(() => setActionSuccess(''), 4000)
      await loadRequests()
      if (onJobAccepted) {
        setTimeout(onJobAccepted, 1200)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not accept request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject(requestId: string) {
    setSubmitting(true)
    setActionError('')
    try {
      await rejectRequestByTechnician(requestId, technicianId)
      setActionSuccess('Request rejected.')
      setTimeout(() => setActionSuccess(''), 3000)
      await loadRequests()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reject request.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-error/10 p-4 text-sm text-error">
        <AlertCircle className="mb-2 h-5 w-5" />
        {error}
      </div>
    )
  }

  return (
    <div>
      {actionError && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl bg-error/10 p-3 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-2xl bg-primary-light/30 p-6 text-center">
          <Wrench className="mx-auto h-10 w-10 text-primary/40" />
          <p className="mt-3 text-sm text-ink/50">
            No service requests matching your categories yet.
            Select more services in your profile to receive more requests.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const extended = req as ServiceRequestWithCategory & { _myQuoteStatus: string | null }
            const alreadyQuoted = extended._myQuoteStatus !== null
            const isDirectTarget = (req.description || '').includes('TechID:') || (req.description || '').includes('Direct Request')
            const displayDesc = (req.description || '').replace(/^\[Direct Request for [^\]]+\]\s*/, '')

            return (
              <div key={req.id} className={`card p-5 transition-all ${isDirectTarget ? 'ring-2 ring-primary/40 bg-purple-50/20' : ''}`}>
                {/* Direct Targeted Badge */}
                {isDirectTarget && (
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1 text-[11px] font-black text-white shadow-soft">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>⚡ Direct Service Request for You</span>
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ServiceImageLogo name={req.category_name || 'Service'} icon={req.category_icon} size="sm" />
                    <div>
                      <span className="font-bold text-sm text-ink">{req.category_name || 'Service'}</span>
                      {req.location && (
                        <p className="text-[11px] text-ink/50 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {req.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    req.status === 'requested' ? 'bg-primary-light text-primary-dark' :
                    req.status === 'quoted' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-ink/60'
                  }`}>
                    {REQUEST_STATUS_LABELS[req.status] || req.status}
                  </span>
                </div>

                {/* Description */}
                {displayDesc && (
                  <p className="mt-3 text-sm text-ink/80 font-medium">{displayDesc}</p>
                )}

                {/* AI diagnosis summary */}
                {req.diagnosis_summary && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary-light/30 p-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-semibold text-ink/60">AI Diagnosis</p>
                      <p className="text-sm text-ink/70">{req.diagnosis_summary}</p>
                    </div>
                  </div>
                )}

                {/* Photo */}
                {req.image_url && (
                  <div className="mt-3">
                    <img
                      src={req.image_url}
                      alt="Problem"
                      className="h-20 w-20 rounded-xl object-cover ring-1 ring-primary/10"
                    />
                  </div>
                )}

                {/* Meta & Customer Info */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink/60">
                  {req.customer_name && (
                    <span className="flex items-center gap-1 font-semibold text-ink/80 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <User className="h-3.5 w-3.5 text-primary" /> {req.customer_name}
                    </span>
                  )}
                  {req.customer_phone && (
                    <a
                      href={`https://wa.me/${req.customer_phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                      title="Direct WhatsApp contact"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> {req.customer_phone}
                    </a>
                  )}
                  {req.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary/70" /> {req.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-ink/40">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-4 border-t border-primary/10 pt-4">
                  {alreadyQuoted ? (
                    <p className="flex items-center gap-2 text-sm text-ink/60 font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      You {extended._myQuoteStatus === 'rejected' ? 'disapproved / rejected' : 'quoted'} this request
                    </p>
                  ) : quoteFormFor === req.id ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-medium text-ink/70">Amount (Rs)</span>
                          <input
                            type="number"
                            value={quoteAmount}
                            onChange={(e) => setQuoteAmount(e.target.value)}
                            placeholder="0"
                            min="0"
                            className="mt-1.5 w-full rounded-xl bg-background px-4 py-2.5 text-base text-ink ring-1 ring-primary/15 focus:ring-2 focus:ring-primary focus:outline-none"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-sm font-medium text-ink/70">Message</span>
                        <textarea
                          value={quoteMessage}
                          onChange={(e) => setQuoteMessage(e.target.value)}
                          placeholder="Briefly describe what's included..."
                          rows={2}
                          className="mt-1.5 w-full resize-none rounded-xl bg-background px-4 py-2.5 text-base text-ink ring-1 ring-primary/15 focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSendQuote}
                          disabled={submitting}
                          className="btn-primary flex-1 text-sm"
                        >
                          {submitting ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                          ) : (
                            <><Send className="h-4 w-4" /> Send Quote</>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setQuoteFormFor(null)
                            setQuoteAmount('')
                            setQuoteMessage('')
                          }}
                          className="btn-secondary text-sm"
                          disabled={submitting}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleAcceptDirectly(req.id)}
                        disabled={submitting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-emerald-700 transition-all flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve Request
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={submitting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white transition-all"
                      >
                        <XCircle className="h-4 w-4" /> Disapprove
                      </button>
                      <button
                        onClick={() => setQuoteFormFor(req.id)}
                        disabled={submitting}
                        className="btn-secondary text-xs !py-2.5"
                      >
                        <Send className="h-4 w-4" /> Custom Quote
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
