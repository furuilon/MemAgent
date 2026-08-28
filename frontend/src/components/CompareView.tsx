import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'
import { Check, Square, X } from 'lucide-react'
import { streamTask, type AppliedMemory } from '../lib/api'

interface Props {
  task: string
  onExit: () => void
}

interface ArmState {
  content: string
  status: 'running' | 'done' | 'error'
  error?: string
  applied: AppliedMemory[]
}

const INIT: ArmState = { content: '', status: 'running', applied: [] }

export default function CompareView({ task, onExit }: Props) {
  const [left, setLeft] = useState<ArmState>(INIT)
  const [right, setRight] = useState<ArmState>(INIT)
  const controllersRef = useRef<AbortController[]>([])
  const finishedRef = useRef(0)

  const stopAll = () => controllersRef.current.forEach((c) => c.abort())

  useEffect(() => {
    let cancelled = false

    const consume = async (arm: 'left' | 'right', useMemory: boolean) => {
      const controller = new AbortController()
      controllersRef.current.push(controller)
      try {
        for await (const ev of streamTask(task, null, controller.signal, {
          useMemory,
          persist: false,
        })) {
          if (cancelled) return
          const setter = arm === 'left' ? setLeft : setRight
          switch (ev.type) {
            case 'delta':
              setter((s) => ({ ...s, content: s.content + ev.data }))
              break
            case 'memories':
              if (useMemory) setter(() => ({ ...INIT, applied: ev.data.applied ?? [] }))
              break
            case 'done':
              finishedRef.current += 1
              setter((s) => ({
                ...s,
                content: ev.data.content,
                status: 'done',
                applied: ev.data.memories_applied ?? [],
              }))
              break
            case 'error':
              finishedRef.current += 1
              setter((s) => ({ ...s, status: 'error', error: String(ev.data) }))
              break
          }
        }
      } catch (e) {
        if (cancelled) return
        const errName = e instanceof Error ? e.name : (e as { name?: string })?.name
        if (errName !== 'AbortError') {
          finishedRef.current += 1
          const setter = arm === 'left' ? setLeft : setRight
          setter((s) => ({ ...s, status: 'error', error: '无法连接后端服务' }))
        }
      }
    }

    consume('left', false)
    consume('right', true)

    return () => {
      cancelled = true
      controllersRef.current.forEach((c) => c.abort())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allDone = left.status !== 'running' && right.status !== 'running'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface/60 px-6 py-3">
        <span className="text-[13.5px] font-semibold tracking-tight">对照直播</span>
        <span className="truncate text-[12.5px] text-ink-faint">“{task}”</span>
        <div className="ml-auto flex items-center gap-2">
          {!allDone && (
            <button
              onClick={stopAll}
              aria-label="停止对照"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:border-red-300 hover:text-red-500"
            >
              <Square className="size-3 fill-current" />
              停止
            </button>
          )}
          <button
            onClick={onExit}
            aria-label="退出对照模式"
            className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-zinc-700"
          >
            <X className="size-3.5" />
            退出对照
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-y-auto p-4">
        <ArmColumn label="无记忆 · 普通 AI" emoji="😶" state={left} tone="plain" />
        <ArmColumn label="MemAgent · 带记忆" emoji="🧠" state={right} tone="memory" />
      </div>

      <div className="shrink-0 px-4 pb-3 pt-1 text-center text-[11.5px] text-ink-faint">
        {allDone
          ? '对比完成 —— 右侧结果自动遵守了你沉淀的全部偏好，左侧每次都从零开始。'
          : '同一任务、同一时刻，唯一变量：是否带着你的记忆。'}
      </div>
    </div>
  )
}

function ArmColumn({
  label,
  emoji,
  state,
  tone,
}: {
  label: string
  emoji: string
  state: ArmState
  tone: 'plain' | 'memory'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-surface ${
        tone === 'memory' ? 'border-accent/35 shadow-[0_8px_32px_rgba(217,119,6,0.08)]' : 'border-line'
      }`}
    >
      <div
        className={`flex shrink-0 items-center gap-2 border-b px-4 py-2.5 ${
          tone === 'memory' ? 'border-accent/20 bg-accent-soft/40' : 'border-line bg-paper'
        }`}
      >
        <span>{emoji}</span>
        <span className={`text-[13px] font-medium ${tone === 'memory' ? 'text-accent-strong' : ''}`}>{label}</span>
        {state.status === 'running' && (
          <span className="ml-auto size-3.5 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
        )}
        {state.status === 'done' && <Check className="ml-auto size-4 text-emerald-600" />}
        {state.status === 'error' && (
          <span className="ml-auto text-[11px] text-red-500">失败</span>
        )}
      </div>
      {tone === 'memory' && state.applied.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-accent/15 bg-accent-soft/30 px-3 py-2">
          {state.applied.map((m) => (
            <span
              key={m.id}
              title={m.content}
              className="max-w-[220px] truncate rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] text-accent-strong ring-1 ring-accent/25"
            >
              {m.content}
            </span>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-600">{state.error}</p>
        ) : state.content ? (
          <div className="md text-[13.5px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-faint">等待生成…</p>
        )}
      </div>
    </motion.div>
  )
}
