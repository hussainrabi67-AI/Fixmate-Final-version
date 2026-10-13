import { Link } from 'react-router-dom'
import { User, Sparkles, Wrench, ShieldAlert, ArrowRight } from 'lucide-react'

export default function AISection() {
  return (
    <section className="section py-16 sm:py-20">
      <div className="text-center">
        <p className="eyebrow">FixMate AI</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Don't know which technician you need?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-ink/60">
          Just tell FixMate what happened.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-2xl space-y-4">
        {/* user message */}
        <div className="flex justify-end">
          <div className="flex max-w-[85%] items-start gap-3 rounded-3xl rounded-tr-md bg-primary px-5 py-4 text-white shadow-soft">
            <User className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
            <p className="text-base">My AC is running but it isn't cooling.</p>
          </div>
        </div>

        {/* AI message */}
        <div className="flex justify-start">
          <div className="max-w-[90%] rounded-3xl rounded-tl-md bg-white p-5 shadow-card ring-1 ring-primary/5">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">FixMate AI</span>
            </div>

            <div className="mt-4 space-y-4 text-left">
              <p className="text-base text-ink">
                <span className="font-semibold">Possible problem:</span> AC cooling issue
              </p>

              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">
                  Try first
                </p>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2 text-base text-ink/80">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    Check the air filter.
                  </li>
                  <li className="flex items-start gap-2 text-base text-ink/80">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    Make sure airflow is not blocked.
                  </li>
                </ul>
              </div>

              <div className="flex items-start gap-2 rounded-2xl bg-warning/10 p-3 text-base text-ink/80">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <p>
                  <span className="font-semibold">Safety:</span> Do not open the refrigerant or
                  electrical system yourself.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* follow-up CTA */}
        <div className="rounded-3xl bg-primary-light/60 p-5 text-center">
          <p className="text-lg font-semibold text-ink">Still need help?</p>
          <Link
            to="/services"
            className="btn-primary mt-3"
          >
            <Wrench className="h-5 w-5" /> Find an AC Technician
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
