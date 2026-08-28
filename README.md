<p align="center">
  <a href="#english">English</a> · <a href="#-memagent--会记住你的-agent">简体中文</a> · <a href="#quick-start--快速开始">Quick Start</a> · <a href="#download--下载">Download</a> · <a href="#architecture--架构">Architecture</a>
</p>

<p align="center">
  <img src="frontend/public/favicon.png" width="72" height="72" alt="MemAgent logo" />
</p>
<h1 align="center">MemAgent</h1>
<p align="center">A lightweight agent that learns from your feedback.</p>
<p align="center">会记住你的 Agent</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/python-3.11+-3776AB?logo=python" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/fastapi-0.111-009688?logo=fastapi" alt="FastAPI" />
</p>

---

<a id="english"></a>
## English

### What is MemAgent?

MemAgent is a **lightweight feedback-memory agent** built for the Qiniu Cloud track. You give it a task, it plans, calls preset tools, and generates a result. When you edit the result or leave a comment, it distills the feedback into structured rules (*preference / rule / experience*) and automatically applies them to the next similar task.

**Core loop:** `Task → Plan → Tools → Generate → Feedback → Distill → Auto-apply`

### Features

| Feature | Description |
|---|---|
| **Feedback Distillation** | One comment like “use bullet points, no tables” becomes a permanent rule |
| **Hybrid Retrieval** | Scope-tag filter + character n-gram cosine, ranked by confidence & usage |
| **Cost Dashboard** | Every LLM call logged by token/latency/purpose, visualized |
| **A/B Lab** | Side-by-side `no-memory vs with-memory` live comparison + LLM-as-Judge score |
| **File Workspace** | Sandbox / Full-disk dual mode, local file CRUD with safety guard |
| **Session Memory** | Recent turns injected as short-term context |

### Quick Start / 快速开始

```bash
# 1. Configure LLM (DeepSeek / Qiniu / OpenAI / Ollama - OpenAI compatible)
cp backend/.env.example backend/.env  # then fill LLM_API_KEY

# 2a. Backend
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload

# 2b. Frontend
cd frontend
npm install
npm run dev

# Or one-click (Windows)
powershell -ExecutionPolicy Bypass -File start.ps1
```

Open `http://localhost:5173`. For desktop build: `powershell -ExecutionPolicy Bypass -File build_exe.ps1`.

### Download / 下载

> **Source code is clean (0.4 MB). Executables are never committed — get them from [Releases](../../releases).**

| Platform | Package | Note |
|---|---|---|
| Windows | `MemAgent-windows-amd64-installer.exe` (18.6 MB) | NSIS per-user installer, no admin required |
| Windows | `MemAgent-win64.zip` (33.7 MB) | Portable, unzip and run `MemAgent/MemAgent.exe` |
| macOS / Linux | Source only | `npm run dev` + `uvicorn` (contributions welcome) |

All releases are at `Releases` → `Assets`. The installer is a single `exe` file, not a folder.

### Architecture / 架构

```
Web UI (React/Vite/Tailwind) — SSE streaming
  │
FastAPI Backend
  ├─ Planner        JSON-step planning (provider-agnostic)
  ├─ Executor       8 tools: get_task_records / search_memory / save_report + file CRUD
  ├─ Generator      Prompt assembly with budget control (≤300 tokens for memories)
  └─ Memory System
      ├─ Extractor  Distills feedback → atomic rules
      ├─ Store      SQLite structured store
      ├─ Retriever  Scope filter + n-gram cosine, confidence-boosted ranking
      └─ Injector   Budget-aware injection

File Access: sandbox (workspace/ only) ↔ full (whole disk, system dirs blocked)
Eval: Tracker → Judge → A/B Test
```

### Project Structure / 目录

```
backend/app/
├── api/          providers / history / workspace
├── agent/        orchestrator / planner / generator / routes
├── memory/       extractor / store / retriever / injector
├── tools/        registry / builtin / files (dual-mode sandbox)
├── llm/          OpenAI-compatible client + multi-provider factory
├── eval/         tracker / judge / ab_test
└── scripts/      smoke.py / parallel_check.py / gen_icon.py
frontend/src/
├── components/   Header / Sidebar / Composer / ReportCanvas / Memory* …
└── lib/api.ts    Typed API layer
installer/installer.nsi  NSIS per-user installer (like Reasonix)
```

---

<a id="-memagent--会记住你的-agent"></a>
## 简体中文

### MemAgent 是什么？

MemAgent 是为**七牛云赛道**打造的轻量反馈记忆 Agent。核心能力：你提一句反馈，它提炼成可复用的规则，下次同类任务自动遵守。

### 对应赛题考查点

| 考查点 | 我们的方案 |
|---|---|
| 记忆成本 | 只存蒸馏规则，注入按预算截断，零向量库依赖，成本仪表盘可视化 |
| 对话速度 | SSE 流式 + 工具并行 + 进度事件，本地检索 <1ms |
| 记忆效果 | A/B 对照 + LLM-as-Judge 逐条判定遵循率，已应用记忆高亮可解释 |

### 真实场景

**智能周报助手**（每周重复、个性化强）+ 本地文件整理（读写真实磁盘）。

---

## License

MIT © 2025 MemAgent Team
