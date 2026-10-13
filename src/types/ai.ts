export interface AIDiagnosis {
  problem_summary: string
  problem_summary_urdu?: string
  detected_objects?: string[]
  possible_causes: string[]
  possible_causes_urdu?: string[]
  safe_steps: string[]
  safe_steps_urdu?: string[]
  safety_warning: string
  safety_warning_urdu?: string
  urgency: string
  professional_required: boolean
  recommended_category?: string | null
  conversational_reply?: string
  source?: 'n8n' | 'gemini' | 'system'
  raw_agent_reply?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  diagnosis?: AIDiagnosis
  imageUrl?: string
  source?: 'n8n' | 'gemini' | 'system'
}
