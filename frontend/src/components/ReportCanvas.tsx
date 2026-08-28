import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'
import {
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Copy,
  Download,
  FolderTree,
  Layers,
  PenLine,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Wrench,
  XCircle,
} from 'lucide-react'
import type { AppliedMemory } from '../lib/api'
import FeedbackComposer from './FeedbackComposer'

interface TimelineItem {
  kind:
    | 'plan'
    | 'tool-start'
    | 'tool'
    | 'tool-error'
    | 'memory'
    | 'generate'
    | 'warn'
    | 'error'
    | 'done'
  label: string
}

interface Props {
  phase: 'idle' | 'running' | 'done'
  stage: string | null
  content: string
  title: string
  applied: AppliedMemory[]
  error: string | null
  timeline: TimelineItem[]
  feedbackBusy: boolean
  onFeedback: (comment: string, editedOutput: string) => void
  onPickTask: (task: string) => void
  onRegenerate: () => void
}

const STAGE_LABEL: Record<string, string> = {
  planning: '正在规划任务、选择工具…',
  generating: '正在结合记忆与素材撰写…',
}

const STRIP_ICONS: Record<TimelineItem['kind'], typeof Compass> = {
  plan: Compass,
  'tool-start': Layers,
  tool: Wrench,
  'tool-error': TriangleAlert,
  memory: BrainCircuit,
  generate: PenLine,
  warn: TriangleAlert,
  error: XCircle,
  done: CheckCircle2,
}

const SAMPLES = [
  { icon: 'report', text: '帮我生成本周的工作周报' },
  { icon: 'files', text: '看看工作区里有哪些文件，帮我整理一份清单报告' },
]

export default function ReportCanvas({
  phase,
  stage,
  content,
  title,
  applied,
  error,
  timeline,
  feedbackBusy,
  onFeedback,
  onPickTask,
  onRegenerate,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [stripOpen, setStripOpen] = useState(true)

  useEffect(() => {
    if (phase === 'running') setStripOpen(true)
  }, [phase])

  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const exportMd = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'memagent-report').replace(/[\\/:*?"<>|]/g, '_')}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const showStrip = timeline.length > 0 && phase !== 'idle' && !(phase === 'running' && !content)

  return (
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="dot-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-[720px] px-8 pb-10 pt-10">
          {phase === 'idle' && (
            <div className="flex min-h-[46vh] flex-col items-center justify-center text-center">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex size-12 items-center justify-center rounded-2xl bg-surface shadow-[0_8px_30px_rgba(24,24,27,0.07)] ring-1 ring-black/[0.04]"
              >
                <Sparkles className="size-5 text-accent" />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.5 }}
                className="mt-6 text-[26px] font-bold tracking-tight"
              >
                把重复的活儿，交给会记忆的助手
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.5 }}
                className="mt-3 max-w-[400px] text-[14px] leading-relaxed text-ink-faint"
              >
                输入任务得到结果；提一句反馈，它就蒸馏成记忆——下一次同类任务，自动变成你想要的样子。
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28 }}
                className="mt-7 flex flex-wrap items-center justify-center gap-2"
              >
                {SAMPLES.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => onPickTask(s.text)}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] text-ink-soft transition-all hover:-translate-y-px hover:border-accent/40 hover:text-accent-strong"
                  >
                    {s.icon === 'files' ? <FolderTree className="size-3.5" /> : null}
                    {s.text}
                  </button>
                ))}
              </motion.div>
            </div>
          )}

          {phase === 'running' && !content && (
            <div className="flex min-h-[46vh] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-5 shadow-sm">
                <span className="size-4 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
                <span className="text-[14px] text-ink-soft">{STAGE_LABEL[stage ?? ''] ?? '准备中…'}</span>
              </div>
            </div>
          )}

          {showStrip && (
            <div className="mb-4 overflow-hidden rounded-xl border border-line bg-surface/70">
              <button
                onClick={() => setStripOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[12px] text-ink-faint transition-colors hover:bg-line-soft/50"
              >
                <ChevronDown className={`size-3.5 transition-transform ${stripOpen ? '' : '-rotate-90'}`} />
                执行轨迹 · {timeline.length} 步
                {phase === 'done' && <CheckCircle2 className="ml-auto size-3.5 text-emerald-600" />}
              </button>
              {stripOpen && (
                <div className="space-y-0.5 border-t border-line px-4 py-2.5">
                  {timeline.map((item, i) => {
                    const Icon = STRIP_ICONS[item.kind]
                    const tone =
                      item.kind === 'error' || item.kind === 'tool-error'
                        ? 'text-red-500'
                        : item.kind === 'warn'
                          ? 'text-amber-500'
                          : item.kind === 'memory'
                            ? 'text-accent-strong'
                            : item.kind === 'done'
                              ? 'text-emerald-600'
                              : 'text-ink-faint'
                    return (
                      <div key={i} className="animate-rise flex items-start gap-2 py-0.5 text-[12.5px] text-ink-soft">
                        <Icon className={`mt-[3px] size-3 shrink-0 ${tone}`} />
                        <span className="leading-snug">{item.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {(content || phase === 'done') && (
            <motion.article
              layout="position"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="rounded-2xl border border-line bg-surface p-9 shadow-[0_12px_48px_rgba(24,24,27,0.06)]"
            >
              {phase === 'done' && (
                <div className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-4">
                  <h1 className="text-[19px] font-semibold tracking-tight">{title || '未命名结果'}</h1>
                  <button
                    onClick={onRegenerate}
                    title="用当前记忆重新生成"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-faint transition-colors hover:bg-line-soft hover:text-ink"
                  >
                    <RotateCcw className="size-3.5" />
                    重新生成
                  </button>
                  <button
                    onClick={exportMd}
                    title="导出为 Markdown 文件"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-faint transition-colors hover:bg-line-soft hover:text-ink"
                  >
                    <Download className="size-3.5" />
                    导出
                  </button>
                  <button
                    onClick={copy}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-faint transition-colors hover:bg-line-soft hover:text-ink"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
              )}

              {applied.length > 0 && phase !== 'running' && (
                <div className="mb-5 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 flex items-center gap-1 text-[11.5px] font-medium text-accent-strong">
                    <BrainCircuit className="size-3.5" /> 已应用记忆
                  </span>
                  {applied.map((m) => (
                    <span
                      key={m.id}
                      title={m.content}
                      className="max-w-[240px] truncate rounded-full border border-accent/25 bg-accent-soft/60 px-2.5 py-1 text-[11.5px] text-accent-strong"
                    >
                      {m.content}
                    </span>
                  ))}
                </div>
              )}

              <div className={`md ${phase === 'running' ? 'is-streaming' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </motion.article>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
              {error}
            </div>
          )}

          {phase === 'done' && !error && (
            <FeedbackComposer content={content} busy={feedbackBusy} onSubmit={onFeedback} />
          )}
        </div>
      </div>

      <style>{`
        .dot-grid {
          background-image: radial-gradient(circle, #e0dedb 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent);
          opacity: 0.55;
        }
        .md.is-streaming::after {
          content: '';
          display: inline-block;
          width: 8px;
          height: 1.05em;
          margin-left: 3px;
          vertical-align: text-bottom;
          background: var(--color-ink);
          border-radius: 1px;
          animation: var(--animate-blink);
        }
      `}</style>
    </div>
  )
}
