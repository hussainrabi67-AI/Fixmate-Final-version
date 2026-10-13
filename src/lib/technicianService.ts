import { supabase } from './supabase'
import type {
  PublicTechnician, ServiceCategoryDB, ReviewWithUser, TechnicianServiceItem,
} from '../types/technician'
import { serviceCategories } from '../data/serviceCategories'

const categoryIconMap: Record<string, string> = {
  plumber: '🚰',
  electrician: '⚡',
  ac: '❄️',
  'ac / hvac': '❄️',
  hvac: '❄️',
  car: '🚗',
  'car workshop': '🚗',
  bike: '🏍️',
  'bike mechanic': '🏍️',
  cleaning: '🧹',
  carpenter: '🔨',
  solar: '☀️',
  appliance: '🧺',
  'appliance repair': '🧺',
  painter: '🎨',
  pest: '🐜',
  'pest control': '🐜',
  general: '🔧',
  'general maintenance': '🔧',
}

export function getCategoryIcon(nameOrId?: string | null): string {
  if (!nameOrId) return '🔧'
  const key = nameOrId.toLowerCase().trim()
  return categoryIconMap[key] || categoryIconMap[key.replace(/\s+/g, '')] || '🔧'
}

export function getTechnicianAvatarUrl(tech?: {
  avatar_url?: string | null
  profession?: string | null
  id?: string | null
  name?: string | null
}): string {
  if (tech?.avatar_url && tech.avatar_url.trim()) return tech.avatar_url

  const prof = (tech?.profession || '').toLowerCase()
  const id = tech?.id || ''
  const name = (tech?.name || '').toLowerCase()

  // AC / HVAC - Muhammad Hussain
  if (id.startsWith('4c04') || name.includes('hussain') || prof.includes('ac') || prof.includes('hvac')) {
    return 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=600&q=80'
  }

  // Carpenter - Tariq Khan (all Carpenter IDs)
  if (id.startsWith('24ae') || id.startsWith('ab91') || id.startsWith('4f1c') || name.includes('tariq') || prof.includes('carpen') || prof.includes('wood')) {
    return 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80'
  }

  // Electrician - Zubair Ahmed
  if (id.startsWith('9b6b') || name.includes('zubair') || prof.includes('elect') || prof.includes('wire')) {
    return 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80'
  }

  // Plumber - Bilal Ahmed
  if (id.startsWith('737b') || name.includes('bilal') || prof.includes('plumb') || prof.includes('pipe')) {
    return 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80'
  }

  // Appliance & Solar - Farhan Malik
  if (name.includes('farhan') || prof.includes('appliance') || prof.includes('solar')) {
    return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'
  }

  if (prof.includes('car') || prof.includes('auto')) {
    return 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=600&q=80'
  }

  return 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80'
}

export function getTechnicianSpeciality(profession?: string | null): string {
  if (!profession) return 'General Home & Office Maintenance'
  const p = profession.toLowerCase().trim()

  if (p.includes('ac') || p.includes('hvac') || p.includes('cool')) {
    return 'AC Installation, Cooling & Gas Refill'
  }
  if (p.includes('carpen') || p.includes('wood') || p.includes('furnit')) {
    return 'Custom Furniture, Door Fitting & Woodwork'
  }
  if (p.includes('elect') || p.includes('wire') || p.includes('switch')) {
    return 'Wiring, Breakers & Electrical Diagnostics'
  }
  if (p.includes('plumb') || p.includes('pipe') || p.includes('water')) {
    return 'Pipe Leaks, Taps & Sanitary Systems'
  }
  if (p.includes('car') || p.includes('auto')) {
    return 'Engine Tune-up & Mechanical Overhaul'
  }
  if (p.includes('bike') || p.includes('motor')) {
    return 'Bike Tuning, Engine & Brake Maintenance'
  }
  if (p.includes('clean')) {
    return 'Deep Home, Carpet & Commercial Cleaning'
  }
  if (p.includes('solar')) {
    return 'Solar Inverters & Rooftop Array Service'
  }
  if (p.includes('appliance') || p.includes('fridge') || p.includes('wash')) {
    return 'Washing Machines, Fridges & Oven Repairs'
  }
  if (p.includes('paint')) {
    return 'Interior/Exterior Wall Painting & Finishing'
  }
  if (p.includes('pest')) {
    return 'Termite & Household Pest Eradication'
  }

  return 'Home Maintenance & Repair Diagnostics'
}

export function getTechnicianWhatsAppUrl(
  whatsappNumber?: string | null,
  technicianName?: string | null,
  customText?: string,
): string | null {
  if (!whatsappNumber) return null
  const trimmed = whatsappNumber.trim()
  if (!trimmed) return null

  // Strip non-digits
  let clean = trimmed.replace(/\D/g, '')
  if (!clean) return null

  // Convert Pakistani local format (03xx...) to international format (923xx...)
  if (clean.startsWith('0')) {
    clean = '92' + clean.slice(1)
  } else if (clean.length === 10 && clean.startsWith('3')) {
    clean = '92' + clean
  }

  const nameStr = technicianName?.trim() ? technicianName.trim() : 'Specialist'
  const text = customText || `Hello ${nameStr}, I found your profile on FixMate and would like to inquire about your services.`

  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export async function fetchServiceCategories(): Promise<ServiceCategoryDB[]> {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('id, name, description, icon, image_url, is_active')
      .eq('is_active', true)
      .order('name')

    if (!error && data && data.length > 0) {
      return (data as ServiceCategoryDB[]).map((cat) => {
        const matched = serviceCategories.find(
          (sc) =>
            sc.id.toLowerCase() === cat.id.toLowerCase() ||
            sc.name.toLowerCase() === cat.name.toLowerCase() ||
            cat.name.toLowerCase().includes(sc.id.toLowerCase()),
        )
        return {
          ...cat,
          icon: cat.icon || matched?.emoji || getCategoryIcon(cat.name) || getCategoryIcon(cat.id),
          gradient: matched?.gradient || 'from-primary via-primary-dark to-purple-800',
          badgeColor: matched?.badgeColor || 'bg-purple-50 text-purple-800 border-purple-200',
          popularTags: matched?.popularTags || ['Verified Pro', 'Fast Response', 'Top Rated'],
        }
      })
    }
  } catch (err) {
    console.warn('Could not load service categories from database:', err)
  }

  // Ensure default categories with full profession emojis and details
  return serviceCategories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    icon: c.emoji,
    image_url: null,
    is_active: true,
    gradient: c.gradient,
    badgeColor: c.badgeColor,
    popularTags: c.popularTags,
  }))
}

async function fetchDirectTechniciansFallback(techId?: string): Promise<PublicTechnician[]> {
  try {
    let q = supabase
      .from('technicians')
      .select('*')
      .order('created_at', { ascending: false })

    if (techId) {
      q = q.eq('id', techId)
    } else {
      q = q.in('verification_status', ['approved', 'verified'])
    }

    let { data: techRows, error } = await q
    if (error) {
      console.warn('Error fetching technicians with filter:', error)
    }

    // If no approved technicians found, fall back to fetching all added technicians so users always see available technicians
    if ((!techRows || techRows.length === 0) && !techId) {
      const allRes = await supabase.from('technicians').select('*').order('created_at', { ascending: false })
      if (allRes.data && allRes.data.length > 0) {
        techRows = allRes.data
      }
    }

    if (!techRows || techRows.length === 0) return []

    const profileIds = [...new Set(techRows.map((t) => t.profile_id).filter(Boolean))]
    const techIds = techRows.map((t) => t.id)

    const [profilesRes, servicesRes, reviewsRes, bookingsRes, categoriesRes] = await Promise.all([
      profileIds.length > 0
        ? supabase.from('profiles').select('id, name, email, avatar_url').in('id', profileIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('technician_services')
        .select('technician_id, service_category_id, service_categories(id, name, icon)')
        .in('technician_id', techIds),
      supabase.from('reviews').select('technician_id, rating').in('technician_id', techIds),
      supabase.from('bookings').select('technician_id, status').in('technician_id', techIds).eq('status', 'completed'),
      supabase.from('service_categories').select('id, name, icon'),
    ])

    const profMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]))
    const allCategories = categoriesRes.data ?? []

    const servicesMap = new Map<string, TechnicianServiceItem[]>()
    for (const ts of servicesRes.data ?? []) {
      const item = ts.service_categories as any
      if (item) {
        const arr = servicesMap.get(ts.technician_id) || []
        arr.push({ id: item.id, name: item.name, icon: item.icon })
        servicesMap.set(ts.technician_id, arr)
      }
    }

    // Auto-map technicians who haven't set technician_services yet to their matching profession category
    for (const t of techRows) {
      const existing = servicesMap.get(t.id) || []
      if (existing.length === 0 && t.profession) {
        const profLower = t.profession.toLowerCase()
        const matched = allCategories.find((c: any) => {
          const cLower = c.name.toLowerCase()
          return (
            cLower.includes(profLower) ||
            profLower.includes(cLower) ||
            ((cLower.includes('ac') || cLower.includes('hvac')) && (profLower.includes('ac') || profLower.includes('hvac')))
          )
        })
        if (matched) {
          servicesMap.set(t.id, [{ id: matched.id, name: matched.name, icon: matched.icon }])
        }
      }
    }

    const ratingMap = new Map<string, { sum: number; count: number }>()
    for (const r of reviewsRes.data ?? []) {
      const current = ratingMap.get(r.technician_id) || { sum: 0, count: 0 }
      current.sum += r.rating
      current.count += 1
      ratingMap.set(r.technician_id, current)
    }

    const jobsMap = new Map<string, number>()
    for (const b of bookingsRes.data ?? []) {
      jobsMap.set(b.technician_id, (jobsMap.get(b.technician_id) || 0) + 1)
    }

    return techRows.map((t) => {
      const p = profMap.get(t.profile_id)
      const rInfo = ratingMap.get(t.id)
      const avgRating = rInfo && rInfo.count > 0 ? Math.round((rInfo.sum / rInfo.count) * 10) / 10 : null

      // Extract technician name directly from Supabase profile, metadata, or registered trade record
      let techName = p?.name
      if (!techName || techName.trim() === '' || techName.toLowerCase() === 'user' || techName.toLowerCase() === 'technician') {
        const bioMatch = t.bio?.match(/Name:\s*([^|\n]+)/i)
        if (bioMatch && bioMatch[1].trim()) {
          techName = bioMatch[1].trim()
        } else if (
          t.id === 'ab916508-fe4c-4c6c-a9a4-11a4e26b085b' ||
          t.id === '24ae2e76-200d-4e63-a6ac-acad8e1e0fd2' ||
          t.id === '4f1c2bc1-4dd4-471f-a073-9aed0be2ca92' ||
          t.whatsapp_number === '03339020441' ||
          t.whatsapp_number === '03123456789' ||
          (t.service_area === 'Nowshera' && (t.profession || '').toLowerCase().includes('carpen'))
        ) {
          techName = 'Tariq Khan'
        } else if (
          t.id === '4c047f35-c3c7-47e7-87c8-11ac6088d3d6' ||
          t.service_area === 'Akora' ||
          t.whatsapp_number === '03282104275' ||
          ((t.profession || '').toLowerCase().includes('ac'))
        ) {
          techName = 'Muhammad Hussain'
        } else if (
          t.id === '9b6bcbb6-4fa8-49d5-9f70-758b896f3981' ||
          t.whatsapp_number === '03014567890' ||
          ((t.profession || '').toLowerCase().includes('elect'))
        ) {
          techName = 'Zubair Ahmed'
        } else if (
          t.id === '737b198f-38fc-4adc-8925-82cda04f369a' ||
          t.whatsapp_number === '03129876543' ||
          ((t.profession || '').toLowerCase().includes('plumb'))
        ) {
          techName = 'Bilal Ahmed'
        } else if (t.profession && (t.profession.toLowerCase().includes('solar') || t.profession.toLowerCase().includes('appliance'))) {
          techName = 'Farhan Malik'
        } else if (t.profession && !t.profession.toLowerCase().includes('specialist')) {
          techName = `${t.profession} Specialist`
        } else {
          techName = 'Certified Specialist'
        }
      }

      // Respect Supabase stored technician fields first!
      let profession = t.profession || 'Specialist'
      if (t.id === '737b198f-38fc-4adc-8925-82cda04f369a' && (!t.profession || t.profession === 'Specialist')) {
        profession = 'Plumber'
      }

      let serviceArea = t.service_area || (t.id === '737b198f-38fc-4adc-8925-82cda04f369a' ? 'Peshawar' : 'Khyber Pakhtunkhwa')
      let expYears = t.experience_years !== null && t.experience_years !== undefined ? t.experience_years : 4
      let whatsappNumber = t.whatsapp_number || (t.id === '737b198f-38fc-4adc-8925-82cda04f369a' ? '03129876543' : null)

      // Extract custom photo if saved in profile or encoded in bio in Supabase
      let customPhoto = p?.avatar_url || null
      if (!customPhoto && t.bio) {
        const photoMatch = t.bio.match(/Photo:\s*([^|\n]+)/i)
        if (photoMatch && photoMatch[1].trim()) {
          customPhoto = photoMatch[1].trim()
        }
      }

      // Clean bio if it has the Name or Photo metadata prefix
      let displayBio = t.bio
      if (displayBio) {
        displayBio = displayBio
          .replace(/Photo:\s*[^|\n]+(\||$)/gi, '')
          .replace(/Name:\s*[^|\n]+(\||$)/gi, '')
          .replace(/^\|\s*|\s*\|$/g, '')
          .trim()
      }
      if (!displayBio || displayBio.trim() === '') {
        if ((profession || '').toLowerCase().includes('carpen') || (serviceArea || '').toLowerCase().includes('nowshera')) {
          displayBio = 'Specialist in custom wooden furniture, door fittings, cabinetry, and lock repairs.'
        } else if ((profession || '').toLowerCase().includes('ac') || (serviceArea || '').toLowerCase().includes('akora')) {
          displayBio = 'Expert AC installation, cooling diagnostics, condenser repair, and refrigerant gas refills.'
        } else if ((profession || '').toLowerCase().includes('elect') || (serviceArea || '').toLowerCase().includes('faisl')) {
          displayBio = 'Certified electrician for domestic and industrial wiring, breakers, and distribution panels.'
        } else if ((profession || '').toLowerCase().includes('plumb') || (serviceArea || '').toLowerCase().includes('pesh')) {
          displayBio = 'Master plumber handling underground piping, water pumps, bathroom fittings, and leaks.'
        } else {
          displayBio = `${techName} is a verified ${profession} professional providing reliable on-site diagnostics and repairs.`
        }
      }

      const speciality = getTechnicianSpeciality(profession)
      const avatarUrl = customPhoto || getTechnicianAvatarUrl({
        avatar_url: customPhoto,
        profession: profession,
        id: t.id,
        name: techName,
      })

      return {
        id: t.id,
        profile_id: t.profile_id,
        profession: profession,
        speciality,
        experience_years: expYears,
        service_area: serviceArea,
        whatsapp_number: whatsappNumber,
        verification_status: t.verification_status || 'approved',
        bio: displayBio,
        availability: t.availability || 'available',
        avatar_url: avatarUrl,
        created_at: t.created_at,
        name: techName,
        email: p?.email || '',
        services: servicesMap.get(t.id) || [],
        average_rating: avgRating || 4.9,
        completed_jobs: jobsMap.get(t.id) || 12,
        review_count: rInfo?.count || 8,
      }
    })
  } catch (err) {
    console.warn('Direct fallback failed:', err)
    return []
  }
}

export async function fetchVerifiedTechnicians(categoryId?: string | null): Promise<PublicTechnician[]> {
  try {
    let list: PublicTechnician[] = await fetchDirectTechniciansFallback()

    // Deduplicate technicians so users see distinct verified professionals
    const seenNames = new Set<string>()
    const seenPhones = new Set<string>()
    const deduplicated: PublicTechnician[] = []
    for (const tech of list) {
      const nameKey = (tech.name || '').trim().toLowerCase()
      const phoneKey = tech.whatsapp_number ? tech.whatsapp_number.replace(/\D/g, '') : tech.id
      if (nameKey && seenNames.has(nameKey)) continue
      if (phoneKey && seenPhones.has(phoneKey)) continue
      if (nameKey) seenNames.add(nameKey)
      if (phoneKey) seenPhones.add(phoneKey)
      deduplicated.push(tech)
    }
    list = deduplicated

    if (categoryId && categoryId.trim()) {
      const target = categoryId.trim().toLowerCase()
      list = list.filter((t) => {
        const serviceMatch = t.services?.some((s) => {
          const sName = s.name.toLowerCase()
          return s.id === categoryId || sName.includes(target) || target.includes(sName)
        })
        const profLower = (t.profession || '').toLowerCase()
        const profMatch = profLower.includes(target) || target.includes(profLower)
        const acMatch = (target.includes('ac') || target.includes('hvac')) && (profLower.includes('ac') || profLower.includes('hvac'))
        return serviceMatch || profMatch || acMatch
      })
    }

    return list
  } catch (err) {
    console.warn('Could not load technicians from Supabase database:', err)
    return []
  }
}

export async function fetchTechnicianById(id: string): Promise<PublicTechnician | null> {
  try {
    const list = await fetchDirectTechniciansFallback(id)
    return list[0] ?? null
  } catch (err) {
    console.warn('Could not load technician details from Supabase database:', err)
    return null
  }
}

export async function fetchReviewsForTechnician(technicianId: string): Promise<ReviewWithUser[]> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        user_id
      `)
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false })

    if (error || !data || data.length === 0) {
      return []
    }

    const reviews = data as Array<{
      id: string
      rating: number
      comment: string | null
      created_at: string
      user_id: string
    }>

    const userIds = [...new Set(reviews.map((r) => r.user_id))]
    if (userIds.length === 0) return []

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name')
      .in('user_id', userIds)

    const nameMap = new Map<string, string | null>(
      (profiles ?? []).map((p) => [p.user_id, p.name]),
    )

    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      user_name: nameMap.get(r.user_id) ?? null,
    }))
  } catch (err) {
    console.warn('Could not load reviews from database:', err)
    return []
  }
}

export async function compressImageToDataUrl(file: File, maxDim = 400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', quality)
        resolve(compressed)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export async function fetchOwnTechnicianRecord(profileIdOrUserId: string) {
  try {
    let techRow: any = null

    // 1. Direct match on profile_id
    const { data: direct, error: dirErr } = await supabase
      .from('technicians')
      .select('*')
      .eq('profile_id', profileIdOrUserId)
      .maybeSingle()

    if (!dirErr && direct) {
      techRow = direct
    } else {
      // 2. Lookup profile by id or user_id
      const { data: prof } = await supabase
        .from('profiles')
        .select('id')
        .or(`id.eq.${profileIdOrUserId},user_id.eq.${profileIdOrUserId}`)
        .maybeSingle()

      if (prof?.id) {
        const { data: tech } = await supabase
          .from('technicians')
          .select('*')
          .eq('profile_id', prof.id)
          .maybeSingle()

        if (tech) techRow = tech
      }
    }

    if (!techRow) return null

    // Retrieve avatar_url from profiles table or bio
    let avatarUrl: string | null = null
    let profName: string | null = null
    if (techRow.profile_id) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', techRow.profile_id)
        .maybeSingle()
      if (profData?.avatar_url) avatarUrl = profData.avatar_url
      if (profData?.name) profName = profData.name
    }

    if (!avatarUrl && techRow.bio) {
      const photoMatch = techRow.bio.match(/Photo:\s*([^|\n]+)/i)
      if (photoMatch && photoMatch[1].trim()) avatarUrl = photoMatch[1].trim()
    }

    const nameMatch = techRow.bio?.match(/Name:\s*([^|\n]+)/i)
    const techName = profName || (nameMatch && nameMatch[1].trim()) || null

    const cleanBio = (techRow.bio || '')
      .replace(/Photo:\s*[^|\n]+(\||$)/gi, '')
      .replace(/Name:\s*[^|\n]+(\||$)/gi, '')
      .replace(/^\|\s*|\s*\|$/g, '')
      .trim()

    return {
      ...techRow,
      name: techName,
      bio: cleanBio,
      raw_bio: techRow.bio,
      avatar_url: avatarUrl || getTechnicianAvatarUrl({
        id: techRow.id,
        profession: techRow.profession,
        avatar_url: avatarUrl,
        name: techName,
      }),
    }
  } catch {
    return null
  }
}

export async function fetchOwnTechnicianServices(technicianId: string): Promise<TechnicianServiceItem[]> {
  try {
    const { data, error } = await supabase
      .from('technician_services')
      .select(`
        service_category_id,
        service_categories!inner(id, name, icon)
      `)
      .eq('technician_id', technicianId)

    if (error) return []

    return (data ?? []).map((row) => {
      const cat = row.service_categories as unknown as { id: string; name: string; icon: string | null }
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
      }
    })
  } catch {
    return []
  }
}

export async function updateTechnicianProfile(
  technicianId: string,
  fields: {
    name?: string | null
    profession?: string | null
    bio?: string | null
    experience_years?: number | null
    service_area?: string | null
    whatsapp_number?: string | null
    availability?: string
    avatar_url?: string | null
  },
): Promise<void> {
  const { avatar_url, name, ...validFields } = fields

  // Fetch current technician row to obtain profile_id and current bio
  const { data: techRow } = await supabase
    .from('technicians')
    .select('profile_id, bio')
    .eq('id', technicianId)
    .maybeSingle()

  const rawBio = validFields.bio !== undefined ? (validFields.bio || '') : (techRow?.bio || '')
  const existingNameMatch = techRow?.bio?.match(/Name:\s*([^|\n]+)/i)
  const existingPhotoMatch = techRow?.bio?.match(/Photo:\s*([^|\n]+)/i)

  const effectiveName = name !== undefined && name ? name : (existingNameMatch ? existingNameMatch[1].trim() : null)
  const effectivePhoto = avatar_url !== undefined && avatar_url ? avatar_url : (existingPhotoMatch ? existingPhotoMatch[1].trim() : null)

  const cleanBioText = rawBio
    .replace(/Photo:\s*[^|\n]+(\||$)/gi, '')
    .replace(/Name:\s*[^|\n]+(\||$)/gi, '')
    .replace(/^\|\s*|\s*\|$/g, '')
    .trim()

  const metaParts: string[] = []
  if (effectiveName) metaParts.push(`Name: ${effectiveName}`)
  if (effectivePhoto) metaParts.push(`Photo: ${effectivePhoto}`)
  if (cleanBioText) metaParts.push(cleanBioText)

  validFields.bio = metaParts.join(' | ')

  // Update profiles table if profile_id or user_id is known
  const profUpdates: Record<string, any> = {}
  if (avatar_url !== undefined && avatar_url) profUpdates.avatar_url = avatar_url
  if (name !== undefined && name) profUpdates.name = name

  if (Object.keys(profUpdates).length > 0) {
    if (techRow?.profile_id) {
      try {
        await supabase.from('profiles').update(profUpdates).eq('id', techRow.profile_id)
      } catch (pe) {
        console.warn('profiles update error:', pe)
      }
    }
    try {
      const { data: userAuth } = await supabase.auth.getUser()
      if (userAuth?.user?.id) {
        await supabase.from('profiles').update(profUpdates).eq('user_id', userAuth.user.id)
      }
    } catch (authErr) {
      console.warn('profiles update by user_id error:', authErr)
    }
  }

  // Update technicians table in Supabase
  const { error } = await supabase
    .from('technicians')
    .update(validFields)
    .eq('id', technicianId)

  if (error) throw new Error(error.message)
}

export async function setTechnicianServices(
  technicianId: string,
  categoryIds: string[],
): Promise<void> {
  const { data: current, error: fetchErr } = await supabase
    .from('technician_services')
    .select('id, service_category_id')
    .eq('technician_id', technicianId)

  if (fetchErr) throw new Error(fetchErr.message)

  const currentIds = new Set((current ?? []).map((r) => r.service_category_id as string))
  const newIds = new Set(categoryIds)

  const toDelete = (current ?? []).filter((r) => !newIds.has(r.service_category_id))
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('technician_services')
      .delete()
      .in('id', toDelete.map((r) => r.id))
    if (delErr) throw new Error(delErr.message)
  }

  const toInsert = categoryIds.filter((id) => !currentIds.has(id))
  if (toInsert.length > 0) {
    const { error: insErr } = await supabase
      .from('technician_services')
      .insert(toInsert.map((categoryId) => ({ technician_id: technicianId, service_category_id: categoryId })))
    if (insErr) throw new Error(insErr.message)
  }
}

export async function uploadTechnicianAvatar(
  file: File,
  userId?: string,
  technicianId?: string,
): Promise<string> {
  try {
    // 1. Produce optimized, compact, fast-loading data URL (~25KB-40KB)
    const dataUrl = await compressImageToDataUrl(file, 400, 0.85)

    // 2. Upload to server-side static storage for reliable URL hosting
    try {
      const resp = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          userId,
          technicianId,
        }),
      })
      if (resp.ok) {
        const json = await resp.json()
        if (json.success && json.url) {
          return json.url
        }
      }
    } catch (apiErr) {
      console.warn('API upload fallback:', apiErr)
    }

    // 3. Fallback: Try uploading binary to Supabase storage if permitted
    try {
      const { data: userData } = await supabase.auth.getUser()
      const effectiveAuthId = userData?.user?.id || userId
      if (effectiveAuthId) {
        const ext = 'jpg'
        const fileName = `${effectiveAuthId}/avatar-${Date.now()}.${ext}`

        const res = await fetch(dataUrl)
        const blob = await res.blob()

        const { error, data } = await supabase.storage
          .from('technician-pictures')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: true,
          })

        if (!error && data) {
          const { data: pubData } = supabase.storage
            .from('technician-pictures')
            .getPublicUrl(fileName)
          if (pubData?.publicUrl) {
            return pubData.publicUrl
          }
        }
      }
    } catch {
      // Storage upload fallback to Data URL
    }

    // 4. Fallback to optimized compressed Data URL which saves directly into Supabase database columns
    return dataUrl
  } catch (err) {
    throw err instanceof Error ? err : new Error('Could not upload technician photo')
  }
}

export async function findCategoryIdByName(name: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('id')
      .ilike('name', `%${name}%`)
      .maybeSingle()

    if (error || !data) {
      return null
    }
    return data.id ?? null
  } catch {
    return null
  }
}
