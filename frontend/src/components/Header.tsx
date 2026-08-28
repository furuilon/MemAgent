import { Activity, BrainCircuit, PanelLeft, Settings2 } from 'lucide-react'

interface Props {
  llmConfigured: boolean
  model: string
  providerName?: string
  totalTokens: number
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onOpenMetrics: () => void
  onOpenSettings: () => void
}

export default function Header({
  llmConfigured,
  model,
  providerName,
  totalTokens,
  sidebarOpen,
  onToggleSidebar,
  onOpenMetrics,
  onOpenSettings,
}: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-paper/85 px-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? '收起历史栏' : '展开历史栏'}
          title={sidebarOpen ? '收起历史栏' : '展开历史栏'}
          className="flex size-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-line-soft hover:text-ink"
        >
          <PanelLeft className={`size-4 transition-opacity ${sidebarOpen ? '' : 'opacity-60'}`} />
        </button>
        <div className="flex size-7 items-center justify-center rounded-lg bg-ink">
          <BrainCircuit className="size-4 text-paper" strokeWidth={2.2} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">MemAgent</span>
        <div className="h-4 w-px bg-line" />
        <span className="text-[13px] text-ink-faint">会记住你的 Agent</span>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenMetrics}
          className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
        >
          <Activity className="size-3.5" />
          <span className="font-medium tabular-nums">{totalTokens.toLocaleString()}</span>
          <span>tokens</span>
        </button>
        <button
          onClick={onOpenSettings}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
            llmConfigured
              ? 'border-line bg-surface text-ink-soft hover:border-ink/25 hover:text-ink'
              : 'border-accent/40 bg-accent-soft/60 text-accent-strong hover:bg-accent-soft'
          }`}
          title={llmConfigured ? `当前服务：${providerName ?? ''} · ${model}` : '点击配置模型服务与 API Key'}
        >
          <span className={`size-1.5 rounded-full ${llmConfigured ? 'bg-emerald-500' : 'animate-pulse bg-accent'}`} />
          {llmConfigured ? providerName || model : '未配置 Key'}
          <Settings2 className="size-3.5" />
        </button>
      </div>
    </header>
  )
}
