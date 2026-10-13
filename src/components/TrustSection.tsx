import { BadgeCheck, Star, Lock, Bot, MessageCircle } from 'lucide-react'

const items = [
  { icon: BadgeCheck, title: 'Verified Professionals', desc: 'Every technician is identity-checked.' },
  { icon: Star, title: 'Customer Reviews', desc: 'Real ratings from real customers.' },
  { icon: Lock, title: 'Secure Accounts', desc: 'Your data stays protected.' },
  { icon: Bot, title: 'AI Assistance', desc: 'Smart guidance before you spend.' },
  { icon: MessageCircle, title: 'WhatsApp Notifications', desc: 'Coming soon.' },
]

export default function TrustSection() {
  return (
    <section className="section py-16 sm:py-20">
      <div className="text-center">
        <p className="eyebrow">Why FixMate</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Built on trust
        </h2>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.title} className="card p-5 text-center transition-all hover:shadow-lift">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-xs text-ink/55">{item.desc}</p>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-center text-xs text-ink/40">
        WhatsApp integration is coming soon — not yet connected.
      </p>
    </section>
  )
}
