import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import type { MemoryItem } from '../lib/api'

interface Props {
  comment: string
  memories: MemoryItem[]
  onDone: () => void
}

type Phase = 'comment' | 'chips' | 'fly'

export default function DistillOverlay({ comment, memories, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('comment')
  const chips = useMemo(() => memories.slice(0, 5), [memories])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('chips'), 650)
    const t2 = setTimeout(() => setPhase('fly'), 650 + chips.length * 230 + 850)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [chips.length])

  useEffect(() => {
    if (phase !== 'fly') return
    const t = setTimeout(onDone, chips.length * 130 + 750)
    return () => clearTimeout(t)
  }, [phase, chips.length, onDone])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 backdrop-blur-md"
      >
        <motion.div
          layout
          className="w-[440px] rounded-2xl bg-surface p-8 shadow-[0_24px_80px_rgba(24,24,27,0.18)] ring-1 ring-black/[0.06]"
        >
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <span className="text-[13px] font-medium tracking-tight">
              {chips.length > 0 ? '正在从反馈中蒸馏记忆…' : '分析反馈中…'}
            </span>
          </div>
          <p className="text-[15px] leading-relaxed text-ink">“{comment || '（用户直接修改了结果）'}”</p>

          {phase !== 'comment' && (
            <div className="mt-6 space-y-2.5">
              {chips.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 14, scale: 0.92, filter: 'blur(4px)' }}
                  animate={
                    phase === 'chips'
                      ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
                      : {
                          opacity: 0,
                          x: typeof window !== 'undefined' ? window.innerWidth * 0.32 : 400,
                          y: typeof window !== 'undefined' ? -window.innerHeight * 0.28 : -200,
                          scale: 0.72,
                          filter: 'blur(2px)',
                        }
                  }
                  transition={{
                    delay: phase === 'chips' ? i * 0.23 : i * 0.13,
                    duration: phase === 'chips' ? 0.45 : 0.6,
                    ease: phase === 'chips' ? [0.22, 1, 0.36, 1] : [0.5, 0, 0.9, 0.4],
                  }}
                  className="rounded-xl border border-accent/35 bg-accent-soft/70 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                        m.status === 'merged' ? 'bg-line-soft text-ink-soft' : 'bg-accent-strong text-white'
                      }`}
                    >
                      {m.status === 'merged' ? '强化已有记忆' : '新记忆'}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-accent-strong/70">
                      {m.scope.join(' · ')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-snug">{m.content}</p>
                </motion.div>
              ))}
              {chips.length === 0 && (
                <p className="pt-2 text-[13px] text-ink-faint">这次没有沉淀出新偏好，已有记忆保持不变。</p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
