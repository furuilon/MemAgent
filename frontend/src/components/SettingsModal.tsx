import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleAlert, FolderTree, KeyRound, Plus, Settings2, Trash2, X, Zap } from 'lucide-react'
import {
  activateProvider,
  deleteProvider,
  fetchModelOverrides,
  fetchProviders,
  getFileAccessMode,
  putModelOverrides,
  saveProvider,
  setFileAccessMode,
  testProvider,
  type ProviderProfile,
} from '../lib/api'

const PURPOSE_META: Array<{ key: string; label: string; hint: string }> = [
  { key: 'plan', label: '任务规划', hint: '轻量模型即可' },
  { key: 'generate', label: '结果生成', hint: '建议用主力强模型' },
  { key: 'extract', label: '记忆提取', hint: '轻量模型即可' },
  { key: 'judge', label: '效果评判', hint: '建议用与生成不同的模型以减少偏见' },
]

interface Props {
  open: boolean
  onClose: () => void
  onChanged: () => void
}

const PRESETS: Array<{ label: string; base_url: string; model: string }> = [
  { label: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: '七牛云', base_url: 'https://api.qnaigc.com/v1', model: 'deepseek-v3' },
  { label: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'Ollama 本地', base_url: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
]

export default function SettingsModal({ open, onClose, onChanged }: Props) {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([])
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-chat')
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; text: string }>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [fileMode, setFileMode] = useState<'sandbox' | 'full'>('sandbox')
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [resolvedModels, setResolvedModels] = useState<Record<string, string>>({})
  const [ovSaved, setOvSaved] = useState(false)

  const refreshFileMode = () => {
    getFileAccessMode()
      .then((m) => setFileMode(m.mode === 'full' ? 'full' : 'sandbox'))
      .catch(() => undefined)
  }

  const refreshOverrides = () => {
    fetchModelOverrides()
      .then((info) => {
        setOverrides(info.overrides ?? {})
        setResolvedModels(info.resolved ?? {})
      })
      .catch(() => undefined)
  }

  useEffect(() => {
    if (open) {
      refreshFileMode()
      refreshOverrides()
    }
  }, [open])

  const handleSaveOverrides = async () => {
    await putModelOverrides(overrides)
    setOvSaved(true)
    refreshOverrides()
    onChanged()
    setTimeout(() => setOvSaved(false), 1600)
  }

  const handleToggleFileMode = async () => {
    const next = fileMode === 'sandbox' ? 'full' : 'sandbox'
    if (
      next === 'full' &&
      !window.confirm('开启后 Agent 可以读写整台电脑的文件（受保护系统目录仍被拦截）。\n确定开启本机访问？')
    )
      return
    const r = await setFileAccessMode(next)
    if (r.ok) setFileMode(next)
  }

  const refresh = () => {
    fetchProviders().then((d) => setProfiles(d.profiles ?? [])).catch(() => undefined)
  }

  useEffect(() => {
    if (open) refresh()
  }, [open])

  const resetForm = () => {
    setEditingId(undefined)
    setName('')
    setApiKey('')
    setBaseUrl(PRESETS[0].base_url)
    setModel(PRESETS[0].model)
  }

  useEffect(() => {
    resetForm()
  }, [open])

  const handleSave = async () => {
    if (!name.trim() || !baseUrl.trim() || !model.trim()) return
    if (!editingId && !apiKey.trim()) return
    await saveProvider({
      id: editingId,
      name: name.trim(),
      base_url: baseUrl.trim(),
      api_key: apiKey.trim(),
      model: model.trim(),
    })
    resetForm()
    refresh()
    onChanged()
  }

  const startEdit = (p: ProviderProfile) => {
    setEditingId(p.id)
    setName(p.name)
    setBaseUrl(p.base_url)
    setApiKey('')
    setModel(p.model)
  }

  const runTest = async (p: ProviderProfile) => {
    setTestingId(p.id)
    try {
      const r = await testProvider({ id: p.id })
      setTestResults((m) => ({
        ...m,
        [p.id]: r.ok
          ? { ok: true, text: `连通 · ${r.latency_ms}ms` }
          : { ok: false, text: (r.error ?? '失败').slice(0, 60) },
      }))
    } catch {
      setTestResults((m) => ({ ...m, [p.id]: { ok: false, text: '无法连接后端' } }))
    } finally {
      setTestingId(null)
    }
  }

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
            className="max-h-[86vh] w-[600px] overflow-y-auto rounded-2xl bg-surface p-7 shadow-[0_24px_80px_rgba(24,24,27,0.16)] ring-1 ring-black/[0.06]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
                  <Settings2 className="size-4" />
                  模型服务配置
                </h2>
                <p className="mt-0.5 text-[12px] text-ink-faint">可保存多个 API Key，一键切换；Key 仅存储在本机数据库</p>
              </div>
              <button onClick={onClose} className="text-ink-faint transition-colors hover:text-ink">
                <X className="size-4.5" />
              </button>
            </div>

            <div className="mb-5 rounded-xl border border-line bg-paper p-4">
              <div className="flex items-center gap-2">
                <FolderTree className="size-4 text-accent-strong" />
                <span className="text-[13.5px] font-medium">文件访问范围</span>
                <button
                  onClick={handleToggleFileMode}
                  className={`ml-auto relative h-6 w-11 rounded-full transition-colors ${
                    fileMode === 'full' ? 'bg-accent' : 'bg-line'
                  }`}
                  title="点击切换"
                >
                  <span
                    className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                      fileMode === 'full' ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                {fileMode === 'sandbox'
                  ? '沙箱模式：Agent 只能读写 backend/workspace/ 目录，安全可控。'
                  : '本机模式：Agent 可读写整台电脑的文件。Windows、Program Files 等系统目录仍会被自动拦截。'}
              </p>
            </div>

            <div className="mb-5 rounded-xl border border-line bg-paper p-4">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-medium">按用途分配模型</span>
                <button
                  onClick={handleSaveOverrides}
                  className={`ml-auto rounded-lg px-3 py-1 text-[11.5px] font-medium transition-colors ${
                    ovSaved ? 'bg-emerald-600 text-white' : 'bg-ink text-paper hover:bg-zinc-700'
                  }`}
                >
                  {ovSaved ? '已保存 ✓' : '保存分配'}
                </button>
              </div>
              <p className="mt-1.5 mb-2.5 text-[11.5px] leading-relaxed text-ink-faint">
                留空则统一使用当前服务的默认模型。给规划/提取配轻量模型可显著降低 token 成本。
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PURPOSE_META.map((p) => (
                  <div key={p.key} className="rounded-lg border border-line bg-surface p-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-medium">{p.label}</span>
                      <span className="font-mono text-[9.5px] text-ink-faint/70" title={resolvedModels[p.key]}>
                        {resolvedModels[p.key] ?? ''}
                      </span>
                    </div>
                    <input
                      value={overrides[p.key] ?? ''}
                      onChange={(e) => setOverrides((m) => ({ ...m, [p.key]: e.target.value }))}
                      placeholder={p.hint}
                      className="mt-1 w-full rounded-md border border-line px-2 py-1 font-mono text-[11px] outline-none focus:border-ink/30"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {profiles.length === 0 && (
                <p className="rounded-xl border border-dashed border-line p-4 text-center text-[13px] text-ink-faint">
                  还没有配置。在下方添加第一个模型服务。
                </p>
              )}
              {profiles.map((p) => (
                <motion.div layout key={p.id} className={`rounded-xl border p-4 ${p.active ? 'border-accent/45 bg-accent-soft/40 ring-2 ring-accent/10' : 'border-line bg-paper'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium">{p.name}</span>
                    {p.active ? (
                      <span className="flex items-center gap-1 rounded-full bg-accent-strong px-2 py-0.5 text-[10.5px] font-medium text-white">
                        <Check className="size-3" /> 使用中
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          await activateProvider(p.id)
                          refresh()
                          onChanged()
                        }}
                        className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
                      >
                        启用
                      </button>
                    )}
                    <span className="ml-auto font-mono text-[11px] text-ink-faint">{p.api_key_masked || '未设置 Key'}</span>
                    <button
                      onClick={() => runTest(p)}
                      disabled={testingId === p.id}
                      title="测试连通性"
                      className="text-ink-faint transition-colors hover:text-ink disabled:opacity-40"
                    >
                      {testingId === p.id ? (
                        <span className="block size-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
                      ) : (
                        <Zap className="size-3.5" />
                      )}
                    </button>
                    <button onClick={() => startEdit(p)} className="text-[12px] text-ink-faint hover:text-ink">
                      编辑
                    </button>
                    <button
                      onClick={async () => {
                        await deleteProvider(p.id)
                        refresh()
                        onChanged()
                      }}
                      className="text-ink-faint/60 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-faint">
                    <span className="truncate">{p.base_url}</span>
                    <span className="rounded bg-line-soft px-1.5 py-0.5">{p.model}</span>
                  </div>
                  {testResults[p.id] && (
                    <div className={`mt-2 flex items-center gap-1.5 text-[11.5px] ${testResults[p.id].ok ? 'text-emerald-600' : 'text-red-500'}`}>
                      {testResults[p.id].ok ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
                      {testResults[p.id].text}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-line bg-paper p-4">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound className="size-3.5 text-accent-strong" />
                <span className="text-[13px] font-medium">{editingId ? '编辑配置' : '添加新配置'}</span>
                <div className="ml-auto flex gap-1">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setBaseUrl(preset.base_url)
                        setModel(preset.model)
                        if (!editingId) setName(preset.label)
                      }}
                      className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] text-ink-faint transition-colors hover:border-ink/25 hover:text-ink"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="名称，如 DeepSeek 主力"
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink/25"
                />
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="模型名"
                  className="rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] outline-none focus:border-ink/25"
                />
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="Base URL"
                  className="col-span-2 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12.5px] outline-none focus:border-ink/25"
                />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={editingId ? '留空则保留原 Key' : 'API Key'}
                  className="col-span-2 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] outline-none focus:border-ink/25"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                {editingId ? (
                  <button onClick={resetForm} className="text-[12.5px] text-ink-faint hover:text-ink">
                    取消编辑
                  </button>
                ) : (
                  <span className="text-[11.5px] text-ink-faint">Key 加密传输仅存本地 SQLite</span>
                )}
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || !baseUrl.trim() || !model.trim() || (!editingId && !apiKey.trim())}
                  className="flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-medium text-paper transition-colors hover:bg-zinc-700 disabled:opacity-35"
                >
                  <Plus className="size-3.5" />
                  {editingId ? '保存修改' : '添加并保存'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
