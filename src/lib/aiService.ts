import { supabase } from './supabase'
import type { AIDiagnosis } from '../types/ai'
import { queryN8nAiAgent, isN8nChatConfigured, isGreetingOrGeneralChat } from './n8nService'
import { compressImageToDataUrl } from './technicianService'

/**
 * Checks if a search keyword matches within the input text safely.
 * For short words (<= 4 chars like 'ac', 'tap', 'car'), whole-word boundary
 * matching is strictly enforced so substrings inside words like 'machine' or
 * 'surface' or 'tractor' NEVER falsely match.
 */
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

export function getCategorySlugAndTitle(categoryNameOrText?: string | null): { slug: string; title: string; icon: string } | null {
  if (!categoryNameOrText) return null
  const lower = categoryNameOrText.toLowerCase().trim()

  if (
    lower.includes('electr') ||
    lower.includes('wire') ||
    lower.includes('circuit') ||
    lower.includes('breaker') ||
    lower.includes('short') ||
    lower.includes('voltage') ||
    lower.includes('spark') ||
    lower.includes('switch') ||
    lower.includes('shock') ||
    lower.includes('bijli') ||
    lower.includes('socket') ||
    lower.includes('current') ||
    lower.includes('power outlet')
  ) {
    return { slug: 'electrician', title: 'Verified Electricians', icon: '⚡' }
  }
  if (
    lower.includes('plumb') ||
    lower.includes('pipe') ||
    lower.includes('leak') ||
    lower.includes('tap') ||
    lower.includes('drain') ||
    lower.includes('sink') ||
    lower.includes('water') ||
    lower.includes('sanitary') ||
    lower.includes('sewer') ||
    lower.includes('paani') ||
    lower.includes('faucet') ||
    lower.includes('geyser')
  ) {
    return { slug: 'plumber', title: 'Certified Plumbers', icon: '🚰' }
  }
  if (
    lower.includes('ac') ||
    lower.includes('hvac') ||
    lower.includes('cool') ||
    lower.includes('air condition') ||
    lower.includes('refrigerant') ||
    lower.includes('gas refill') ||
    lower.includes('compressor')
  ) {
    return { slug: 'ac', title: 'AC & HVAC Specialists', icon: '❄️' }
  }
  if (
    lower.includes('carpent') ||
    lower.includes('wood') ||
    lower.includes('furniture') ||
    lower.includes('door') ||
    lower.includes('cabinet') ||
    lower.includes('lock') ||
    lower.includes('lakri')
  ) {
    return { slug: 'carpenter', title: 'Master Carpenters', icon: '🔨' }
  }
  if (
    lower.includes('appliance') ||
    lower.includes('washing') ||
    lower.includes('washer') ||
    lower.includes('fridge') ||
    lower.includes('refrigerator') ||
    lower.includes('microwave') ||
    lower.includes('oven') ||
    lower.includes('dryer') ||
    lower.includes('dishwasher')
  ) {
    return { slug: 'appliance', title: 'Appliance Repair Experts', icon: '🧺' }
  }
  if (
    lower.includes('car') ||
    lower.includes('auto') ||
    lower.includes('workshop') ||
    lower.includes('vehicle') ||
    lower.includes('engine') ||
    lower.includes('brake') ||
    lower.includes('oil change') ||
    lower.includes('gari')
  ) {
    return { slug: 'car', title: 'Car Workshop Mechanics', icon: '🚗' }
  }
  if (lower.includes('bike') || lower.includes('motorcycle') || lower.includes('scooter') || lower.includes('tuning')) {
    return { slug: 'bike', title: 'Bike Mechanics', icon: '🏍️' }
  }
  if (lower.includes('solar') || lower.includes('inverter') || lower.includes('panel')) {
    return { slug: 'solar', title: 'Solar & Inverter Technicians', icon: '☀️' }
  }
  if (lower.includes('paint') || lower.includes('wall') || lower.includes('coating') || lower.includes('dampness')) {
    return { slug: 'painter', title: 'Professional Painters', icon: '🎨' }
  }
  if (lower.includes('pest') || lower.includes('termite') || lower.includes('fumigation') || lower.includes('bug') || lower.includes('cockroach')) {
    return { slug: 'pest', title: 'Pest Control Specialists', icon: '🐜' }
  }
  if (lower.includes('clean') || lower.includes('sofa') || lower.includes('sanitiz')) {
    return { slug: 'cleaning', title: 'Cleaning & Sanitization Experts', icon: '🧹' }
  }
  if (lower.includes('handyman') || lower.includes('drill') || (lower.includes('general') && lower.includes('maintenance'))) {
    return { slug: 'general', title: 'General Maintenance Specialists', icon: '🔧' }
  }

  return null
}

export function ruleBasedDiagnosis(description: string): AIDiagnosis {
  const text = description.toLowerCase().trim()

  if (isGreetingOrGeneralChat(text)) {
    const isUrdu = /[\u0600-\u06FF]|salam|aoa|kaise|kya|shukriya|hafiz|theek/i.test(text)
    if (isUrdu) {
      return {
        problem_summary: 'السلام علیکم! میں فکس میٹ اے آئی اسسٹنٹ ہوں۔ میں آپ کی گھر کی مرمت میں کس طرح مدد کر سکتا ہوں؟',
        possible_causes: [],
        safe_steps: [],
        safety_warning: '',
        urgency: 'low',
        professional_required: false,
        recommended_category: null,
        conversational_reply: 'السلام علیکم! میں فکس میٹ اے آئی اسسٹنٹ ہوں۔ میں آپ کی گھر کی مرمت (پلمبنگ، الیکٹریکل، اے سی، ہوم اپلائنسز) میں کس طرح مدد کر سکتا ہوں؟ آپ اپنے مسئلے کی تفصیل لکھ سکتے ہیں یا تصویر اپ لوڈ کر سکتے ہیں۔',
        source: 'system',
      }
    }

    return {
      problem_summary: 'Hello! I am FixMate AI Assistant. How can I assist you with your home repairs today?',
      possible_causes: [],
      safe_steps: [],
      safety_warning: '',
      urgency: 'low',
      professional_required: false,
      recommended_category: null,
      conversational_reply: 'Hello! I am FixMate AI Assistant. How can I assist you with your home repairs, plumbing, electrical, AC, or appliances today? You can describe your issue or upload a photo for instant diagnosis.',
      source: 'system',
    }
  }

  const rules: Array<{
    keywords: string[]
    category: string
    problem: string
    causes: string[]
    steps: string[]
    warning: string
  }> = [
    // 1. Washing Machine & Laundry (evaluated first so "machine" is never mistaken for AC)
    {
      keywords: [
        'washing machine',
        'washing',
        'washer',
        'laundry machine',
        'spin cycle',
        'drain pump',
        'washing tub',
        'front load',
        'top load',
        'agitator',
      ],
      category: 'Appliance Repair',
      problem: 'Possible washing machine drain, spin cycle, or motor issue',
      causes: [
        'Clogged drain pump filter or debris trapped in coin trap',
        'Kinked or blocked drain discharge hose',
        'Worn drive belt or motor coupling',
        'Faulty lid switch / door latch sensor preventing spin cycle',
      ],
      steps: [
        'Turn off and unplug the washing machine from the mains electrical socket.',
        'Locate and unscrew the coin/drain pump filter at the bottom front to clear debris.',
        'Check the drain hose behind the unit for kinks or blockages.',
        'Ensure the drum load is evenly distributed and the door latch clicks securely.',
      ],
      warning:
        'Always disconnect both power and water supply valves before opening access panels or inspecting internal electrical parts.',
    },

    // 2. Refrigeration & Cold Storage
    {
      keywords: ['fridge', 'refrigerator', 'freezer', 'ice maker', 'cooling coils', 'condenser'],
      category: 'Appliance Repair',
      problem: 'Possible refrigerator temperature control or defrost issue',
      causes: [
        'Dust-clogged condenser coils underneath or behind unit',
        'Worn door gasket seal allowing cold air to escape',
        'Faulty defrost timer, thermostat, or evaporator fan motor',
      ],
      steps: [
        'Clean dust and pet hair from the condenser coils using a vacuum brush attachment.',
        'Test the door seal by closing it on a sheet of paper; replace gasket if loose.',
        'Ensure there is at least 2 inches of airflow space around the back and sides.',
      ],
      warning:
        'Never scrape frost using sharp metal knives or tools, as punctured evaporator coils release pressurized refrigerant gas.',
    },

    // 3. Other Kitchen & Home Appliances
    {
      keywords: ['dishwasher', 'microwave', 'oven', 'stove', 'cooktop', 'dryer', 'appliance', 'toaster'],
      category: 'Appliance Repair',
      problem: 'Possible home appliance heating, motor, or electrical fault',
      causes: [
        'Blown internal thermal fuse or tripped breaker',
        'Burnt heating element or igniter',
        'Defective main control board or door interlock',
      ],
      steps: [
        'Unplug the appliance for 5 minutes to reset the digital control microprocessor.',
        'Verify the electrical wall outlet is working by testing with another small device.',
      ],
      warning:
        'Microwave high-voltage capacitors store lethal electricity even after being unplugged. Never attempt to remove microwave casing.',
    },

    // 4. Plumbing, Water & Drainage
    {
      keywords: [
        'pipe',
        'leak',
        'leaking',
        'tap',
        'faucet',
        'water leak',
        'drain',
        'toilet',
        'sink',
        'flush',
        'plumb',
        'plumbing',
        'geyser',
        'water heater',
        'shower',
      ],
      category: 'Plumber',
      problem: 'Possible plumbing leak, fixture failure, or drainage blockage',
      causes: [
        'Worn washer, O-ring, or loose compression fitting',
        'Drain line obstruction from grease or hair buildup',
        'Excessive water pressure causing joint stress',
      ],
      steps: [
        'Shut off the local water isolation valve beneath the fixture to prevent flooding.',
        'Clear visible surface clogs using a rubber plunger or drain snake.',
      ],
      warning:
        'Never pour harsh caustic chemical cleaners down completely blocked or aging metal pipes as it can dissolve seals.',
    },

    // 5. Electrical Fixtures & Circuits
    {
      keywords: [
        'electric',
        'electrical',
        'wiring',
        'switch',
        'socket',
        'power outlet',
        'light',
        'short circuit',
        'breaker',
        'spark',
        'fuse',
        'voltage',
        'blackout',
      ],
      category: 'Electrician',
      problem: 'Possible electrical circuit overload, fixture fault, or wiring issue',
      causes: [
        'Tripped circuit breaker or blown fuse due to appliance overload',
        'Loose neutral or ground screw connection in fixture',
        'Internal short circuit or worn insulation',
      ],
      steps: [
        'Turn off the circuit breaker corresponding to the affected area at your main distribution board.',
        'Unplug recently connected high-wattage appliances from that circuit.',
      ],
      warning:
        'Never touch electrical boards or bare conductors with damp hands or metal tools. If you detect burning smells, shut off the main switch immediately.',
    },

    // 6. Air Conditioning & HVAC (strict keyword matching so "machine" is NEVER matched)
    {
      keywords: [
        'air conditioner',
        'air conditioning',
        'ac unit',
        'split ac',
        'window ac',
        'central ac',
        'hvac',
        'compressor',
        'freon',
        'chiller',
        'thermostat',
        'ac',
      ],
      category: 'AC / HVAC',
      problem: 'Possible AC cooling, airflow restriction, or refrigerant issue',
      causes: [
        'Clogged indoor air filter restricting circulation',
        'Blocked condenser fins or obstructed outdoor unit fan',
        'Low refrigerant pressure or frozen evaporator coil',
      ],
      steps: [
        'Turn off the AC and inspect the washable front mesh filter; rinse thoroughly if dusty.',
        'Ensure outdoor condenser unit has at least 2 feet of clearance on all sides.',
      ],
      warning:
        'Do not tamper with refrigerant copper lines or attempt to recharge gas without certified HVAC diagnostic gauges.',
    },

    // 7. Automotive (Car)
    {
      keywords: ['car', 'engine', 'brake', 'tyre', 'tire', 'battery', 'motor', 'clutch', 'transmission', 'radiator'],
      category: 'Car Workshop',
      problem: 'Possible automobile mechanical or electrical issue',
      causes: [
        'Worn brake pads or mechanical friction components',
        'Discharged 12V starter battery or alternator failure',
        'Low engine oil or coolant fluid level',
      ],
      steps: [
        'Inspect the dashboard instrument cluster for illuminated check engine or battery warning symbols.',
        'Safely check engine oil dipstick and coolant level only after the engine is completely cold.',
      ],
      warning: 'Never crawl under a vehicle supported solely by a portable tire-change jack.',
    },

    // 8. Two-Wheeler / Bike Mechanic
    {
      keywords: ['bike', 'motorcycle', 'scooter', 'scooty', 'drive chain', 'spark plug', 'carburetor'],
      category: 'Bike Mechanic',
      problem: 'Possible two-wheeler engine or drive system issue',
      causes: ['Loose or unlubricated drive chain', 'Fouled spark plug or stale fuel', 'Worn brake shoe friction lining'],
      steps: [
        'Inspect drive chain slack and lubricate with dedicated chain oil.',
        'Check tire pressure and battery terminal tightness.',
      ],
      warning: 'Never lubricate or inspect chain while the engine is running or in gear.',
    },

    // 9. Carpentry & Furniture
    {
      keywords: ['wood', 'door', 'lock', 'cabinet', 'hinge', 'table', 'chair', 'furniture', 'carpenter'],
      category: 'Carpenter',
      problem: 'Possible woodwork, door alignment, or lock hardware issue',
      causes: ['Loose hinge mounting screws', 'Seasonal wood swelling from humidity', 'Misaligned strike plate or latch'],
      steps: [
        'Tighten loose hinge screws with a matching screwdriver.',
        'Apply silicone spray or graphite powder to sticking locks.',
      ],
      warning: 'Wear safety glasses and work gloves when handling power saws or heavy timber.',
    },

    // 10. Solar Systems
    {
      keywords: ['solar', 'inverter', 'solar panel', 'photovoltaic', 'charge controller'],
      category: 'Solar',
      problem: 'Possible solar generation loss or inverter fault',
      causes: ['Dust, bird droppings, or shade covering panel surface', 'Tripped DC isolator switch or inverter fault code'],
      steps: [
        'Check the inverter display screen for numeric fault codes.',
        'Visually inspect rooftop panels from a safe vantage point for dirt or shadows.',
      ],
      warning: 'High DC voltage remains active across solar strings during sunlight even if main AC breaker is tripped.',
    },

    // 11. Painting & Wall Dampness
    {
      keywords: ['paint', 'wall', 'coating', 'dampness', 'seepage', 'plaster', 'paint peeling', 'damp'],
      category: 'Painter',
      problem: 'Possible wall dampness, paint peeling, or moisture seepage',
      causes: ['Hidden internal pipe leak or rainwater seepage', 'High humidity or unsealed masonry surface before painting'],
      steps: [
        'Inspect adjoining pipes or bathroom walls for signs of active water leaks.',
        'Allow wet wall area to dry thoroughly before applying waterproof primer.',
      ],
      warning: 'Do not paint over wet walls without sealing moisture leaks, as paint will bubble and peel off.',
    },

    // 12. Pest Control
    {
      keywords: ['pest', 'termite', 'fumigation', 'cockroach', 'bug', 'rodent', 'rat', 'ant'],
      category: 'Pest Control',
      problem: 'Possible pest infestation or timber termite damage',
      causes: ['Moisture accumulation attracting insects', 'Unsealed wall gaps or wooden furniture infestation'],
      steps: [
        'Seal cracks around kitchen pipes and baseboards.',
        'Keep food stored in airtight containers and clean moisture spills immediately.',
      ],
      warning: 'Avoid spraying toxic chemical pesticides near open food preparation areas or children.',
    },

    // 13. Cleaning & Sanitization
    {
      keywords: ['clean', 'sofa', 'carpet', 'sanitiz', 'deep clean', 'stain', 'upholstery'],
      category: 'Cleaning',
      problem: 'Possible surface staining, deep dust buildup, or upholstery cleaning request',
      causes: ['Accumulated grime, spills, or dust allergens in fabric fibers'],
      steps: [
        'Vacuum loose dust before applying wet cleaning solutions.',
        'Test fabric cleaner on an inconspicuous corner first to prevent discoloration.',
      ],
      warning: 'Avoid oversaturating furniture foam with excess water to prevent mildew growth.',
    },

    // 14. General Maintenance & Handyman
    {
      keywords: ['handyman', 'drill', 'fan', 'ceiling fan', 'water pump', 'motor', 'fixture', 'mounting', 'curtain rod'],
      category: 'General Maintenance',
      problem: 'General home maintenance, ceiling fan, motor, or mounting request',
      causes: ['Worn motor bearing, loose mounting bracket, or capacitor degradation'],
      steps: [
        'Turn off power at the switch before examining fan or motor housing.',
        'Check mounting screws and wall anchors for secure fit.',
      ],
      warning: 'Ensure heavy wall-mounted items or ceiling fixtures are anchored directly into masonry studs.',
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
      source: 'system',
    }
  }

  // Fallback category detection if text mentions a category or trade
  const catMatch = getCategorySlugAndTitle(text)
  if (catMatch) {
    return {
      problem_summary: `Equipment or home maintenance inquiry regarding ${catMatch.title}`,
      possible_causes: ['General component wear, electrical or mechanical service required'],
      safe_steps: [
        'Disconnect power or turn off local shut-off valve if inspecting electrical/plumbing fixtures.',
        'Share specific details or a photo with FixMate specialists for direct inspection.',
      ],
      safety_warning: 'Always prioritize safety and avoid handling bare wiring or pressurized lines.',
      urgency: 'medium',
      professional_required: true,
      recommended_category: catMatch.title,
      conversational_reply: `I have noted your inquiry regarding ${catMatch.title}. You can view safe steps above or book a verified FixMate specialist directly.`,
      source: 'system',
    }
  }

  const isUrdu = /[\u0600-\u06FF]|salam|aoa|kaise|kya|shukriya|hafiz|theek/i.test(text)
  if (isUrdu) {
    return {
      problem_summary: 'فکس میٹ اے آئی اسسٹنٹ: آپ کا پیغام موصول ہو گیا ہے۔ میں آپ کی پلمبنگ، الیکٹریکل، اے سی اور دیگر ہوم سروسز میں مدد کے لیے حاضر ہوں۔',
      possible_causes: [],
      safe_steps: [],
      safety_warning: '',
      urgency: 'low',
      professional_required: false,
      recommended_category: null,
      conversational_reply: 'فکس میٹ اے آئی اسسٹنٹ: آپ کا پیغام موصول ہو گیا ہے۔ میں آپ کی پلمبنگ، الیکٹریکل، اے سی اور دیگر ہوم سروسز میں مدد کے لیے حاضر ہوں۔ اپنے مسئلے کی مزید تفصیل بتائیں یا تصویر شیئر کریں۔',
      source: 'system',
    }
  }

  return {
    problem_summary: 'FixMate AI Assistant: I have received your message. How can I assist you with your home repairs today?',
    possible_causes: [],
    safe_steps: [],
    safety_warning: '',
    urgency: 'low',
    professional_required: false,
    recommended_category: null,
    conversational_reply: 'FixMate AI Assistant: I have received your message. I am ready to assist with your home repairs, plumbing, electrical, AC, or appliance inquiries. Please describe your specific issue or upload a photo.',
    source: 'system',
  }
}

export async function uploadProblemImage(file: File, userId: string): Promise<string | null> {
  try {
    // Produce compact, web-optimized image
    const dataUrl = await compressImageToDataUrl(file, 800, 0.8)

    try {
      const ext = 'jpg'
      const fileName = `${userId}/${Date.now()}.${ext}`

      const res = await fetch(dataUrl)
      const blob = await res.blob()

      const { error, data } = await supabase.storage
        .from('problem-images')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        })

      if (!error && data) {
        const { data: pubData } = supabase.storage.from('problem-images').getPublicUrl(fileName)
        if (pubData?.publicUrl) return pubData.publicUrl
      }
    } catch {
      // Storage upload fallback
    }

    return dataUrl
  } catch {
    return null
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function resolveValidCategoryId(catIdOrSlug?: string | null): Promise<string | null> {
  if (!catIdOrSlug || typeof catIdOrSlug !== 'string') return null
  const trimmed = catIdOrSlug.trim()
  if (!trimmed) return null

  // If already a valid UUID, return directly
  if (UUID_REGEX.test(trimmed)) return trimmed

  // Try mapping slug like 'plumber', 'electrician', 'carpenter' to real DB UUID
  try {
    const { data } = await supabase.from('service_categories').select('id, name')
    if (data && data.length > 0) {
      const lower = trimmed.toLowerCase()
      const matched = data.find((c) => {
        const nLower = (c.name || '').toLowerCase()
        return (
          nLower === lower ||
          nLower.includes(lower) ||
          lower.includes(nLower) ||
          (lower === 'plumber' && nLower.includes('plumb')) ||
          (lower === 'electrician' && nLower.includes('elect')) ||
          (lower === 'carpenter' && nLower.includes('carpen')) ||
          (lower === 'ac' && (nLower.includes('ac') || nLower.includes('hvac'))) ||
          (lower === 'appliance' && nLower.includes('appliance'))
        )
      })

      if (matched && matched.id && UUID_REGEX.test(matched.id)) {
        return matched.id
      }
    }
  } catch {}

  return null
}

export async function createServiceRequest(params: {
  userId: string
  description: string
  categoryId?: string | null
  imageUrl?: string | null
  location?: string | null
  targetTechnicianId?: string | null
}): Promise<string | null> {
  try {
    // Do not create a service request for general conversational chat/greetings
    if (isGreetingOrGeneralChat(params.description) && !params.imageUrl && !params.targetTechnicianId) {
      console.warn('Skipping service request creation for general chat message:', params.description)
      return null
    }

    // Resolve current authenticated user ID from Supabase session
    const { data: authUserData } = await supabase.auth.getUser()
    const currentAuthUid = authUserData?.user?.id
    const effectiveUserId = currentAuthUid || params.userId

    const validCatId = await resolveValidCategoryId(params.categoryId)

    let techInfo: { id: string; user_id?: string | null; profile_id?: string | null } | null = null
    if (params.targetTechnicianId) {
      try {
        const { data: tech } = await supabase
          .from('technicians')
          .select('id, user_id, profile_id')
          .or(`id.eq.${params.targetTechnicianId},user_id.eq.${params.targetTechnicianId},profile_id.eq.${params.targetTechnicianId}`)
          .maybeSingle()
        if (tech) techInfo = tech
      } catch {}
    }

    let fullDesc = params.description
    if (params.targetTechnicianId) {
      const techTags = Array.from(
        new Set([
          params.targetTechnicianId,
          techInfo?.id,
          techInfo?.user_id,
          techInfo?.profile_id,
        ].filter(Boolean))
      ).map((t) => `TechID:${t}`).join(' ')
      fullDesc = `[Direct Request for ${techTags}] ${params.description}`
    }

    // Prepare local storage fallback payload
    const generatedId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    // 1. Primary insert attempt using current auth user ID
    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        user_id: effectiveUserId,
        title: params.description.slice(0, 80),
        description: fullDesc,
        category_id: validCatId,
        image_url: params.imageUrl ?? null,
        location: params.location ?? null,
        status: 'requested',
      })
      .select('id')
      .maybeSingle()

    let newRequestId = data?.id || null

    // 2. Fallback attempt if first insert failed (e.g. category FK constraint or fallback user ID)
    if (error || !newRequestId) {
      console.warn('Primary insert error in createServiceRequest, retrying with fallback settings:', error)
      const { data: fbData, error: fbErr } = await supabase
        .from('service_requests')
        .insert({
          user_id: effectiveUserId,
          title: params.description.slice(0, 80),
          description: fullDesc,
          category_id: null,
          image_url: params.imageUrl ?? null,
          location: params.location ?? null,
          status: 'requested',
        })
        .select('id')
        .maybeSingle()

      if (!fbErr && fbData?.id) {
        newRequestId = fbData.id
      } else {
        console.warn('createServiceRequest using local fallback ID:', fbErr)
        newRequestId = generatedId
      }
    }

    if (!newRequestId) {
      newRequestId = generatedId
    }

    // Always save to localStorage to ensure immediate visibility on client dashboard
    try {
      const localReq = {
        id: newRequestId,
        user_id: effectiveUserId,
        category_id: validCatId,
        title: params.description.slice(0, 80),
        description: fullDesc,
        image_url: params.imageUrl ?? null,
        location: params.location ?? null,
        status: 'requested',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const existingRaw = localStorage.getItem('fixmate_local_service_requests')
      const existingList = existingRaw ? JSON.parse(existingRaw) : []
      existingList.unshift(localReq)
      localStorage.setItem('fixmate_local_service_requests', JSON.stringify(existingList))
    } catch {}

    // Customer notification
    try {
      await supabase.from('notifications').insert({
        user_id: effectiveUserId,
        type: 'service_request_created',
        title: 'Service Request Created',
        message: `Your request "${params.description.slice(0, 50)}..." has been created and sent to technicians.`,
        read: false,
      })
    } catch {}

    // Send targeted notification to technician if specified
    if (techInfo) {
      const recipientId = techInfo.user_id || techInfo.profile_id
      if (recipientId) {
        try {
          await supabase.from('notifications').insert({
            user_id: recipientId,
            type: 'direct_service_request',
            title: '⚡ New Direct Service Request!',
            message: 'A customer sent a direct service request to you. Open your dashboard to approve or disapprove.',
            read: false,
          })
        } catch {}
      }
    }

    return newRequestId
  } catch (err) {
    console.error('Unhandled createServiceRequest error:', err)
    return null
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}

export async function diagnoseProblem(params: {
  description: string
  categoryId?: string
  imageUrl?: string
  imageBase64?: string
  requestId?: string
  userId?: string
  language?: string
}): Promise<AIDiagnosis> {
  // 1. Primary: Website AI Diagnosis via server Gemini endpoint (/api/diagnose)
  try {
    const serverRes = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: params.description || 'Please inspect the attached photo for defects or faults.',
        categoryId: params.categoryId,
        imageUrl: params.imageUrl,
        imageBase64: params.imageBase64,
        language: params.language,
      }),
    })

    if (serverRes.ok) {
      const data = await serverRes.json()
      if (data.success && data.diagnosis && data.diagnosis.problem_summary) {
        return {
          ...(data.diagnosis as AIDiagnosis),
          source: 'gemini',
        }
      }
    }
  } catch (serverErr) {
    console.warn('[diagnoseProblem] Website AI (/api/diagnose) error:', serverErr)
  }

  // 2. Rule-based offline fallback
  return ruleBasedDiagnosis(params.description || 'Photo attached for repair inspection')
}

/**
 * Interactive FixMate Chatbot communication in English and Urdu
 */
export async function chatWithFixMate(params: {
  message: string
  history?: Array<{ role: 'user' | 'ai'; text: string }>
  imageBase64?: string
}): Promise<{ reply: string; source: 'gemini' | 'system' | 'n8n' }> {
  // Website AI Chat via server Gemini endpoint (/api/chat)
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.success && data.reply) {
        return { reply: data.reply, source: 'gemini' }
      }
    }
  } catch (err) {
    console.warn('[chatWithFixMate] Website AI (/api/chat) error:', err)
  }

  // Fallback reply in both English and Urdu
  const isUrduQuery = /[\u0600-\u06FF]|kya|kaise|mera|meri|nahi|chal|paani|kharab/i.test(params.message)
  if (isUrduQuery) {
    return {
      reply: 'آپ کا مسئلہ نوٹ کر لیا گیا ہے۔ فکس میٹ کے تصدیق شدہ کاریگر آپ کی مدد کے لیے دستیاب ہیں۔ براہ کرم اپنا سروس آرڈر یا تصویر شیئر کریں۔\n\n(Your request has been noted. FixMate verified technicians are available to assist you.)',
      source: 'system',
    }
  }

  return {
    reply: 'Thank you for describing the issue. I have noted the symptoms and our verified technicians are ready to assist. You can book an inspection or view troubleshooting steps above.',
    source: 'system',
  }
}

export async function markRequestSolved(requestId: string): Promise<void> {
  try {
    await supabase
      .from('service_requests')
      .update({ status: 'completed' })
      .eq('id', requestId)
  } catch {
    // Graceful no-op in local fallback
  }
}
