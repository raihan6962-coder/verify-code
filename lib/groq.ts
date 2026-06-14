let apiKey = process.env.GROQ_API_KEY || ''

export function setGroqApiKey(key: string) {
  apiKey = key
}

export function hasGroqApiKey(): boolean {
  return !!apiKey
}

export async function groqChat(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: [{ type: 'text', text: system }] },
        { role: 'user', content: [{ type: 'text', text: user }] },
      ],
      temperature: 0.1,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }
  const data = await res.json()
  return data.choices[0].message.content
}
