import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit } from 'lucide-react'

interface Props {
  content: string
  busy: boolean
  onSubmit: (comment: string, editedOutput: string) => void
}

export default function FeedbackComposer({ content, busy, onSubmit }: Props) {
  const [comment, setComment] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft(content)
    setComment('')
    setEditing(false)
  }, [content])

  const dirty = editing && draft !== content && draft.trim().length > 0
  const canSubmit = !busy && (comment.trim().length > 0 || dirty)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-5 rounded-2xl border border-dashed border-accent/35 bg-surface p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <BrainCircuit className="size-4 text-accent-strong" />
        <span className="text-[13.5px] font-medium">教它一下 —— 这条反馈会永久改变它的行为</span>
        {dirty && (
          <button
            onClick={() => setEditing(false)}
            className="ml-auto rounded-lg bg-ink px-2.5 py-1 text-[11.5px] text-paper"
          >
            使用修改稿
          </button>
        )}
        {!dirty && (
          <button
            onClick={() => setEditing(true)}
            className="ml-auto rounded-lg border border-line px-2.5 py-1 text-[11.5px] text-ink-faint hover:text-ink"
          >
            手动修改结果
          </button>
        )}
      </div>
      {editing && (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mb-3 min-h-[140px] w-full resize-none rounded-xl border border-line bg-paper p-3.5 font-mono text-[12.5px] leading-relaxed outline-none focus:border-accent/50"
        />
      )}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={'例：以后都用要点列表，不要表格；语气正式一点；突出数据成果…'}
        className="min-h-[72px] w-full resize-none rounded-xl border border-line bg-paper p-3.5 text-[13.5px] leading-relaxed outline-none transition-all placeholder:text-ink-faint/70 focus:border-accent/50 focus:ring-4 focus:ring-accent/[0.08]"
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11.5px] text-ink-faint">
          {dirty ? '检测到手动修改，将一并作为学习素材' : '只写一句偏好也可以'}
        </p>
        <button
          onClick={() => {
            onSubmit(comment.trim(), dirty ? draft : '')
          }}
          disabled={!canSubmit}
          className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-accent-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {busy ? '蒸馏中…' : '提交并蒸馏成记忆'}
        </button>
      </div>
    </motion.div>
  )
}
