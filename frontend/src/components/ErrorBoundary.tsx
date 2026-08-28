import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('MemAgent 崩溃:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-paper p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-200">
            <AlertTriangle className="size-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight">界面遇到了问题</h1>
            <p className="mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-ink-faint">
              后端数据和记忆不受影响。刷新页面即可恢复；如果反复出现，请把下面的错误信息反馈给我们。
            </p>
          </div>
          <pre className="max-h-[160px] max-w-[560px] overflow-auto rounded-xl border border-line bg-surface p-3 text-left font-mono text-[11px] text-ink-soft">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-zinc-700"
          >
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
