import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, AlertCircle } from 'lucide-react'
import PageShell from '../components/PageShell'
import { supabase } from '../lib/supabase'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate(): string | null {
    if (!name.trim()) return 'Please enter your name.'
    if (!email.trim()) return 'Please enter your email.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email.'
    if (password.length < 6) return 'Password must be at least 6 characters.'
    return null
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'user' },
      },
    })
    setLoading(false)

    if (authError) {
      setError(
        authError.message.includes('already registered')
          ? 'This email is already registered. Try logging in.'
          : authError.message,
      )
      return
    }

    if (data.user) {
      navigate('/dashboard')
    }
  }

  return (
    <PageShell
      title="Create your account"
      subtitle="Join FixMate to get AI help and find trusted professionals."
      icon={<UserPlus className="h-8 w-8" />}
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-error/10 p-3 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-4 text-left" onSubmit={handleRegister}>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-2xl bg-background px-4 py-3 text-base text-ink ring-1 ring-primary/15 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl bg-background px-4 py-3 text-base text-ink ring-1 ring-primary/15 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-2xl bg-background px-4 py-3 text-base text-ink ring-1 ring-primary/15 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account...' : 'Get Started'}
        </button>
        <p className="text-center text-sm text-ink/60">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Login
          </Link>
        </p>
      </form>
    </PageShell>
  )
}
