import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUp,
  ChevronRight,
  CircleAlert,
  FileText,
  Folder,
  FolderTree,
  Globe,
  Lock,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import {
  deleteWorkspaceFile,
  fetchDrives,
  fetchQuickFolders,
  listWorkspaceFiles,
  pickSystemFolder,
  readWorkspaceFile,
  setFileAccessMode,
  writeWorkspaceFile,
  type DriveInfo,
  type QuickFolder,
  type WorkspaceListing,
} from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
}

function sizeLabel(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function WorkspaceModal({ open, onClose }: Props) {
  const [listing, setListing] = useState<WorkspaceListing | null>(null)
  const [cwd, setCwd] = useState('.')
  const [activePath, setActivePath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [jumpPath, setJumpPath] = useState('')
  const [jumpBusy, setJumpBusy] = useState(false)
  const [drives, setDrives] = useState<DriveInfo[]>([])
  const [quickFolders, setQuickFolders] = useState<QuickFolder[]>([])
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      setActivePath(null)
      setContent('')
      setSavedContent('')
      setCwd('.')
      navigate('.')
      fetchDrives().then(setDrives).catch(() => undefined)
      fetchQuickFolders().then(setQuickFolders).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const navSeqRef = useRef(0)

  const navigate = async (path: string, clearEditor = true) => {
    const seq = ++navSeqRef.current
    setBusy(true)
    try {
      const data = await listWorkspaceFiles(path)
      if (seq !== navSeqRef.current) return
      if (data.ok) {
        setListing(data)
        setCwd(data.cwd)
        setError(data.error ?? null)
        if (clearEditor) {
          setActivePath(null)
          setContent('')
          setSavedContent('')
        }
      } else {
        setError(data.error ?? '无法访问该目录')
      }
    } catch {
      setError('无法连接后端')
    } finally {
      setBusy(false)
    }
  }

  const breadcrumbs = useMemo(() => {
    if (!listing) return [] as Array<{ label: string; path: string }>
    const mode = listing.mode
    if (mode === 'sandbox') {
      const parts = cwd === '.' ? [] : cwd.split('/')
      const segs = [{ label: 'workspace', path: '.' }]
      let acc = ''
      for (const p of parts) {
        acc = acc ? `${acc}/${p}` : p
        segs.push({ label: p, path: acc })
      }
      return segs
    }
    const norm = cwd.replace(/\//g, '\\')
    const parts = norm.split('\\').filter(Boolean)
    const isWin = /^[A-Za-z]:$/.test(parts[0] ?? '')
    const segs: Array<{ label: string; path: string }> = []
    if (isWin) {
      segs.push({ label: `${parts[0]}\\`, path: `${parts[0]}\\` })
      let acc = `${parts[0]}\\`
      for (const p of parts.slice(1)) {
        acc = acc.endsWith('\\') ? `${acc}${p}` : `${acc}\\${p}`
        segs.push({ label: p, path: acc })
      }
    } else {
      segs.push({ label: '/', path: '/' })
      let acc = ''
      for (const p of parts) {
        acc = `${acc}/${p}`
        segs.push({ label: p, path: acc })
      }
    }
    return segs
  }, [listing, cwd])

  const openFile = async (path: string) => {
    setError(null)
    setBusy(true)
    try {
      const r = await readWorkspaceFile(path)
      if (r.ok && typeof r.content === 'string') {
        setActivePath(r.path ?? path)
        setContent(r.content)
        setSavedContent(r.content)
      } else {
        setError(r.error ?? '读取失败（可能是不支持的二进制文件）')
      }
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!activePath) return
    setBusy(true)
    try {
      const r = await writeWorkspaceFile(activePath, content)
      if (r.ok) {
        setSavedContent(content)
        navigate(cwd)
      } else {
        setError(r.error ?? '保存失败')
      }
    } finally {
      setBusy(false)
    }
  }

  const remove = async (path: string) => {
    if (!window.confirm(`确认删除 ${path} ？此操作不可恢复。`)) return
    setBusy(true)
    try {
      const r = await deleteWorkspaceFile(path)
      if (r.ok) {
        if (activePath === path) {
          setActivePath(null)
          setContent('')
          setSavedContent('')
        }
        navigate(cwd)
      } else {
        setError(r.error ?? '删除失败')
      }
    } finally {
      setBusy(false)
    }
  }

  const createFile = async () => {
    const name = newName.trim()
    if (!name) return
    const base = cwd === '.' ? '' : cwd.replace(/\\/g, '/')
    const target = base ? `${base}/${name}` : name
    setBusy(true)
    try {
      const r = await writeWorkspaceFile(target, '')
      if (r.ok) {
        setCreating(false)
        setNewName('')
        refresh()
        openFile(target)
      } else {
        setError(r.error ?? '创建失败')
      }
    } finally {
      setBusy(false)
    }
  }

  const refresh = () => navigate(cwd, false)

  const goUp = () => {
    if (!listing || listing.mode !== 'full' || !cwd || cwd === '.') return
    const parent = cwd.replace(/[\\/]+$/, '').split(/[\\/]/).slice(0, -1).join('\\')
    navigate(parent.length <= 3 ? parent || cwd : parent)
  }

  const toggleMode = async () => {
    if (!listing) return
    const nextMode = listing.mode === 'sandbox' ? 'full' : 'sandbox'
    if (
      nextMode === 'full' &&
      !window.confirm('开启后 Agent 和文件浏览器可以读写整台电脑的文件。\n受保护系统目录仍会被拦截。确定开启？')
    )
      return
    const r = await setFileAccessMode(nextMode)
    if (r.ok) {
      setCwd('.')
      navigate('.')
      if (nextMode === 'full') {
        fetchDrives().then(setDrives).catch(() => undefined)
        fetchQuickFolders().then(setQuickFolders).catch(() => undefined)
      }
    }
  }

  const openSystemPicker = async () => {
    if (picking) return
    setPicking(true)
    try {
      const r = await pickSystemFolder()
      if (r.ok && r.path) {
        await navigate(r.path)
      } else if (r.error) {
        setError(r.error)
      }
    } catch {
      setError('无法打开系统对话框')
    } finally {
      setPicking(false)
    }
  }

  const cleanJumpPath = (raw: string) =>
    raw
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim()

  const doJump = async () => {
    const target = cleanJumpPath(jumpPath)
    if (!target) {
      setError('请先输入要跳转的路径，例如 C:\\Users')
      return
    }
    setJumpBusy(true)
    try {
      const data = await listWorkspaceFiles(target)
      if (data.ok) {
        setListing(data)
        setCwd(data.cwd)
        setError(null)
        setActivePath(null)
        setContent('')
        setSavedContent('')
        setJumpPath('')
      } else {
        setError(data.error ?? '无法访问该目录')
      }
    } catch {
      setError('无法连接后端服务')
    } finally {
      setJumpBusy(false)
    }
  }

  const mode = listing?.mode ?? 'sandbox'
  const dirty = activePath !== null && content !== savedContent

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
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[80vh] w-[920px] overflow-hidden rounded-2xl bg-surface shadow-[0_24px_80px_rgba(24,24,27,0.18)] ring-1 ring-black/[0.06]"
          >
            <div className="flex w-[300px] shrink-0 flex-col border-r border-line bg-paper">
              <div className="flex items-center gap-2 px-4 pb-2 pt-5">
                <FolderTree className="size-4 text-accent-strong" />
                <span className="text-[14px] font-semibold tracking-tight">文件</span>
                <button
                  onClick={toggleMode}
                  title={mode === 'sandbox' ? '切换为本机访问' : '切换回沙箱模式'}
                  className={`ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
                    mode === 'full'
                      ? 'border-accent/40 bg-accent-soft text-accent-strong'
                      : 'border-line bg-surface text-ink-faint hover:text-ink'
                  }`}
                >
                  {mode === 'full' ? <Globe className="size-3" /> : <Lock className="size-3" />}
                  {mode === 'full' ? '本机' : '沙箱'}
                </button>
                <button
                  onClick={() => {
                    setCreating((v) => !v)
                    setNewName('')
                  }}
                  aria-label="新建文件"
                  title="新建文件"
                  className="rounded-lg border border-line bg-surface p-1.5 text-ink-faint transition-colors hover:border-ink/25 hover:text-ink"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              <div className="mx-3.5 mb-2 flex items-center gap-1 overflow-hidden rounded-lg border border-line bg-surface px-2 py-1.5">
                {breadcrumbs.map((b, i) => (
                  <span key={b.path} className="flex min-w-0 items-center">
                    {i > 0 && <ChevronRight className="mx-0.5 size-3 shrink-0 text-ink-faint/50" />}
                    <button
                      onClick={() => navigate(b.path)}
                      className={`truncate text-[11.5px] transition-colors ${
                        i === breadcrumbs.length - 1 ? 'font-medium text-ink' : 'text-ink-faint hover:text-ink'
                      }`}
                    >
                      {b.label}
                    </button>
                  </span>
                ))}
              </div>

              {mode === 'full' && (
                <>
                  <div className="mx-3.5 mb-2 flex gap-1.5">
                    <input
                      value={jumpPath}
                      onChange={(e) => setJumpPath(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing || e.key === 'Process') return
                        if (e.key === 'Enter') doJump()
                      }}
                      placeholder="输入本机路径，如 C:\Users"
                      className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-[11px] outline-none focus:border-ink/30"
                    />
                    <button
                      onClick={doJump}
                      disabled={jumpBusy}
                      className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[11px] text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
                    >
                      {jumpBusy ? (
                        <span className="size-3 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
                      ) : null}
                      跳转
                    </button>
                  </div>
                  {drives.length > 0 && (
                    <div className="mx-3.5 mb-2 flex flex-wrap gap-1">
                      {drives.map((d) => (
                        <button
                          key={d.path}
                          onClick={() => navigate(d.path)}
                          className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-ink-faint transition-colors hover:border-accent/40 hover:text-accent-strong"
                        >
                          {d.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {quickFolders.length > 0 && (
                    <div className="mx-3.5 mb-2 flex flex-wrap gap-1">
                      <button
                        onClick={openSystemPicker}
                        disabled={picking}
                        className="flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[10.5px] font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
                        title="打开 Windows 原生文件夹选择窗口"
                      >
                        {picking ? (
                          <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-white/40 border-t-white" />
                        ) : null}
                        系统弹窗选择…
                      </button>
                      {quickFolders.map((q) => (
                        <button
                          key={q.key + q.path}
                          onClick={() => navigate(q.path)}
                          title={q.path}
                          className="rounded-md border border-accent/30 bg-accent-soft/60 px-1.5 py-0.5 text-[10.5px] text-accent-strong transition-colors hover:bg-accent-soft"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {creating && (
                <div className="mx-3.5 mb-2 flex gap-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createFile()}
                    placeholder="新文件名.md"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-ink/30"
                  />
                  <button
                    onClick={createFile}
                    disabled={!newName.trim() || busy}
                    className="rounded-lg bg-ink px-2 text-[12px] text-paper disabled:opacity-40"
                  >
                    建
                  </button>
                </div>
              )}

              <div className="-mr-1 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                {error && (
                  <div className="mb-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11.5px] leading-snug text-red-600">
                    <CircleAlert className="mt-0.5 size-3 shrink-0" />
                    {error}
                  </div>
                )}
                {mode === 'full' && cwd && cwd !== '.' && cwd.length > 3 && (
                  <button
                    onClick={goUp}
                    className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                  >
                    <ArrowUp className="size-3.5" />
                    上一级
                  </button>
                )}
                {listing?.dirs.map((d) => (
                  <button
                    key={d.path}
                    onClick={() => navigate(d.path)}
                    className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface"
                  >
                    <Folder className="size-3.5 shrink-0 text-sky-500/70" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{d.name}</span>
                    <ChevronRight className="size-3 shrink-0 text-ink-faint/40 group-hover:text-ink-faint" />
                  </button>
                ))}
                {listing?.files.map((f) => (
                  <div
                    key={f.path}
                    onClick={() => openFile(f.path)}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                      f.path === activePath ? 'bg-surface ring-1 ring-accent/35' : 'hover:bg-surface/70'
                    }`}
                  >
                    <FileText className="size-3.5 shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{f.path.split(/[\\/]/).pop()}</span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-faint/70">
                      {sizeLabel(f.size_bytes)}
                    </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(f.path)
                        }}
                        aria-label={`删除 ${f.path}`}
                        className="shrink-0 text-ink-faint/50 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                      >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
                {listing && listing.dirs.length === 0 && listing.files.length === 0 && !error && (
                  <p className="rounded-lg border border-dashed border-line p-3 text-center text-[12px] text-ink-faint">
                    空目录，点 + 新建文件
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-2">
                  {activePath ? (
                    <>
                      <span className="truncate font-mono text-[13px]" title={activePath}>
                        {activePath}
                      </span>
                      {dirty && (
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-accent-strong">
                          未保存
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[13px] text-ink-faint">选择左侧文件查看 / 编辑</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {activePath && (
                    <button
                      onClick={save}
                      disabled={!dirty || busy}
                      className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-zinc-700 disabled:opacity-30"
                    >
                      <Save className="size-3.5" />
                      保存
                    </button>
                  )}
                  <button onClick={onClose} className="ml-1 text-ink-faint transition-colors hover:text-ink">
                    <X className="size-4.5" />
                  </button>
                </div>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={!activePath}
                spellCheck={false}
                placeholder={
                  busy
                    ? '加载中…'
                    : mode === 'full'
                      ? '已连接本机文件系统：浏览、编辑、保存；Agent 执行任务时也读写同一份真实文件。'
                      : 'Agent 和你共用这个沙箱目录——在设置或左上角可切换为「本机」访问整台电脑。'
                }
                className="min-h-0 flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed outline-none placeholder:text-ink-faint/60"
              />
              {activePath && (
                <div className="border-t border-line px-5 py-2 text-[11px] text-ink-faint">
                  提示：让 Agent「读取 {activePath.split(/[\\/]/).pop()} 再整理成周报」，它会用同一套工具操作这个真实文件。
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
