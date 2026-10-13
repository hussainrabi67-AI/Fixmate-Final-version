import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, Loader2, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { fetchServiceCategories } from '../lib/technicianService'
import type { ServiceCategoryDB } from '../types/technician'
import ServiceImageLogo from '../components/ServiceImageLogo'

export default function ServicesPage() {
  const [categories, setCategories] = useState<ServiceCategoryDB[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchServiceCategories()
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="section py-12 sm:py-16 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3.5 py-1.5 text-xs font-bold text-primary mb-3 shadow-soft">
          <ShieldCheck className="h-3.5 w-3.5" /> Verified FixMate Trades & Services
        </div>
        <h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl md:text-5xl">
          Expert Repair & Maintenance Services
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-ink/65">
          Browse certified professionals across all home, electrical, mechanical, and automotive specialties. Every technician is verified for safety and quality.
        </p>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((cat) => {
            const gradient = cat.gradient || 'from-primary via-primary-dark to-purple-800'
            const badgeClass = cat.badgeColor || 'bg-purple-50 text-purple-800 border-purple-200'

            return (
              <Link
                key={cat.id}
                to={`/technicians?category=${cat.id}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 transition-all duration-200 hover:-translate-y-1.5 hover:shadow-lift hover:ring-primary/40"
              >
                {/* Service Logo Container with Animated Gradient and High-res Icon */}
                <div className="flex items-start justify-between gap-3">
                  <ServiceImageLogo
                    id={cat.id}
                    name={cat.name}
                    icon={cat.icon}
                    gradient={gradient}
                    size="lg"
                    className="group-hover:scale-110 group-hover:rotate-3 shrink-0"
                  />
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${badgeClass}`}>
                    Verified
                  </span>
                </div>

                {/* Service Details */}
                <div className="mt-4 flex-1">
                  <h3 className="text-lg font-black text-ink group-hover:text-primary transition-colors">
                    {cat.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-ink/60 leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>

                  {/* Popular Tags */}
                  {cat.popularTags && cat.popularTags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {cat.popularTags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-ink/70"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5 text-primary" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-primary">
                  <span>Browse Technicians</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary-light text-primary transition-transform group-hover:translate-x-1">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* AI Assistant Banner */}
      <div className="mt-16 overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary-dark p-8 sm:p-10 text-white shadow-lift">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md mb-3">
              <Sparkles className="h-3.5 w-3.5 text-yellow-300" /> AI-Powered Repair Diagnosis
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">Not sure which service you need?</h2>
            <p className="mt-2 text-sm sm:text-base text-white/85">
              Chat with FixMate AI to diagnose the fault, review safe DIY steps, or instantly connect to the right specialized technician.
            </p>
          </div>
          <Link
            to="/ai-assistant"
            className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-primary shadow-soft transition-all hover:bg-slate-50 hover:scale-105 shrink-0"
          >
            <Sparkles className="h-4 w-4" />
            Launch AI Chatbot
          </Link>
        </div>
      </div>
    </div>
  )
}
