import dotenv from 'dotenv'
import express from 'express'

dotenv.config({ path: '.env.local' })

const app = express()
const port = Number(process.env.PORT) || 3001
const model = 'gemini-3.5-flash-lite'
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
)

app.use((request, response, next) => {
  const origin = request.get('origin')
  if (origin && !allowedOrigins.has(origin)) {
    return response.status(403).json({ error: 'This website is not allowed to use the API.' })
  }

  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }

  if (request.method === 'OPTIONS') {
    return response.sendStatus(204)
  }
  next()
})

app.use(express.json({ limit: '10kb' }))

app.get('/healthz', (_request, response) => {
  response.json({ status: 'ok' })
})

async function generateText(prompt, jsonResponse = false) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const error = new Error('The Gemini API key is not configured on the server.')
    error.status = 503
    throw error
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        ...(jsonResponse && { generationConfig: { responseMimeType: 'application/json' } }),
      }),
    },
  )

  if (!response.ok) {
    let message = response.statusText || 'Gemini request failed.'
    try {
      const body = await response.json()
      if (typeof body.error?.message === 'string') {
        message = body.error.message
      }
    } catch {
      // Keep the HTTP status message if Gemini did not return JSON.
    }

    const error = new Error(`Gemini request failed (${response.status}): ${message}`)
    error.status = 502
    throw error
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim()

  if (!text) {
    const error = new Error('Gemini returned an empty response. Please try again.')
    error.status = 502
    throw error
  }
  return text
}

app.post('/api/skills', async (_request, response) => {
  try {
    const text = await generateText(
      'Suggest 10 professional skills for a software developer. Return only a JSON array of short skill names.',
      true,
    )
    const skills = JSON.parse(text)
    if (!Array.isArray(skills) || skills.some((skill) => typeof skill !== 'string')) {
      return response.status(502).json({ error: 'Gemini returned an unexpected skills response.' })
    }
    response.json({ skills: skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 10) })
  } catch (error) {
    response.status(error.status ?? 502).json({ error: error.message })
  }
})

app.post('/api/summary', async (request, response) => {
  const background = request.body?.background
  if (typeof background !== 'string' || !background.trim()) {
    return response.status(400).json({ error: 'Enter professional background details first.' })
  }
  if (background.length > 4000) {
    return response.status(400).json({ error: 'Background details must be 4,000 characters or fewer.' })
  }

  try {
    const summary = await generateText(
      `Write a concise, professional resume summary based on the following keywords and background. Use first person implied (no "I"), avoid inventing facts, and return only the summary paragraph:\n\n${background.trim()}`,
    )
    response.json({ summary })
  } catch (error) {
    response.status(error.status ?? 502).json({ error: error.message })
  }
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Resume Builder API listening on port ${port}`)
})
