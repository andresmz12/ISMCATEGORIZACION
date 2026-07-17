'use client'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/Toast'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Floating chat bubble, bottom-right, only rendered by the dashboard layout
// when the active business has chatbotEnabled === true.
export function ChatWidget({ businessId, businessName }: { businessId: string; businessName: string }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Reset the conversation when switching businesses — a stale history
  // referencing a different business's data would confuse the model.
  useEffect(() => {
    setMessages([])
  }, [businessId])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setSending(true)
    try {
      const res = await fetch(`/api/businesses/${businessId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.error || 'No se pudo enviar el mensaje', 'error')
        setMessages(messages)
        setInput(text)
        return
      }
      setMessages(m => [...m, { role: 'assistant', content: data.reply }])
    } catch {
      toast('Error de conexión', 'error')
      setMessages(messages)
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[360px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-7rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-[#1B4965] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-white text-sm font-semibold">Asistente</p>
              <p className="text-white/60 text-xs">{businessName}</p>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-white/60 hover:text-white transition-colors"
                  aria-label="Nueva conversación"
                  title="Nueva conversación"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
                aria-label="Cerrar chat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-xs py-8 px-2">
                Ejemplos: &ldquo;¿Cuántas transacciones tengo sin clasificar?&rdquo;, &ldquo;¿Cuánto gasté en Office Expenses este año?&rdquo;
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-[#1B4965] text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 rounded-xl px-3 py-1.5 text-sm">Pensando...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 p-2.5 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              className="input text-sm flex-1"
              placeholder="Escribe tu pregunta..."
              maxLength={2000}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="px-3 py-2 rounded-lg bg-[#1B4965] text-white text-sm font-medium hover:bg-[#153d52] transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full bg-[#1B4965] hover:bg-[#153d52] text-white shadow-xl flex items-center justify-center transition-all hover:scale-105"
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    </div>
  )
}
