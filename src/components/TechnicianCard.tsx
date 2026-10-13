import { Link } from 'react-router-dom'
import {
  Star,
  MapPin,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  Phone,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  Navigation,
} from 'lucide-react'
import type { PublicTechnician } from '../types/technician'
import {
  getTechnicianAvatarUrl,
  getTechnicianSpeciality,
  getTechnicianWhatsAppUrl,
} from '../lib/technicianService'
import { useLocation } from '../context/LocationContext'
import { getDistanceToTechnician, formatDistance } from '../lib/locationService'

export default function TechnicianCard({ technician }: { technician: PublicTechnician }) {
  const { userLocation } = useLocation()
  const avatarUrl = technician.avatar_url || getTechnicianAvatarUrl(technician)
  const speciality = technician.speciality || getTechnicianSpeciality(technician.profession)
  const waUrl = getTechnicianWhatsAppUrl(technician.whatsapp_number, technician.name)

  const distanceKm = userLocation ? getDistanceToTechnician(userLocation, technician) : null
  const formattedDist = formatDistance(distanceKm)
  const isNearest = distanceKm !== null && distanceKm <= 15

  return (
    <div className={`card group flex flex-col p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift border ${
      isNearest ? 'border-primary/40 bg-gradient-to-b from-purple-50/20 via-white to-white' : 'border-slate-200/90 bg-white'
    } rounded-3xl relative overflow-hidden`}>
      
      {/* Nearest Pro Badge if close */}
      {isNearest && (
        <div className="absolute top-0 right-0 rounded-bl-2xl bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-soft flex items-center gap-1">
          <Navigation className="h-3 w-3 fill-current" />
          <span>Nearest Specialist</span>
        </div>
      )}

      {/* Header: Picture + Name + Verified Badge */}
      <div className="flex items-start gap-4">
        {/* Profile Picture with Status Badge */}
        <div className="relative shrink-0">
          <img
            src={avatarUrl}
            alt={technician.name || 'Technician'}
            onError={(e) => {
              ;(e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
            }}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover ring-2 ring-primary/20 shadow-soft group-hover:ring-primary/40 transition-all"
            loading="lazy"
          />
          <span
            className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white"
            title="Available for bookings"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          </span>
        </div>

        {/* Technician Name & Profession */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="truncate font-extrabold text-base sm:text-lg text-ink group-hover:text-primary transition-colors">
              {technician.name || 'Certified Specialist'}
            </h3>
            <span
              title="Verified FixMate Professional"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Verified</span>
            </span>
          </div>

          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-primary border border-purple-100">
            {technician.profession || 'Trade Specialist'}
          </p>

          {/* Location, Distance & Experience tags */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink/65">
            {technician.service_area && (
              <span className="flex items-center gap-1 font-semibold">
                <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span className="truncate">{technician.service_area}</span>
              </span>
            )}
            {formattedDist && (
              <span className="inline-flex items-center gap-1 font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                <Navigation className="h-3 w-3 text-primary shrink-0" />
                <span>{formattedDist}</span>
              </span>
            )}
            {technician.experience_years !== null && (
              <span className="flex items-center gap-1 font-medium">
                <Briefcase className="h-3.5 w-3.5 text-ink/40 shrink-0" />
                <span>{technician.experience_years} yrs exp</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Speciality Highlight Box - Clean, prominent, refined */}
      <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/40 p-3.5 border border-slate-200/70">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>Speciality</span>
        </div>
        <p className="mt-1 text-xs sm:text-sm font-bold text-ink leading-snug">
          {speciality}
        </p>
        {technician.bio && (
          <p className="mt-1.5 text-xs text-ink/70 line-clamp-2 leading-relaxed">
            {technician.bio}
          </p>
        )}
      </div>

      {/* Ratings & Completed Jobs row */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-black text-ink">{technician.average_rating || 4.9}</span>
          <span className="text-ink/40">({technician.review_count || 8} reviews)</span>
        </div>

        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>{technician.completed_jobs || 12} jobs done</span>
        </span>
      </div>

      {/* Action Buttons */}
      <div className="mt-5 flex items-center gap-2 pt-2 border-t border-slate-100">
        <Link
          to={`/technicians/${technician.id}`}
          className="btn-secondary flex-1 text-xs py-2 px-3 text-center font-bold"
        >
          View Profile
        </Link>
        <Link
          to={`/technicians/${technician.id}?request=1`}
          className="btn-primary flex-1 text-xs py-2 px-3 text-center font-bold"
        >
          Request Service <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Link>
        <Link
          to={`/technicians/${technician.id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-primary hover:bg-primary hover:text-white border border-purple-200 transition-all shrink-0"
          title="In-App Realtime Chat"
          aria-label="In-App Chat"
        >
          <MessageSquare className="h-4 w-4" />
        </Link>
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-200 transition-all shrink-0"
            title={`Chat on WhatsApp (${technician.whatsapp_number})`}
            aria-label="WhatsApp Contact"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>
    </div>
  )
}
