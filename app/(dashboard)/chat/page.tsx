'use client'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/Toast'
import { useActiveBiz } from '@/lib/use-active-biz'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const { activeBizId, businesses, loading: bizLoading } = useActiveBiz()
  const activeBusiness = businesses.find(b => b.id === activeBizId) || null
  const toast = useToast()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending || !activeBizId) return
    setInput('')
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setSending(true)
    try {
      const res = await fetch(`/api/businesses/${activeBizId}/chat`, {
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

  if (bizLoading) {
    return <div className="p-6 text-center text-gray-400 text-sm">Cargando...</div>
  }

  if (!activeBusiness?.chatbotEnabled) {
    return (
      <div className="p-6">
        <div className="card p-8 text-center max-w-md mx-auto">
          <p className="text-gray-700 font-medium mb-1">Asistente no disponible</p>
          <p className="text-sm text-gray-400">
            El asistente de chat con IA no está habilitado para este negocio. Contacta a tu administrador para activarlo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-4rem)] max-h-[900px]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Asistente</h1>
        <p className="text-sm text-gray-500 mt-0.5">Pregúntale sobre las transacciones de {activeBusiness.name}</p>
      </div>

      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-10">
              Ejemplos: &ldquo;¿Cuántas transacciones tengo sin clasificar?&rdquo;, &ldquo;¿Cuánto gasté en Office Expenses este año?&rdquo;
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#1B4965] text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 rounded-xl px-3.5 py-2 text-sm">Pensando...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-100 p-3 flex gap-2">
          <input
            className="input text-sm flex-1"
            placeholder="Escribe tu pregunta..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-lg bg-[#1B4965] text-white text-sm font-medium hover:bg-[#153d52] transition-colors disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
