export interface ServiceRequestWithCategory {
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
  category_name: string | null
  category_icon: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  diagnosis_summary: string | null
  diagnosis_urgency: string | null
  diagnosis_professional: boolean | null
}

export interface QuoteWithTechnician {
  id: string
  request_id: string
  technician_id: string
  amount: number | null
  message: string | null
  status: string
  created_at: string
  technician_name: string | null
  technician_avatar: string | null
  technician_profession: string | null
  technician_experience: number | null
  technician_service_area: string | null
  technician_rating: number | null
  technician_review_count: number
  technician_completed_jobs: number
}

export interface BookingWithDetails {
  id: string
  request_id: string
  user_id: string
  technician_id: string
  scheduled_at: string | null
  location: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
  request_title: string | null
  request_description: string | null
  request_image: string | null
  request_category_name: string | null
  request_category_icon: string | null
  technician_name: string | null
  technician_avatar: string | null
  technician_profession: string | null
  quote_amount: number | null
  quote_message: string | null
}

export interface BookingReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

export const BOOKING_STEPS = [
  'requested',
  'accepted',
  'scheduled',
  'on_the_way',
  'in_progress',
  'completed',
] as const

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  accepted: 'Accepted',
  scheduled: 'Scheduled',
  on_the_way: 'On The Way',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  requested: 'Request Sent',
  matching: 'Matching',
  quoted: 'Quoted',
  booked: 'Booked',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
}
