import { useEffect, useState, useRef } from 'react'
import { Link, useParams, useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import {
  Star, MapPin, Briefcase, CheckCircle2, Wrench, ArrowLeft, ArrowRight,
  Loader2, AlertCircle, MessageSquare, CheckCircle, Phone, Camera, X,
  Sparkles, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchTechnicianById, fetchReviewsForTechnician, getTechnicianAvatarUrl, getTechnicianSpeciality, getTechnicianWhatsAppUrl,
} from '../lib/technicianService'
import { createServiceRequest, uploadProblemImage } from '../lib/aiService'
import { sendServiceRequestToN8n } from '../lib/n8nService'
import { getOrCreateConversation } from '../lib/chatService'
import type { PublicTechnician, ReviewWithUser } from '../types/technician'
import ServiceImageLogo from '../components/ServiceImageLogo'
import VoiceInputButton from '../components/VoiceInputButton'

export default function TechnicianProfilePage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session } = useAuth()

  const [technician, setTechnician] = useState<PublicTechnician | null>(null)
  const [reviews, setReviews] = useState<ReviewWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [requestError, setRequestError] = useState('')

  async function handleStartChat() {
    if (!session) {
      navigate('/login')
      return
    }
    if (!technician?.id) return
    setStartingChat(true)
    try {
      const conv = await getOrCreateConversation({
        customerId: session.user.id,
        technicianId: technician.id,
      })
      if (conv) {
        navigate(`/dashboard?tab=messages&convId=${conv.id}`)
      } else {
        navigate('/dashboard?tab=messages')
      }
    } catch {
      navigate('/dashboard?tab=messages')
    } finally {
      setStartingChat(false)
    }
  }

  const [requestNotes, setRequestNotes] = useState('')
  const [requestPhoto, setRequestPhoto] = useState<File | null>(null)
  const [requestPhotoPreview, setRequestPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const showRequestForm = searchParams.get('request') === '1'

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        const [tech, revs] = await Promise.all([
          fetchTechnicianById(id!),
          fetchReviewsForTechnician(id!),
        ])
        if (!cancelled) {
          setTechnician(tech)
          setReviews(revs)
          if (tech?.name) {
            document.title = `${tech.name} - ${tech.profession || 'Verified Specialist'} | FixMate`
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this profile.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  async function handleRequestService() {
    if (!session || !technician) return
    setRequesting(true)
    setRequestError('')

    try {
      let uploadedImgUrl: string | null = null
      if (requestPhoto) {
        try {
          uploadedImgUrl = await uploadProblemImage(requestPhoto, session.user.id)
        } catch {}
      }

      const firstService = technician.services[0]
      const desc = requestNotes.trim() || `Direct service request for ${technician.profession || technician.name || 'technician'}`
      const requestId = await createServiceRequest({
        userId: session.user.id,
        description: desc,
        categoryId: firstService?.id ?? null,
        imageUrl: uploadedImgUrl,
        location: technician.service_area || null,
        targetTechnicianId: technician.id,
      })

      if (!requestId) {
        throw new Error('Could not create your service request. Please try again.')
      }

      // Trigger n8n webhook (non-blocking)
      sendServiceRequestToN8n({
        request_id: requestId,
        user_id: session.user.id,
        category_id: firstService?.id ?? null,
        category_name: firstService?.name ?? technician.profession ?? null,
        title: desc.slice(0, 80),
        description: desc,
        location: technician.service_area || null,
        urgency: 'medium',
        professional_required: true,
      })

      setRequestSuccess(true)
      setRequestNotes('')
      setRequestPhoto(null)
      setRequestPhotoPreview(null)
      setSearchParams({})
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setRequesting(false)
    }
  }

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
          <Link to="/technicians" className="btn-secondary mt-4">
            <ArrowLeft className="h-4 w-4" /> Back to technicians
          </Link>
        </div>
      </div>
    )
  }

  if (!technician) {
    return <Navigate to="/technicians" replace />
  }

  const initials = (technician.name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const avatarUrl = technician.avatar_url || getTechnicianAvatarUrl(technician)
  const speciality = technician.speciality || getTechnicianSpeciality(technician.profession)
  const waUrl = getTechnicianWhatsAppUrl(technician.whatsapp_number, technician.name)

  return (
    <div className="section py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/technicians" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to technicians
        </Link>

        {/* Profile header */}
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <img
                src={avatarUrl}
                alt={technician.name || 'Technician'}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
                }}
                className="h-24 w-24 rounded-3xl object-cover ring-2 ring-primary/20 shadow-soft"
              />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              </span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">{technician.name || 'Technician'}</h1>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-primary border border-purple-100">
                  {technician.profession || 'Specialist'}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink/80">{speciality}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink/70">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-ink">{technician.average_rating || 4.9}</span>
                  <span className="text-ink/50">({technician.review_count || 8} reviews)</span>
                </span>
                {technician.experience_years !== null && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4 text-ink/40" />
                    {technician.experience_years} years experience
                  </span>
                )}
                {technician.service_area && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-rose-500" />
                    {technician.service_area}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all shadow-soft"
                  title="Chat directly on WhatsApp"
                >
                  <Phone className="h-4 w-4" />
                  <span>WhatsApp ({technician.whatsapp_number})</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleStartChat}
                disabled={startingChat}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary-dark transition-all shadow-soft disabled:opacity-50"
              >
                {startingChat ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                <span>In-App Realtime Chat</span>
              </button>
            </div>
          </div>

          {/* Speciality and Bio */}
          <div className="mt-6 rounded-3xl bg-gradient-to-br from-slate-50 to-purple-50/40 p-5 border border-slate-200/80 shadow-soft">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary">
              <Sparkles className="h-4 w-4" />
              <span>Verified Trade Speciality</span>
            </div>
            <p className="mt-1.5 text-base font-extrabold text-ink leading-snug">{speciality}</p>
            {technician.bio && (
              <p className="mt-2 text-sm text-ink/75 leading-relaxed">{technician.bio}</p>
            )}
          </div>

          {/* Services */}
          {technician.services.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Services Offered</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {technician.services.map((s) => (
                  <Link
                    key={s.id}
                    to={`/technicians?category=${s.id}`}
                    className="group inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-sm font-semibold text-ink/80 ring-1 ring-primary/15 transition-all hover:bg-primary-light hover:text-primary hover:shadow-soft"
                  >
                    <ServiceImageLogo name={s.name} icon={s.icon} size="xs" />
                    <span>{s.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Completed jobs */}
          {technician.completed_jobs > 0 && (
            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-primary-light/40 p-3">
              <Wrench className="h-5 w-5 text-primary" />
              <p className="text-sm text-ink/80">
                <span className="font-semibold">{technician.completed_jobs}</span> completed job{technician.completed_jobs !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="mt-6 border-t border-primary/10 pt-6">
            {requestSuccess ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-success/10 p-5 text-center">
                <CheckCircle className="h-10 w-10 text-success" />
                <p className="font-semibold text-ink">Service request submitted!</p>
                <p className="text-sm text-ink/60">Your request has been created. You can track it from your dashboard.</p>
                <Link to="/dashboard" className="btn-primary">
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : !session ? (
              <div className="rounded-2xl bg-primary-light/40 p-4 text-center">
                <p className="text-sm text-ink/70">Log in to request this technician's service.</p>
                <Link to="/login" className="btn-primary mt-3">
                  Login to Continue
                </Link>
              </div>
            ) : (
              <div>
                {requestError && (
                  <div className="mb-3 flex items-start gap-2 rounded-2xl bg-error/10 p-3 text-sm text-error">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{requestError}</span>
                  </div>
                )}
                {showRequestForm ? (
                  <div className="rounded-2xl bg-primary-light/30 p-5 space-y-3">
                    <p className="font-semibold text-ink">Request Service from {technician.name || 'this Specialist'}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-ink/60">
                        Describe the repair needed or dictate by voice:
                      </p>
                      <VoiceInputButton
                        onTranscript={(text) => setRequestNotes((prev) => (prev ? `${prev} ${text}` : text))}
                        language="both"
                        variant="button"
                        label="Dictate Issue (بولیں)"
                        size="sm"
                      />
                    </div>
                    <div>
                      <textarea
                        value={requestNotes}
                        onChange={(e) => setRequestNotes(e.target.value)}
                        placeholder="e.g. Need help fixing my kitchen cabinet door / AC cooling issue (English or Urdu)..."
                        rows={3}
                        className="w-full resize-none rounded-xl bg-white px-3.5 py-2.5 text-xs text-ink ring-1 ring-primary/20 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    {/* Photo preview */}
                    {requestPhotoPreview && (
                      <div className="relative inline-block">
                        <img src={requestPhotoPreview} alt="Preview" className="h-16 w-16 rounded-xl object-cover ring-1 ring-primary" />
                        <button
                          type="button"
                          onClick={() => {
                            setRequestPhoto(null)
                            setRequestPhotoPreview(null)
                          }}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setRequestPhoto(file)
                            setRequestPhotoPreview(URL.createObjectURL(file))
                          }
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-ink/70 ring-1 ring-primary/20 hover:bg-slate-50"
                      >
                        <Camera className="h-3.5 w-3.5 text-primary" />
                        <span>{requestPhoto ? 'Change Photo' : 'Attach Photo'}</span>
                      </button>
                    </div>
                    <div className="mt-4 flex gap-2 pt-2 border-t border-primary/10">
                      <button
                        onClick={handleRequestService}
                        disabled={requesting}
                        className="btn-primary flex-1 text-xs"
                      >
                        {requesting ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                        ) : (
                          <><Wrench className="h-4 w-4" /> Send Request to {technician.name || 'Technician'}</>
                        )}
                      </button>
                      <button
                        onClick={() => setSearchParams({})}
                        className="btn-secondary text-xs"
                        disabled={requesting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSearchParams({ request: '1' })}
                    className="btn-primary w-full"
                  >
                    <Wrench className="h-5 w-5" /> Request Service
                  </button>
                )}
              </div>
            )}

            {waUrl && (
              <div className="mt-3">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-soft hover:bg-emerald-700 transition-colors w-full"
                >
                  <Phone className="h-4 w-4" />
                  <span>Chat directly on WhatsApp ({technician.whatsapp_number})</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-8">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
            <MessageSquare className="h-5 w-5 text-primary" /> Reviews
          </h2>

          {reviews.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-primary-light/30 p-6 text-center">
              <p className="text-sm text-ink/50">No reviews yet. This technician is new to FixMate.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-ink">{review.user_name || 'Customer'}</p>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-ink/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-sm text-ink/70">{review.comment}</p>
                  )}
                  <p className="mt-2 text-xs text-ink/40">
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
