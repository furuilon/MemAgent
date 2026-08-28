import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FlaskConical, X } from 'lucide-react'
import { fetchLatestEval, runEval, type MetricsSummary, type EvalReport } from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
  metrics: MetricsSummary | null
}

const PURPOSE_LABEL: Record<string, string> = {
  plan: '任务规划',
  generate: '结果生成',
  extract: '记忆提取',
  judge: '效果评判',
  connectivity_test: '连通性测试',
}

export default function MetricsModal({ open, onClose, metrics }: Props) {
  const [evalReport, setEvalReport] = useState<EvalReport | null>(null)
  const [evalBusy, setEvalBusy] = useState(false)

  useEffect(() => {
    if (open) fetchLatestEval().then(setEvalReport).catch(() => undefined)
  }, [open])

  const handleRunEval = async () => {
    if (evalBusy) return
    setEvalBusy(true)
    try {
      const report = await runEval()
      setEvalReport(report)
    } catch {
      /* keep old report */
    } finally {
      setEvalBusy(false)
    }
  }

  const maxTokens = Math.max(
    1,
    ...(metrics?.by_purpose ?? []).map((p) => p.prompt_tokens + p.completion_tokens),
  )
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
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[560px] rounded-2xl bg-surface p-7 shadow-[0_24px_80px_rgba(24,24,27,0.16)] ring-1 ring-black/[0.06]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">成本仪表盘</h2>
                <p className="mt-0.5 text-[12px] text-ink-faint">每一次 LLM 调用的 token 与延迟都被记录</p>
              </div>
              <button onClick={onClose} className="text-ink-faint transition-colors hover:text-ink">
                <X className="size-4.5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {[
                { label: '调用次数', value: metrics?.total.calls ?? 0 },
                { label: '输入 tokens', value: metrics?.total.tokens_in ?? 0 },
                { label: '输出 tokens', value: metrics?.total.tokens_out ?? 0 },
                { label: '平均延迟', value: `${metrics?.total.avg_latency_ms ?? 0}ms` },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-line bg-paper px-3.5 py-3">
                  <div className="text-[11px] text-ink-faint">{c.label}</div>
                  <div className="mt-1 text-[17px] font-semibold tabular-nums tracking-tight">
                    {typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {(metrics?.by_purpose ?? []).length === 0 && (
                <p className="rounded-xl border border-dashed border-line p-4 text-center text-[13px] text-ink-faint">
                  暂无调用数据，先运行一个任务吧。
                </p>
              )}
              {(metrics?.by_purpose ?? []).map((p) => {
                const total = p.prompt_tokens + p.completion_tokens
                return (
                  <div key={p.purpose}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                      <span className="font-medium">{PURPOSE_LABEL[p.purpose] ?? p.purpose}</span>
                      <span className="tabular-nums text-ink-faint">
                        {total.toLocaleString()} tokens · {p.calls} 次 · 平均{' '}
                        {Math.round(p.avg_latency_ms)}ms
                      </span>
                    </div>
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
                      <div
                        className="h-full bg-ink"
                        style={{ width: `${(p.prompt_tokens / maxTokens) * 100}%` }}
                      />
                      <div
                        className="h-full bg-accent/80"
                        style={{ width: `${(p.completion_tokens / maxTokens) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-4 pt-1 text-[11px] text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-ink" />输入
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-accent/80" />输出
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="size-4 text-accent-strong" />
                  <span className="text-[14px] font-semibold tracking-tight">A/B 对照实验</span>
                  <span className="rounded-full bg-line-soft px-2 py-0.5 text-[10.5px] text-ink-faint">
                    无记忆 vs 有记忆
                  </span>
                </div>
                <button
                  onClick={handleRunEval}
                  disabled={evalBusy}
                  className="rounded-lg bg-ink px-3 py-1.5 text-[12px] font-medium text-paper transition-colors hover:bg-zinc-700 disabled:opacity-40"
                >
                  {evalBusy ? '评测中…约 30s' : '运行评测'}
                </button>
              </div>

              {evalReport ? (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: '无记忆 · 偏好遵循率', rate: evalReport.summary.baseline_compliance, tone: false },
                      { label: '有记忆 · 偏好遵循率', rate: evalReport.summary.memory_compliance, tone: true },
                    ].map((c) => (
                      <div
                        key={c.label}
                        className={`rounded-xl border px-4 py-3 ${
                          c.tone ? 'border-accent/35 bg-accent-soft/50' : 'border-line bg-paper'
                        }`}
                      >
                        <div className="text-[11px] text-ink-faint">{c.label}</div>
                        <div className={`mt-0.5 text-[22px] font-bold tabular-nums tracking-tight ${c.tone ? 'text-accent-strong' : ''}`}>
                          {c.rate === null || c.rate === undefined ? '—' : `${Math.round(c.rate * 100)}%`}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 space-y-2 text-[12px] tabular-nums text-ink-faint">
                    <div className="flex justify-between">
                      <span>平均输入 tokens（注入记忆的开销）</span>
                      <span>
                        {evalReport.summary.baseline_avg_tokens_in} →{' '}
                        <span className="font-medium text-ink">{evalReport.summary.memory_avg_tokens_in}</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>平均端到端延迟</span>
                      <span>
                        {evalReport.summary.baseline_avg_latency_ms}ms →{' '}
                        <span className="font-medium text-ink">{evalReport.summary.memory_avg_latency_ms}ms</span>
                      </span>
                    </div>
                  </div>
                  {evalReport.cases.some((c) => c.applicable_memories.length > 0) && (
                    <div className="mt-3 rounded-lg bg-paper px-3 py-2 text-[11.5px] leading-relaxed text-ink-faint">
                      共评测 {evalReport.summary.tasks} 个任务、
                      {evalReport.cases.reduce((n, c) => n + c.applicable_memories.length, 0)} 条规则，由 LLM
                      Judge 逐条判定是否遵守。
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-4 text-center text-[13px] text-ink-faint">
                  先在对话里沉淀几条偏好，再点击「运行评测」生成对照数据。
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
