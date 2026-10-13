import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Wrench, AlertCircle, CheckCircle2, Camera } from 'lucide-react'
import PageShell from '../components/PageShell'
import { supabase } from '../lib/supabase'
import { serviceCategories } from '../data/serviceCategories'
import { uploadTechnicianAvatar } from '../lib/technicianService'

export default function TechnicianRegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [profession, setProfession] = useState('')
  const [experience, setExperience] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [bio, setBio] = useState('')
  const [password, setPassword] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function validate(): string | null {
    if (!name.trim()) return 'Please enter your name.'
    if (!email.trim()) return 'Please enter your email.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email.'
    if (!phone.trim()) return 'Please enter your phone number.'
    if (!profession) return 'Please select your profession.'
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

    // 1. Create auth account with role = technician
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'technician' },
      },
    })

    if (authError) {
      setLoading(false)
      setError(
        authError.message.includes('already registered')
          ? 'This email is already registered. Try logging in.'
          : authError.message,
      )
      return
    }

    if (!data.user) {
      setLoading(false)
      setError('Something went wrong. Please try again.')
      return
    }

    // 2. Ensure active auth session so RLS allows updates
    if (!data.session) {
      await supabase.auth.signInWithPassword({ email, password }).catch(() => {})
    }

    // Lookup profile created by trigger
    let profile = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (p) {
        profile = p
        break
      }
      await new Promise((r) => setTimeout(r, 250))
    }

    if (!profile) {
      const { data: newProf } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          name: name.trim(),
          phone,
          role: 'technician',
        })
        .select('id')
        .maybeSingle()
      if (newProf) profile = newProf
    }

    if (profile) {
      let uploadedAvatarUrl: string | null = null
      if (photoFile) {
        try {
          uploadedAvatarUrl = await uploadTechnicianAvatar(photoFile, data.user.id)
        } catch (photoErr) {
          console.warn('Photo upload error during registration:', photoErr)
        }
      }

      await supabase
        .from('profiles')
        .update({
          name: name.trim() || undefined,
          phone,
          role: 'technician',
          avatar_url: uploadedAvatarUrl || null,
        })
        .eq('id', profile.id)

      // 3. Create technician record with permanent profile name and photo in Supabase
      const bioParts: string[] = []
      if (name) bioParts.push(`Name: ${name.trim()}`)
      if (uploadedAvatarUrl) bioParts.push(`Photo: ${uploadedAvatarUrl}`)
      if (bio) bioParts.push(bio.trim())
      else bioParts.push('Certified specialist ready for service.')
      const bioWithMeta = bioParts.join(' | ')

      const { data: createdTech } = await supabase
        .from('technicians')
        .insert({
          profile_id: profile.id,
          profession,
          experience_years: experience ? parseInt(experience, 10) : null,
          service_area: serviceArea || null,
          whatsapp_number: whatsapp || null,
          bio: bioWithMeta,
          verification_status: 'approved',
          availability: 'available',
        })
        .select('id')
        .maybeSingle()

      if (createdTech && profession) {
        try {
          const { data: cat } = await supabase
            .from('service_categories')
            .select('id')
            .ilike('name', `%${profession}%`)
            .maybeSingle()
          if (cat) {
            await supabase.from('technician_services').insert({
              technician_id: createdTech.id,
              service_category_id: cat.id,
            })
          }
        } catch {}
      }

      // Notify admins of new registration awaiting verification
      try {
        const { data: admins } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('role', 'admin')

        for (const admin of admins ?? []) {
          await supabase.from('notifications').insert({
            user_id: admin.user_id,
            type: 'technician_registered',
            title: 'New Technician Registration',
            message: `${name || 'A technician'} (${profession || 'Specialist'}) registered and is awaiting verification.`,
            read: false,
          })
        }
      } catch {
        // Ignore notification error
      }
    }

    setLoading(false)
    setSuccess(true)
  }

  if (success) {
    return (
      <PageShell
        title="Registration submitted"
        subtitle=""
        icon={<CheckCircle2 className="h-8 w-8" />}
      >
        <div className="rounded-3xl bg-primary-light/60 p-6 text-center">
          <p className="text-lg font-semibold text-ink">
            Your technician profile is pending verification.
          </p>
          <p className="mt-2 text-sm text-ink/60">
            We will review your details and notify you once your account is verified.
          </p>
          <Link to="/login" className="btn-primary mt-5">
            Proceed to Login
          </Link>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Join as a Technician"
      subtitle="Create your professional profile and start receiving service requests."
      icon={<Wrench className="h-8 w-8" />}
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-error/10 p-3 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-4 text-left" onSubmit={handleRegister}>
        {/* Profile Photo Upload */}
        <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Avatar Preview"
              className="h-16 w-16 rounded-2xl object-cover ring-2 ring-primary shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary shrink-0">
              <Camera className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink">Profile Photo (Optional)</p>
            <p className="text-[11px] text-ink/50 mt-0.5">Upload a professional trade picture</p>
            <label className="mt-1.5 inline-block cursor-pointer rounded-xl bg-white px-3 py-1 text-xs font-bold text-primary ring-1 ring-primary/20 hover:bg-primary-light transition-colors">
              Choose Photo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setPhotoFile(file)
                    setPhotoPreview(URL.createObjectURL(file))
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

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
          <label className="mb-1 block text-sm font-medium text-ink/70">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number"
            className="w-full rounded-2xl bg-background px-4 py-3 text-base text-ink ring-1 ring-primary/15 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Profession</label>
          <select
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            className="w-full rounded-2xl bg-background px-4 py-3 text-base text-ink ring-1 ring-primary/15 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select a category</option>
            {serviceCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Experience (years)</label>
            <input
              type="number"
              min="0"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="5"
              className="w-full rounded-2xl bg-background px-4 py-3 text-base text-ink ring-1 ring-primary/15 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Service area</label>
            <input
              type="text"
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              placeholder="City / Area"
              className="w-full rounded-2xl bg-background px-4 py-3 text-base text-ink ring-1 ring-primary/15 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">WhatsApp number</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="WhatsApp contact number"
            className="w-full rounded-2xl bg-background px-4 py-3 text-base text-ink ring-1 ring-primary/15 placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short description of your skills and experience"
            rows={3}
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
          {loading ? 'Creating profile...' : 'Create Technician Profile'}
        </button>
        <p className="text-center text-sm text-ink/60">
          Just looking?{' '}
          <Link to="/technician" className="font-semibold text-primary hover:underline">
            Back to technician info
          </Link>
        </p>
      </form>
    </PageShell>
  )
}
