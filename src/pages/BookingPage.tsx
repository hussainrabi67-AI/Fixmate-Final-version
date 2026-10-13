import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import {
  Loader2, AlertCircle, ArrowLeft, CheckCircle2, Star, MapPin,
  Clock, Calendar, Wrench, Camera, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchBookingById, updateBookingStatus, updateBookingScheduledAt,
  fetchReviewForBooking, createReview,
} from '../lib/jobService'
import { fetchOwnTechnicianRecord } from '../lib/technicianService'
import {
  BOOKING_STEPS, BOOKING_STATUS_LABELS,
} from '../types/job'
import type { BookingWithDetails, BookingReview } from '../types/job'
import ServiceImageLogo from '../components/ServiceImageLogo'

export default function BookingPage() {
  const { id } = useParams<{ id: string }>()
  const { session, profile, loading: authLoading } = useAuth()

  const [booking, setBooking] = useState<BookingWithDetails | null>(null)
  const [review, setReview] = useState<BookingReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isTechnician, setIsTechnician] = useState(false)
  const [isCustomer, setIsCustomer] = useState(false)
  const [techId, setTechId] = useState<string | null>(null)

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')

  // Schedule form
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleLocation, setScheduleLocation] = useState('')

  // Review form
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      try {
        const [b, r] = await Promise.all([
          fetchBookingById(id!),
          fetchReviewForBooking(id!),
        ])
        if (!cancelled) {
          setBooking(b)
          setReview(r)
          if (b) {
            setScheduleLocation(b.location || '')
            if (b.scheduled_at) {
              setScheduleDate(new Date(b.scheduled_at).toISOString().slice(0, 16))
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load booking.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  // Determine if current user is the technician or customer for this booking
  useEffect(() => {
    async function checkUserAccess() {
      if (!booking) return
      const effectiveUserId = profile?.user_id || session?.user?.id || profile?.id

      if (profile?.role === 'technician') {
        const tech = await fetchOwnTechnicianRecord(profile.id || profile.user_id || session?.user.id || '')
        if (tech && tech.id === booking.technician_id) {
          setIsTechnician(true)
          setTechId(tech.id)
        }
      }

      if (
        effectiveUserId === booking.user_id ||
        session?.user?.id === booking.user_id ||
        profile?.user_id === booking.user_id ||
        profile?.id === booking.user_id
      ) {
        setIsCustomer(true)
      }

      if (profile?.role === 'admin') {
        setIsCustomer(true)
      }
    }
    checkUserAccess()
  }, [profile, booking, session])

  if (authLoading || loading) {
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
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </div>
    )
  }

  if (!booking) return <Navigate to="/dashboard" replace />

  const isCancelled = booking.status === 'cancelled'
  const isCompleted = booking.status === 'completed'
  const currentStepIndex = BOOKING_STEPS.indexOf(booking.status as typeof BOOKING_STEPS[number])

  // Allowed next statuses for technician
  const nextStatusOptions: { value: string; label: string }[] = []
  if (isTechnician && !isCancelled && !isCompleted) {
    const transitions: Record<string, string[]> = {
      accepted: ['in_progress', 'scheduled', 'completed', 'cancelled'],
      scheduled: ['in_progress', 'completed', 'cancelled'],
      on_the_way: ['in_progress', 'completed', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
    }
    const allowed = transitions[booking.status] || []
    for (const s of allowed) {
      if (s !== 'cancelled') {
        nextStatusOptions.push({
          value: s,
          label: s === 'completed' ? 'Accomplish & Complete Job' : s === 'in_progress' ? 'Start Job (In Progress)' : BOOKING_STATUS_LABELS[s],
        })
      }
    }
  }

  async function handleStatusUpdate(newStatus: string) {
    setUpdatingStatus(true)
    setStatusError('')
    try {
      await updateBookingStatus(booking!.id, newStatus)
      const updated = await fetchBookingById(booking!.id)
      setBooking(updated)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not update status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleSchedule() {
    if (!scheduleDate) {
      setStatusError('Please select a date and time.')
      return
    }
    setUpdatingStatus(true)
    setStatusError('')
    try {
      await updateBookingScheduledAt(booking!.id, new Date(scheduleDate).toISOString(), scheduleLocation)
      const updated = await fetchBookingById(booking!.id)
      setBooking(updated)
      setShowSchedule(false)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not schedule booking.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleSubmitReview() {
    if (!session || !booking) return
    setSubmittingReview(true)
    setReviewError('')

    try {
      await createReview({
        bookingId: booking.id,
        userId: session.user.id,
        technicianId: booking.technician_id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      })
      setReviewSuccess(true)
      const r = await fetchReviewForBooking(booking.id)
      setReview(r)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not submit review.')
    } finally {
      setSubmittingReview(false)
    }
  }

  return (
    <div className="section py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          to={isTechnician ? '/technician' : '/dashboard'}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* Booking header */}
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <ServiceImageLogo name={booking.request_category_name || 'Booking'} icon={booking.request_category_icon} size="md" />
              <div>
                <h1 className="text-xl font-bold text-ink">{booking.request_category_name || 'Booking'}</h1>
                <p className="mt-1 text-sm text-ink/60">{booking.request_title || booking.request_description || 'Service booking'}</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
              isCompleted ? 'bg-success/10 text-success' :
              isCancelled ? 'bg-error/10 text-error' :
              'bg-primary-light text-primary-dark'
            }`}>
              {BOOKING_STATUS_LABELS[booking.status] || booking.status}
            </span>
          </div>

          {/* Problem photo */}
          {booking.request_image && (
            <img src={booking.request_image} alt="Problem" className="mt-4 h-32 w-full max-w-xs rounded-2xl object-cover ring-1 ring-primary/10" />
          )}

          {/* Details grid */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Technician</p>
              <p className="mt-1 font-semibold text-ink">{booking.technician_name || 'Technician'}</p>
              <p className="text-sm text-ink/60">{booking.technician_profession || ''}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Quote Amount</p>
              <p className="mt-1 text-lg font-bold text-primary">
                {booking.quote_amount !== null ? `Rs ${booking.quote_amount}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Scheduled
              </p>
              <p className="mt-1 text-sm text-ink/80">
                {booking.scheduled_at
                  ? new Date(booking.scheduled_at).toLocaleString()
                  : 'Not yet scheduled'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Location
              </p>
              <p className="mt-1 text-sm text-ink/80">{booking.location || 'Not specified'}</p>
            </div>
          </div>

          {/* Notes / quote message */}
          {booking.quote_message && (
            <div className="mt-4 rounded-xl bg-background p-3">
              <p className="text-xs font-semibold text-ink/50">Technician's Note</p>
              <p className="mt-1 text-sm text-ink/70">{booking.quote_message}</p>
            </div>
          )}
        </div>

        {/* Progress tracker */}
        {!isCancelled && (
          <div className="card mt-6 p-6">
            <h2 className="text-lg font-bold text-ink">Job Progress</h2>
            <div className="mt-4 space-y-1">
              {BOOKING_STEPS.map((step, idx) => {
                const isDone = idx < currentStepIndex
                const isCurrent = idx === currentStepIndex
                const isFuture = idx > currentStepIndex

                return (
                  <div key={step} className="flex items-center gap-3">
                    {/* Circle */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isDone ? 'bg-success text-white' :
                      isCurrent ? 'bg-primary text-white ring-4 ring-primary/20' :
                      'bg-background text-ink/30 ring-1 ring-primary/10'
                    }`}>
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isCurrent ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-white" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-ink/20" />
                      )}
                    </div>
                    {/* Label */}
                    <span className={`text-sm font-medium ${
                      isDone ? 'text-ink/60' :
                      isCurrent ? 'text-ink' :
                      'text-ink/40'
                    }`}>
                      {BOOKING_STATUS_LABELS[step]}
                    </span>
                    {/* Line */}
                    {idx < BOOKING_STEPS.length - 1 && (
                      <div className={`ml-4 h-0.5 flex-1 ${isDone ? 'bg-success' : 'bg-primary/10'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="card mt-6 p-6 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-error" />
            <p className="mt-3 font-semibold text-ink">This booking was cancelled.</p>
          </div>
        )}

        {/* Technician controls */}
        {isTechnician && !isCancelled && !isCompleted && (
          <div className="card mt-6 p-6">
            <h2 className="text-lg font-bold text-ink">Update Job Status</h2>
            {statusError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-error/10 p-3 text-sm text-error">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            {/* Schedule form for accepted → scheduled */}
            {booking.status === 'accepted' && (
              <div className="mt-4">
                {showSchedule ? (
                  <div className="space-y-3 rounded-2xl bg-primary-light/30 p-4">
                    <label className="block">
                      <span className="text-sm font-medium text-ink/70">Schedule Date & Time</span>
                      <input
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="mt-1.5 w-full rounded-xl bg-background px-4 py-2.5 text-base text-ink ring-1 ring-primary/15 focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-ink/70">Location</span>
                      <input
                        value={scheduleLocation}
                        onChange={(e) => setScheduleLocation(e.target.value)}
                        placeholder="Service location"
                        className="mt-1.5 w-full rounded-xl bg-background px-4 py-2.5 text-base text-ink ring-1 ring-primary/15 focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button onClick={handleSchedule} disabled={updatingStatus} className="btn-primary flex-1 text-sm">
                        {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Schedule'}
                      </button>
                      <button onClick={() => setShowSchedule(false)} className="btn-secondary text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowSchedule(true)} className="btn-secondary text-xs">
                      <Calendar className="h-4 w-4" /> Set Visit Schedule
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Status advance buttons */}
            {nextStatusOptions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {nextStatusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusUpdate(opt.value)}
                    disabled={updatingStatus}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-soft ${
                      opt.value === 'completed'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : opt.value === 'in_progress'
                        ? 'bg-primary text-white hover:bg-primary-dark'
                        : 'bg-slate-100 text-ink hover:bg-slate-200'
                    }`}
                  >
                    {updatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Review section (customer only, after completion) */}
        {isCustomer && isCompleted && (
          <div className="card mt-6 p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <MessageSquare className="h-5 w-5 text-primary" /> Review
            </h2>

            {reviewSuccess || review ? (
              <div className="mt-4 rounded-2xl bg-success/10 p-5 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <p className="mt-2 font-semibold text-ink">Thank you for your review!</p>
                {review && (
                  <div className="mt-3">
                    <div className="flex items-center justify-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-ink/20'}`}
                        />
                      ))}
                    </div>
                    {review.comment && <p className="mt-2 text-sm text-ink/70">{review.comment}</p>}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-ink/60">How was your experience with {booking.technician_name}?</p>
                {reviewError && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-error/10 p-3 text-sm text-error">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{reviewError}</span>
                  </div>
                )}
                <div className="mt-3">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setReviewRating(i + 1)}
                        className="p-1"
                      >
                        <Star
                          className={`h-7 w-7 transition-colors ${
                            i < reviewRating ? 'text-amber-400 fill-amber-400' : 'text-ink/20 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-ink/70">Comment (optional)</span>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience..."
                    rows={3}
                    className="mt-1.5 w-full resize-none rounded-xl bg-background px-4 py-2.5 text-base text-ink ring-1 ring-primary/15 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </label>
                <button
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="btn-primary mt-4 w-full"
                >
                  {submittingReview ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</>
                  ) : (
                    <><Star className="h-5 w-5" /> Submit Review</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Not authorized */}
        {!isTechnician && !isCustomer && (
          <div className="card mt-6 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-ink/40" />
            <p className="mt-2 text-sm text-ink/60">You don't have access to this booking.</p>
          </div>
        )}
      </div>
    </div>
  )
}
