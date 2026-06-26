'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  isError?: boolean
}

interface CoachChatProps {
  userEmail: string
  userName?: string
}

// ---------------------------------------------------------------------------
// Suggested prompts shown when chat is empty
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  { icon: '📄', label: 'Review my resume', prompt: 'Can you review my resume and suggest improvements?' },
  { icon: '💡', label: 'What to post next', prompt: 'Based on my recent achievements, what should I post on LinkedIn next?' },
  { icon: '🔗', label: 'LinkedIn optimisation', prompt: 'How can I improve my LinkedIn profile to attract better opportunities?' },
  { icon: '📚', label: 'Skills to learn', prompt: 'What skills should I focus on learning next given my career trajectory?' },
  { icon: '🎯', label: 'Interview prep', prompt: 'Help me prepare for interviews. What stories from my achievements should I highlight?' },
  { icon: '🚀', label: 'Career roadmap', prompt: 'Given my background and goals, what career progression path do you recommend?' },
]

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-5">
      <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
        <Bot size={15} className="text-emerald-500 dark:text-emerald-400" />
      </div>
      <div className="bg-muted border border-border rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  const [showTime, setShowTime] = useState(false)

  return (
    <div
      className={cn(
        'flex items-end gap-3 mb-5 group',
        isUser && 'flex-row-reverse'
      )}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5',
          isUser
            ? 'bg-emerald-500/20 border border-emerald-500/30'
            : 'bg-emerald-500/15 border border-emerald-500/20'
        )}
      >
        {isUser ? (
          <User size={14} className="text-emerald-500 dark:text-emerald-400" />
        ) : (
          <Bot size={15} className="text-emerald-500 dark:text-emerald-400" />
        )}
      </div>

      {/* Bubble */}
      <div className="max-w-[75%] sm:max-w-[70%] space-y-1">
        <div
          className={cn(
            'px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-emerald-600 text-white rounded-2xl rounded-br-sm shadow-lg shadow-emerald-900/30'
              : msg.isError
              ? 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300 rounded-2xl rounded-bl-sm'
              : 'bg-muted/80 border border-border text-foreground rounded-2xl rounded-bl-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : msg.isError ? (
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
              <p>{msg.content}</p>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none
              prose-p:my-1 prose-p:leading-relaxed
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
              prose-strong:text-foreground prose-strong:font-semibold
              prose-strong:dark:text-white
              prose-ul:my-1.5 prose-ul:pl-4 prose-li:my-0.5
              prose-ol:my-1.5 prose-ol:pl-4
              prose-code:bg-card prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-emerald-600 dark:prose-code:text-emerald-300 prose-code:text-xs
              prose-blockquote:border-l-emerald-500 prose-blockquote:text-muted-foreground">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-emerald-500 dark:bg-emerald-400 rounded-sm animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* Timestamp — visible on hover */}
        <p
          className={cn(
            'text-[10px] text-muted-foreground/60 px-1 transition-opacity duration-150',
            showTime ? 'opacity-100' : 'opacity-0',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {format(msg.timestamp, 'h:mm a')}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CoachChat({ userEmail, userName }: CoachChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  const sendMessage = useCallback(
    async (text: string) => {
      const userText = text.trim()
      if (!userText || isStreaming) return

      setInput('')

      // Add user message
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])

      // Add placeholder for streaming assistant message
      const assistantId = crypto.randomUUID()
      const placeholderMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }
      setMessages((prev) => [...prev, placeholderMsg])
      setIsStreaming(true)

      // Build history for context (all prior messages)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      try {
        abortRef.current = new AbortController()

        const response = await fetch('/api/coach/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userText, conversationId, history }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error ?? `Error ${response.status}`)
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })

          // Update the streaming message in-place
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: accumulated, isStreaming: true }
                : m
            )
          )
        }

        // Mark streaming done
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        )
      } catch (err: unknown) {
        const isAbort =
          err instanceof Error && err.name === 'AbortError'

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: isAbort
                    ? 'Response cancelled.'
                    : `Something went wrong: ${
                        err instanceof Error ? err.message : 'Unknown error'
                      }. Please try again.`,
                  isStreaming: false,
                  isError: !isAbort,
                }
              : m
          )
        )
      } finally {
        setIsStreaming(false)
        abortRef.current = null
        // Refocus input
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
    },
    [isStreaming, messages, conversationId]
  )

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function stopStreaming() {
    abortRef.current?.abort()
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* ── Messages area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scroll-smooth">
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-8 max-w-xl mx-auto text-center">
            {/* Icon */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Bot size={36} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <Sparkles size={12} className="text-zinc-950" />
              </div>
            </div>

            {/* Greeting */}
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Hey{userName ? `, ${userName.split(' ')[0]}` : ''}! 👋
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed max-w-sm">
                I'm your AI career coach. I know your resume and achievements —
                ask me anything about your career.
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
              {SUGGESTED_PROMPTS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.prompt)}
                  disabled={isStreaming}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-muted-foreground/30 hover:bg-muted text-left transition-all duration-200 group"
                >
                  <span className="text-lg leading-none">{s.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">
                      {s.label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {/* Typing dots — shown briefly before first token arrives */}
            {isStreaming && messages[messages.length - 1]?.content === '' && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-background/90 dark:bg-zinc-950/90 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto">
          {/* New conversation prompt */}
          {!isEmpty && !isStreaming && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground/75">
                Shift+Enter for new line · Enter to send
              </p>
              <button
                onClick={() => {
                  setMessages([])
                  setConversationId(undefined)
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors"
              >
                <RefreshCw size={11} />
                New chat
              </button>
            </div>
          )}

          {/* Textarea + send */}
          <div className="flex items-end gap-3 bg-card border border-border rounded-2xl px-4 py-3 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your career coach anything…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none leading-relaxed disabled:opacity-50 min-h-[24px] max-h-[160px]"
            />

            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="shrink-0 w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                title="Stop generating"
              >
                <span className="w-3 h-3 rounded-sm bg-red-500 dark:bg-red-400" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-muted disabled:text-muted-foreground/45 flex items-center justify-center text-zinc-950 disabled:text-muted-foreground/40 transition-all duration-200 shadow-lg shadow-emerald-500/20 disabled:shadow-none"
                title="Send (Enter)"
              >
                <Send size={15} />
              </button>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
            AI can make mistakes. Always verify important career decisions independently.
          </p>
        </div>
      </div>
    </div>
  )
}
