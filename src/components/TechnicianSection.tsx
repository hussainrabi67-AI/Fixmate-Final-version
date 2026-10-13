import { Link } from 'react-router-dom'
import { Wrench, Users, Sparkles } from 'lucide-react'

export default function TechnicianSection() {
  return (
    <section className="section py-16 sm:py-20">
      <div className="card overflow-hidden p-8 sm:p-12">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">For Technicians</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Are you a skilled technician?
            </h2>
            <p className="mt-4 max-w-lg text-lg text-ink/60">
              Get more customers through FixMate. Create your professional profile and receive
              service requests.
            </p>

            <div className="mt-6 flex flex-wrap gap-4 text-sm text-ink/70">
              <span className="inline-flex items-center gap-2 rounded-xl bg-primary-light px-3 py-2 font-medium">
                <Users className="h-4 w-4 text-primary" /> Reach more customers
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-primary-light px-3 py-2 font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> Free customer access
              </span>
            </div>

            <Link to="/technician/register" className="btn-primary mt-8">
              <Wrench className="h-5 w-5" /> Join as a Technician
            </Link>
          </div>

          <div className="hidden lg:block">
            <div className="mx-auto flex max-w-xs items-center justify-center rounded-4xl bg-gradient-to-br from-primary to-primary-dark p-10 text-white shadow-lift">
              <div className="text-center">
                <Wrench className="mx-auto h-20 w-20" strokeWidth={1.5} />
                <p className="mt-4 text-xl font-bold">Grow your business</p>
                <p className="mt-1 text-sm text-white/70">with FixMate</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
