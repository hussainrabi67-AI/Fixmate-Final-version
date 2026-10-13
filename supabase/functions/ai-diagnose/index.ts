import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

interface DiagnoseRequest {
  description: string
  categoryId?: string
  imageUrl?: string
  requestId?: string
}

interface AIDiagnosis {
  problem_summary: string
  possible_causes: string[]
  safe_steps: string[]
  safety_warning: string
  urgency: string
  professional_required: boolean
  recommended_category: string | null
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SYSTEM_PROMPT = `You are FixMate, an AI repair-assistance assistant for home and vehicle problems.
You are NOT a definitive diagnostic authority. You help users with safe first-step guidance.

For every problem, respond ONLY with valid JSON in this exact shape (no markdown, no extra text):
{
  "problem_summary": "short description using 'possible' or 'likely' language",
  "possible_causes": ["cause 1", "cause 2"],
  "safe_steps": ["safe simple step 1", "safe simple step 2"],
  "safety_warning": "what NOT to do for safety",
  "urgency": "low" | "medium" | "high",
  "professional_required": true or false,
  "recommended_category": one of these exact values: "Plumber", "Electrician", "AC / HVAC", "Car Workshop", "Bike Mechanic", "Cleaning", "Carpenter", "Solar", "Appliance Repair", "Painter", "Pest Control", "General Maintenance", or null
}

RULES:
1. Use "possible" or "likely" language. Never claim certainty.
2. Give only safe, simple first-step troubleshooting that a non-technical person can do.
3. For electrical, gas, fire, structural, refrigerant, high-voltage, or safety-critical vehicle problems, set professional_required to true.
4. Never instruct users to perform dangerous repairs.
5. Never invent technicians, prices, ratings, availability, or bookings.
6. recommended_category must be one of the exact category names listed above, or null.
7. If professional help is clearly required, set professional_required = true.
8. If a simple safe check may solve the issue, provide it first in safe_steps.
9. If the user's description is too unclear to give any guidance, return: {"problem_summary": "I need a bit more information", "possible_causes": [], "safe_steps": [], "safety_warning": "", "urgency": "low", "professional_required": false, "recommended_category": null}
10. Keep all text simple and easy for non-technical users to understand.`

function extractJson(text: string): AIDiagnosis | null {
  // Try direct parse first
  try {
    return JSON.parse(text) as AIDiagnosis
  } catch {
    // Try extracting from markdown code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try {
        return JSON.parse(match[1]) as AIDiagnosis
      } catch {
        // fall through
      }
    }
    // Try finding first { to last }
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as AIDiagnosis
      } catch {
        // fall through
      }
    }
  }
  return null
}

function validateDiagnosis(d: AIDiagnosis): AIDiagnosis {
  const validCategories = [
    'Plumber', 'Electrician', 'AC / HVAC', 'Car Workshop', 'Bike Mechanic',
    'Cleaning', 'Carpenter', 'Solar', 'Appliance Repair', 'Painter',
    'Pest Control', 'General Maintenance',
  ]

  return {
    problem_summary: typeof d.problem_summary === 'string' ? d.problem_summary : 'Unable to determine the problem.',
    possible_causes: Array.isArray(d.possible_causes) ? d.possible_causes : [],
    safe_steps: Array.isArray(d.safe_steps) ? d.safe_steps : [],
    safety_warning: typeof d.safety_warning === 'string' ? d.safety_warning : '',
    urgency: ['low', 'medium', 'high'].includes(d.urgency) ? d.urgency : 'medium',
    professional_required: typeof d.professional_required === 'boolean' ? d.professional_required : true,
    recommended_category: d.recommended_category && validCategories.includes(d.recommended_category)
      ? d.recommended_category
      : null,
  }
}

async function diagnoseWithGemini(description: string, imageUrl?: string): Promise<AIDiagnosis> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')

  if (!apiKey) {
    return null
  }

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const parts: Array<Record<string, unknown>> = [
    { text: `${SYSTEM_PROMPT}\n\nUser problem: ${description}` },
  ]

  if (imageUrl) {
    parts.push({ text: '\nAnalyze the problem using the attached image as well.' })
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
    },
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!content) {
    throw new Error('Gemini returned an empty response.')
  }

  const parsed = extractJson(content)
  if (!parsed) {
    throw new Error('Could not parse AI response as JSON.')
  }

  return validateDiagnosis(parsed)
}

function matchKeyword(text: string, kw: string): boolean {
  const normText = text.toLowerCase()
  const normKw = kw.toLowerCase().trim()
  if (!normKw) return false

  if (normKw.length <= 4) {
    const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i')
    return regex.test(normText)
  }

  return normText.includes(normKw)
}

function ruleBasedDiagnosis(description: string): AIDiagnosis {
  const text = description.toLowerCase()

  const rules: Array<{
    keywords: string[]
    category: string
    problem: string
    causes: string[]
    steps: string[]
    warning: string
  }> = [
    {
      keywords: ['washing machine', 'washing', 'washer', 'laundry', 'spin cycle', 'drain pump'],
      category: 'Appliance Repair',
      problem: 'Possible washing machine drain, spin cycle, or motor issue',
      causes: ['Clogged drain pump filter or coin trap', 'Kinked discharge hose', 'Worn drive belt or motor coupling'],
      steps: ['Unplug the washing machine from mains electricity.', 'Clear the coin/drain pump filter at the bottom front.', 'Inspect drain hose for kinks.'],
      warning: 'Disconnect power and water supplies before opening any panels.',
    },
    {
      keywords: ['fridge', 'refrigerator', 'freezer', 'ice maker'],
      category: 'Appliance Repair',
      problem: 'Possible refrigerator temperature control or defrost issue',
      causes: ['Dust-clogged condenser coils', 'Worn door gasket seal', 'Defrost timer fault'],
      steps: ['Gently vacuum dust from condenser coils.', 'Check that the door gasket seals tightly.'],
      warning: 'Never scrape frost with sharp metal tools.',
    },
    {
      keywords: ['dishwasher', 'microwave', 'oven', 'stove', 'appliance'],
      category: 'Appliance Repair',
      problem: 'Possible kitchen appliance electrical or component fault',
      causes: ['Blown internal fuse', 'Faulty heating element', 'Control board error'],
      steps: ['Unplug appliance for 5 minutes to reset the electronics.', 'Verify the wall outlet is working.'],
      warning: 'Never open microwave casings due to high-voltage capacitor risk.',
    },
    {
      keywords: ['air conditioner', 'air conditioning', 'ac unit', 'split ac', 'cooling', 'hvac', 'compressor', 'ac'],
      category: 'AC / HVAC',
      problem: 'Possible AC cooling or airflow restriction issue',
      causes: ['Clogged air filter', 'Blocked outdoor airflow', 'Low refrigerant level'],
      steps: ['Check and clean the washable air filter.', 'Ensure vents and outdoor unit are unobstructed.'],
      warning: 'Do not open the refrigerant system or electrical components yourself.',
    },
    {
      keywords: ['pipe', 'leak', 'tap', 'faucet', 'water', 'drain', 'toilet', 'sink', 'plumb'],
      category: 'Plumber',
      problem: 'Possible plumbing leak or blockage',
      causes: ['Loose fitting or worn washer', 'Pipe corrosion', 'Clogged drain line'],
      steps: ['Turn off the water supply to the affected fixture.', 'Check if a fitting can be tightened by hand.'],
      warning: 'Do not use chemical drain cleaners on damaged pipes.',
    },
    {
      keywords: ['electric', 'wiring', 'switch', 'socket', 'power', 'light', 'short', 'breaker'],
      category: 'Electrician',
      problem: 'Possible electrical circuit or fixture fault',
      causes: ['Loose wiring connection', 'Tripped breaker or blown fuse', 'Faulty switch or socket'],
      steps: ['Turn off the main breaker switch for that circuit.', 'Check for overloaded multi-plug outlets.'],
      warning: 'Never touch exposed wires or open the main panel with wet hands.',
    },
    {
      keywords: ['car', 'engine', 'brake', 'tyre', 'tire', 'battery', 'motor'],
      category: 'Car Workshop',
      problem: 'Possible automotive mechanical or electrical issue',
      causes: ['Worn part needing replacement', 'Low fluid level', 'Weak 12V battery'],
      steps: ['Check for active dashboard warning lights.', 'Inspect fluid levels safely when engine is cold.'],
      warning: 'Do not work under a vehicle supported only by a jack.',
    },
  ]

  const match = rules.find((r) => r.keywords.some((k) => matchKeyword(text, k)))

  if (match) {
    return {
      problem_summary: match.problem,
      possible_causes: match.causes,
      safe_steps: match.steps,
      safety_warning: match.warning,
      urgency: 'medium',
      professional_required: true,
      recommended_category: match.category,
    }
  }

  return {
    problem_summary: 'General repair issue',
    possible_causes: ['Wear and tear', 'Loose or damaged component', 'Environmental factors'],
    safe_steps: ['Inspect the area carefully for visible damage.', 'Take a photo and note when the problem started.'],
    safety_warning: 'If you smell gas, see sparks, or hear unusual noises, stop and call a professional immediately.',
    urgency: 'medium',
    professional_required: true,
    recommended_category: 'General Maintenance',
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const body = await req.json() as DiagnoseRequest

    if (!body.description?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Please describe your problem first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let diagnosis: AIDiagnosis
    let usedAI = false

    try {
      const aiResult = await diagnoseWithGemini(body.description, body.imageUrl)
      if (aiResult) {
        diagnosis = aiResult
        usedAI = true
      } else {
        diagnosis = ruleBasedDiagnosis(body.description)
      }
    } catch {
      diagnosis = ruleBasedDiagnosis(body.description)
    }

    // Save diagnosis to ai_diagnoses table if we have a request ID
    if (body.requestId && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      let recommendedCategoryId: string | null = null
      if (diagnosis.recommended_category) {
        const { data: cat } = await supabase
          .from('service_categories')
          .select('id')
          .eq('name', diagnosis.recommended_category)
          .maybeSingle()
        recommendedCategoryId = cat?.id ?? null
      }

      await supabase.from('ai_diagnoses').insert({
        request_id: body.requestId,
        problem_summary: diagnosis.problem_summary,
        possible_causes: diagnosis.possible_causes,
        safe_steps: diagnosis.safe_steps,
        safety_warning: diagnosis.safety_warning,
        urgency: diagnosis.urgency,
        professional_required: diagnosis.professional_required,
        recommended_category: recommendedCategoryId,
      })
    }

    return new Response(
      JSON.stringify({ diagnosis, aiPowered: usedAI }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Something went wrong analyzing your problem. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
