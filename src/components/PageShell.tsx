import { type ReactNode } from 'react'
import Logo from './Logo'

interface PageShellProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  children?: ReactNode
}

export default function PageShell({ title, subtitle, icon, children }: PageShellProps) {
  return (
    <div className="section flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      {/* Prominent FixMate Logo Badge */}
      <div className="mb-4">
        <Logo size="lg" showTagline className="items-center" />
      </div>

      {icon && (
        <div className="my-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
          {icon}
        </div>
      )}

      <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2.5 max-w-md text-base text-ink/60 leading-relaxed">{subtitle}</p>}
      {children && <div className="mt-8 w-full max-w-md">{children}</div>}
    </div>
  )
}

