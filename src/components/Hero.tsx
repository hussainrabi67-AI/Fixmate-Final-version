import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Sparkles, Search, ShieldCheck } from 'lucide-react'
import ServiceImageLogo from './ServiceImageLogo'
import VoiceInputButton from './VoiceInputButton'

export default function Hero() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function handleAskAI() {
    if (query.trim()) {
      navigate(`/ai-assistant?prompt=${encodeURIComponent(query.trim())}`)
    } else {
      navigate('/ai-assistant')
    }
  }

  return (
    <section className="relative overflow-hidden">
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -left-24 h-72 w-72 rounded-full bg-primary-light blur-3xl" />

      <div className="section relative grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
        {/* left: copy + input */}
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-light px-4 py-1.5 text-sm font-medium text-primary-dark">
            <Sparkles className="h-4 w-4" /> AI-powered repair help
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            What's wrong? <br />
            We'll help you <span className="text-primary">fix it.</span>
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/65">
            Describe your problem in English or Urdu, get simple AI guidance, and find a trusted
            professional when you need one.
          </p>

          {/* AI input card */}
          <div className="mt-8 card p-5 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAskAI()
              }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3 ring-1 ring-primary/15 focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tell us what's wrong (e.g. AC leaking, واشنگ مشین خراب ہے)..."
                  className="w-full bg-transparent text-base text-ink placeholder:text-ink/40 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <VoiceInputButton
                  onTranscript={(text) => setQuery((prev) => (prev ? `${prev} ${text}` : text))}
                  language="both"
                  variant="button"
                  label="Speak (اردو / Eng)"
                  size="sm"
                />
                <Link to="/ai-assistant" className="btn-secondary text-sm">
                  <Camera className="h-4 w-4" /> Upload Photo
                </Link>
                <button
                  type="submit"
                  className="btn-primary ml-auto text-sm"
                >
                  <Sparkles className="h-4 w-4" /> Ask FixMate AI
                </button>
              </div>
            </form>
          </div>

          {/* Quick service chips with ServiceImageLogo */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-ink/50 uppercase tracking-wide mr-1">Popular:</span>
            {[
              { id: 'plumber', name: 'Plumbing' },
              { id: 'electrician', name: 'Electrical' },
              { id: 'ac', name: 'AC / HVAC' },
              { id: 'car', name: 'Car Workshop' },
              { id: 'cleaning', name: 'Cleaning' },
              { id: 'appliance', name: 'Appliances' },
            ].map((s) => (
              <Link
                key={s.id}
                to={`/technicians?category=${s.id}`}
                className="group inline-flex items-center gap-1.5 rounded-full bg-white/80 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-ink/75 ring-1 ring-primary/15 transition-all hover:bg-primary-light hover:text-primary hover:scale-105 shadow-xs"
              >
                <ServiceImageLogo name={s.name} size="xs" />
                <span>{s.name}</span>
              </Link>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/ai-assistant" className="btn-primary text-base">
              <Sparkles className="h-5 w-5" /> Ask FixMate AI
            </Link>
            <Link to="/technicians" className="btn-secondary text-base">
              <Search className="h-5 w-5" /> Find a Technician
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-ink/50">
            <ShieldCheck className="h-4 w-4 text-success" />
            Verified professionals & safe AI guidance
          </div>
        </div>

        {/* right: illustration */}
        <div className="relative hidden lg:block">
          <div className="animate-float card mx-auto flex max-w-md items-center justify-center p-10">
            <Illustration />
          </div>
        </div>
      </div>
    </section>
  )
}

function Illustration() {
  return (
    <svg viewBox="0 0 320 280" className="h-auto w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="160" cy="140" r="120" fill="#F3E8FF" />
      {/* robot head */}
      <rect x="110" y="70" width="100" height="90" rx="24" fill="#8B5CF6" />
      <rect x="110" y="70" width="100" height="90" rx="24" fill="url(#g)" fillOpacity="0.3" />
      <circle cx="140" cy="110" r="10" fill="#fff" />
      <circle cx="180" cy="110" r="10" fill="#fff" />
      <circle cx="140" cy="110" r="4" fill="#1F2937" />
      <circle cx="180" cy="110" r="4" fill="#1F2937" />
      <path d="M140 135 Q160 148 180 135" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* antenna */}
      <line x1="160" y1="70" x2="160" y2="48" stroke="#5B21B6" strokeWidth="5" strokeLinecap="round" />
      <circle cx="160" cy="42" r="8" fill="#22C55E" />
      {/* wrench */}
      <rect x="210" y="150" width="60" height="18" rx="9" fill="#F59E0B" transform="rotate(35 240 159)" />
      <rect x="60" y="150" width="60" height="18" rx="9" fill="#F59E0B" transform="rotate(-35 90 159)" />
      {/* base */}
      <rect x="120" y="170" width="80" height="50" rx="20" fill="#5B21B6" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
    </svg>
  )
}
