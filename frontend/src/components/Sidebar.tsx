import { MessageSquarePlus, FolderTree, PanelLeftClose, Trash2, BrainCircuit } from 'lucide-react'
import type { SessionInfo } from '../lib/api'

interface Props {
  open: boolean
  sessions: SessionInfo[]
  activeId: string | null
  memoryCount: number
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewChat: () => void
  onOpenWorkspace: () => void
  onCollapse: () => void
}

function timeLabel(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'))
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function Sidebar({
  open,
  sessions,
  activeId,
  memoryCount,
  onSelect,
  onDelete,
  onNewChat,
  onOpenWorkspace,
  onCollapse,
}: Props) {
  if (!open) return null
  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-line bg-paper">
      <div className="flex items-center gap-2 px-3.5 pb-2 pt-4">
        <button
          onClick={onCollapse}
          aria-label="收起侧栏"
          title="收起侧栏"
          className="flex size-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-line-soft hover:text-ink"
        >
          <PanelLeftClose className="size-4" />
        </button>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">历史对话</span>
        <span className="ml-auto text-[11px] tabular-nums text-ink-faint/70">{sessions.length}</span>
      </div>

      <div className="px-3.5 pb-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface py-2.5 text-[13px] font-medium text-ink transition-all hover:border-ink/30 hover:shadow-sm active:scale-[0.99]"
        >
          <MessageSquarePlus className="size-4" />
          新对话
        </button>
      </div>

      <div className="-mr-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pr-1.5">
        {sessions.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-4 text-center text-[12px] leading-relaxed text-ink-faint">
            还没有历史对话。
            <br />
            完成第一个任务后会自动保存到这里。
          </p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2.5 transition-colors ${
              s.id === activeId ? 'bg-surface shadow-[0_1px_4px_rgba(24,24,27,0.06)] ring-1 ring-line' : 'hover:bg-surface/70'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-[13px] leading-snug ${s.id === activeId ? 'font-medium text-ink' : 'text-ink-soft'}`}
              >
                {s.title || '未命名对话'}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-faint">{timeLabel(s.updated_at)}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(s.id)
              }}
              aria-label="删除对话"
              title="删除对话"
              className="mt-0.5 text-ink-faint/50 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <button
          onClick={onOpenWorkspace}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-soft transition-colors hover:bg-surface hover:text-ink"
        >
          <FolderTree className="size-4 text-accent-strong" />
          工作区文件
        </button>
        <div className="mt-1 flex items-center gap-2 px-3 py-1.5 text-[12px] text-ink-faint">
          <BrainCircuit className="size-3.5 text-accent" />
          已沉淀 <span className="font-medium tabular-nums text-accent-strong">{memoryCount}</span> 条记忆
        </div>
      </div>
    </aside>
  )
}
