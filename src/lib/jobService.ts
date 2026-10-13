import { supabase } from './supabase'
import type {
  ServiceRequestWithCategory, QuoteWithTechnician, BookingWithDetails, BookingReview,
} from '../types/job'
export { fetchOwnTechnicianRecord, fetchVerifiedTechnicians } from './technicianService'
import { fetchVerifiedTechnicians } from './technicianService'
import { isGreetingOrGeneralChat } from './n8nService'

// ============================================================
// Service Requests Local Storage Helper
// ============================================================

function getLocalServiceRequests(): Array<{
  id: string
  user_id: string
  category_id: string | null
  title: string | null
  description: string | null
  image_url: string | null
  location: string | null
  status: string
  created_at: string
  updated_at: string
  service_categories?: { name: string; icon: string | null } | null
  profiles?: { name: string | null; phone: string | null; email: string | null } | null
}> {
  try {
    const raw = localStorage.getItem('fixmate_local_service_requests')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// ============================================================
// Service Requests (customer side)
// ============================================================

export async function fetchCustomerRequests(userId: string): Promise<ServiceRequestWithCategory[]> {
  try {
    const { data: authUser } = await supabase.auth.getUser()
    const authUid = authUser?.user?.id

    const { data, error } = await supabase
      .from('service_requests')
      .select(`
        id, user_id, category_id, title, description, image_url, location, status,
        created_at, updated_at,
        service_categories!left(name, icon)
      `)
      .or(`user_id.eq.${userId}${authUid && authUid !== userId ? `,user_id.eq.${authUid}` : ''}`)
      .order('created_at', { ascending: false })

    const remoteRequests = (!error && data) ? (data as any[]) : []
    const localRequests = getLocalServiceRequests().filter(
      (r) => r.user_id === userId || (authUid && r.user_id === authUid)
    )

    const combinedMap = new Map<string, any>()
    for (const r of remoteRequests) {
      combinedMap.set(r.id, r)
    }
    for (const lr of localRequests) {
      if (!combinedMap.has(lr.id)) {
        combinedMap.set(lr.id, lr)
      }
    }

    const requests = Array.from(combinedMap.values())

    // Fetch AI diagnoses for requests that have them
    const requestIds = requests.map((r) => r.id)
    let diagnosisMap = new Map<string, { summary: string; urgency: string; professional: boolean }>()
    if (requestIds.length > 0) {
      try {
        const { data: diagnoses } = await supabase
          .from('ai_diagnoses')
          .select('request_id, problem_summary, urgency, professional_required')
          .in('request_id', requestIds)
        for (const d of diagnoses ?? []) {
          diagnosisMap.set(d.request_id, {
            summary: d.problem_summary,
            urgency: d.urgency,
            professional: d.professional_required,
          })
        }
      } catch {
        // Continue without diagnoses
      }
    }

    return requests
      .filter((r) => {
        const fullText = `${r.title || ''} ${r.description || ''}`.trim()
        if (isGreetingOrGeneralChat(fullText) && !r.image_url) {
          return false
        }
        return true
      })
      .map((r) => {
        const diag = diagnosisMap.get(r.id)
        return {
          id: r.id,
          user_id: r.user_id,
          category_id: r.category_id,
          title: r.title,
          description: r.description,
          image_url: r.image_url,
          location: r.location,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,
          category_name: r.service_categories?.name ?? null,
          category_icon: r.service_categories?.icon ?? null,
          diagnosis_summary: diag?.summary ?? null,
          diagnosis_urgency: diag?.urgency ?? null,
          diagnosis_professional: diag?.professional ?? null,
        }
      })
  } catch {
    return []
  }
}

// ============================================================
// Service Requests (technician side)
// ============================================================

export async function fetchRequestsForTechnician(
  technicianId: string,
): Promise<ServiceRequestWithCategory[]> {
  try {
    // 1. Fetch technician's profession and registered services safely
    const { data: tech } = await supabase
      .from('technicians')
      .select('id, user_id, profile_id, profession, service_area')
      .or(`id.eq.${technicianId},user_id.eq.${technicianId},profile_id.eq.${technicianId}`)
      .maybeSingle()

    const realTechId = tech?.id || technicianId
    const realUserId = tech?.user_id
    const realProfileId = tech?.profile_id

    const { data: tsData } = await supabase
      .from('technician_services')
      .select('service_category_id')
      .eq('technician_id', realTechId)

    const techServices = tsData || []
    const categoryIds = new Set(techServices.map((ts) => ts.service_category_id as string))

    // If technician has a profession, resolve matching category
    if (tech?.profession) {
      const profLower = tech.profession.toLowerCase()
      const { data: matchedCats } = await supabase.from('service_categories').select('id, name')
      for (const mc of matchedCats ?? []) {
        const mcName = mc.name.toLowerCase()
        if (
          mcName.includes(profLower) ||
          profLower.includes(mcName) ||
          ((mcName.includes('ac') || mcName.includes('hvac')) && (profLower.includes('ac') || profLower.includes('hvac'))) ||
          (mcName.includes('carpent') && profLower.includes('carpent'))
        ) {
          categoryIds.add(mc.id)
        }
      }
    }

    // 2. Query service requests with status requested, matching, or quoted
    const { data, error } = await supabase
      .from('service_requests')
      .select(`
        id, user_id, category_id, title, description, image_url, location, status,
        created_at, updated_at,
        service_categories!left(name, icon),
        profiles!left(name, phone, email)
      `)
      .in('status', ['requested', 'matching', 'quoted', 'booked'])
      .order('created_at', { ascending: false })

    const remoteData = (!error && data) ? (data as any[]) : []
    const localData = getLocalServiceRequests().filter((r) => r.status === 'requested' || r.status === 'matching' || r.status === 'quoted')

    const combinedMap = new Map<string, any>()
    for (const r of remoteData) {
      combinedMap.set(r.id, r)
    }
    for (const lr of localData) {
      if (!combinedMap.has(lr.id)) {
        combinedMap.set(lr.id, lr)
      }
    }

    const allRequests = Array.from(combinedMap.values())

    // Filter relevant requests so direct requests and matching categories ALWAYS reach the specific technician:
    const filtered = allRequests.filter((r) => {
      const desc = r.description || ''
      const title = r.title || ''
      const fullText = `${title} ${desc}`.trim()

      // 1. Remove general chat messages / greetings from service requests
      if (isGreetingOrGeneralChat(fullText) && !r.image_url) {
        return false
      }

      // 2. Check if request is a direct request to a specific technician
      const hasDirectTag =
        desc.includes('TechID:') ||
        title.includes('TechID:') ||
        desc.toLowerCase().includes('direct request for') ||
        title.toLowerCase().includes('direct request for')

      const isDirectTechMatch =
        desc.includes(`TechID:${realTechId}`) ||
        title.includes(`TechID:${realTechId}`) ||
        (realUserId && (desc.includes(`TechID:${realUserId}`) || title.includes(`TechID:${realUserId}`))) ||
        (realProfileId && (desc.includes(`TechID:${realProfileId}`) || title.includes(`TechID:${realProfileId}`))) ||
        desc.includes(`TechID:${technicianId}`) ||
        title.includes(`TechID:${technicianId}`)

      if (hasDirectTag) {
        // ONLY show if this direct request was specifically sent to THIS technician
        return isDirectTechMatch
      }

      // 3. Category & Profession Matching for open requests
      if (categoryIds.size > 0 && r.category_id) {
        if (categoryIds.has(r.category_id)) return true
      }

      if (tech?.profession && tech.profession.trim() !== '') {
        const pLower = tech.profession.toLowerCase()
        const cLower = (r.service_categories?.name || '').toLowerCase()
        const descLower = desc.toLowerCase()
        const titleLower = title.toLowerCase()

        const matchesCategoryName = cLower && (cLower.includes(pLower) || pLower.includes(cLower))
        const matchesKeywords =
          descLower.includes(pLower) || titleLower.includes(pLower) ||
          (pLower.includes('carpent') && (descLower.includes('wood') || descLower.includes('door') || descLower.includes('furniture'))) ||
          ((pLower.includes('ac') || pLower.includes('hvac')) && (descLower.includes('ac') || descLower.includes('cool'))) ||
          (pLower.includes('plumb') && (descLower.includes('leak') || descLower.includes('pipe') || descLower.includes('tap') || descLower.includes('water'))) ||
          (pLower.includes('electr') && (descLower.includes('wire') || descLower.includes('switch') || descLower.includes('power') || descLower.includes('breaker'))) ||
          (pLower.includes('appliance') && (descLower.includes('washing') || descLower.includes('fridge') || descLower.includes('oven'))) ||
          (pLower.includes('car') && (descLower.includes('engine') || descLower.includes('brake') || descLower.includes('gari')))

        if (matchesCategoryName || matchesKeywords) {
          return true
        }

        // If technician has a specific profession and this request belongs to a different category, exclude it
        if (r.category_id || r.service_categories?.name) {
          return false
        }
      }

      // Allow open requests with no category specified if technician has no specific category restriction
      return categoryIds.size === 0 && (!tech?.profession || tech.profession.trim() === '')
    })

    const requestIds = filtered.map((r) => r.id)
    const userIds = Array.from(new Set(filtered.map((r) => r.user_id).filter(Boolean)))

    let profileMap = new Map<string, { name: string | null; phone: string | null; email: string | null }>()
    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, user_id, name, phone, email')
          .in('user_id', userIds)
        for (const p of profs ?? []) {
          if (p.user_id) profileMap.set(p.user_id, p)
          if (p.id) profileMap.set(p.id, p)
        }
      } catch {}
    }

    let diagnosisMap = new Map<string, { summary: string; urgency: string; professional: boolean }>()
    if (requestIds.length > 0) {
      try {
        const { data: diagnoses } = await supabase
          .from('ai_diagnoses')
          .select('request_id, problem_summary, urgency, professional_required')
          .in('request_id', requestIds)
        for (const d of diagnoses ?? []) {
          diagnosisMap.set(d.request_id, {
            summary: d.problem_summary,
            urgency: d.urgency,
            professional: d.professional_required,
          })
        }
      } catch {
        // ignore
      }
    }

    return filtered.map((r) => {
      const diag = diagnosisMap.get(r.id)
      const prof = profileMap.get(r.user_id) || r.profiles
      return {
        id: r.id,
        user_id: r.user_id,
        category_id: r.category_id,
        title: r.title,
        description: r.description,
        image_url: r.image_url,
        location: r.location,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        category_name: r.service_categories?.name ?? null,
        category_icon: r.service_categories?.icon ?? null,
        customer_name: prof?.name ?? 'Customer',
        customer_phone: prof?.phone ?? null,
        customer_email: prof?.email ?? null,
        diagnosis_summary: diag?.summary ?? null,
        diagnosis_urgency: diag?.urgency ?? null,
        diagnosis_professional: diag?.professional ?? null,
      }
    })
  } catch (err) {
    console.warn('Could not fetch requests for technician:', err)
    return []
  }
}

/**
 * Directly accepts a service request by the technician (creates booking and assigns technician).
 */
export async function acceptRequestDirectly(params: {
  requestId: string
  technicianId: string
  amount?: number
  message?: string
}): Promise<string> {
  const { requestId, technicianId, amount = 1500, message = 'Accepted by technician. Ready to serve.' } = params

  // 1. Fetch the service request
  let reqUserId: string | null = null
  let reqTitle: string | null = null
  let reqLocation: string | null = null

  try {
    const { data: req } = await supabase
      .from('service_requests')
      .select('id, user_id, title, location')
      .eq('id', requestId)
      .single()
    if (req) {
      reqUserId = req.user_id
      reqTitle = req.title
      reqLocation = req.location
    }
  } catch {}

  if (!reqUserId) {
    const localReq = getLocalServiceRequests().find((r) => r.id === requestId)
    if (localReq) {
      reqUserId = localReq.user_id
      reqTitle = localReq.title
      reqLocation = localReq.location
    }
  }

  const effectiveUserId = reqUserId || 'user_fallback'

  // Update localStorage status
  try {
    const raw = localStorage.getItem('fixmate_local_service_requests')
    if (raw) {
      const list = JSON.parse(raw)
      const idx = list.findIndex((r: any) => r.id === requestId)
      if (idx >= 0) {
        list[idx].status = 'booked'
        list[idx].updated_at = new Date().toISOString()
        localStorage.setItem('fixmate_local_service_requests', JSON.stringify(list))
      }
    }
  } catch {}

  // 2. Check if booking already exists for this request
  try {
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('request_id', requestId)
      .maybeSingle()

    if (existingBooking) {
      await supabase
        .from('bookings')
        .update({
          technician_id: technicianId,
          status: 'accepted',
        })
        .eq('id', existingBooking.id)

      await supabase
        .from('service_requests')
        .update({ status: 'booked' })
        .eq('id', requestId)

      return existingBooking.id
    }
  } catch {}

  // 3. Create quote record
  try {
    await supabase.from('quotes').insert({
      request_id: requestId,
      technician_id: technicianId,
      amount,
      message,
      status: 'accepted',
    })
  } catch {}

  // 4. Create booking record
  let newBookingId = `book_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  try {
    const { data: newBooking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        request_id: requestId,
        user_id: effectiveUserId,
        technician_id: technicianId,
        status: 'accepted',
        location: reqLocation || null,
        notes: message,
      })
      .select('id')
      .maybeSingle()

    if (newBooking?.id) {
      newBookingId = newBooking.id
    }
  } catch {}

  // 5. Update request status to 'booked' in Supabase
  try {
    await supabase
      .from('service_requests')
      .update({ status: 'booked' })
      .eq('id', requestId)
  } catch {}

  // 6. Send notification to customer
  try {
    if (effectiveUserId) {
      await supabase.from('notifications').insert({
        user_id: effectiveUserId,
        type: 'quote_accepted',
        title: 'Technician Assigned!',
        message: `A technician has accepted your request "${reqTitle || 'Service'}". They will contact you shortly.`,
        read: false,
      })
    }
  } catch {}

  return newBookingId
}

// ============================================================
// Quotes
// ============================================================

export async function fetchQuotesForRequest(requestId: string): Promise<QuoteWithTechnician[]> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        id, request_id, technician_id, amount, message, status, created_at
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })

    if (error || !data || data.length === 0) return []

    const quotes = data as Array<{
      id: string
      request_id: string
      technician_id: string
      amount: number | null
      message: string | null
      status: string
      created_at: string
    }>

    const technicianIds = [...new Set(quotes.map((q) => q.technician_id))]
    let techMap = new Map<string, Record<string, unknown>>()
    try {
      const allTechs = await fetchVerifiedTechnicians()
      for (const t of allTechs) {
        if (technicianIds.includes(t.id)) {
          techMap.set(t.id, t as any)
        }
      }
    } catch {
      // ignore
    }

    return quotes.map((q) => {
      const t = techMap.get(q.technician_id) ?? {}
      return {
        id: q.id,
        request_id: q.request_id,
        technician_id: q.technician_id,
        amount: q.amount,
        message: q.message,
        status: q.status,
        created_at: q.created_at,
        technician_name: (t.name as string) ?? null,
        technician_avatar: (t.avatar_url as string) ?? null,
        technician_profession: (t.profession as string) ?? null,
        technician_experience: (t.experience_years as number) ?? null,
        technician_service_area: (t.service_area as string) ?? null,
        technician_rating: (t.average_rating as number) ?? null,
        technician_review_count: (t.review_count as number) ?? 0,
        technician_completed_jobs: (t.completed_jobs as number) ?? 0,
      }
    })
  } catch {
    return []
  }
}

export async function fetchQuotesByTechnician(
  technicianId: string,
): Promise<QuoteWithTechnician[]> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        id, request_id, technician_id, amount, message, status, created_at
      `)
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false })

    if (error || !data || data.length === 0) return []

    const quotes = data as Array<{
      id: string
      request_id: string
      technician_id: string
      amount: number | null
      message: string | null
      status: string
      created_at: string
    }>

    return quotes.map((q) => ({
      id: q.id,
      request_id: q.request_id,
      technician_id: q.technician_id,
      amount: q.amount,
      message: q.message,
      status: q.status,
      created_at: q.created_at,
      technician_name: null,
      technician_avatar: null,
      technician_profession: null,
      technician_experience: null,
      technician_service_area: null,
      technician_rating: null,
      technician_review_count: 0,
      technician_completed_jobs: 0,
    }))
  } catch {
    return []
  }
}

export async function createQuote(params: {
  requestId: string
  technicianId: string
  amount: number
  message: string
}): Promise<string | null> {
  const { data: existing } = await supabase
    .from('quotes')
    .select('id, status')
    .eq('request_id', params.requestId)
    .eq('technician_id', params.technicianId)
    .in('status', ['pending', 'accepted'])
    .maybeSingle()

  if (existing) {
    throw new Error('You already have an active quote for this request.')
  }

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      request_id: params.requestId,
      technician_id: params.technicianId,
      amount: params.amount,
      message: params.message,
      status: 'pending',
    })
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)

  // Notify customer of new quote
  try {
    const { data: req } = await supabase
      .from('service_requests')
      .select('user_id, title')
      .eq('id', params.requestId)
      .maybeSingle()

    if (req?.user_id) {
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        type: 'new_quote',
        title: 'New Quote Received',
        message: `You received a quote of Rs ${params.amount} for your request.`,
        read: false,
      })
    }
  } catch {
    // Ignore notification error
  }

  return data?.id ?? null
}

export async function rejectRequestByTechnician(
  requestId: string,
  technicianId: string,
): Promise<void> {
  // Update local storage if present
  try {
    const raw = localStorage.getItem('fixmate_local_service_requests')
    if (raw) {
      const list = JSON.parse(raw)
      const idx = list.findIndex((r: any) => r.id === requestId)
      if (idx >= 0) {
        list[idx].status = 'rejected'
        list[idx].updated_at = new Date().toISOString()
        localStorage.setItem('fixmate_local_service_requests', JSON.stringify(list))
      }
    }
  } catch {}

  try {
    await supabase
      .from('quotes')
      .insert({
        request_id: requestId,
        technician_id: technicianId,
        amount: 0,
        message: 'Disapproved by technician',
        status: 'rejected',
      })
  } catch {}
}

export async function acceptQuote(quoteId: string): Promise<string> {
  let bookingId: string | null = null

  try {
    const { data, error } = await supabase.rpc('accept_quote', { p_quote_id: quoteId })
    if (!error && data) {
      bookingId = data as string
    }
  } catch {
    // Fall back to direct table update
  }

  if (!bookingId) {
    // Direct table operation fallback
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .select('id, request_id, technician_id, amount, message, service_requests(user_id, location)')
      .eq('id', quoteId)
      .single()

    if (qErr || !quote) {
      throw new Error(qErr?.message || 'Quote not found.')
    }

    const customerUserId = (quote as any).service_requests?.user_id
    const location = (quote as any).service_requests?.location

    const { data: newBooking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        request_id: quote.request_id,
        user_id: customerUserId,
        technician_id: quote.technician_id,
        status: 'accepted',
        location: location || null,
        notes: quote.message || null,
      })
      .select('id')
      .single()

    if (bErr || !newBooking) {
      throw new Error(bErr?.message || 'Could not create booking for quote.')
    }

    bookingId = newBooking.id

    // Update quote & request
    await Promise.all([
      supabase.from('quotes').update({ status: 'accepted' }).eq('id', quoteId),
      supabase.from('service_requests').update({ status: 'booked' }).eq('id', quote.request_id),
    ])
  }

  // Notify customer and technician
  try {
    const { data: quoteData } = await supabase
      .from('quotes')
      .select('amount, request_id, technician_id, service_requests(user_id), technicians(profile_id, profiles(user_id))')
      .eq('id', quoteId)
      .maybeSingle()

    if (quoteData) {
      const q = quoteData as any
      const customerUserId = q.service_requests?.user_id
      const techUserId = q.technicians?.profiles?.user_id

      if (customerUserId) {
        await supabase.from('notifications').insert({
          user_id: customerUserId,
          type: 'quote_accepted',
          title: 'Booking Confirmed',
          message: `Your booking has been confirmed for Rs ${q.amount}.`,
          read: false,
        })
      }

      if (techUserId) {
        await supabase.from('notifications').insert({
          user_id: techUserId,
          type: 'quote_accepted_technician',
          title: 'Quote Accepted!',
          message: `A customer accepted your quote of Rs ${q.amount}! Check your jobs to schedule the visit.`,
          read: false,
        })
      }
    }
  } catch {
    // Ignore notification error
  }

  if (!bookingId) {
    throw new Error('Failed to create booking for quote.')
  }

  return bookingId
}

// ============================================================
// Bookings
// ============================================================

export async function fetchCustomerBookings(userId: string): Promise<BookingWithDetails[]> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, request_id, user_id, technician_id, scheduled_at, location, notes,
        status, created_at, updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return enrichBookings(data)
  } catch {
    return []
  }
}

export async function fetchTechnicianBookings(technicianId: string): Promise<BookingWithDetails[]> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, request_id, user_id, technician_id, scheduled_at, location, notes,
        status, created_at, updated_at
      `)
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return enrichBookings(data)
  } catch {
    return []
  }
}

export async function fetchBookingById(bookingId: string): Promise<BookingWithDetails | null> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, request_id, user_id, technician_id, scheduled_at, location, notes,
        status, created_at, updated_at
      `)
      .eq('id', bookingId)
      .maybeSingle()

    if (error || !data) return null

    const enriched = await enrichBookings([data])
    return enriched[0] ?? null
  } catch {
    return null
  }
}

async function enrichBookings(
  bookings: Array<Record<string, unknown>>,
): Promise<BookingWithDetails[]> {
  if (bookings.length === 0) return []

  const requestIds = [...new Set(bookings.map((b) => b.request_id as string))]
  const technicianIds = [...new Set(bookings.map((b) => b.technician_id as string))]

  const { data: requests } = await supabase
    .from('service_requests')
    .select('id, title, description, image_url, category_id, service_categories!left(name, icon)')
    .in('id', requestIds)

  const reqMap = new Map<string, Record<string, unknown>>()
  for (const r of requests ?? []) {
    reqMap.set(r.id, r)
  }

  let techMap = new Map<string, Record<string, unknown>>()
  try {
    const allTechs = await fetchVerifiedTechnicians()
    for (const t of allTechs) {
      if (technicianIds.includes(t.id)) {
        techMap.set(t.id, t as any)
      }
    }
  } catch {
    // ignore
  }

  const { data: quotes } = await supabase
    .from('quotes')
    .select('request_id, technician_id, amount, message, status')
    .eq('status', 'accepted')
    .in('request_id', requestIds)

  const quoteMap = new Map<string, { amount: number; message: string }>()
  for (const q of quotes ?? []) {
    const key = `${q.request_id}_${q.technician_id}`
    quoteMap.set(key, { amount: q.amount, message: q.message })
  }

  return bookings.map((b) => {
    const req = reqMap.get(b.request_id as string) ?? {}
    const tech = techMap.get(b.technician_id as string) ?? {}
    const quoteKey = `${b.request_id}_${b.technician_id}`
    const quote = quoteMap.get(quoteKey)

    const cat = req.service_categories as { name: string; icon: string | null } | null | undefined

    return {
      id: b.id as string,
      request_id: b.request_id as string,
      user_id: b.user_id as string,
      technician_id: b.technician_id as string,
      scheduled_at: b.scheduled_at as string | null,
      location: b.location as string | null,
      notes: b.notes as string | null,
      status: b.status as string,
      created_at: b.created_at as string,
      updated_at: b.updated_at as string,
      request_title: (req.title as string) ?? null,
      request_description: (req.description as string) ?? null,
      request_image: (req.image_url as string) ?? null,
      request_category_name: cat?.name ?? null,
      request_category_icon: cat?.icon ?? null,
      technician_name: (tech.name as string) ?? null,
      technician_avatar: (tech.avatar_url as string) ?? null,
      technician_profession: (tech.profession as string) ?? null,
      quote_amount: quote?.amount ?? null,
      quote_message: quote?.message ?? null,
    }
  })
}

export async function updateBookingStatus(
  bookingId: string,
  newStatus: string,
): Promise<void> {
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .maybeSingle()

  if (fetchErr) throw new Error(fetchErr.message)
  if (!booking) throw new Error('Booking not found.')

  const currentStatus = booking.status as string

  // Allowed transitions
  const ALLOWED: Record<string, string[]> = {
    accepted: ['scheduled', 'on_the_way', 'in_progress', 'completed', 'cancelled'],
    scheduled: ['on_the_way', 'in_progress', 'completed', 'cancelled'],
    on_the_way: ['in_progress', 'completed', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
  }

  let isValid = (ALLOWED[currentStatus] || []).includes(newStatus)
  try {
    const { data: valid, error: transErr } = await supabase.rpc('valid_booking_status_transition', {
      p_current: currentStatus,
      p_new: newStatus,
    })
    if (!transErr && typeof valid === 'boolean') {
      isValid = valid
    }
  } catch {
    // Keep local validation
  }

  if (!isValid && currentStatus !== newStatus) {
    throw new Error(`Cannot change status from "${currentStatus}" to "${newStatus}".`)
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)

  if (newStatus === 'completed') {
    const { data: b } = await supabase
      .from('bookings')
      .select('request_id, user_id')
      .eq('id', bookingId)
      .maybeSingle()

    if (b) {
      await supabase
        .from('service_requests')
        .update({ status: 'completed' })
        .eq('id', b.request_id)

      // Notify customer of completion and send review reminder
      try {
        await supabase.from('notifications').insert([
          {
            user_id: b.user_id,
            type: 'job_completed',
            title: 'Job Completed',
            message: 'Your service job has been marked as completed.',
            read: false,
          },
          {
            user_id: b.user_id,
            type: 'review_reminder',
            title: 'How was your service?',
            message: 'Please leave a review and rating for your technician.',
            read: false,
          },
        ])
      } catch {
        // ignore notification error
      }
    }
  } else {
    // Notify customer of intermediate status changes
    try {
      const { data: b } = await supabase
        .from('bookings')
        .select('user_id')
        .eq('id', bookingId)
        .maybeSingle()

      if (b?.user_id) {
        const titleMap: Record<string, string> = {
          scheduled: 'Job Scheduled',
          on_the_way: 'Technician On The Way',
          in_progress: 'Job In Progress',
          cancelled: 'Booking Cancelled',
        }
        const msgMap: Record<string, string> = {
          scheduled: 'Your job has been scheduled by the technician.',
          on_the_way: 'Your technician is now on the way to your location.',
          in_progress: 'Your repair job is currently in progress.',
          cancelled: 'The booking has been cancelled.',
        }

        if (titleMap[newStatus]) {
          await supabase.from('notifications').insert({
            user_id: b.user_id,
            type: 'booking_status_updated',
            title: titleMap[newStatus],
            message: msgMap[newStatus],
            read: false,
          })
        }
      }
    } catch {
      // ignore notification error
    }
  }
}

export async function updateBookingScheduledAt(
  bookingId: string,
  scheduledAt: string,
  location: string,
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ scheduled_at: scheduledAt, location, status: 'scheduled' })
    .eq('id', bookingId)

  if (error) throw new Error(error.message)
}

export async function fetchReviewForBooking(bookingId: string): Promise<BookingReview | null> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if (error) return null
    return data as BookingReview | null
  } catch {
    return null
  }
}

export async function createReview(params: {
  bookingId: string
  userId: string
  technicianId: string
  rating: number
  comment: string
}): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .insert({
      booking_id: params.bookingId,
      user_id: params.userId,
      technician_id: params.technicianId,
      rating: params.rating,
      comment: params.comment,
    })

  if (error) throw new Error(error.message)
}
