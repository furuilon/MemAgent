# MemAgent · 会记住你的 Agent

> 七牛云赛道 —— 具备反馈记忆能力的轻量 Agent 系统
>
> 用户下达任务 → Agent 规划、调用工具、生成结果 → 用户修改/反馈 → 系统蒸馏沉淀记忆 → 后续同类任务自动应用偏好。

## 演示主线（3 分钟）

1. 输入「帮我生成本周的工作周报」→ 得到一份平庸的通用周报
2. 点击「教它一下」，输入：*“别用表格，用要点列表；语气正式一点；突出数据成果”*
3. 观察右侧记忆库实时新增 3 条结构化规则（蒸馏动画）
4. 再次生成同类任务 → 新结果**自动遵守全部偏好**，界面标注「已应用记忆」
5. 打开右上角成本仪表盘：token 计量、延迟统计、A/B 对照实验数据

## 架构

```
Web UI (React/Vite/Tailwind)
   │ SSE 流式
FastAPI Backend
   ├─ Planner        任务规划，选择工具（JSON 协议，供应商无关）
   ├─ Tool Executor  8 个预置工具：工作记录 / 记忆检索 / 报告保存 + 本地文件增删改查
   ├─ Generator      结合素材+记忆流式生成
   └─ Memory System  ←—— 核心创新
       ├─ Extractor  LLM 把反馈蒸馏成原子化规则（不存原始对话）
       ├─ Store      SQLite 结构化存储
       ├─ Retriever  场景标签过滤 + 字符 n-gram 余弦相似度混合排序
       └─ Injector   预算内压缩注入 prompt（默认 ≤300 token）
File Access        双模式文件系统
   ├─ sandbox（默认） 仅 workspace/ 目录，路径越界自动拦截
   ├─ full            授权后读写整台电脑；Windows、Program Files
   │                  等受保护目录仍被强制拦截
Eval Module
   ├─ Tracker        每次 LLM 调用的 token/延迟/用途打点
   ├─ Judge          LLM-as-Judge 逐条判定输出是否遵守偏好
   └─ A/B Test       同任务 × {无记忆, 有记忆} 对照实验
```

## 快速开始

```bash
# 1. 配置 key（支持 DeepSeek / 七牛云 / OpenAI / Ollama，OpenAI 兼容协议一行切换）
cp backend/.env.example backend/.env    # 填入 LLM_API_KEY

# 2a. 后端
cd backend
python -m venv .venv                    # 已有 .venv 可跳过
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn app.main:app --port 8000 --reload

# 2b. 前端
cd frontend
npm install
npm run dev

# 或一键启动（Windows）
powershell -File start.ps1
```

打开 http://localhost:5173

## 关键设计（对应官方考查点）

| 考查点 | 方案 |
|-------|------|
| **记忆成本** | 只存蒸馏后的原子规则而非对话历史；注入前按 token 预算截断；检索零向量库依赖（纯 Python n-gram），仪表盘可视化每次调用开销 |
| **对话速度** | SSE 流式输出；规划失败自动降级兜底方案不阻塞；本地检索 <1ms |
| **记忆效果** | A/B 对照实验 + LLM-as-Judge 偏好遵循率量化报告；重复反馈自动合并去重；界面标注「已应用记忆」保证可解释性 |

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/task/stream` | 执行任务（SSE 流式事件） |
| POST | `/api/task` | 执行任务（JSON，评测用） |
| POST | `/api/feedback` | 提交反馈 → 蒸馏记忆 |
| GET/POST/DELETE | `/api/memories` | 记忆管理 |
| GET | `/api/metrics/summary` | 成本汇总 |
| POST | `/api/eval/run` | 运行 A/B 对照实验 |
| GET | `/api/eval/latest` | 最近一次评测报告 |

## 目录规范

```
backend/app/
├── api/            路由层：providers / history / workspace
├── agent/          Agent 域：orchestrator + planner + generator + routes(任务)
├── memory/         记忆系统四件套
├── tools/          工具注册表 + 内置工具 + 文件工具（双模式沙箱）
├── llm/            OpenAI 兼容客户端 + 按事件循环缓存的多供应商工厂
├── eval/           打点 / Judge / A/B
└── scripts/        smoke.py 一键集成检查（10 组用例）
frontend/src/components/   PascalCase 组件，一个组件一个职责
```

## 打包为 Windows 桌面应用

```powershell
powershell -ExecutionPolicy Bypass -File build_exe.ps1
# 产物: backend/dist/MemAgent.exe (约 34MB, 双击即用)
```

- 单文件内置前端 + 后端 + 沙箱，数据(.db/记忆/工作区)生成在 exe 同目录
- API Key 配置方式二选一：exe 同目录放 `.env`，或启动后在设置页填入
- 窗口基于 WebView2(Win10/11 自带)；异常时自动回退默认浏览器

## 切换到七牛云

编辑 `backend/.env`：

```
LLM_BASE_URL=https://api.qnaigc.com/v1
LLM_API_KEY=sk-xxx
LLM_MODEL=deepseek-v3
```

离线兜底：`LLM_BASE_URL=http://localhost:11434/v1` + Ollama。
