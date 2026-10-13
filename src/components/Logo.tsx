import { Link } from 'react-router-dom'
import { Wrench, Sparkles } from 'lucide-react'

export interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
}

export default function Logo({ className = 'items-start', size = 'md', showTagline = false }: LogoProps) {
  const iconSizes = {
    sm: 'h-8 w-8 rounded-xl',
    md: 'h-10 w-10 rounded-2xl',
    lg: 'h-12 w-12 rounded-2xl',
    xl: 'h-16 w-16 rounded-3xl',
  }

  const wrenchSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  }

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  }

  return (
    <Link to="/" className={`inline-flex flex-col items-start ${className}`}>
      <div className="group flex items-center gap-2.5 font-black tracking-tight">
        <span
          className={`relative flex items-center justify-center bg-gradient-to-br from-primary via-purple-600 to-indigo-700 text-white shadow-md shadow-primary/25 transition-transform duration-300 group-hover:scale-105 ${iconSizes[size]}`}
        >
          <Wrench className={`${wrenchSizes[size]} transition-transform duration-300 group-hover:rotate-12`} strokeWidth={2.5} />
          <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-300 animate-pulse" />
        </span>
        <span className={`${textSizes[size]} font-black tracking-tight text-ink`}>
          Fix<span className="bg-gradient-to-r from-primary via-purple-600 to-indigo-600 bg-clip-text text-transparent">Mate</span>
        </span>
      </div>
      {showTagline && (
        <span className="mt-1 text-[11px] font-bold text-ink/50 tracking-wider uppercase">
          AI Repairs & Local Technicians
        </span>
      )}
    </Link>
  )
}

