const REST_TIMEOUT = 8000

async function jfetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REST_TIMEOUT) })
}

export interface MemoryItem {
  id: string
  type: string
  scope: string[]
  content: string
  confidence: number
  usage_count: number
  created_at: string
  last_used_at?: string | null
  status?: string
}

export interface AppliedMemory {
  id: string
  content: string
  type: string
}

export interface PlanStep {
  tool: string
  args: Record<string, unknown>
}

export interface StreamEvent {
  type:
    | 'start'
    | 'session'
    | 'stage'
    | 'warning'
    | 'plan'
    | 'tool_start'
    | 'tool_result'
    | 'tool_error'
    | 'memories'
    | 'delta'
    | 'error'
    | 'done'
  data: any
}

export interface SessionInfo {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  meta?: { title?: string; applied?: AppliedMemory[] }
  created_at: string
}

export async function fetchSessions(): Promise<SessionInfo[]> {
  const resp = await jfetch('/api/sessions')
  const data = await resp.json()
  return data.sessions ?? []
}

export async function fetchSessionMessages(
  id: string,
): Promise<{ session: SessionInfo; messages: ChatMessage[] }> {
  const resp = await jfetch(`/api/sessions/${id}`)
  return resp.json()
}

export async function deleteSession(id: string): Promise<void> {
  await jfetch(`/api/sessions/${id}`, { method: 'DELETE' })
}

export interface WorkspaceDir {
  name: string
  path: string
}

export interface WorkspaceFile {
  path: string
  size_bytes: number
  ext: string
}

export interface WorkspaceListing {
  ok: boolean
  mode: string
  cwd: string
  sandbox_root: string
  dirs: WorkspaceDir[]
  files: WorkspaceFile[]
  error?: string
}

export async function listWorkspaceFiles(path = '.'): Promise<WorkspaceListing> {
  const resp = await jfetch(`/api/workspace/files?path=${encodeURIComponent(path)}`)
  return resp.json()
}

export interface DriveInfo {
  name: string
  path: string
}

export async function fetchDrives(): Promise<DriveInfo[]> {
  const resp = await jfetch('/api/workspace/drives')
  const data = await resp.json()
  return data.drives ?? []
}

export interface QuickFolder {
  label: string
  key: string
  path: string
}

export async function fetchQuickFolders(): Promise<QuickFolder[]> {
  const resp = await jfetch('/api/workspace/quick')
  const data = await resp.json()
  return data.folders ?? []
}

export async function pickSystemFolder(): Promise<{
  ok: boolean
  path?: string
  canceled?: boolean
  error?: string
}> {
  const resp = await jfetch('/api/workspace/pick', { method: 'POST' })
  return resp.json()
}

export async function getFileAccessMode(): Promise<{ mode: string; sandbox_root: string }> {
  const resp = await jfetch('/api/workspace/mode')
  return resp.json()
}

export async function setFileAccessMode(mode: string): Promise<{ ok: boolean; mode?: string; error?: string }> {
  const resp = await jfetch('/api/workspace/mode', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  return resp.json()
}

export async function readWorkspaceFile(
  path: string,
): Promise<{ ok: boolean; content?: string; path?: string; error?: string }> {
  const resp = await jfetch(`/api/workspace/file?path=${encodeURIComponent(path)}`)
  return resp.json()
}

export async function writeWorkspaceFile(
  path: string,
  content: string,
): Promise<{ ok: boolean; action?: string; error?: string }> {
  const resp = await jfetch('/api/workspace/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  return resp.json()
}

export async function deleteWorkspaceFile(path: string): Promise<{ ok: boolean; error?: string }> {
  const resp = await jfetch('/api/workspace/file/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  return resp.json()
}

export interface TaskResult {
  ok: boolean
  task_id: string
  report_id: string
  title: string
  content: string
  memories_applied: AppliedMemory[]
  error?: string
}

export interface MetricsSummary {
  total: {
    calls: number
    tokens_in: number
    tokens_out: number
    avg_latency_ms: number
    errors: number
  }
  by_purpose: Array<{
    purpose: string
    calls: number
    prompt_tokens: number
    completion_tokens: number
    avg_latency_ms: number
  }>
}

export async function* streamTask(
  task: string,
  sessionId?: string | null,
  signal?: AbortSignal,
  opts?: { useMemory?: boolean; persist?: boolean },
): AsyncGenerator<StreamEvent> {
  const resp = await fetch('/api/task/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task,
      session_id: sessionId ?? null,
      use_memory: opts?.useMemory ?? true,
      persist: opts?.persist ?? true,
    }),
    signal,
  })
  if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        try {
          yield JSON.parse(line.slice(5).trim()) as StreamEvent
        } catch {
          /* skip malformed chunk */
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* already released */
    }
  }
}

export async function submitFeedback(payload: {
  task_text: string
  original_output: string
  edited_output?: string
  comment?: string
}): Promise<{ ok: boolean; feedback_id: string; memories: MemoryItem[]; error?: string }> {
  const resp = await jfetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return resp.json()
}

export async function fetchMemories(): Promise<MemoryItem[]> {
  const resp = await jfetch('/api/memories')
  const data = await resp.json()
  return data.memories ?? []
}

export async function deleteMemory(id: string): Promise<void> {
  await jfetch(`/api/memories/${id}`, { method: 'DELETE' })
}

export interface MemoryEvent {
  id: number
  memory_id: string
  kind: 'born' | 'merged' | 'boosted'
  detail?: string | null
  created_at: string
  content?: string | null
}

export async function fetchMemoryEvents(): Promise<MemoryEvent[]> {
  const resp = await jfetch('/api/memory-events')
  const data = await resp.json()
  return data.events ?? []
}

export async function fetchMemorySummary(): Promise<{
  ok: boolean
  summary: string
  count: number
}> {
  const resp = await jfetch('/api/memory-summary', { method: 'POST' })
  return resp.json()
}

export async function createMemory(payload: {
  type: string
  content: string
  scope: string[]
}): Promise<MemoryItem> {
  const resp = await jfetch('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return resp.json()
}

export async function fetchHealth(): Promise<{
  status: string
  llm: { configured: boolean; model: string; name?: string }
}> {
  const resp = await jfetch('/api/health')
  return resp.json()
}

export interface ProviderProfile {
  id: string
  name: string
  base_url: string
  model: string
  api_key_masked: string
  has_key: boolean
  active: boolean
}

export interface ProviderTestResult {
  ok: boolean
  latency_ms: number
  reply?: string
  error?: string
}

export async function fetchProviders(): Promise<{
  profiles: ProviderProfile[]
  model_overrides: Record<string, string>
}> {
  const resp = await fetch('/api/providers')
  return resp.json()
}

export interface ModelOverridesInfo {
  overrides: Record<string, string>
  purposes: string[]
  resolved: Record<string, string>
}

export async function fetchModelOverrides(): Promise<ModelOverridesInfo> {
  const resp = await jfetch('/api/providers/model-overrides')
  return resp.json()
}

export async function putModelOverrides(
  overrides: Record<string, string>,
): Promise<{ ok: boolean; overrides: Record<string, string> }> {
  const resp = await jfetch('/api/providers/model-overrides', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overrides }),
  })
  return resp.json()
}

export async function saveProvider(payload: {
  id?: string
  name: string
  base_url: string
  api_key?: string
  model: string
}): Promise<{ ok: boolean; profile_id: string }> {
  const resp = await jfetch('/api/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return resp.json()
}

export async function activateProvider(id: string): Promise<{ ok: boolean }> {
  const resp = await jfetch('/api/providers/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  return resp.json()
}

export async function deleteProvider(id: string): Promise<{ ok: boolean }> {
  const resp = await jfetch(`/api/providers/${id}`, { method: 'DELETE' })
  return resp.json()
}

export async function testProvider(payload: {
  id?: string
  base_url?: string
  api_key?: string
  model?: string
}): Promise<ProviderTestResult> {
  const resp = await jfetch('/api/providers/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return resp.json()
}

export async function fetchMetrics(): Promise<MetricsSummary> {
  const resp = await jfetch('/api/metrics/summary')
  return resp.json()
}

export interface EvalDetail {
  id: string
  rule: string
  followed: boolean
  reason?: string
}

export interface EvalReport {
  id: string
  created_at?: string
  cases: Array<{
    task: string
    applicable_memories: Array<{ id: string; content: string }>
    baseline: { ok: boolean; usage: { calls: number; tokens_in: number; tokens_out: number }; latency_ms: number; judge: { compliance_rate: number | null } }
    with_memory: { ok: boolean; usage: { calls: number; tokens_in: number; tokens_out: number }; latency_ms: number; applied: AppliedMemory[]; judge: { compliance_rate: number | null } }
  }>
  summary: {
    tasks: number
    baseline_compliance: number | null
    memory_compliance: number | null
    baseline_avg_latency_ms: number
    memory_avg_latency_ms: number
    baseline_avg_tokens_in: number
    memory_avg_tokens_in: number
  }
}

export async function fetchLatestEval(): Promise<EvalReport | null> {
  const resp = await jfetch('/api/eval/latest')
  const data = await resp.json()
  return data.report ?? null
}

export async function runEval(tasks?: string[]): Promise<EvalReport> {
  const resp = await jfetch('/api/eval/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  })
  const data = await resp.json()
  return data as EvalReport
}
