import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { serviceCategories } from '../data/serviceCategories'
import ServiceImageLogo from './ServiceImageLogo'

export default function ServiceCategories() {
  return (
    <section className="section py-16 sm:py-20">
      <div className="text-center">
        <p className="eyebrow">Browse Services</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          What do you need help with?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-ink/60">
          Pick a service category to find certified, background-checked professionals near you.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {serviceCategories.map((cat) => (
          <Link
            key={cat.id}
            to={`/technicians?category=${cat.id}`}
            className="group card flex flex-col items-center gap-3 p-5 text-center transition-all duration-200 hover:-translate-y-1.5 hover:shadow-lift hover:ring-primary/40"
          >
            <ServiceImageLogo
              id={cat.id}
              name={cat.name}
              icon={cat.emoji}
              gradient={cat.gradient}
              size="lg"
              className="group-hover:scale-110 group-hover:rotate-3"
            />
            <div>
              <p className="font-bold text-ink group-hover:text-primary transition-colors">{cat.name}</p>
              <p className="mt-0.5 text-xs text-ink/55 line-clamp-1">{cat.description}</p>
            </div>
            {cat.popularTags && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-ink/60">
                <CheckCircle2 className="h-2.5 w-2.5 text-primary" /> {cat.popularTags[0]}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link to="/services" className="btn-secondary text-sm">
          View All Services
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}
