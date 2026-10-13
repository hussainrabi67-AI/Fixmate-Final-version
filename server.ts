import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { GoogleGenAI } from '@google/genai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

// Support large image payloads (up to 30MB base64)
app.use(express.json({ limit: '30mb' }))
app.use(express.urlencoded({ limit: '30mb', extended: true }))

// Static serving for uploaded files
const uploadsDir = path.resolve(__dirname, 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use('/uploads', express.static(uploadsDir))

// Initialize Gemini SDK with process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({})

const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite']

async function generateWithFallback(options: {
  contents: any
  config?: any
  models?: string[]
}) {
  let lastError: any = null
  const modelsToTry = options.models || CANDIDATE_MODELS
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      })
      if (response && typeof response.text === 'string') {
        return { text: response.text, model }
      }
    } catch (err: any) {
      lastError = err
      // If model fails or throws error, try next candidate
      console.warn(`[Gemini] model ${model} failed, trying next fallback:`, err?.message || err)
    }
  }
  throw lastError || new Error('All Gemini models failed.')
}

const SYSTEM_DIAGNOSIS_PROMPT = `You are FixMate, an intelligent bilingual (English and Urdu) AI repair assistant for household equipment, appliances (washing machines, refrigerators, microwaves), plumbing, electrical systems, carpentry, AC/HVAC, and vehicle maintenance.

You can communicate fluently in:
1. English
2. Urdu (اردو رسم الخط - Nastaliq script)
3. Roman Urdu (e.g., "Washing machine ka paani leak ho raha hai")

Category & Specialty Routing Rules:
- If the issue is electrical (wiring, switches, circuit breakers, short circuit, lights, sparks, electrical shock risk), set "recommended_category": "Electrician".
- If the issue is plumbing (water leakage, pipe burst, tap fix, drain blockage, sink/toilet leaks), set "recommended_category": "Plumber".
- If the issue is AC/HVAC (cooling loss, gas refill, compressor noise, heating, thermostat), set "recommended_category": "AC / HVAC".
- If the issue is carpentry/woodwork (doors sticking, cabinet repair, locks, wooden furniture), set "recommended_category": "Carpenter".
- If the issue is household appliances (washing machine, refrigerator/fridge, microwave, oven, dishwasher), set "recommended_category": "Appliance Repair".
- If the issue is automobile/car (car engine noise, oil change, brakes, battery, tuning), set "recommended_category": "Car Workshop".
- If the issue is motorbike/scooter (bike tuning, chain repair, brakes), set "recommended_category": "Bike Mechanic".
- If the issue is solar/green energy (solar panel, inverter error 04/09, solar wiring), set "recommended_category": "Solar".
- If the issue is painting/walls (wall paint, waterproofing, dampness), set "recommended_category": "Painter".
- If the issue is pest control (termites, bed bugs, fumigation), set "recommended_category": "Pest Control".
- For greetings, general questions, pricing inquiries, service queries, or general conversational text messages (when NOT reporting a specific broken equipment defect/fault/leak):
  Set "professional_required": false, "recommended_category": null, "possible_causes": [], "possible_causes_urdu": [], "safe_steps": [], "safe_steps_urdu": [], "safety_warning": "", "safety_warning_urdu": "", "urgency": "low", and provide a helpful, natural answer in "conversational_reply" and "problem_summary".

When analyzing user problems and uploaded photos:
- Carefully inspect any uploaded photo to detect visible parts, damage, cracks, leaks, burns, rust, loose wires, or fault indicators.
- State clearly what you detect in the image.
- Provide practical, safe first-step guidance.
- If it is hazardous (high voltage, gas, pressurized refrigerant, structural), always mark professional_required = true.

Respond strictly with valid JSON with this exact structure:
{
  "problem_summary": "Clear summary in English (e.g. 'Possible electrical short circuit or tripped breaker')",
  "problem_summary_urdu": "اردو میں مسئلہ کا خلاصہ (e.g. 'شارٹ سرکٹ یا بریکر ٹرپ ہونے کا امکان')",
  "detected_objects": ["List of components or issues detected from text or photo, e.g. 'breaker panel', 'burnt wire']",
  "possible_causes": ["Cause 1 in English", "Cause 2 in English"],
  "possible_causes_urdu": ["ممکنہ وجہ 1", "ممکنہ وجہ 2"],
  "safe_steps": ["Safe step 1 in English", "Safe step 2 in English"],
  "safe_steps_urdu": ["محفوظ قدم 1", "محفوظ قدم 2"],
  "safety_warning": "Safety warning in English (what NOT to do)",
  "safety_warning_urdu": "حفاظتی انتباہ اردو میں",
  "urgency": "low" | "medium" | "high",
  "professional_required": true or false,
  "recommended_category": "Plumber" | "Electrician" | "AC / HVAC" | "Car Workshop" | "Bike Mechanic" | "Cleaning" | "Carpenter" | "Solar" | "Appliance Repair" | "Painter" | "Pest Control" | null,
  "conversational_reply": "Friendly response in the user's language recommending safe steps and connecting them with verified specialists."
}`

function parseJsonSafely(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1])
      } catch {}
    }
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {}
    }
    return null
  }
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// POST /api/diagnose - Full Diagnosis & Multimodal Vision Detection
// -------------------------------------------------------------
app.post('/api/diagnose', async (req, res) => {
  try {
    const { description, imageUrl, imageBase64, categoryId, language } = req.body

    const parts: any[] = []

    // 1. Process inline base64 image if provided
    if (imageBase64 && typeof imageBase64 === 'string') {
      const match = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        })
      } else {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        })
      }
    } else if (imageUrl && typeof imageUrl === 'string') {
      // 2. Process image URL (data URL, http/https, or local upload path)
      if (imageUrl.startsWith('data:')) {
        const match = imageUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          })
        }
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        try {
          const fetchRes = await fetch(imageUrl)
          if (fetchRes.ok) {
            const arrayBuf = await fetchRes.arrayBuffer()
            const mime = fetchRes.headers.get('content-type') || 'image/jpeg'
            const b64 = Buffer.from(arrayBuf).toString('base64')
            parts.push({
              inlineData: {
                mimeType: mime,
                data: b64,
              },
            })
          }
        } catch (imgErr) {
          console.warn('Failed to fetch imageUrl for Gemini vision:', imgErr)
        }
      } else if (imageUrl.startsWith('/')) {
        try {
          const localFilePath = path.join(__dirname, 'public', imageUrl)
          if (fs.existsSync(localFilePath)) {
            const buf = fs.readFileSync(localFilePath)
            const ext = path.extname(localFilePath).toLowerCase()
            const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
            parts.push({
              inlineData: {
                mimeType: mime,
                data: buf.toString('base64'),
              },
            })
          }
        } catch (localErr) {
          console.warn('Failed to read local file for vision:', localErr)
        }
      }
    }

    const hasImage = parts.length > 0

    const userPrompt = `User Problem Description: ${description || (hasImage ? 'Please analyze the attached image and diagnose the repair or equipment issue.' : 'Equipment inspection request.')}
${categoryId ? `Preferred Category Context: ${categoryId}` : ''}
${language ? `User Preferred Language: ${language}` : ''}

${hasImage ? 'IMPORTANT MULTIMODAL INSTRUCTION: Carefully inspect the attached photo. Identify the specific appliance, machine, piping, fixture, or surface shown (e.g., washing machine, pipe leak, circuit breaker panel, AC unit, car component). Detect any visual defects such as cracks, leaks, burns, rust, disconnected wires, or mechanical wear. Tailor your problem summary, detected objects, possible causes, safe steps, and conversational reply directly to what is visible in the picture.' : 'Provide clear, safe, and practical troubleshooting steps.'}`

    parts.push({ text: userPrompt })

    const result = await generateWithFallback({
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        systemInstruction: SYSTEM_DIAGNOSIS_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    })

    const parsed = parseJsonSafely(result.text)
    if (!parsed) {
      throw new Error('Failed to parse model JSON output.')
    }

    return res.json({
      success: true,
      diagnosis: parsed,
      modelUsed: result.model,
    })
  } catch (error: any) {
    console.error('Error in /api/diagnose:', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to diagnose problem.',
    })
  }
})

// -------------------------------------------------------------
// POST /api/chat - Conversational FixMate Assistant (English & Urdu)
// -------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, imageBase64 } = req.body

    const contents: any[] = []

    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.role === 'user' || item.role === 'ai') {
          contents.push({
            role: item.role === 'ai' ? 'model' : 'user',
            parts: [{ text: item.text || '' }],
          })
        }
      }
    }

    const currentParts: any[] = []
    if (imageBase64 && typeof imageBase64 === 'string') {
      const match = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
      if (match) {
        currentParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        })
      } else {
        currentParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        })
      }
    }

    currentParts.push({
      text: message || 'Please inspect my attached picture and assist me.',
    })

    contents.push({
      role: 'user',
      parts: currentParts,
    })

    const result = await generateWithFallback({
      contents,
      config: {
        systemInstruction: `You are FixMate, an intelligent, empathetic repair assistant for Pakistani and global homes.
You speak fluently in English, Urdu (اردو), and Roman Urdu.
If the user speaks or writes in Urdu or Roman Urdu, respond naturally in Urdu / Roman Urdu with clear steps!
If they upload a photo, describe what you see, point out any faults, and advise whether it requires a professional technician (e.g. Plumber, Electrician, Carpenter, AC Technician) or can be safely checked at home.`,
        temperature: 0.4,
      },
    })

    return res.json({
      success: true,
      reply: result.text,
      modelUsed: result.model,
    })
  } catch (error: any) {
    console.error('Error in /api/chat:', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Chat service encountered an error.',
    })
  }
})

// -------------------------------------------------------------
// POST /api/upload-photo - Upload and host technician & user photos
// -------------------------------------------------------------
app.post('/api/upload-photo', async (req, res) => {
  try {
    const { imageBase64, userId, technicianId } = req.body
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'No image data provided' })
    }

    const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
    const ext = matches ? (matches[1].includes('png') ? 'png' : 'jpg') : 'jpg'
    const base64Data = matches ? matches[2] : imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    const avatarsDir = path.resolve(__dirname, 'public', 'uploads', 'avatars')
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true })
    }

    const safeId = (technicianId || userId || 'tech').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36)
    const fileName = `avatar-${safeId}-${Date.now()}.${ext}`
    const filePath = path.join(avatarsDir, fileName)
    fs.writeFileSync(filePath, buffer)

    const publicUrl = `/uploads/avatars/${fileName}`
    return res.json({ success: true, url: publicUrl })
  } catch (error: any) {
    console.error('Error in /api/upload-photo:', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to save photo.',
    })
  }
})

// -------------------------------------------------------------
// POST /api/transcribe - Multimodal Audio Speech-to-Text (English & Urdu)
// -------------------------------------------------------------
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType, language } = req.body || {}
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'No audio data provided' })
    }

    const cleanBase64 = audioBase64.replace(/^data:[a-zA-Z0-9/.-]+;base64,/, '')
    const audioMime = (mimeType || 'audio/webm').split(';')[0]

    const langInstruction =
      language === 'ur'
        ? 'The user is speaking in Urdu (or Roman Urdu). Transcribe accurately into Urdu script (or Roman Urdu if spoken as such).'
        : language === 'en'
        ? 'The user is speaking in English. Transcribe accurately into English text.'
        : 'The user may speak in Urdu (اردو), Roman Urdu, or English. Transcribe verbatim in the spoken language.'

    const result = await generateWithFallback({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: audioMime,
                data: cleanBase64,
              },
            },
            {
              text: `${langInstruction}
Transcribe the speech accurately into text. Output ONLY the transcribed words with no extra quotes, no markdown, and no preamble. If the audio is silent or unintelligible noise, output an empty response.`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
      },
      models: ['gemini-3.5-transcribe', 'gemini-3.8-flash', 'gemini-flash-latest'],
    })

    const transcript = (result.text || '').trim().replace(/^["']|["']$/g, '')
    return res.json({ success: true, transcript, modelUsed: result.model })
  } catch (error: any) {
    console.error('Error in /api/transcribe:', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to transcribe audio.',
    })
  }
})

// -------------------------------------------------------------
// POST /api/n8n/test - Server-side connectivity test for n8n webhooks
// (Bypasses browser CORS & Mixed-Content blocks, gives actionable diagnostics)
// -------------------------------------------------------------
app.post('/api/n8n/test', async (req, res) => {
  try {
    const { webhookUrl, mock } = req.body || {}

    // Allow mock connection testing for instant verification
    if (mock === true || webhookUrl === 'mock' || webhookUrl === 'simulate') {
      return res.json({
        success: true,
        status: 200,
        message: 'Simulation verified: n8n pipeline parser and response dispatch are working properly.',
        data: '{"output":"FixMate n8n AI Agent connection verified successfully!"}',
      })
    }

    const targetUrl = (webhookUrl || process.env.VITE_N8N_AI_CHAT_WEBHOOK || '').trim()

    if (!targetUrl) {
      return res.status(400).json({ success: false, message: 'No n8n webhook URL specified.' })
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook URL. URL must start with https:// or http://',
      })
    }

    async function tryCallWebhook(url: string) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)
      try {
        const response = await fetch(url, {
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
        const text = await response.text()
        return { ok: response.ok, status: response.status, statusText: response.statusText, text }
      } catch (err: any) {
        clearTimeout(timeoutId)
        return { ok: false, error: err }
      }
    }

    const callResult = await tryCallWebhook(targetUrl)

    let isInactive = false
    let n8nHint = ''

    if (!callResult.ok && callResult.text) {
      try {
        const parsedJson = JSON.parse(callResult.text)
        if (parsedJson?.hint) n8nHint = parsedJson.hint
        if (parsedJson?.message && (parsedJson.message.includes('not registered') || parsedJson.code === 404)) {
          isInactive = true
        }
      } catch {}
    }

    // If 404 on /webhook/, check if /webhook-test/ is active in n8n editor
    if (!callResult.ok && targetUrl.includes('/webhook/')) {
      const altUrl = targetUrl.replace('/webhook/', '/webhook-test/')
      const altResult = await tryCallWebhook(altUrl)
      if (altResult.ok) {
        return res.json({
          success: true,
          status: altResult.status,
          suggestedUrl: altUrl,
          message: 'Connected via n8n Test Webhook! Note: In your n8n editor, this workflow is currently in Test mode. To use the production webhook, toggle the workflow switch to "Active" (top-right of canvas).',
          data: (altResult.text || '').slice(0, 300),
        })
      }
    } else if (!callResult.ok && targetUrl.includes('/webhook-test/')) {
      const altUrl = targetUrl.replace('/webhook-test/', '/webhook/')
      const altResult = await tryCallWebhook(altUrl)
      if (altResult.ok) {
        return res.json({
          success: true,
          status: altResult.status,
          suggestedUrl: altUrl,
          message: 'Connected via n8n Production Webhook! The workflow is active.',
          data: (altResult.text || '').slice(0, 300),
        })
      }
    }

    if (callResult.ok) {
      return res.json({
        success: true,
        status: callResult.status,
        message: 'Successfully connected to n8n AI Agent webhook! Workflow is live and responding.',
        data: (callResult.text || '').slice(0, 300),
      })
    }

    if (isInactive || callResult.status === 404) {
      return res.json({
        success: false,
        status: 404,
        isInactive: true,
        n8nReachable: true,
        message:
          n8nHint ||
          'Connected to n8n host, but workflow is currently inactive (Draft mode). In your n8n workspace, open the workflow and toggle the switch in the top-right corner to "Active". (Or if running a test run, click "Execute workflow" on the canvas).',
      })
    }

    if (callResult.error) {
      const errMsg = callResult.error.message || String(callResult.error)
      return res.json({
        success: false,
        message: `Could not reach n8n host: ${errMsg}. Please verify the domain and network accessibility.`,
      })
    }

    return res.json({
      success: false,
      status: callResult.status,
      message: `n8n endpoint returned HTTP ${callResult.status} (${callResult.statusText || 'Error'}). ${n8nHint}`,
    })
  } catch (error: any) {
    console.error('Error in /api/n8n/test:', error)
    return res.status(500).json({ success: false, message: error?.message || 'Failed to test n8n connection.' })
  }
})

// -------------------------------------------------------------
// POST /api/n8n/chat - Proxy chat questions to n8n AI Agent
// -------------------------------------------------------------
app.post('/api/n8n/chat', async (req, res) => {
  try {
    const { webhookUrl, message, sessionId, userId, imageUrl, requestId } = req.body || {}
    const targetUrl = (webhookUrl || process.env.VITE_N8N_AI_CHAT_WEBHOOK || '').trim()

    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'No n8n chat webhook URL configured' })
    }

    const payload = {
      chatInput: message,
      message,
      prompt: message,
      text: message,
      description: message,
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: userId || 'anonymous_user',
      imageUrl: imageUrl || null,
      requestId: requestId || null,
      timestamp: new Date().toISOString(),
      source: 'fixmate_frontend',
    }

    async function sendToUrl(url: string) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 25000)
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const text = await r.text()
        return { ok: r.ok, status: r.status, text }
      } catch (err: any) {
        clearTimeout(timeoutId)
        return { ok: false, error: err }
      }
    }

    let result = await sendToUrl(targetUrl)

    // If production 404, try test webhook automatically
    if (!result.ok && targetUrl.includes('/webhook/')) {
      const testUrl = targetUrl.replace('/webhook/', '/webhook-test/')
      const testResult = await sendToUrl(testUrl)
      if (testResult.ok && testResult.text) {
        result = testResult
      }
    }

    if (result.ok && result.text) {
      return res.json({ success: true, raw: result.text })
    }

    return res.status(result.status || 502).json({
      success: false,
      status: result.status,
      error: result.text || result.error?.message || 'n8n webhook did not respond successfully',
    })
  } catch (error: any) {
    console.error('Error in /api/n8n/chat:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to query n8n chat' })
  }
})

// -------------------------------------------------------------
// POST /api/n8n/dispatch - Proxy service request ticket dispatch to n8n
// -------------------------------------------------------------
app.post('/api/n8n/dispatch', async (req, res) => {
  try {
    const { webhookUrl, ...payload } = req.body
    const targetUrl = (webhookUrl || process.env.VITE_N8N_NEW_SERVICE_REQUEST_WEBHOOK || '').trim()

    if (!targetUrl) {
      return res.status(400).json({ success: false, error: 'No n8n service request webhook configured' })
    }

    async function sendDispatch(url: string) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const text = await r.text()
        return { ok: r.ok, status: r.status, text }
      } catch (err: any) {
        clearTimeout(timeoutId)
        return { ok: false, error: err }
      }
    }

    let result = await sendDispatch(targetUrl)
    if (!result.ok && targetUrl.includes('/webhook/')) {
      const testUrl = targetUrl.replace('/webhook/', '/webhook-test/')
      const testRes = await sendDispatch(testUrl)
      if (testRes.ok) result = testRes
    }

    if (result.ok) {
      return res.json({ success: true })
    }

    return res.status(result.status || 502).json({
      success: false,
      status: result.status,
      error: result.text || result.error?.message || 'Failed to dispatch to n8n',
    })
  } catch (error: any) {
    console.error('Error in /api/n8n/dispatch:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Failed to dispatch to n8n' })
  }
})

// -------------------------------------------------------------
// Vite Dev Server or Production Static Serving
// -------------------------------------------------------------
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production'

  if (isDev) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.resolve(__dirname, 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FixMate full-stack server running on http://0.0.0.0:${PORT}`)
  })
}

if (process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}

export default app
export { app }
