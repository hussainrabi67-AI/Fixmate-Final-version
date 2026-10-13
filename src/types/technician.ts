export interface TechnicianServiceItem {
  id: string
  name: string
  icon: string | null
}

export interface PublicTechnician {
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
  speciality?: string
  services: TechnicianServiceItem[]
  average_rating: number | null
  completed_jobs: number
  review_count: number
}

export interface ServiceCategoryDB {
  id: string
  name: string
  description: string | null
  icon: string | null
  image_url: string | null
  is_active: boolean
  gradient?: string
  badgeColor?: string
  popularTags?: string[]
}

export interface ReviewWithUser {
  id: string
  rating: number
  comment: string | null
  created_at: string
  user_name: string | null
}
