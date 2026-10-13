import { PenLine, Sparkles, Wrench } from 'lucide-react'

const steps = [
  {
    icon: PenLine,
    title: '1. Tell Us',
    text: 'Describe your problem using text, voice, or photo.',
    color: 'bg-primary',
  },
  {
    icon: Sparkles,
    title: '2. Get AI Help',
    text: 'FixMate identifies the likely problem and gives safe guidance.',
    color: 'bg-success',
  },
  {
    icon: Wrench,
    title: '3. Get a Professional',
    text: 'If needed, find a verified local technician and request service.',
    color: 'bg-warning',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-primary-light/30 py-16 sm:py-20">
      <div className="section">
        <div className="text-center">
          <p className="eyebrow">How It Works</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Fix it in 3 simple steps
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="card p-7 text-center transition-all hover:-translate-y-1 hover:shadow-lift">
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${step.color} text-white shadow-soft`}>
                  <Icon className="h-8 w-8" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-xl font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-base text-ink/60">{step.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
