<p align="center">
  <a href="#中文">简体中文</a> · <a href="#english">English</a> · <a href="#解决的问题">痛点</a> · <a href="#核心特性">特性</a> · <a href="#技术架构">架构</a> · <a href="#快速开始">快速开始</a> · <a href="#下载">下载</a> · <a href="#api-一览">API</a>
</p>

<p align="center">
  <img src="frontend/public/favicon.png" width="80" height="80" alt="MemAgent logo" />
</p>

<h1 align="center">MemAgent</h1>
<p align="center"><strong>会记住你的 Agent · A lightweight agent that learns from your feedback</strong></p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/python-3.11+-3776AB?logo=python&logoColor=white" alt="Python 3.11+" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/fastapi-0.111-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/vite-7-646CFF?logo=vite" alt="Vite 7" />
</p>

<p align="center">
  七牛云赛道 · 具备反馈记忆能力的轻量 Agent 系统<br/>
  <em>用户下达任务 → Agent 规划、调用工具、生成结果 → 用户反馈 → 系统蒸馏沉淀记忆 → 后续同类任务自动应用偏好</em>
</p>

---

<a id="中文"></a>
## 中文

### 项目简介

MemAgent 是一个**轻量反馈记忆 Agent 系统**，专为七牛云赛道设计。区别于一次性问答的普通 Agent，MemAgent 会把你的每一次修改和点评提炼成结构化的长期记忆（偏好 / 规则 / 经验），并在后续相似任务中自动检索、注入，让结果越来越符合你的个人习惯。

**一句话定位：** 你教它一次，它记住一辈子。

**核心闭环：**

```
任务 Task → 规划 Plan → 工具 Tools → 生成 Generate → 反馈 Feedback → 蒸馏 Distill → 自动应用 Auto-apply
```

### 解决的问题

现有大模型 Agent 普遍存在四大记忆困境，MemAgent 逐一击破：

| 困境 | 现状 | MemAgent 的解法 |
|---|---|---|
| **对话历史即记忆** | 把全部对话塞进上下文，Token 成本随轮次线性增长；新会话一切归零 | 只存蒸馏后的原子规则，记忆体积压缩 90%+；跨会话可复用 |
| **反馈无法沉淀** | 用户说"别用表格"，下一次又用表格；修改只影响当次输出 | LLM 蒸馏为永久规则，存入 SQLite，后续自动检索应用 |
| **检索成本高** | 依赖向量数据库，部署重、延迟高、冷启动慢 | 场景标签 + n-gram 余弦混合检索，零向量库依赖，本地 <1ms |
| **效果不可验证** | 记忆是否生效全靠主观感受，缺乏量化手段 | A/B 对照实验室 + LLM-as-Judge 逐条判定遵循率，数据说话 |

### 目标用户与使用场景

**目标用户：** 需要反复使用 Agent 完成同类任务、对输出格式/语气/侧重点有强个性化偏好的个人用户和小团队——包括每周生成固定格式报告的职场人士、需要协助整理本地文件的知识工作者、对 Token 成本敏感希望轻量部署的开发者。

**核心使用场景：**

- **智能周报助手** —— 每周重复、个性化强（格式 / 语气 / 侧重点千人千面），最能体现反馈记忆的价值。用户教一次"别用表格、语气正式、突出数据"，后续周报自动遵守全部偏好。
- **本地文件整理** —— 通过双模式文件系统读写真实磁盘文件，Agent 记住用户的文件命名和整理习惯。

### 核心特性

| 特性 | 说明 |
|---|---|
| **反馈蒸馏** | 一句"别用表格"被 LLM 提炼为原子化永久规则（preference / rule / experience），而非流水账式存入对话历史 |
| **混合检索** | 场景标签过滤 + 字符 n-gram 余弦相似度，综合置信度与使用次数加权排序，零向量库依赖，本地检索 <1ms |
| **成本可视化** | 每次 LLM 调用的 Token、延迟、用途全量打点，仪表盘实时展示 Token 曲线、延迟、遵循率 |
| **A/B 对照实验室** | 同任务左右分屏对比"无记忆 vs 有记忆"，差异肉眼可见，支持 LLM-as-Judge 逐条判定遵循率 |
| **记忆演化时间线** | 每条记忆的诞生、合并、强化全程记录，可追溯可解释 |
| **双模式文件系统** | 沙箱（默认仅 workspace/，路径越界自动拦截）↔ 本机（授权后读写整台电脑，系统目录仍强制拦截） |
| **短期记忆** | 同会话内最近 6 轮对话自动注入上下文，2400 字符预算控制 |
| **按用途模型路由** | 规划 / 生成 / 提取 / 评判可分别指定不同模型，显著降低成本 |

系统内置 8 个预置工具：获取任务记录、搜索记忆、保存报告、列出文件、读取文件、写入文件、删除文件、搜索文件。

### 创新点

1. **反馈蒸馏而非历史堆砌** —— 用 LLM 将自然语言反馈提炼为结构化原子规则，记忆体积压缩 90% 以上，跨会话可复用，区别于把对话历史当记忆的传统方案。
2. **零向量库的混合检索** —— 场景标签过滤 + 字符 n-gram 余弦相似度，无需部署向量数据库，本地检索 <1ms，冷启动零成本，适合轻量桌面场景。
3. **预算可控的记忆注入** —— 记忆注入默认 ≤300 tokens 预算，历史按 2400 字符裁剪，从机制上保证 Token 成本不随记忆量增长而失控。
4. **可验证的记忆效果** —— A/B 对照实验室 + LLM-as-Judge 逐条判定遵循率，记忆是否生效、生效多少有量化数据支撑，而非主观感受。
5. **双模式文件系统** —— 沙箱与本机自由切换，既保证默认安全，又授权后可操作真实磁盘文件，系统目录仍强制拦截，兼顾实用性与安全性。
6. **按用途模型路由** —— 规划、生成、提取、评判分别可指定不同模型，用小模型做简单任务、大模型做核心生成，显著降低整体成本。

### 技术架构

```
Web UI (React 19 / Vite 7 / Tailwind CSS 4)
  │  SSE 流式推送
  ├─ Composer          任务输入 + 对照模式切换
  ├─ ReportCanvas      报告展示 + 执行轨迹
  ├─ MemoryPanel       记忆库 + 演化时间线入口
  └─ Workspace         双模式文件浏览器

FastAPI Backend (Python 3.11)
  ├─ Planner           JSON 步骤规划（供应商无关）+ 失败兜底
  ├─ Tool Executor     8 个预置工具，支持并行执行
  ├─ Generator         素材 + 记忆 + 短期历史 三合一 Prompt 组装（预算控制）
  └─ Memory System  ← 核心创新
      ├─ Extractor     LLM 蒸馏 → 原子化规则（preference / rule / experience）
      ├─ Store         SQLite 结构化存储
      ├─ Retriever     场景标签 + n-gram 余弦，置信度/使用次数加权排序
      └─ Injector      预算内压缩注入（默认 ≤300 tokens）

File Access            双模式
  ├─ sandbox (默认)    仅 backend/data/workspace/，路径越界自动拦截
  └─ full (授权后)     读写整台电脑，Windows / Program Files 等仍强制拦截

Eval Module
  ├─ Tracker           Token / 延迟 / 用途 打点
  ├─ Judge             LLM-as-Judge 逐条判定是否遵守偏好
  └─ A/B Test          同任务 × {无记忆, 有记忆} 对照实验

Session                短期记忆（最近 6 轮，2400 字符预算）
```

**大模型支持：** 采用 OpenAI 兼容协议，一行切换 DeepSeek / 七牛云 / OpenAI / Ollama（本地离线兜底）。

**打包与分发：** PyInstaller onedir 打包 + NSIS 安装器，源码仓库保持 0.4MB 级干净，可执行文件通过 GitHub Releases 分发。

### 考查点对应方案

| 官方考查点 | 我们的方案 |
|---|---|
| **记忆成本**（Token 费用、时间） | 只存蒸馏规则而非对话历史；注入按 Token 预算截断；历史按字符预算裁剪；按用途模型路由；检索零向量库依赖；仪表盘全量可视化 |
| **对话速度** | SSE 流式输出；工具并行执行（实测 0.31s vs 0.6s 顺序）；进度事件消除黑盒等待；本地检索 <1ms |
| **记忆效果及是否准确使用** | LLM-as-Judge 逐条判定遵循率；A/B 对照实验室；界面"已应用记忆"高亮可解释；置信度强化排序 |

### 当前完成情况

项目已完成核心功能开发，处于可演示、可体验状态：

- 记忆系统四阶段流水线（Extractor / Store / Retriever / Injector）全部实现并可运行
- 前端四大面板（Composer / ReportCanvas / MemoryPanel / Workspace）全部完成
- 8 个预置工具全部实现，支持并行执行（实测 0.31s vs 顺序 0.6s）
- 成本可视化仪表盘：Token / 延迟 / 用途全量打点
- A/B 对照实验室：左右分屏 + LLM-as-Judge 评判
- 记忆演化时间线：完整记录记忆的诞生、合并、强化
- 双模式文件系统：沙箱 / 本机切换，路径越界拦截
- 多平台构建：Windows 双形态（安装器 + 便携版）已就绪，macOS / Linux GitHub Actions 自动构建
- 开源仓库：GitHub 公开，含完整源码、双语 README、API 文档、部署说明

### 演示主线（3 分钟）

1. 输入「帮我生成本周的工作周报」→ 得到一份通用周报
2. 点击"教它一下"，输入：*"别用表格，用要点列表；语气正式一点；突出数据成果"*
3. 观察右侧记忆库实时新增 3 条结构化规则
4. 再次生成同类任务 → 新结果**自动遵守全部偏好**，顶部金色标签显示「已应用记忆 ×3」
5. 右上角打开成本仪表盘：Token 曲线、延迟、A/B 遵循率数据

### 快速开始

**环境要求：** Python 3.11+ · Node.js 18+

```bash
# 1. 配置大模型（支持 DeepSeek / 七牛云 / OpenAI / Ollama，OpenAI 兼容协议一行切换）
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 LLM_API_KEY

# 2a. 后端
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload

# 2b. 前端
cd frontend
npm install
npm run dev
# 打开 http://localhost:5173

# 一键启动（Windows，已含前后端）
powershell -ExecutionPolicy Bypass -File start.ps1

# 一键打包桌面安装器
powershell -ExecutionPolicy Bypass -File build_exe.ps1
# 产物: release/MemAgent-windows-amd64-installer.exe
```

### 下载

> **源码仓库保持 0.4MB 级干净，可执行文件通过 GitHub Releases 分发（与 Reasonix / OpenHands 一致）。**

| 平台 | 安装包 | 大小 | 说明 |
|---|---|---|---|
| Windows | [MemAgent-windows-amd64-installer.exe](https://github.com/furuilon/MemAgent/releases/latest/download/MemAgent-windows-amd64-installer.exe) | 18.6 MB | **推荐**，NSIS 安装器，无需管理员权限 |
| Windows | [MemAgent-windows-amd64-portable.zip](https://github.com/furuilon/MemAgent/releases/latest/download/MemAgent-windows-amd64-portable.zip) | 23.4 MB | 便携版，解压后运行 `MemAgent/MemAgent.exe` |
| macOS | [MemAgent-darwin-arm64.tar.gz](https://github.com/furuilon/MemAgent/releases/latest/download/MemAgent-darwin-arm64.tar.gz) | ~21 MB | Apple Silicon，自动构建 |
| Linux | [MemAgent-linux-amd64.tar.gz](https://github.com/furuilon/MemAgent/releases/latest/download/MemAgent-linux-amd64.tar.gz) | ~20 MB | x86_64，自动构建 |
| 源码 | `Source code (zip/tar.gz)` | 0.4 MB | `git clone` 即可 |

> **多平台说明（已完成）：** Windows 双形态已就绪；macOS / Linux 由 `.github/workflows/release.yml` 定义的多平台矩阵自动构建，推送 `v*` 标签后自动产出对应安装包并上传至同一 Release，无需手动操作或改动源码结构。

### API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/task/stream` | 执行任务（SSE 流式，支持 `use_memory` / `persist` / `session_id`） |
| POST | `/api/task` | 执行任务（JSON，评测用） |
| POST | `/api/feedback` | 提交反馈 → 蒸馏记忆 |
| GET / POST / DELETE | `/api/memories` | 记忆增删改查 |
| GET | `/api/memory-events` | 记忆演化时间线 |
| POST | `/api/memory-summary` | 一句话总结"它学会了什么" |
| GET | `/api/metrics/summary` | 成本汇总 |
| POST | `/api/eval/run` | 运行 A/B 对照实验 |
| GET | `/api/eval/latest` | 最近一次评测报告 |
| GET / POST / DELETE | `/api/workspace/*` | 文件浏览 / 读写 / 搜索 / 模式切换 |

### 目录结构

```
memagent/
├── backend/
│   ├── app/
│   │   ├── api/            路由层：providers / history / workspace
│   │   ├── agent/          orchestrator / planner / generator / routes
│   │   ├── memory/         extractor / store / retriever / injector
│   │   ├── tools/          registry / builtin / files（双模式沙箱）
│   │   ├── llm/            OpenAI 兼容客户端 + 多供应商工厂
│   │   ├── eval/           tracker / judge / ab_test
│   │   └── scripts/        smoke.py / parallel_check.py / gen_icon.py
│   ├── icon.ico
│   ├── MemAgent.spec       PyInstaller 规格（onedir + 图标）
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     Header / Sidebar / Composer / ReportCanvas / Memory* / CompareView ...
│   │   └── lib/api.ts      类型化 API 层（含超时与中断处理）
│   └── public/favicon.png
├── installer/
│   └── installer.nsi       NSIS per-user 安装脚本（对标 Reasonix）
├── release/                构建产物（被 .gitignore 忽略，通过 Releases 发布）
├── build_exe.ps1           一键打包脚本
├── start.ps1               一键启动脚本
└── README.md               本文件
```

### 切换到七牛云

编辑 `backend/.env`：

```ini
LLM_BASE_URL=https://api.qnaigc.com/v1
LLM_API_KEY=sk-xxx
LLM_MODEL=deepseek-v3
```

离线兜底：`LLM_BASE_URL=http://localhost:11434/v1` + Ollama 本地模型。

---

<a id="english"></a>
## English

### Introduction

MemAgent is a **lightweight feedback-memory agent system** built for the Qiniu Cloud track. Unlike one-off Q&A agents, MemAgent distills every edit and comment you make into structured long-term memories (*preference / rule / experience*) and automatically retrieves and injects them on the next similar task — so results get closer to your personal taste over time.

**Core loop:** `Task → Plan → Tools → Generate → Feedback → Distill → Auto-apply`

### Problem Solved

| Pain Point | Status Quo | MemAgent's Solution |
|---|---|---|
| **Conversation history as memory** | Full context stuffed in prompt, Token cost grows linearly; resets every new session | Only distilled atomic rules stored, 90%+ compression; reusable across sessions |
| **Feedback doesn't stick** | "No tables" is ignored next time; only affects current output | LLM distills to permanent rules in SQLite, auto-retrieved later |
| **Expensive retrieval** | Vector DB required, heavy deployment, high latency, cold start | Scope-tag + n-gram cosine hybrid retrieval, zero vector DB, <1ms locally |
| **Unverifiable effect** | Whether memory works is purely subjective | A/B lab + LLM-as-Judge per-rule compliance, data-driven |

### Target Users & Scenarios

**Target users:** Individuals and small teams who repeatedly use agents for similar tasks with strong personal preferences in format/tone/focus — professionals generating recurring reports, knowledge workers organizing local files, developers sensitive to Token costs seeking lightweight deployment.

**Core scenarios:** Smart weekly report assistant (highly repetitive, highly personalized) and local file organization (dual-mode filesystem reads/writes real disk files).

### Features

| Feature | Description |
|---|---|
| **Feedback Distillation** | One comment like "use bullet points, no tables" becomes a permanent rule |
| **Hybrid Retrieval** | Scope-tag filter + character n-gram cosine, ranked by confidence & usage |
| **Cost Dashboard** | Every LLM call logged by tokens/latency/purpose, visualized |
| **A/B Lab** | Side-by-side live comparison: `no-memory vs with-memory` |
| **Memory Timeline** | Every memory's birth, merge, and reinforcement tracked |
| **Dual-mode Filesystem** | Sandbox (workspace/ only) ↔ Full-disk (system dirs still blocked) |
| **Short-term Memory** | Last 6 turns auto-injected as context |
| **Per-purpose Model Routing** | Different models for planning/generation/extraction/judging to cut costs |

### Innovations

1. **Feedback distillation, not history dumping** — LLM distills natural language feedback into structured atomic rules, 90%+ memory compression, reusable across sessions.
2. **Zero-vector-DB hybrid retrieval** — Scope-tag + n-gram cosine, no vector DB deployment, <1ms local retrieval, zero cold-start cost.
3. **Budget-controlled memory injection** — Default ≤300 tokens injection budget, 2400-char history cap, Token cost never spirals with memory growth.
4. **Verifiable memory effectiveness** — A/B lab + LLM-as-Judge per-rule compliance, quantified data not subjective feeling.
5. **Dual-mode filesystem** — Sandbox ↔ full-disk toggle, safe by default, real disk access when authorized, system dirs always blocked.
6. **Per-purpose model routing** — Different models for planning/generation/extraction/judging, small models for simple tasks, big models for core generation.

### Architecture

Same as the Chinese diagram above (see [技术架构](#技术架构)).

### Evaluation Mapping

| Criterion | Our Approach |
|---|---|
| **Memory Cost** | Distilled rules only, budget-aware injection, history capping, per-purpose routing, zero vector DB, full dashboard |
| **Dialogue Speed** | SSE streaming, parallel tool execution (0.31s vs 0.6s sequential), progress events, <1ms local retrieval |
| **Memory Effectiveness** | LLM-as-Judge per-rule compliance, A/B lab, applied-memory highlighting, confidence-boosted ranking |

### Current Status

Core features fully implemented and demonstrable: four-stage memory pipeline (Extractor/Store/Retriever/Injector), four frontend panels, 8 built-in tools with parallel execution, cost dashboard, A/B lab, memory timeline, dual-mode filesystem, multi-platform builds (Windows ready, macOS/Linux auto-built via GitHub Actions), open-source GitHub repo with complete source code and bilingual README.

### Quick Start

**Requirements:** Python 3.11+ · Node.js 18+

```bash
# 1. Configure LLM (DeepSeek / Qiniu / OpenAI / Ollama — OpenAI compatible)
cp backend/.env.example backend/.env  # fill in LLM_API_KEY

# 2a. Backend
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload

# 2b. Frontend
cd frontend
npm install
npm run dev
# Open http://localhost:5173

# One-click (Windows)
powershell -ExecutionPolicy Bypass -File start.ps1

# Build desktop installer
powershell -ExecutionPolicy Bypass -File build_exe.ps1
# Output: release/MemAgent-windows-amd64-installer.exe
```

### Download

> **Source repo stays clean (0.4 MB). Executables are distributed via GitHub Releases (same as Reasonix / OpenHands).**

| Platform | Package | Size | Note |
|---|---|---|---|
| Windows | [MemAgent-windows-amd64-installer.exe](https://github.com/furuilon/MemAgent/releases/latest/download/MemAgent-windows-amd64-installer.exe) | 18.6 MB | **Recommended**, NSIS per-user installer, no admin required |
| Windows | [MemAgent-windows-amd64-portable.zip](https://github.com/furuilon/MemAgent/releases/latest/download/MemAgent-windows-amd64-portable.zip) | 23.4 MB | Portable, unzip and run `MemAgent/MemAgent.exe` |
| macOS | [MemAgent-darwin-arm64.tar.gz](https://github.com/furuilon/MemAgent/releases/latest/download/MemAgent-darwin-arm64.tar.gz) | ~21 MB | Apple Silicon, auto-built |
| Linux | [MemAgent-linux-amd64.tar.gz](https://github.com/furuilon/MemAgent/releases/latest/download/MemAgent-linux-amd64.tar.gz) | ~20 MB | x86_64, auto-built |
| Source | `Source code (zip/tar.gz)` | 0.4 MB | `git clone` |

> **Multi-platform note (done):** Windows dual-form is ready; macOS / Linux are auto-built by `.github/workflows/release.yml` multi-platform matrix. Pushing a `v*` tag produces all platform packages and uploads them to the same Release — no source changes needed.

### Demo Flow (3 min)

1. Input "Generate my weekly work report" → get a generic report
2. Click "Teach it", input: *"No tables, use bullet points; formal tone; highlight data achievements"*
3. Watch the memory panel add 3 structured rules in real time
4. Generate the same task again → result **automatically follows all preferences**, gold badge shows "Applied memory ×3"
5. Open cost dashboard: Token curve, latency, A/B compliance rate

### API Overview

Same as the Chinese table above (see [API 一览](#api-一览)).

### Project Structure

Same as the Chinese diagram above (see [目录结构](#目录结构)).

---

## License

MIT © 2026 MemAgent — See [LICENSE](./LICENSE) for details.
