import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Composer from './components/Composer'
import ReportCanvas from './components/ReportCanvas'
import CompareView from './components/CompareView'
import MemoryPanel from './components/MemoryPanel'
import MemoryTimeline from './components/MemoryTimeline'
import DistillOverlay from './components/DistillOverlay'
import MetricsModal from './components/MetricsModal'
import SettingsModal from './components/SettingsModal'
import WorkspaceModal from './components/WorkspaceModal'
import {
  createMemory,
  deleteMemory,
  deleteSession,
  fetchHealth,
  fetchMemories,
  fetchMetrics,
  fetchSessionMessages,
  fetchSessions,
  streamTask,
  submitFeedback,
  type AppliedMemory,
  type MemoryItem,
  type MetricsSummary,
  type SessionInfo,
} from './lib/api'

type Phase = 'idle' | 'running' | 'done'

type TimelineItem = {
  kind: 'plan' | 'tool-start' | 'tool' | 'tool-error' | 'memory' | 'generate' | 'warn' | 'error' | 'done'
  label: string
}

const SIDEBAR_KEY = 'memagent.sidebar'

export default function App() {
  const [task, setTask] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [stage, setStage] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [applied, setApplied] = useState<AppliedMemory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])

  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const activeSessionRef = useRef<string | null>(null)

  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== '0')
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareTask, setCompareTask] = useState('')
  const [compareKey, setCompareKey] = useState(0)
  const [timelineOpen, setTimelineOpen] = useState(false)

  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [distilling, setDistilling] = useState<{ comment: string; memories: MemoryItem[] } | null>(null)
  const [feedbackBusy, setFeedbackBusy] = useState(false)

  const [metricsOpen, setMetricsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [health, setHealth] = useState<{ configured: boolean; model: string; name?: string }>({
    configured: false,
    model: '',
  })

  const lastTaskRef = useRef('')
  const abortRef = useRef<AbortController | null>(null)

  const refreshMemories = useCallback(async () => {
    try {
      setMemories(await fetchMemories())
    } catch {
      /* backend offline */
    }
  }, [])

  const refreshMetrics = useCallback(async () => {
    try {
      setMetrics(await fetchMetrics())
    } catch {
      /* ignore */
    }
  }, [])

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await fetchSessions())
    } catch {
      /* ignore */
    }
  }, [])

  const refreshHealth = useCallback(() => {
    fetchHealth()
      .then((h) => setHealth({ configured: h.llm.configured, model: h.llm.model, name: h.llm.name }))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshMemories()
    refreshMetrics()
    refreshSessions()
    refreshHealth()
  }, [refreshMemories, refreshMetrics, refreshSessions, refreshHealth])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      localStorage.setItem(SIDEBAR_KEY, v ? '0' : '1')
      return !v
    })
  }, [])

  const resetCanvas = useCallback(() => {
    setPhase('idle')
    setStage(null)
    setContent('')
    setTitle('')
    setApplied([])
    setError(null)
    setTimeline([])
    lastTaskRef.current = ''
    activeSessionRef.current = null
    setActiveSessionId(null)
  }, [])

  const newChat = useCallback(() => {
    resetCanvas()
    setTask('')
  }, [resetCanvas])

  const loadSession = useCallback(
    async (id: string) => {
      if (phase === 'running') return
      try {
        const data = await fetchSessionMessages(id)
        if (!data.session) {
          await deleteSession(id)
          setSessions((s) => s.filter((x) => x.id !== id))
          return
        }
        const userMsgs = data.messages.filter((m) => m.role === 'user')
        const assistantMsgs = data.messages.filter((m) => m.role === 'assistant')
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1]
        const lastUser = userMsgs[userMsgs.length - 1]
        activeSessionRef.current = id
        setActiveSessionId(id)
        if (lastAssistant) {
          setPhase('done')
          setContent(lastAssistant.content)
          setTitle(lastAssistant.meta?.title ?? '历史结果')
          setApplied(lastAssistant.meta?.applied ?? [])
          setError(null)
        } else {
          resetCanvas()
        }
        lastTaskRef.current = lastUser?.content ?? ''
        setTimeline([])
        setStage(null)
      } catch {
        /* keep current view */
      }
    },
    [phase, resetCanvas],
  )

  const removeSession = useCallback(
    async (id: string) => {
      await deleteSession(id)
      setSessions((s) => s.filter((x) => x.id !== id))
      if (activeSessionRef.current === id) {
        resetCanvas()
      }
    },
    [resetCanvas],
  )

  const run = useCallback(
    async (input: string) => {
      if (!input.trim()) return
      lastTaskRef.current = input.trim()
      setPhase('running')
      setStage(null)
      setContent('')
      setTitle('')
      setApplied([])
      setError(null)
      setTimeline([])

      const controller = new AbortController()
      abortRef.current = controller

      try {
        for await (const ev of streamTask(input.trim(), activeSessionRef.current, controller.signal)) {
          switch (ev.type) {
            case 'session':
              activeSessionRef.current = ev.data.session_id
              setActiveSessionId(ev.data.session_id)
              break
            case 'stage':
              setStage(ev.data)
              setTimeline((t) => [
                ...t,
                {
                  kind: ev.data === 'planning' ? 'plan' : 'generate',
                  label: ev.data === 'planning' ? '规划任务中…' : '生成结果中…',
                },
              ])
              break
            case 'plan': {
              const steps = ev.data as Array<{ tool: string }>
              setTimeline((t) => [
                ...t,
                {
                  kind: 'plan',
                  label: steps.length
                    ? `计划 ${steps.length} 步：${steps.map((s) => s.tool).join(' → ')}`
                    : '无需调用工具，直接生成',
                },
              ])
              break
            }
            case 'tool_start': {
              const tools = ev.data.tools as string[]
              setTimeline((t) => [
                ...t,
                {
                  kind: 'tool-start',
                  label:
                    tools.length > 1
                      ? `并行执行 ${tools.length} 个工具：${tools.join('、')}`
                      : `执行工具：${tools[0] ?? ''}`,
                },
              ])
              break
            }
            case 'tool_result': {
              const summary = summarizeTool(ev.data.tool, ev.data.result)
              setTimeline((t) => [...t, { kind: 'tool', label: `工具 ${ev.data.tool}：${summary}` }])
              break
            }
            case 'tool_error':
              setTimeline((t) => [...t, { kind: 'tool-error', label: `工具 ${ev.data.tool} 失败` }])
              break
            case 'memories':
              setApplied(ev.data.applied ?? [])
              if ((ev.data.applied ?? []).length > 0)
                setTimeline((t) => [
                  ...t,
                  { kind: 'memory', label: `自动检索并应用 ${ev.data.applied.length} 条记忆` },
                ])
              break
            case 'delta':
              setContent((c) => c + ev.data)
              break
            case 'warning':
              setTimeline((t) => [...t, { kind: 'warn', label: String(ev.data) }])
              break
            case 'error':
              setError(String(ev.data))
              setTimeline((t) => [...t, { kind: 'error', label: '执行失败' }])
              break
            case 'done':
              setTitle(ev.data.title)
              setContent(ev.data.content)
              setApplied(ev.data.memories_applied ?? [])
              setPhase('done')
              setTimeline((t) => [...t, { kind: 'done', label: '完成，已存入报告库' }])
              refreshMetrics()
              refreshSessions()
              break
          }
        }
        setPhase((p) => (p === 'running' ? 'done' : p))
        refreshSessions()
      } catch (e) {
        const errName = e instanceof Error ? e.name : (e as { name?: string })?.name
        if (errName === 'AbortError') {
          setTimeline((t) => [...t, { kind: 'warn', label: '已手动停止，未保存本次结果' }])
          refreshSessions()
        } else {
          setError('无法连接后端服务（请先启动 uvicorn）')
        }
        setPhase('done')
      } finally {
        abortRef.current = null
      }
    },
    [refreshMetrics, refreshSessions],
  )

  const stopRun = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleFeedback = useCallback(
    async (comment: string, editedOutput: string) => {
      if (feedbackBusy) return
      setFeedbackBusy(true)
      try {
        const res = await submitFeedback({
          task_text: lastTaskRef.current,
          original_output: content,
          edited_output: editedOutput,
          comment,
        })
        if (res.ok) {
          setDistilling({ comment, memories: res.memories })
        } else {
          setError(res.error ?? '反馈处理失败')
        }
      } catch {
        setError('无法连接后端服务')
      } finally {
        setFeedbackBusy(false)
      }
    },
    [content, feedbackBusy],
  )

  const handleDeleteMemory = useCallback(
    async (id: string) => {
      await deleteMemory(id)
      refreshMemories()
    },
    [refreshMemories],
  )

  const handleCreateMemory = useCallback(
    async (payload: { type: string; content: string; scope: string[] }) => {
      await createMemory(payload)
      await refreshMemories()
    },
    [refreshMemories],
  )

  const submitTask = useCallback(
    (t: string) => {
      if (!t.trim() || phase === 'running') return
      if (compareMode) {
        setCompareTask(t.trim())
        setCompareKey((k) => k + 1)
        return
      }
      setTask(t)
      run(t)
    },
    [compareMode, phase, run],
  )

  const totalTokens = (metrics?.total.tokens_in ?? 0) + (metrics?.total.tokens_out ?? 0)

  return (
    <div className="flex h-full flex-col">
      <Header
        llmConfigured={health.configured}
        model={health.model}
        providerName={health.name}
        totalTokens={totalTokens}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onOpenMetrics={() => {
          refreshMetrics()
          setMetricsOpen(true)
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          sessions={sessions}
          activeId={activeSessionId}
          memoryCount={memories.length}
          onSelect={loadSession}
          onDelete={removeSession}
          onNewChat={newChat}
          onOpenWorkspace={() => setWorkspaceOpen(true)}
          onCollapse={toggleSidebar}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {compareMode ? (
            <>
              {compareTask ? (
                <CompareView key={compareKey} task={compareTask} onExit={() => setCompareMode(false)} />
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <p className="text-[13.5px] text-ink-faint">
                    对照模式已开启 —— 在下方输入任务，左右两栏将同时对比「无记忆 vs 有记忆」。
                  </p>
                </div>
              )}
              <Composer
                task={task}
                onTaskChange={setTask}
                running={phase === 'running'}
                compareMode={compareMode}
                onToggleCompare={() => setCompareMode((v) => !v)}
                onRun={(t) => submitTask(t || task)}
                onStop={stopRun}
                onOpenWorkspace={() => setWorkspaceOpen(true)}
              />
            </>
          ) : (
            <>
              <ReportCanvas
                phase={phase}
                stage={stage}
                content={content}
                title={title}
                applied={applied}
                error={error}
                timeline={timeline}
                feedbackBusy={feedbackBusy}
                onFeedback={handleFeedback}
                onPickTask={(t) => {
                  setTask(t)
                  run(t)
                }}
                onRegenerate={() => run(lastTaskRef.current || task)}
              />
              <Composer
                task={task}
                onTaskChange={setTask}
                running={phase === 'running'}
                compareMode={false}
                onToggleCompare={() => setCompareMode(true)}
                onRun={() => run(task)}
                onStop={stopRun}
                onOpenWorkspace={() => setWorkspaceOpen(true)}
              />
            </>
          )}
        </main>
        <MemoryPanel
          memories={memories}
          onDelete={handleDeleteMemory}
          onCreate={handleCreateMemory}
          onOpenTimeline={() => setTimelineOpen(true)}
        />
      </div>

      {distilling && (
        <DistillOverlay
          comment={distilling.comment}
          memories={distilling.memories}
          onDone={() => {
            setDistilling(null)
            refreshMemories()
            refreshMetrics()
          }}
        />
      )}

      <MetricsModal open={metricsOpen} onClose={() => setMetricsOpen(false)} metrics={metrics} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onChanged={refreshHealth} />
      <WorkspaceModal open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} />
      <MemoryTimeline open={timelineOpen} onClose={() => setTimelineOpen(false)} />
    </div>
  )
}

function summarizeTool(tool: string, result: unknown): string {
  if (tool === 'get_task_records' && Array.isArray(result)) return `获取 ${result.length} 条工作记录`
  if (tool === 'list_files' && result && typeof result === 'object' && 'files' in (result as object)) {
    const r = result as { cwd?: string; dirs?: unknown[]; files?: unknown[] }
    const where = r.cwd && r.cwd !== '.' ? `（${r.cwd}）` : ''
    return `浏览目录${where}：${r.files?.length ?? 0} 个文件、${r.dirs?.length ?? 0} 个子目录`
  }
  if (tool === 'read_file' && result && typeof result === 'object') {
    const r = result as { path?: string; size_bytes?: number }
    return `读取 ${r.path ?? ''}（${r.size_bytes ?? 0} 字节）`
  }
  if (tool === 'write_file' && result && typeof result === 'object') {
    const r = result as { path?: string; action?: string }
    return `${r.action === 'created' ? '创建' : r.action === 'updated' ? '更新' : '写入'} ${r.path ?? ''}`
  }
  if (tool === 'delete_file' && result && typeof result === 'object') {
    const r = result as { path?: string }
    return `删除 ${r.path ?? ''}`
  }
  if (tool === 'search_files' && Array.isArray(result)) return `命中 ${result.length} 处`
  if (tool === 'save_report') return '报告已保存'
  if (tool === 'search_memory' && Array.isArray(result)) return `命中 ${result.length} 条记忆`
  return '执行完成'
}
