import { Link } from 'react-router-dom'
import Logo from './Logo'

const links = [
  { label: 'About', to: '/#about' },
  { label: 'Services', to: '/services' },
  { label: 'For Technicians', to: '/technician' },
  { label: 'Privacy', to: '/#privacy' },
  { label: 'Terms', to: '/#terms' },
  { label: 'Contact', to: '/#contact' },
]

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-primary/10 bg-primary-light/40">
      <div className="section py-12">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          <div className="max-w-sm">
            <Logo size="md" showTagline />
            <p className="mt-2 text-sm text-ink/60">
              AI-powered help for your everyday repair problems.
            </p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="text-sm font-medium text-ink/60 transition-colors hover:text-primary"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t border-primary/10 pt-6 text-center text-xs text-ink/50">
          &copy; {new Date().getFullYear()} FixMate. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
