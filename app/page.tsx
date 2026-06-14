'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export default function Dashboard() {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ts, setTs] = useState(0)
  const [imgReady, setImgReady] = useState(false)
  const [aiReady, setAiReady] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [pageUrl, setPageUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('New Tab')
  const [browserReady, setBrowserReady] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    fetch('/api/chat')
      .then((r) => r.json())
      .then((d) => setAiReady(d.ai))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTs(Date.now()), 800)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (browserReady) {
      const id = setInterval(async () => {
        try {
          const r = await fetch('/api/chat')
          const d = await r.json()
          if (d.ai !== undefined) setAiReady(d.ai)
        } catch {}
      }, 3000)
      return () => clearInterval(id)
    }
  }, [browserReady])

  useEffect(() => {
    inputRef.current?.focus()
  }, [loading])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleImgLoad = useCallback(() => {
    setImgReady(true)
    setBrowserReady(true)
  }, [])

  const handleImgError = useCallback(() => {
    setImgReady(false)
  }, [])

  async function handleBrowserClick(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current
    if (!img || !imgReady) return
    const rect = img.getBoundingClientRect()
    const scaleX = 1280 / rect.width
    const scaleY = 720 / rect.height
    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)
    try {
      await fetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      })
    } catch {}
  }

  async function sendMessage() {
    const cmd = input.trim()
    if (!cmd || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: cmd }])
    setLoading(true)
    try {
      const body: Record<string, string> = { command: cmd }
      if (apiKey) body.apiKey = apiKey
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ai !== undefined) setAiReady(data.ai)
      setMessages((prev) => [...prev, { role: 'agent', text: data.result }])
    } catch {
      setMessages((prev) => [...prev, { role: 'agent', text: '✗ Request failed' }])
    }
    setLoading(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#0d1117',
        color: '#e6edf3',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ===== CHAT PANEL ===== */}
      <div
        style={{
          flex: '0 0 380px',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #30363d',
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #30363d',
            background: '#161b22',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Browser Agent</h1>
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              style={{
                background: 'none',
                border: '1px solid #30363d',
                borderRadius: 6,
                color: aiReady ? '#3fb950' : '#e3b341',
                fontSize: 11,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              {aiReady ? 'AI ●' : 'AI ○'}
            </button>
          </div>
          {showKeyInput && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_... (Groq API key)"
                style={{
                  flex: 1,
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: '5px 8px',
                  color: '#e6edf3',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={async () => {
                  if (apiKey) {
                    await fetch('/api/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ command: '', apiKey }),
                    })
                    setAiReady(true)
                  }
                }}
                style={{
                  background: '#238636',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '5px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Set
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', fontSize: 13 }}>
          {messages.length === 0 && (
            <div style={{ color: '#484f58', textAlign: 'center', marginTop: 40, lineHeight: 1.8 }}>
              {aiReady
                ? 'Try:\nopen youtube\nsearch for cats\nclick first video\nscroll down\ngo back'
                : 'Click AI ○ above\nand enter your\nGroq API key'}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: m.role === 'user' ? '#58a6ff' : '#3fb950',
                  marginBottom: 2,
                  fontWeight: 600,
                }}
              >
                {m.role === 'user' ? 'You' : 'Agent'}
              </div>
              <div
                style={{
                  background: m.role === 'user' ? '#1f6feb' : '#21262d',
                  padding: '7px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.5,
                  maxWidth: '95%',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  border: m.role === 'user' ? 'none' : '1px solid #30363d',
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid #30363d',
            display: 'flex',
            gap: 6,
            background: '#161b22',
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a command..."
            disabled={loading}
            style={{
              flex: 1,
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '8px 12px',
              color: '#e6edf3',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              background: loading ? '#21262d' : '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: loading ? 'default' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {/* ===== BROWSER VIEW ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Browser chrome */}
        <div
          style={{
            background: '#1e1e2e',
            borderBottom: '1px solid #30363d',
            userSelect: 'none',
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px 0',
              gap: 0,
              background: '#151521',
            }}
          >
            <div
              style={{
                padding: '6px 16px',
                background: '#1e1e2e',
                borderRadius: '6px 6px 0 0',
                fontSize: 12,
                color: '#e6edf3',
                border: '1px solid #30363d',
                borderBottom: '1px solid #1e1e2e',
                marginBottom: -1,
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'default',
              }}
            >
              {pageTitle || 'New Tab'}
            </div>
          </div>

          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
            }}
          >
            <button
              onClick={async () => {
                setLoading(true)
                await fetch('/api/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command: 'go back' }),
                })
                setLoading(false)
              }}
              style={navBtnStyle}
              title="Go back"
            >
              ←
            </button>
            <button
              onClick={async () => {
                setLoading(true)
                await fetch('/api/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command: 'refresh' }),
                })
                setLoading(false)
              }}
              style={navBtnStyle}
              title="Refresh"
            >
              ↻
            </button>
            <div
              style={{
                flex: 1,
                background: '#252540',
                borderRadius: 20,
                padding: '5px 14px',
                fontSize: 12.5,
                color: '#9eabc0',
                cursor: 'text',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pageUrl || 'about:blank'}
            </div>
            {aiReady && (
              <span
                style={{
                  fontSize: 10,
                  color: '#3fb950',
                  background: '#1a3a1a',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontWeight: 600,
                }}
              >
                AI
              </span>
            )}
          </div>
        </div>

        {/* Content area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d1117',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Desktop background (shown when no screenshot) */}
          {!imgReady && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                background: 'linear-gradient(145deg, #0d1117 0%, #161b22 50%, #1c2333 100%)',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #238636, #1f6feb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  marginBottom: 16,
                  opacity: 0.8,
                }}
              >
                ⊞
              </div>
              <div style={{ color: '#8b949e', fontSize: 13 }}>
                {browserReady ? 'Browser ready — send a command' : 'Starting browser...'}
              </div>
              {!browserReady && (
                <div
                  style={{
                    marginTop: 12,
                    width: 120,
                    height: 3,
                    background: '#30363d',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '30%',
                      height: '100%',
                      background: '#238636',
                      borderRadius: 2,
                      animation: 'slide 1.5s ease-in-out infinite',
                    }}
                  />
                </div>
              )}
              <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
            </div>
          )}

          {/* Browser screenshot */}
          <img
            ref={imgRef}
            src={`/api/screenshot?t=${ts}`}
            alt="browser preview"
            onClick={handleBrowserClick}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              cursor: imgReady ? 'crosshair' : 'default',
              visibility: imgReady ? 'visible' : 'hidden',
              position: 'relative',
              zIndex: 1,
            }}
            onLoad={handleImgLoad}
            onError={handleImgError}
          />
        </div>
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#9eabc0',
  fontSize: 16,
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 4,
  lineHeight: 1,
}
