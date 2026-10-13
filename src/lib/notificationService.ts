import { supabase } from './supabase'
import type { NotificationItem } from '../types/notification'

export async function fetchUserNotifications(userId: string): Promise<NotificationItem[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, message, read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return data as NotificationItem[]
  } catch {
    return []
  }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
  } catch {
    // Ignore error in fallback
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
  } catch {
    // Ignore error in fallback
  }
}

export async function createNotification(params: {
  userId: string
  type: string
  title: string
  message: string
}): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      read: false,
    })
  } catch {
    // Ignore error in fallback
  }
}

export async function notifyTechniciansForCategory(
  categoryId: string,
  requestTitle: string,
): Promise<void> {
  try {
    const { data: techServices } = await supabase
      .from('technician_services')
      .select('technician_id, technicians(profile_id, profiles(user_id))')
      .eq('service_category_id', categoryId)

    if (!techServices || techServices.length === 0) return

    const userIds = new Set<string>()
    for (const ts of techServices as any[]) {
      const uId = ts.technicians?.profiles?.user_id
      if (uId) userIds.add(uId)
    }

    for (const userId of userIds) {
      await createNotification({
        userId,
        type: 'new_matching_request',
        title: 'New Service Request',
        message: `A new request matching your service is available: "${requestTitle.slice(0, 50)}..."`,
      })
    }
  } catch {
    // Ignore error in fallback
  }
}

export async function notifyAdmins(
  type: string,
  title: string,
  message: string,
): Promise<void> {
  try {
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin')

    if (!adminProfiles || adminProfiles.length === 0) return

    for (const admin of adminProfiles) {
      await createNotification({
        userId: admin.user_id,
        type,
        title,
        message,
      })
    }
  } catch {
    // Ignore error in fallback
  }
}
