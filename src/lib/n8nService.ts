import type { AIDiagnosis } from '../types/ai'

export interface N8nServiceRequestPayload {
  request_id: string
  user_id: string
  category_id: string | null
  category_name: string | null
  title: string | null
  description: string
  location: string | null
  urgency: string
  professional_required: boolean
}

const STORAGE_KEY_CHAT_WEBHOOK = 'n8n_ai_chat_webhook_url'
const STORAGE_KEY_SERVICE_WEBHOOK = 'n8n_service_request_webhook_url'

/**
 * Returns the currently active n8n AI Chat Agent Webhook URL.
 * Checks localStorage first, then environment variables.
 */
export function getN8nChatWebhookUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CHAT_WEBHOOK)
    if (saved && saved.trim()) {
      return saved.trim()
    }
  } catch {
    // Ignore localStorage access errors
  }

  const envUrl = (
    (import.meta.env.VITE_N8N_AI_CHAT_WEBHOOK as string) ||
    (import.meta.env.VITE_N8N_CHAT_WEBHOOK as string) ||
    (import.meta.env.VITE_N8N_WEBHOOK_URL as string) ||
    ''
  ).trim()

  return envUrl
}

/**
 * Saves or updates the n8n AI Chat Agent Webhook URL in localStorage.
 */
export function setN8nChatWebhookUrl(url: string): void {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(STORAGE_KEY_CHAT_WEBHOOK)
    } else {
      localStorage.setItem(STORAGE_KEY_CHAT_WEBHOOK, url.trim())
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Checks whether an n8n AI Chat Webhook is currently configured.
 */
export function isN8nChatConfigured(): boolean {
  return Boolean(getN8nChatWebhookUrl())
}

/**
 * Returns the n8n Service Request Webhook URL.
 */
export function getN8nServiceRequestWebhookUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SERVICE_WEBHOOK)
    if (saved && saved.trim()) return saved.trim()
  } catch {
    // Ignore
  }

  return ((import.meta.env.VITE_N8N_NEW_SERVICE_REQUEST_WEBHOOK as string) || '').trim()
}

/**
 * Saves the n8n Service Request Webhook URL.
 */
export function setN8nServiceRequestWebhookUrl(url: string): void {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(STORAGE_KEY_SERVICE_WEBHOOK)
    } else {
      localStorage.setItem(STORAGE_KEY_SERVICE_WEBHOOK, url.trim())
    }
  } catch {
    // Ignore
  }
}



/**
 * Detects if a text prompt or response is a greeting, general conversational query, or non-repair message.
 */
export function isGreetingOrGeneralChat(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const t = text.toLowerCase().trim()
  if (!t) return false

  const explicitGreetings = [
    'hi', 'hello', 'hey', 'helo', 'hlo', 'hy', 'assalam o alaikum', 'assalam-o-alaikum',
    'assalamoalaikum', 'assalam alaikum', 'salam', 'aoa', 'a.o.a', 'good morning',
    'good afternoon', 'good evening', 'good night', 'how are you', 'kaise ho',
    'kya hal hai', 'kya haal hai', 'kaise hain', 'kaise hain aap', 'who are you',
    'kon ho', 'tum kon ho', 'aap kaun hain', 'what can you do', 'kya kar sakte ho',
    'help', 'madad', 'thanks', 'thank you', 'shukriya', 'ok', 'okay', 'theek hai',
    'thik h', 'bye', 'goodbye', 'allah hafiz', 'khuda hafiz', 'nice', 'great', 'awesome',
    'hello fixmate', 'hi fixmate', 'hey fixmate', 'what is fixmate', 'who is fixmate',
    'tell me about fixmate', 'what services do you offer', 'what services do you have',
    'how does fixmate work', 'how to book a technician', 'how do i book', 'price list',
    'rates', 'charges', 'cost', 'where are you located', 'contact number', 'phone number',
    'customer service', 'support',
    'سلام', 'السلام علیکم', 'کیسے ہو', 'کیا حال ہے', 'شکریہ', 'اللہ حافظ'
  ]

  if (explicitGreetings.includes(t)) return true

  // Check if text mentions any appliance, equipment, or repair term/category
  const repairOrEquipmentTerms = [
    'ac', 'air conditioner', 'hvac', 'cooler', 'cooling', 'fridge', 'refrigerator',
    'freezer', 'washing machine', 'washer', 'dryer', 'microwave', 'oven', 'stove',
    'appliance', 'pipe', 'leak', 'leaking', 'tap', 'faucet', 'drain', 'sink', 'toilet',
    'plumb', 'plumber', 'water', 'geyser', 'shower', 'sewer', 'sanitary', 'wire',
    'wiring', 'electric', 'electrical', 'switch', 'socket', 'breaker', 'fuse',
    'short circuit', 'spark', 'current', 'power', 'bijli', 'voltage', 'door',
    'lock', 'wood', 'furniture', 'cabinet', 'carpenter', 'car', 'engine', 'brake',
    'battery', 'tire', 'motor', 'bike', 'motorcycle', 'scooter', 'solar', 'inverter',
    'panel', 'paint', 'wall', 'dampness', 'pest', 'clean', 'repair', 'fix',
    'broken', 'working', 'fault', 'issue', 'problem', 'noise', 'smoke', 'smell',
    'heat', 'cold', 'slow', 'stopped', 'stuck', 'damaged', 'burst', 'clogged',
    'kharab', 'harab', 'paani', 'band', 'shor', 'chala'
  ]

  const mentionsRepairOrEquipment = repairOrEquipmentTerms.some(term => {
    if (term.length <= 3) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(t)
    }
    return t.includes(term)
  })

  // If query mentions any repair equipment or fault term, it is NOT a greeting
  if (mentionsRepairOrEquipment) return false

  // Common greeting & general chat patterns
  const greetingPatterns = [
    /^(hi|hello|hey|helo|hlo|hy|salam|assalam|aoa|good\s*(morning|afternoon|evening|night))\b/i,
    /^(how\s*are\s*you|kaise\s*ho|kya\s*hal|who\s*are\s*you|what\s*can\s*you\s*do|what\s*is\s*fixmate|who\s*is\s*fixmate|tell\s*me\s*about\s*fixmate)\b/i,
    /^(thanks?|thank\s*you|shukriya|bye|goodbye|allah\s*hafiz)\b/i,
    /^(what|where|when|how\s*much|price|rate|cost|location|address|contact|phone|number|discount|charges)\b/i,
    /(price|rate|cost|location|address|contact|phone|number|charges)/i,
  ]

  if (greetingPatterns.some((p) => p.test(t))) return true

  return false
}

/**
 * Safely extracts human text output from any n8n Webhook / AI Agent node envelope structure
 */
function extractTextFromN8nPayload(obj: any): string | null {
  if (!obj) return null
  if (typeof obj === 'string' && obj.trim()) {
    const s = obj.trim()
    if (!s.includes('is not registered') && !s.includes('"code":404')) {
      return s
    }
    return null
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = extractTextFromN8nPayload(item)
      if (found) return found
    }
    return null
  }

  if (typeof obj === 'object') {
    // Unpack standard n8n output wrapper: { json: { ... } }
    if (obj.json && typeof obj.json === 'object') {
      const foundInJson = extractTextFromN8nPayload(obj.json)
      if (foundInJson) return foundInJson
    }

    // Direct AI agent output keys
    const keys = ['output', 'response', 'chatResponse', 'answer', 'text', 'content', 'reply', 'result', 'message', 'data']
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        if (typeof obj[k] === 'string' && obj[k].trim()) {
          const s = obj[k].trim()
          if (!s.includes('is not registered') && !s.includes('"code":404')) {
            return s
          }
        } else if (typeof obj[k] === 'object') {
          const found = extractTextFromN8nPayload(obj[k])
          if (found) return found
        }
      }
    }

    // Check OpenAI / LLM choices array format inside n8n: { choices: [{ message: { content: "..." } }] }
    if (Array.isArray(obj.choices)) {
      const foundInChoices = extractTextFromN8nPayload(obj.choices)
      if (foundInChoices) return foundInChoices
    }
  }

  return null
}

/**
 * Safely parse AI response from any n8n Webhook / AI Agent node output.
 */
function parseN8nAgentResponse(rawText: string, userPrompt: string): AIDiagnosis | null {
  if (!rawText || !rawText.trim()) return null
  const normPrompt = userPrompt.toLowerCase()
  let parsedJson: any = null

  try {
    parsedJson = JSON.parse(rawText)
  } catch {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try {
        parsedJson = JSON.parse(match[1])
      } catch {}
    }
  }

  const isGreeting = isGreetingOrGeneralChat(userPrompt)

  // 1. Check if n8n returned a pre-structured AIDiagnosis object with problem_summary
  if (parsedJson) {
    let item = Array.isArray(parsedJson) ? parsedJson[0] : parsedJson
    if (item && typeof item === 'object' && item.json && typeof item.json === 'object') {
      item = item.json
    }

    if (item && typeof item === 'object') {
      if (
        item.code === 404 ||
        item.error ||
        (typeof item.message === 'string' && item.message.toLowerCase().includes('not registered'))
      ) {
        return null
      }

      const diagCandidate = item.diagnosis || item.aiDiagnosis
      if (
        diagCandidate &&
        typeof diagCandidate === 'object' &&
        (typeof diagCandidate.problem_summary === 'string' || typeof diagCandidate.safe_steps !== 'undefined')
      ) {
        const cat = isGreeting ? null : inferCategoryFromText(diagCandidate.recommended_category || diagCandidate.problem_summary || userPrompt)
        return {
          problem_summary: diagCandidate.problem_summary || 'Response from n8n AI Agent',
          problem_summary_urdu: diagCandidate.problem_summary_urdu || undefined,
          possible_causes: isGreeting ? [] : (Array.isArray(diagCandidate.possible_causes) ? diagCandidate.possible_causes : []),
          possible_causes_urdu: isGreeting ? undefined : (Array.isArray(diagCandidate.possible_causes_urdu) ? diagCandidate.possible_causes_urdu : undefined),
          safe_steps: isGreeting ? [] : (Array.isArray(diagCandidate.safe_steps) ? diagCandidate.safe_steps : []),
          safe_steps_urdu: isGreeting ? undefined : (Array.isArray(diagCandidate.safe_steps_urdu) ? diagCandidate.safe_steps_urdu : undefined),
          safety_warning: isGreeting ? '' : (typeof diagCandidate.safety_warning === 'string' ? diagCandidate.safety_warning : ''),
          safety_warning_urdu: isGreeting ? undefined : diagCandidate.safety_warning_urdu || undefined,
          urgency: isGreeting ? 'low' : (['low', 'medium', 'high'].includes(diagCandidate.urgency) ? diagCandidate.urgency : 'medium'),
          professional_required: isGreeting ? false : (typeof diagCandidate.professional_required === 'boolean' ? diagCandidate.professional_required : true),
          recommended_category: cat,
          conversational_reply: diagCandidate.conversational_reply || diagCandidate.problem_summary || undefined,
          source: 'n8n',
          raw_agent_reply: rawText,
        }
      }
    }

    // Extract text from n8n output payload recursively
    const agentText = extractTextFromN8nPayload(parsedJson)
    if (agentText) {
      return formatTextIntoDiagnosis(agentText, normPrompt, rawText)
    }
  }

  // 2. Plain text response from n8n
  if (typeof rawText === 'string' && rawText.trim()) {
    if (!rawText.includes('is not registered') && !rawText.includes('"code":404')) {
      return formatTextIntoDiagnosis(rawText.trim(), normPrompt, rawText)
    }
  }

  return null
}

/**
 * Parses freeform natural language output from an n8n AI Agent into a structured AIDiagnosis
 */
function formatTextIntoDiagnosis(agentText: string, userPrompt: string, rawPayload: string): AIDiagnosis {
  const isGreeting = isGreetingOrGeneralChat(userPrompt) || isGreetingOrGeneralChat(agentText)

  // Extract bullet points or numbered steps from the AI response
  const lines = agentText.split('\n').map((l) => l.trim()).filter(Boolean)
  const safeSteps: string[] = []
  const causes: string[] = []
  let warning = ''

  if (!isGreeting) {
    for (const line of lines) {
      const isNumbered = /^[0-9]+[.)]\s*(.+)/.exec(line)
      const isBullet = /^[-*•]\s*(.+)/.exec(line)
      const item = isNumbered ? isNumbered[1] : isBullet ? isBullet[1] : null

      if (item) {
        const lower = item.toLowerCase()
        if (lower.includes('caution') || lower.includes('danger') || lower.includes('warning') || lower.includes('unplug')) {
          warning = item
        } else if (lower.includes('cause') || lower.includes('due to') || lower.includes('worn') || lower.includes('clogged')) {
          if (causes.length < 4) causes.push(item)
        } else {
          if (safeSteps.length < 5) safeSteps.push(item)
        }
      } else {
        const lower = line.toLowerCase()
        if (lower.includes('warning:') || lower.includes('caution:')) {
          warning = line.replace(/^(warning|caution):\s*/i, '')
        }
      }
    }
  }

  const category = isGreeting ? null : inferCategoryFromText(`${userPrompt} ${agentText}`)
  const isRepairQuery = !isGreeting && (Boolean(category) || safeSteps.length > 0 || causes.length > 0 || Boolean(warning))

  return {
    problem_summary: agentText,
    possible_causes: isGreeting ? [] : causes,
    safe_steps: isGreeting ? [] : safeSteps,
    safety_warning: isGreeting ? '' : warning,
    urgency: isGreeting ? 'low' : (agentText.toLowerCase().includes('urgent') || agentText.toLowerCase().includes('fire') ? 'high' : 'medium'),
    professional_required: isRepairQuery,
    recommended_category: isGreeting ? null : category,
    conversational_reply: agentText,
    source: 'n8n',
    raw_agent_reply: agentText,
  }
}

/**
 * Accurately detects recommended service category from text, preventing substring collision bugs and false General Maintenance defaults
 */
export function inferCategoryFromText(text: string): string | null {
  if (!text) return null
  const t = text.toLowerCase()

  // 1. Washing machine & Appliances
  if (
    t.includes('washing machine') ||
    t.includes('washer') ||
    t.includes('laundry') ||
    t.includes('spin cycle') ||
    t.includes('fridge') ||
    t.includes('refrigerator') ||
    t.includes('microwave') ||
    t.includes('dishwasher') ||
    t.includes('dryer') ||
    t.includes('oven') ||
    t.includes('appliance') ||
    t.includes('dhona') ||
    t.includes('istri')
  ) {
    return 'Appliance Repair'
  }

  // 2. Plumbing
  if (
    t.includes('pipe') ||
    t.includes('leak') ||
    t.includes('tap') ||
    t.includes('faucet') ||
    t.includes('drain') ||
    t.includes('toilet') ||
    t.includes('sink') ||
    t.includes('plumb') ||
    t.includes('paani') ||
    t.includes('geyser') ||
    t.includes('sewer') ||
    t.includes('sanitary') ||
    t.includes('toti') ||
    t.includes('flush')
  ) {
    return 'Plumber'
  }

  // 3. Electrical
  if (
    t.includes('electric') ||
    t.includes('wiring') ||
    t.includes('switch') ||
    t.includes('socket') ||
    t.includes('circuit') ||
    t.includes('breaker') ||
    t.includes('spark') ||
    t.includes('bijli') ||
    t.includes('short circuit') ||
    t.includes('voltage') ||
    t.includes('outlet')
  ) {
    return 'Electrician'
  }

  // 4. AC / HVAC (strictly check whole-word 'ac' or explicit HVAC keywords)
  const acWordRegex = /(^|[^a-z0-9])ac([^a-z0-9]|$)/i
  if (
    t.includes('air conditioner') ||
    t.includes('air conditioning') ||
    t.includes('cooling') ||
    t.includes('hvac') ||
    t.includes('compressor') ||
    t.includes('freon') ||
    t.includes('refrigerant') ||
    acWordRegex.test(t)
  ) {
    return 'AC / HVAC'
  }

  // 5. Vehicles
  if (t.includes('car') || t.includes('engine') || t.includes('brake') || t.includes('tyre') || t.includes('gari') || t.includes('mechanic')) {
    return 'Car Workshop'
  }
  if (t.includes('bike') || t.includes('motorcycle') || t.includes('scooter') || t.includes('tuning')) {
    return 'Bike Mechanic'
  }

  // 6. Carpenter
  if (t.includes('wood') || t.includes('furniture') || t.includes('door') || t.includes('lock') || t.includes('cabinet') || t.includes('lakri')) {
    return 'Carpenter'
  }

  // 7. Solar
  if (t.includes('solar') || t.includes('inverter') || t.includes('panel')) {
    return 'Solar'
  }

  // 8. Painter
  if (t.includes('paint') || t.includes('wall') || t.includes('coating') || t.includes('dampness')) {
    return 'Painter'
  }

  // 9. Pest Control
  if (t.includes('pest') || t.includes('termite') || t.includes('fumigation') || t.includes('bug') || t.includes('cockroach')) {
    return 'Pest Control'
  }

  // 10. Cleaning
  if (t.includes('clean') || t.includes('sofa') || t.includes('sanitiz') || t.includes('carpet')) {
    return 'Cleaning'
  }

  // Explicit Handyman / General Repair keywords
  if (t.includes('handyman') || t.includes('drill') || t.includes('fixture') || t.includes('general maintenance')) {
    return 'General Maintenance'
  }

  return null
}

/**
 * Sends a chat message to the configured n8n AI Agent webhook and fetches the real AI response.
 * Returns null if the webhook is not configured or if an error occurred.
 */
export async function queryN8nAiAgent(params: {
  message: string
  sessionId?: string
  userId?: string
  imageUrl?: string
  requestId?: string
}): Promise<AIDiagnosis | null> {
  const webhookUrl = getN8nChatWebhookUrl()

  // 1. Primary: Use server-side proxy route to eliminate browser CORS & mixed-content issues
  let proxyNetworkFailed = false
  try {
    const proxyRes = await fetch('/api/n8n/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl,
        message: params.message,
        sessionId: params.sessionId,
        userId: params.userId,
        imageUrl: params.imageUrl,
        requestId: params.requestId,
      }),
    })

    if (proxyRes.ok) {
      const data = await proxyRes.json()
      if (data.success && data.raw) {
        const parsed = parseN8nAgentResponse(data.raw, params.message)
        if (parsed) return parsed
      }
    } else {
      // The server proxy successfully reached n8n, but n8n returned an error or inactive 404
      console.warn(`[n8n AI Agent] Proxy response status: ${proxyRes.status}`)
      return null
    }
  } catch (proxyErr) {
    proxyNetworkFailed = true
    console.warn('[n8n AI Agent] Server proxy network unreachable, attempting direct fallback:', proxyErr)
  }

  // 2. Direct browser fallback ONLY if the local proxy server itself was unreachable
  if (proxyNetworkFailed) {
    try {
      const sessionId = params.sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

      const bodyPayload = {
        chatInput: params.message,
        message: params.message,
        prompt: params.message,
        text: params.message,
        description: params.message,
        sessionId,
        userId: params.userId || 'anonymous_user',
        imageUrl: params.imageUrl || null,
        requestId: params.requestId || null,
        timestamp: new Date().toISOString(),
        source: 'fixmate_frontend',
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.warn(`[n8n AI Agent] HTTP ${response.status} from webhook URL: ${webhookUrl}`)
        return null
      }

      const rawText = await response.text()
      if (!rawText || !rawText.trim()) {
        return null
      }

      return parseN8nAgentResponse(rawText, params.message)
    } catch (err) {
      console.warn('[n8n AI Agent] Direct fetch error or timeout:', err)
      return null
    }
  }

  return null
}

/**
 * Tests connection to an n8n webhook URL and returns status details.
 * Uses server-side proxy first to bypass browser CORS & mixed-content constraints.
 */
export async function testN8nConnection(
  customUrl?: string,
): Promise<{ success: boolean; message: string; suggestedUrl?: string; data?: any; status?: number; isInactive?: boolean; n8nReachable?: boolean }> {
  const targetUrl = (customUrl || getN8nChatWebhookUrl()).trim()

  if (!targetUrl) {
    return {
      success: false,
      message: 'No n8n webhook URL specified.',
    }
  }

  // 1. Primary: Server-side proxy (bypasses browser CORS restrictions, diagnoses inactive workflows)
  let proxyNetworkFailed = false
  try {
    const proxyRes = await fetch('/api/n8n/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl: targetUrl }),
    })

    const data = await proxyRes.json()
    if (data && typeof data.message === 'string') {
      return data
    }
  } catch (proxyErr) {
    proxyNetworkFailed = true
    console.warn('[n8n test] Server proxy network unreachable, trying direct test:', proxyErr)
  }

  if (!proxyNetworkFailed) {
    return {
      success: false,
      message: 'Could not retrieve test status from server proxy.',
    }
  }

  // 2. Direct browser fallback
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({
        test: true,
        chatInput: 'Ping FixMate AI Agent - Connection Test',
        message: 'Ping FixMate AI Agent - Connection Test',
        sessionId: 'test_ping_' + Date.now(),
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      let isInactive = false
      let extraHint = ''
      try {
        const text = await response.text()
        const parsed = JSON.parse(text)
        if (parsed?.hint) extraHint = parsed.hint
        if (parsed?.message && parsed.message.includes('not registered')) isInactive = true
      } catch {}

      return {
        success: false,
        status: response.status,
        isInactive,
        message:
          extraHint ||
          `n8n endpoint returned HTTP status ${response.status} (${response.statusText}). If status is 404, toggle workflow to "Active" in n8n editor.`,
      }
    }

    const reply = await response.text()
    return {
      success: true,
      status: response.status,
      message: 'Successfully connected to n8n AI Agent webhook!',
      data: reply.slice(0, 300),
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'Request timed out after 12 seconds. Ensure n8n is running and reachable.',
      }
    }
    return {
      success: false,
      message: `Failed to connect to n8n: ${err.message || String(err)}. Note: If testing localhost, check CORS settings on n8n Webhook node.`,
    }
  }
}

/**
 * Sends a newly created service request payload to the configured n8n webhook.
 * Fails safely and non-blockingly if n8n is offline or unreachable.
 */
export async function sendServiceRequestToN8n(
  payload: N8nServiceRequestPayload,
): Promise<boolean> {
  const webhookUrl = getN8nServiceRequestWebhookUrl()

  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
    return false
  }

  // 1. Primary: Server-side dispatch proxy
  try {
    const proxyRes = await fetch('/api/n8n/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: webhookUrl.trim(),
        ...payload,
      }),
    })

    if (proxyRes.ok) {
      return true
    }
  } catch (proxyErr) {
    console.warn('[n8n Service Webhook] Proxy dispatch error:', proxyErr)
  }

  // 2. Direct browser fallback
  try {
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request_id: payload.request_id,
        user_id: payload.user_id,
        category_id: payload.category_id,
        category_name: payload.category_name,
        title: payload.title,
        description: payload.description,
        location: payload.location,
        urgency: payload.urgency || 'medium',
        professional_required:
          typeof payload.professional_required === 'boolean'
            ? payload.professional_required
            : true,
      }),
    })

    return response.ok
  } catch (err) {
    console.warn('[n8n Service Webhook] Direct error sending payload:', err)
    return false
  }
}
