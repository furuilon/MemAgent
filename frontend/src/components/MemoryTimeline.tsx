import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GitMerge, Sparkles, TrendingUp, X } from 'lucide-react'
import { fetchMemoryEvents, type MemoryEvent } from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
}

const KIND_META: Record<
  MemoryEvent['kind'],
  { label: string; icon: typeof Sparkles; dot: string; text: string }
> = {
  born: { label: '新规则诞生', icon: Sparkles, dot: 'bg-accent', text: 'text-accent-strong' },
  merged: { label: '规则合并', icon: GitMerge, dot: 'bg-sky-500', text: 'text-sky-600' },
  boosted: { label: '置信度提升', icon: TrendingUp, dot: 'bg-emerald-500', text: 'text-emerald-600' },
}

function dayLabel(iso: string): string {
  return iso.slice(0, 10)
}

export default function MemoryTimeline({ open, onClose }: Props) {
  const [events, setEvents] = useState<MemoryEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetchMemoryEvents()
        .then(setEvents)
        .catch(() => undefined)
        .finally(() => setLoading(false))
    }
  }, [open])

  const groups = useMemo(() => {
    const map = new Map<string, MemoryEvent[]>()
    for (const e of events) {
      const day = dayLabel(e.created_at)
      if (!map.has(day)) map.set(day, [])
      map.get(day)!.push(e)
    }
    return Array.from(map.entries())
  }, [events])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[78vh] w-[560px] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_24px_80px_rgba(24,24,27,0.18)] ring-1 ring-black/[0.06]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                  <Sparkles className="size-4 text-accent" />
                  记忆演化时间线
                </h2>
                <p className="mt-0.5 text-[11.5px] text-ink-faint">
                  它的每一条习惯，都是从你的某句话里学会的
                </p>
              </div>
              <button onClick={onClose} aria-label="关闭" className="text-ink-faint transition-colors hover:text-ink">
                <X className="size-4.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {loading && <p className="py-8 text-center text-[13px] text-ink-faint">加载中…</p>}
              {!loading && events.length === 0 && (
                <div className="rounded-xl border border-dashed border-line p-6 text-center">
                  <p className="text-[13px] leading-relaxed text-ink-faint">
                    时间线还没有内容。
                    <br />
                    从现在起的每一条记忆、每一次强化，都会记录在这里。
                  </p>
                </div>
              )}
              {groups.map(([day, list]) => (
                <div key={day} className="mb-5">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">{day}</div>
                  <div className="relative space-y-3 pl-5">
                    <span className="absolute bottom-1 left-[7px] top-1 w-px bg-line" />
                    {list.map((e, i) => {
                      const meta = KIND_META[e.kind] ?? KIND_META.born
                      const Icon = meta.icon
                      return (
                        <motion.div
                          key={e.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="relative rounded-xl border border-line bg-paper p-3"
                        >
                          <span
                            className={`absolute -left-[25px] top-4 size-[9px] rounded-full ring-2 ring-surface ${meta.dot}`}
                          />
                          <div className={`flex items-center gap-1.5 text-[12px] font-medium ${meta.text}`}>
                            <Icon className="size-3" />
                            {meta.label}
                            <span className="ml-auto font-mono text-[10px] font-normal text-ink-faint/70">
                              {e.created_at.slice(11, 16)}
                            </span>
                          </div>
                          {e.detail && <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{e.detail}</p>}
                          {e.content && (
                            <p className="mt-1 truncate text-[11.5px] text-ink-faint" title={e.content}>
                              规则：{e.content}
                            </p>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
