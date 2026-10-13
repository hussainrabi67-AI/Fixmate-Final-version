import { Link } from 'react-router-dom'
import { ShieldCheck, Lock, Users, PhoneCall, Sparkles, ArrowRight, UserCheck } from 'lucide-react'

export default function VerifiedTechniciansSection() {
  return (
    <section className="section py-16 sm:py-20 bg-gradient-to-b from-slate-50/50 via-white to-slate-50/80">
      <div className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-primary-dark to-slate-900 p-8 sm:p-12 text-white shadow-lift">
          {/* Subtle ambient lighting decoration */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative z-10 grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>FixMate Verified Specialist Network</span>
              </div>

              <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                Connect directly with background-checked local technicians
              </h2>

              <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                Our certified directory features verified electricians, plumbers, AC specialists, carpenters, auto mechanics, and appliance experts. To protect technician privacy and guarantee authentic bookings, profile details and direct contact options are reserved for registered members.
              </p>

              {/* Value proposition badges */}
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-slate-200">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur-sm border border-white/10">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" /> Identity & License Verified
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur-sm border border-white/10">
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-400" /> Direct WhatsApp & In-App Access
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur-sm border border-white/10">
                  <Lock className="h-3.5 w-3.5 text-amber-400" /> Members-Only Directory
                </span>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-soft hover:bg-primary-dark transition-all hover:scale-105 shrink-0"
                >
                  <Sparkles className="h-4 w-4 text-yellow-300" />
                  <span>Register Free to Browse Technicians</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 py-3.5 text-sm font-bold text-white border border-white/20 hover:bg-white/25 transition-all shrink-0"
                >
                  <span>Already a member? Sign In</span>
                </Link>
              </div>
            </div>

            {/* Right illustration / graphic card */}
            <div className="hidden lg:block lg:col-span-4">
              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-md border border-white/15 text-center shadow-card">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/30 text-white border border-primary/40 shadow-soft">
                  <Lock className="h-8 w-8 text-amber-300" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">Registered Access</h3>
                <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                  Sign in to view technician ratings, skill certificates, exact locations, and approach them directly on WhatsApp.
                </p>
                <div className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> 100% Free Member Registration
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

