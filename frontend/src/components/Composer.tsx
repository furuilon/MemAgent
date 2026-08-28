import { ArrowUp, FolderTree, Scale, Square } from 'lucide-react'

interface Props {
  task: string
  onTaskChange: (v: string) => void
  running: boolean
  compareMode: boolean
  onToggleCompare: () => void
  onRun: (task?: string) => void
  onStop: () => void
  onOpenWorkspace: () => void
}

export default function Composer({
  task,
  onTaskChange,
  running,
  compareMode,
  onToggleCompare,
  onRun,
  onStop,
  onOpenWorkspace,
}: Props) {
  const submit = () => {
    if (running || !task.trim()) return
    onRun()
  }

  return (
    <div className="relative shrink-0 px-8 pb-5 pt-1">
      <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-paper to-transparent" />
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2.5 shadow-[0_8px_32px_rgba(24,24,27,0.09)] transition-all focus-within:border-ink/25 focus-within:ring-4 focus-within:ring-ink/[0.05]">
          <button
            onClick={onOpenWorkspace}
            aria-label="打开工作区文件"
            title="打开工作区文件"
            className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl text-ink-faint transition-colors hover:bg-line-soft hover:text-accent-strong"
          >
            <FolderTree className="size-4" />
          </button>
          <button
            onClick={onToggleCompare}
            aria-label="切换对照模式"
            title={compareMode ? '退出对照模式' : '对照模式：同任务左右对比有无记忆'}
            className={`mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
              compareMode
                ? 'bg-accent text-white'
                : 'text-ink-faint hover:bg-line-soft hover:text-accent-strong'
            }`}
          >
            <Scale className="size-4" />
          </button>
          <textarea
            value={task}
            onChange={(e) => onTaskChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.key === 'Process') return
            if (e.key === 'Enter' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              submit()
            }
          }}
            rows={1}
            placeholder={
              compareMode
                ? '对照模式：发送任务，左右同时对比「无记忆 vs 有记忆」…'
                : '输入任务，Enter 发送 / Shift+Enter 换行…'
            }
            className="max-h-[140px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[14.5px] leading-relaxed outline-none placeholder:text-ink-faint/70"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 140)}px`
            }}
          />
          {running ? (
            <button
              onClick={onStop}
              aria-label="停止生成"
              title="停止生成"
              className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition-all hover:bg-zinc-700 active:scale-95"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              aria-label="发送任务"
              disabled={!task.trim()}
              className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition-all hover:bg-zinc-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-faint/80">
          MemAgent 会规划工具调用、检索你的记忆，并从反馈中持续学习
        </p>
      </div>
    </div>
  )
}
