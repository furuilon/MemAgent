import { useState } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, ChevronLeft, History, Sparkles, Trash2 } from 'lucide-react'
import { fetchMemorySummary, type MemoryItem } from '../lib/api'

interface Props {
  memories: MemoryItem[]
  onDelete: (id: string) => void
  onCreate: (payload: { type: string; content: string; scope: string[] }) => Promise<void>
  onOpenTimeline: () => void
}

const MEM_PANEL_KEY = 'memagent.mempanel'

const TYPE_STYLE: Record<string, string> = {
  rule: 'bg-ink text-paper',
  preference: 'bg-accent-soft text-accent-strong border border-accent/25',
  experience: 'bg-line-soft text-ink-soft',
}
const TYPE_LABEL: Record<string, string> = {
  rule: '规则',
  preference: '偏好',
  experience: '经验',
}

export default function MemoryPanel({ memories, onDelete, onCreate, onOpenTimeline }: Props) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(MEM_PANEL_KEY) === '1')
  const [adding, setAdding] = useState(false)
  const [content, setContent] = useState('')
  const [type, setType] = useState('preference')
  const [scope, setScope] = useState('weekly_report')
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryBusy, setSummaryBusy] = useState(false)

  const toggle = () => {
    setCollapsed((v) => {
      localStorage.setItem(MEM_PANEL_KEY, v ? '0' : '1')
      return !v
    })
  }

  if (collapsed) {
    return (
      <aside className="flex h-full w-[52px] shrink-0 flex-col items-center gap-4 border-l border-line py-4">
        <button
          onClick={toggle}
          aria-label="展开记忆库"
          title={`展开记忆库（${memories.length} 条）`}
          className="relative flex size-9 items-center justify-center rounded-xl text-accent-strong transition-colors hover:bg-accent-soft/60"
        >
          <BrainCircuit className="size-5" />
          {memories.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent-strong text-[9px] font-bold text-white">
              {memories.length > 9 ? '9+' : memories.length}
            </span>
          )}
        </button>
        <button
          onClick={toggle}
          aria-label="展开记忆库"
          className="mt-auto [writing-mode:vertical-rl] text-[11px] tracking-widest text-ink-faint transition-colors hover:text-ink"
        >
          记忆库
        </button>
      </aside>
    )
  }

  const submit = async () => {
    if (!content.trim()) return
    try {
      await onCreate({ type, content: content.trim(), scope: [scope] })
      setContent('')
      setErrMsg(null)
      setAdding(false)
    } catch {
      setErrMsg('保存失败，请检查后端服务')
    }
  }

  return (
    <aside className="flex h-full min-h-0 w-[360px] shrink-0 flex-col border-l border-line">
      <div className="flex items-center gap-2 px-5 pb-3 pt-5">
        <button
          onClick={toggle}
          aria-label="收起记忆库"
          title="收起记忆库"
          className="flex size-6 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-line-soft hover:text-ink"
        >
          <ChevronLeft className="size-4" />
        </button>
        <BrainCircuit className="size-4 text-accent-strong" />
        <span className="text-[14px] font-semibold tracking-tight">记忆库</span>
        <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-soft">
          {memories.length}
        </span>
        <button
          onClick={onOpenTimeline}
          aria-label="查看记忆演化时间线"
          title="记忆演化时间线"
          className="ml-auto rounded-lg border border-line bg-surface p-1.5 text-ink-faint transition-colors hover:border-accent/40 hover:text-accent-strong"
        >
          <History className="size-3.5" />
        </button>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
        >
          {adding ? '收起' : '+ 添加'}
        </button>
      </div>

      {adding && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mx-5 mb-3 overflow-hidden rounded-xl border border-line bg-surface p-3"
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="例如：周报永远用要点列表，不要表格"
            className="min-h-[60px] w-full resize-none rounded-lg border border-line p-2.5 text-[13px] outline-none focus:border-ink/25"
          />
          <div className="mt-2 flex items-center gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-[12px]"
            >
              <option value="preference">偏好</option>
              <option value="rule">规则</option>
              <option value="experience">经验</option>
            </select>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-[12px]"
            >
              <option value="weekly_report">周报</option>
              <option value="resume">简历</option>
              <option value="email">邮件</option>
              <option value="general">通用</option>
            </select>
            <button
              onClick={submit}
              disabled={!content.trim()}
              className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-[12px] font-medium text-paper disabled:opacity-40"
            >
              存入记忆
            </button>
          </div>
          {errMsg && <p className="mt-2 text-[11.5px] text-red-500">{errMsg}</p>}
        </motion.div>
      )}

      <div className="-mr-1 min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-5 pr-2">
        {memories.length === 0 && (
          <div className="rounded-xl border border-dashed border-line p-5 text-center">
            <p className="text-[13px] leading-relaxed text-ink-faint">
              还没有记忆。
              <br />
              提交一次反馈，它就会开始学习你的偏好。
            </p>
          </div>
        )}
        {memories.map((m) => (
          <motion.div
            key={m.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`group relative rounded-xl border bg-surface p-3.5 transition-all hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(24,24,27,0.06)] ${
              m.status === 'new' ? 'border-accent/45 ring-2 ring-accent/15' : 'border-line'
            }`}
          >
            <div className="mb-2 flex items-center gap-1.5">
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${TYPE_STYLE[m.type] ?? TYPE_STYLE.experience}`}
              >
                {TYPE_LABEL[m.type] ?? m.type}
              </span>
              {m.status === 'merged' && (
                <span className="rounded-md bg-line-soft px-1.5 py-0.5 text-[10.5px] text-ink-faint">
                  已合并
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] text-ink-faint/70">{m.id.slice(4, 10)}</span>
            </div>
            <p className="pr-4 text-[13.5px] leading-relaxed">{m.content}</p>
            <div className="mt-2.5 flex items-center gap-2">
              {m.scope.map((s) => (
                <span
                  key={s}
                  className="rounded bg-line-soft px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint"
                >
                  {s.replace('_report', '')}
                </span>
              ))}
              <span className="text-[11px] tabular-nums text-ink-faint">×{m.usage_count}</span>
              <div className="ml-auto h-[3px] w-14 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent/80"
                  style={{ width: `${Math.round(m.confidence * 100)}%` }}
                />
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm(`删除这条记忆？\n「${m.content.slice(0, 30)}${m.content.length > 30 ? '…' : ''}」`)) {
                  onDelete(m.id)
                }
              }}
              title="删除这条记忆"
              className="absolute right-2.5 top-2.5 text-ink-faint/50 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="shrink-0 border-t border-line p-3.5">
        {summary !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2.5 rounded-xl border border-accent/30 bg-accent-soft/50 p-3"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-accent-strong">
              <Sparkles className="size-3" />
              它学会了什么
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed">{summary}</p>
          </motion.div>
        )}
        <button
          onClick={async () => {
            if (summaryBusy) return
            setSummaryBusy(true)
            try {
              const r = await fetchMemorySummary()
              setSummary(r.summary)
            } catch {
              setSummary('暂时无法生成总结，请检查后端服务。')
            } finally {
              setSummaryBusy(false)
            }
          }}
          disabled={summaryBusy || memories.length === 0}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-accent/40 py-2 text-[12.5px] font-medium text-accent-strong transition-colors hover:bg-accent-soft/50 disabled:opacity-40"
        >
          {summaryBusy ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {summaryBusy ? '回忆中…' : '它学会了什么？'}
        </button>
      </div>
    </aside>
  )
}
