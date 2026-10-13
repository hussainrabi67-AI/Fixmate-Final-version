import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, AlertCircle, Mail, Eye, EyeOff } from 'lucide-react'
import PageShell from '../components/PageShell'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)

    if (authError) {
      setError(
        authError.message.includes('Invalid login')
          ? 'Invalid email or password.'
          : authError.message,
      )
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', data.user.id)
        .maybeSingle()

      let role = profile?.role ?? (data.user.user_metadata?.role as string | undefined) ?? 'user'

      if (role !== 'technician' && profile?.id) {
        const { data: tech } = await supabase
          .from('technicians')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle()
        if (tech) role = 'technician'
      }

      if (role === 'technician') navigate('/technician')
      else if (role === 'admin') navigate('/admin')
      else navigate('/dashboard')
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    if (!email) {
      setError('Enter your email to reset your password.')
      return
    }

    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setInfo('Password reset link sent to your email.')
  }

  return (
    <PageShell
      title={showReset ? 'Reset your password' : 'Welcome back'}
      subtitle={showReset ? 'Enter your email and we will send you a reset link.' : 'Log in to your FixMate account.'}
      icon={<LogIn className="h-8 w-8" />}
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-error/10 p-3 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-success/10 p-3 text-sm text-success">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      {!showReset ? (
        <form className="space-y-4 text-left" onSubmit={handleLogin}>
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl bg-background px-4 py-3 pr-12 text-base text-ink ring-1 ring-primary/15 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Logging in...' : 'Login'}
          </button>



          <button
            type="button"
            onClick={() => { setShowReset(true); setError(''); setInfo('') }}
            className="block w-full text-center text-sm text-primary hover:underline"
          >
            Forgot password?
          </button>
          <p className="text-center text-sm text-ink/60">
            New to FixMate?{' '}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      ) : (
        <form className="space-y-4 text-left" onSubmit={handleReset}>
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
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
          <button
            type="button"
            onClick={() => { setShowReset(false); setError(''); setInfo('') }}
            className="block w-full text-center text-sm text-primary hover:underline"
          >
            Back to login
          </button>
        </form>
      )}
    </PageShell>
  )
}
