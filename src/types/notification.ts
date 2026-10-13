export interface NotificationItem {
  id: string
  user_id: string
  type: string | null
  title: string | null
  message: string | null
  read: boolean
  created_at: string
}
