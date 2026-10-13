import { supabase } from './supabase'

export interface AdminKPIMetrics {
  totalUsers: number
  totalTechnicians: number
  pendingVerification: number
  totalRequests: number
  activeBookings: number
  completedJobs: number
  openComplaints: number
}

export interface AdminRequestItem {
  id: string
  user_id: string
  title: string | null
  description: string | null
  category_name: string | null
  category_icon: string | null
  location: string | null
  status: string
  created_at: string
  customer_name: string | null
  customer_email: string | null
}

export interface AdminTechnicianItem {
  id: string
  profile_id: string
  profession: string | null
  experience_years: number | null
  service_area: string | null
  whatsapp_number: string | null
  verification_status: string
  bio: string | null
  availability: string
  avatar_url: string | null
  created_at: string
  name: string | null
  email: string | null
  phone: string | null
  completed_jobs_count: number
}

export interface AdminUserItem {
  id: string
  user_id: string
  name: string | null
  email: string | null
  phone: string | null
  role: string
  avatar_url: string | null
  created_at: string
}

export interface AdminBookingItem {
  id: string
  request_id: string
  user_id: string
  technician_id: string
  scheduled_at: string | null
  location: string | null
  notes: string | null
  status: string
  created_at: string
  customer_name: string | null
  technician_name: string | null
  category_name: string | null
}

export interface AdminComplaintItem {
  id: string
  user_id: string
  booking_id: string
  subject: string | null
  description: string | null
  status: string
  created_at: string
  customer_name: string | null
  customer_email: string | null
}

export interface AdminReviewItem {
  id: string
  booking_id: string
  user_id: string
  technician_id: string
  rating: number
  comment: string | null
  created_at: string
  customer_name: string | null
  technician_name: string | null
}

export interface AdminNotificationItem {
  id: string
  user_id: string
  type: string | null
  title: string | null
  message: string | null
  read: boolean
  created_at: string
}

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export async function fetchAdminKPIMetrics(): Promise<AdminKPIMetrics> {
  try {
    const [
      { count: usersCount },
      { count: techsCount },
      { count: pendingTechsCount },
      { count: reqsCount },
      { count: activeBooksCount },
      { count: completedJobsCount },
      { count: complaintsCount },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('technicians').select('*', { count: 'exact', head: true }),
      supabase
        .from('technicians')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'pending'),
      supabase.from('service_requests').select('*', { count: 'exact', head: true }),
      supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("completed","cancelled")'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
    ])

    // Fallback cross-check for technician profiles
    let effectivePending = pendingTechsCount ?? 0
    let effectiveTechs = techsCount ?? 0

    if (effectiveTechs === 0) {
      const { count: techProfilesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'technician')
      if (techProfilesCount && techProfilesCount > 0) {
        effectiveTechs = techProfilesCount
        effectivePending = Math.max(effectivePending, techProfilesCount)
      }
    }

    return {
      totalUsers: usersCount ?? 0,
      totalTechnicians: effectiveTechs,
      pendingVerification: effectivePending,
      totalRequests: reqsCount ?? 0,
      activeBookings: activeBooksCount ?? 0,
      completedJobs: completedJobsCount ?? 0,
      openComplaints: complaintsCount ?? 0,
    }
  } catch (err) {
    console.warn('Error fetching admin metrics:', err)
    return {
      totalUsers: 0,
      totalTechnicians: 0,
      pendingVerification: 0,
      totalRequests: 0,
      activeBookings: 0,
      completedJobs: 0,
      openComplaints: 0,
    }
  }
}

export async function fetchRequestsTrend(): Promise<ChartDataPoint[]> {
  try {
    const { data } = await supabase
      .from('service_requests')
      .select('created_at')
      .order('created_at', { ascending: true })

    const now = new Date()
    const days: ChartDataPoint[] = []
    const dayMap = new Map<string, number>()

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, 0)
    }

    if (data && data.length > 0) {
      for (const row of data) {
        if (row.created_at) {
          const key = row.created_at.slice(0, 10)
          if (dayMap.has(key)) {
            dayMap.set(key, (dayMap.get(key) || 0) + 1)
          }
        }
      }
    }

    dayMap.forEach((val, dateKey) => {
      const d = new Date(dateKey + 'T00:00:00')
      days.push({
        label: d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' }),
        value: val,
      })
    })

    return days
  } catch {
    return []
  }
}

export async function fetchRequestsByCategoryChart(): Promise<ChartDataPoint[]> {
  try {
    const { data } = await supabase
      .from('service_requests')
      .select('category_id, service_categories!left(name)')

    const countMap = new Map<string, number>()
    for (const r of data ?? []) {
      const catName = (r as any).service_categories?.name || 'General'
      countMap.set(catName, (countMap.get(catName) || 0) + 1)
    }

    const result: ChartDataPoint[] = []
    const palette = ['#7C3AED', '#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6', '#8B5CF6']
    let i = 0
    countMap.forEach((count, name) => {
      result.push({
        label: name,
        value: count,
        color: palette[i % palette.length],
      })
      i++
    })

    return result.sort((a, b) => b.value - a.value).slice(0, 6)
  } catch {
    return []
  }
}

export async function fetchBookingStatusChart(): Promise<ChartDataPoint[]> {
  try {
    const { data } = await supabase.from('bookings').select('status')
    const countMap = new Map<string, number>()
    for (const b of data ?? []) {
      const status = b.status || 'requested'
      countMap.set(status, (countMap.get(status) || 0) + 1)
    }

    const statusColors: Record<string, string> = {
      requested: '#94A3B8',
      accepted: '#6366F1',
      scheduled: '#3B82F6',
      on_the_way: '#F59E0B',
      in_progress: '#8B5CF6',
      completed: '#10B981',
      cancelled: '#EF4444',
    }

    const statusLabels: Record<string, string> = {
      requested: 'Requested',
      accepted: 'Accepted',
      scheduled: 'Scheduled',
      on_the_way: 'On The Way',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    }

    const result: ChartDataPoint[] = []
    countMap.forEach((count, status) => {
      result.push({
        label: statusLabels[status] || status,
        value: count,
        color: statusColors[status] || '#7C3AED',
      })
    })

    return result
  } catch {
    return []
  }
}

export async function fetchTechnicianVerificationChart(): Promise<ChartDataPoint[]> {
  try {
    const { data } = await supabase.from('technicians').select('verification_status')
    const countMap = new Map<string, number>()
    for (const t of data ?? []) {
      const st = t.verification_status || 'pending'
      countMap.set(st, (countMap.get(st) || 0) + 1)
    }

    const statusColors: Record<string, string> = {
      approved: '#10B981',
      verified: '#10B981',
      pending: '#F59E0B',
      rejected: '#EF4444',
    }

    const result: ChartDataPoint[] = []
    countMap.forEach((count, st) => {
      result.push({
        label: st.charAt(0).toUpperCase() + st.slice(1),
        value: count,
        color: statusColors[st] || '#94A3B8',
      })
    })

    return result
  } catch {
    return []
  }
}

export async function fetchAdminRecentRequests(limit = 8): Promise<AdminRequestItem[]> {
  try {
    const { data: requests, error } = await supabase
      .from('service_requests')
      .select(`
        id, user_id, category_id, title, description, location, status, created_at,
        service_categories!left(name, icon)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !requests) return []

    const userIds = [...new Set(requests.map((r) => r.user_id).filter(Boolean))]
    const profileMap = new Map<string, { name: string | null; email: string | null }>()

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds)
      for (const p of profiles ?? []) {
        profileMap.set(p.user_id, { name: p.name, email: p.email })
      }
    }

    return requests.map((r: any) => {
      const prof = profileMap.get(r.user_id)
      return {
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        description: r.description,
        category_name: r.service_categories?.name ?? null,
        category_icon: r.service_categories?.icon ?? null,
        location: r.location,
        status: r.status,
        created_at: r.created_at,
        customer_name: prof?.name ?? 'Customer',
        customer_email: prof?.email ?? '',
      }
    })
  } catch {
    return []
  }
}

export async function fetchAllAdminRequests(statusFilter = ''): Promise<AdminRequestItem[]> {
  try {
    let query = supabase
      .from('service_requests')
      .select(`
        id, user_id, category_id, title, description, location, status, created_at,
        service_categories!left(name, icon)
      `)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: requests, error } = await query
    if (error || !requests) return []

    const userIds = [...new Set(requests.map((r) => r.user_id).filter(Boolean))]
    const profileMap = new Map<string, { name: string | null; email: string | null }>()

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds)
      for (const p of profiles ?? []) {
        profileMap.set(p.user_id, { name: p.name, email: p.email })
      }
    }

    return requests.map((r: any) => {
      const prof = profileMap.get(r.user_id)
      return {
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        description: r.description,
        category_name: r.service_categories?.name ?? null,
        category_icon: r.service_categories?.icon ?? null,
        location: r.location,
        status: r.status,
        created_at: r.created_at,
        customer_name: prof?.name ?? 'Customer',
        customer_email: prof?.email ?? '',
      }
    })
  } catch {
    return []
  }
}

export async function fetchAdminPendingTechnicians(): Promise<AdminTechnicianItem[]> {
  try {
    // 1. Query technicians with status pending
    const { data: techs, error } = await supabase
      .from('technicians')
      .select('*')
      .in('verification_status', ['pending', 'unverified'])
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Error querying pending technicians:', error)
    }

    const list = techs || []
    const profileIds = [...new Set(list.map((t) => t.profile_id).filter(Boolean))]
    const profileMap = new Map<string, { id: string; user_id: string; name: string | null; email: string | null; phone: string | null }>()

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, name, email, phone')
        .in('id', profileIds)

      for (const p of profiles ?? []) {
        profileMap.set(p.id, p)
        profileMap.set(p.user_id, p)
      }
    }

    // 2. Also check if there are profiles with role = 'technician' that don't have a technician row yet
    const { data: techProfiles } = await supabase
      .from('profiles')
      .select('id, user_id, name, email, phone, created_at')
      .eq('role', 'technician')

    const existingProfileIds = new Set(list.map((t) => t.profile_id))
    const syntheticItems: AdminTechnicianItem[] = []

    for (const tp of techProfiles ?? []) {
      if (!existingProfileIds.has(tp.id)) {
        syntheticItems.push({
          id: tp.id,
          profile_id: tp.id,
          profession: 'Specialist',
          experience_years: null,
          service_area: null,
          whatsapp_number: null,
          verification_status: 'pending',
          bio: null,
          availability: 'available',
          avatar_url: null,
          created_at: tp.created_at || new Date().toISOString(),
          name: tp.name || 'Technician',
          email: tp.email || '',
          phone: tp.phone || '',
          completed_jobs_count: 0,
        })
      }
    }

    const mappedItems: AdminTechnicianItem[] = list.map((t: any) => {
      const prof = profileMap.get(t.profile_id)
      return {
        id: t.id,
        profile_id: t.profile_id,
        profession: t.profession || 'Specialist',
        experience_years: t.experience_years,
        service_area: t.service_area,
        whatsapp_number: t.whatsapp_number,
        verification_status: t.verification_status || 'pending',
        bio: t.bio,
        availability: t.availability || 'available',
        avatar_url: t.avatar_url,
        created_at: t.created_at,
        name: prof?.name || 'Technician',
        email: prof?.email || '',
        phone: prof?.phone || '',
        completed_jobs_count: 0,
      }
    })

    return [...mappedItems, ...syntheticItems]
  } catch (err) {
    console.warn('Could not load pending technicians:', err)
    return []
  }
}

export async function fetchAllAdminTechnicians(filterStatus = ''): Promise<AdminTechnicianItem[]> {
  try {
    let query = supabase.from('technicians').select('*').order('created_at', { ascending: false })

    if (filterStatus) {
      query = query.eq('verification_status', filterStatus)
    }

    const { data: techs, error } = await query
    if (error) {
      console.warn('Error fetching all technicians:', error)
    }

    const list = techs || []
    const profileIds = [...new Set(list.map((t) => t.profile_id).filter(Boolean))]
    const profileMap = new Map<string, { id: string; user_id: string; name: string | null; email: string | null; phone: string | null }>()

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, user_id, name, email, phone')
        .in('id', profileIds)

      for (const p of profiles ?? []) {
        profileMap.set(p.id, p)
        profileMap.set(p.user_id, p)
      }
    }

    // Include any technician profiles if no filter or pending filter
    const syntheticItems: AdminTechnicianItem[] = []
    if (!filterStatus || filterStatus === 'pending') {
      const { data: techProfiles } = await supabase
        .from('profiles')
        .select('id, user_id, name, email, phone, created_at')
        .eq('role', 'technician')

      const existingProfileIds = new Set(list.map((t) => t.profile_id))
      for (const tp of techProfiles ?? []) {
        if (!existingProfileIds.has(tp.id)) {
          syntheticItems.push({
            id: tp.id,
            profile_id: tp.id,
            profession: 'Specialist',
            experience_years: null,
            service_area: null,
            whatsapp_number: null,
            verification_status: 'pending',
            bio: null,
            availability: 'available',
            avatar_url: null,
            created_at: tp.created_at || new Date().toISOString(),
            name: tp.name || 'Technician',
            email: tp.email || '',
            phone: tp.phone || '',
            completed_jobs_count: 0,
          })
        }
      }
    }

    const mappedItems: AdminTechnicianItem[] = list.map((t: any) => {
      const prof = profileMap.get(t.profile_id)
      return {
        id: t.id,
        profile_id: t.profile_id,
        profession: t.profession || 'Specialist',
        experience_years: t.experience_years,
        service_area: t.service_area,
        whatsapp_number: t.whatsapp_number,
        verification_status: t.verification_status || 'pending',
        bio: t.bio,
        availability: t.availability || 'available',
        avatar_url: t.avatar_url,
        created_at: t.created_at,
        name: prof?.name || 'Technician',
        email: prof?.email || '',
        phone: prof?.phone || '',
        completed_jobs_count: 0,
      }
    })

    return [...mappedItems, ...syntheticItems]
  } catch (err) {
    console.warn('Could not load all technicians:', err)
    return []
  }
}

export async function updateTechnicianVerificationStatus(
  technicianId: string,
  newStatus: 'approved' | 'rejected' | 'verified' | 'pending' | 'deactivated' | 'inactive',
): Promise<void> {
  let resolvedProfileId: string | null = null

  // 1. Try direct update by technician id
  const { data: updatedById } = await supabase
    .from('technicians')
    .update({ verification_status: newStatus })
    .eq('id', technicianId)
    .select('id, profile_id')

  if (updatedById && updatedById.length > 0) {
    resolvedProfileId = updatedById[0].profile_id
  } else {
    // 2. Try update by profile_id
    const { data: updatedByProfile } = await supabase
      .from('technicians')
      .update({ verification_status: newStatus })
      .eq('profile_id', technicianId)
      .select('id, profile_id')

    if (updatedByProfile && updatedByProfile.length > 0) {
      resolvedProfileId = updatedByProfile[0].profile_id
    } else {
      // 3. If record doesn't exist yet, look up profile by id or user_id and create it
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, user_id')
        .or(`id.eq.${technicianId},user_id.eq.${technicianId}`)
        .maybeSingle()

      if (prof) {
        resolvedProfileId = prof.id
        await supabase.from('technicians').upsert({
          profile_id: prof.id,
          profession: 'Specialist',
          verification_status: newStatus,
        })
      }
    }
  }

  // If approved or verified, ensure profile has role 'technician'
  if ((newStatus === 'approved' || newStatus === 'verified') && resolvedProfileId) {
    try {
      await supabase
        .from('profiles')
        .update({ role: 'technician' })
        .eq('id', resolvedProfileId)
    } catch {
      // ignore
    }
  }

  // Notify the technician
  try {
    const targetProfId = resolvedProfileId || technicianId
    const { data: prof } = await supabase
      .from('profiles')
      .select('user_id')
      .or(`id.eq.${targetProfId},user_id.eq.${targetProfId}`)
      .maybeSingle()

    if (prof?.user_id) {
      const isApproved = newStatus === 'approved' || newStatus === 'verified'
      await supabase.from('notifications').insert({
        user_id: prof.user_id,
        type: isApproved ? 'technician_approved' : 'technician_rejected',
        title: isApproved ? 'Profile Approved!' : 'Profile Verification Update',
        message: isApproved
          ? 'Your technician profile has been approved! You will now receive service requests from customers.'
          : 'Your technician application could not be approved at this time.',
        read: false,
      })
    }
  } catch {
    // ignore notification error
  }
}

export async function fetchAdminUsers(search = '', roleFilter = ''): Promise<AdminUserItem[]> {
  try {
    let query = supabase
      .from('profiles')
      .select('id, user_id, name, email, phone, role, avatar_url, created_at')
      .order('created_at', { ascending: false })

    if (roleFilter) {
      query = query.eq('role', roleFilter)
    }

    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error || !data) return []
    return data as AdminUserItem[]
  } catch {
    return []
  }
}

export async function fetchAdminBookings(statusFilter = ''): Promise<AdminBookingItem[]> {
  try {
    let query = supabase
      .from('bookings')
      .select(`
        id, request_id, user_id, technician_id, scheduled_at, location, notes, status, created_at,
        profiles!bookings_user_id_fkey(name),
        service_requests!bookings_request_id_fkey(service_categories!left(name))
      `)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query
    if (error || !data) {
      // Fallback simple query
      const { data: rawBookings } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })

      if (!rawBookings) return []
      return rawBookings.map((b: any) => ({
        id: b.id,
        request_id: b.request_id,
        user_id: b.user_id,
        technician_id: b.technician_id,
        scheduled_at: b.scheduled_at,
        location: b.location,
        notes: b.notes,
        status: b.status,
        created_at: b.created_at,
        customer_name: 'Customer',
        technician_name: 'Technician',
        category_name: 'Service',
      }))
    }

    return data.map((b: any) => ({
      id: b.id,
      request_id: b.request_id,
      user_id: b.user_id,
      technician_id: b.technician_id,
      scheduled_at: b.scheduled_at,
      location: b.location,
      notes: b.notes,
      status: b.status,
      created_at: b.created_at,
      customer_name: b.profiles?.name ?? 'Customer',
      technician_name: 'Technician',
      category_name: b.service_requests?.service_categories?.name ?? 'Service',
    }))
  } catch {
    return []
  }
}

export async function fetchAdminComplaints(statusFilter = ''): Promise<AdminComplaintItem[]> {
  try {
    let query = supabase
      .from('complaints')
      .select('*')
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: complaints, error } = await query
    if (error || !complaints) return []

    const userIds = [...new Set(complaints.map((c) => c.user_id).filter(Boolean))]
    const profileMap = new Map<string, { name: string | null; email: string | null }>()

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds)
      for (const p of profiles ?? []) {
        profileMap.set(p.user_id, { name: p.name, email: p.email })
      }
    }

    return complaints.map((c: any) => {
      const prof = profileMap.get(c.user_id)
      return {
        id: c.id,
        user_id: c.user_id,
        booking_id: c.booking_id,
        subject: c.subject,
        description: c.description,
        status: c.status,
        created_at: c.created_at,
        customer_name: prof?.name ?? 'Customer',
        customer_email: prof?.email ?? '',
      }
    })
  } catch {
    return []
  }
}

export async function updateComplaintStatus(
  complaintId: string,
  newStatus: string,
): Promise<void> {
  const { error } = await supabase
    .from('complaints')
    .update({ status: newStatus })
    .eq('id', complaintId)

  if (error) throw new Error(error.message)
}

export async function fetchAdminReviews(): Promise<AdminReviewItem[]> {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !reviews) return []

    const userIds = [...new Set(reviews.map((r) => r.user_id).filter(Boolean))]
    const profileMap = new Map<string, string>()

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds)
      for (const p of profiles ?? []) {
        if (p.name) profileMap.set(p.user_id, p.name)
      }
    }

    return reviews.map((r: any) => ({
      id: r.id,
      booking_id: r.booking_id,
      user_id: r.user_id,
      technician_id: r.technician_id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      customer_name: profileMap.get(r.user_id) ?? 'Customer',
      technician_name: 'Technician',
    }))
  } catch {
    return []
  }
}

export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId)
  if (error) throw new Error(error.message)
}

export async function fetchAdminNotifications(): Promise<AdminNotificationItem[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, message, read, created_at')
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return data as AdminNotificationItem[]
  } catch {
    return []
  }
}

export async function markAdminNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)

  if (error) throw new Error(error.message)
}

export async function markAllAdminNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false)

  if (error) throw new Error(error.message)
}

export async function toggleServiceCategory(
  categoryId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('service_categories')
    .update({ is_active: isActive })
    .eq('id', categoryId)

  if (error) throw new Error(error.message)
}
