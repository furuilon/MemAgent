import socket
import sys
import threading
import time
import traceback
import webbrowser
from pathlib import Path

READY = threading.Event()
WINDOW_HOLDER: dict = {}
LOG_LOCK = threading.Lock()


def _log(msg: str) -> None:
    try:
        base = sys.executable if getattr(sys, "frozen", False) else __file__
        log_path = Path(base).resolve().parent / "startup.log"
        with LOG_LOCK, open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")
    except Exception:
        pass


def _port_open(port: int, timeout: float = 0.4) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def _existing_backend() -> int | None:
    for port in range(8000, 8020):
        if _port_open(port):
            return port
    return None


def _free_port(preferred: int) -> int:
    for port in range(preferred, preferred + 20):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return preferred


def _has_webview2() -> bool:
    if sys.platform != "win32":
        return False
    GUID = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
    try:
        import winreg

        candidates = [
            (winreg.HKEY_LOCAL_MACHINE, rf"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{GUID}"),
            (winreg.HKEY_CURRENT_USER, rf"Software\Microsoft\EdgeUpdate\Clients\{GUID}"),
        ]
        for hive, path in candidates:
            try:
                with winreg.OpenKey(hive, path) as key:
                    pv = winreg.QueryValueEx(key, "pv")[0]
                    if pv and str(pv) != "0.0.0.0":
                        return True
            except OSError:
                continue
    except Exception:
        pass
    return False


LOADING_HTML = """<!doctype html><html><head><meta charset="utf-8">
<style>
body{margin:0;height:100vh;display:flex;flex-direction:column;gap:18px;align-items:center;justify-content:center;background:#141416;color:#f4f4f5;font-family:'Segoe UI',system-ui,sans-serif}
.logo{width:72px;height:72px;border-radius:18px;background:#18181b;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:#fafaf9;box-shadow:0 0 60px rgba(217,119,6,.25)}
.m{color:#f59e0b}
.spin{width:34px;height:34px;border-radius:50%;border:3px solid #333;border-top-color:#f59e0b;animation:s 1s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}
p{font-size:14px;color:#9d9da6;margin:0}
</style></head><body>
<div class="logo"><span class="m">M</span></div>
<div class="spin"></div>
<p>MemAgent 正在唤醒记忆…</p>
</body></html>"""


def serve_worker(port: int) -> None:
    try:
        t0 = time.perf_counter()
        _log("导入 app.main ...")
        from app.main import app

        import uvicorn

        _log(f"导入完成 {time.perf_counter() - t0:.1f}s, 启动 Server @{port}")
        config = uvicorn.Config(
            app,
            host="127.0.0.1",
            port=port,
            log_level="warning",
            log_config=None,
            access_log=False,
        )
        server = uvicorn.Server(config)
        server.install_signal_handlers = lambda: None
        server.run()
    except Exception:
        READY.set()
        _log("serve_worker 异常:\n" + traceback.format_exc())


def ready_waiter(port: int) -> None:
    deadline = time.time() + 30
    while time.time() < deadline and not _port_open(port, 0.4):
        time.sleep(0.12)
    if _port_open(port):
        READY.set()
        _log(f"端口 {port} 就绪")
        window = WINDOW_HOLDER.get("w")
        if window:
            try:
                window.load_url(f"http://127.0.0.1:{port}")
                _log("窗口已跳转到应用")
            except Exception:
                _log("load_url 失败:\n" + traceback.format_exc())
    else:
        _log("等待超时, 打开浏览器兜底")
        READY.set()
        webbrowser.open(f"http://127.0.0.1:{port}")


def main() -> None:
    _log("=== MemAgent 启动 ===")

    existing = _existing_backend()
    if existing:
        url = f"http://127.0.0.1:{existing}"
        _log(f"已有实例 @ {url}, 直接打开")
        if _has_webview2():
            try:
                import webview

                webview.create_window("MemAgent", url, width=1440, height=900)
                webview.start()
                return
            except Exception:
                pass
        webbrowser.open(url)
        return

    port = _free_port(8000)

    threading.Thread(target=serve_worker, args=(port,), daemon=True).start()

    if _has_webview2():
        try:
            import webview

            window = webview.create_window(
                "MemAgent",
                html=LOADING_HTML,
                width=1440,
                height=900,
                min_size=(1100, 700),
            )
            WINDOW_HOLDER["w"] = window
            _log("加载窗口已弹出")
            threading.Thread(target=ready_waiter, args=(port,), daemon=True).start()
            webview.start()
            return
        except Exception:
            _log("webview 异常:\n" + traceback.format_exc())

    _log("无 WebView2, 阻塞等待后端后走浏览器")
    ready_waiter(port)
    READY.wait(timeout=1)
    webbrowser.open(f"http://127.0.0.1:{port}")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        _log("FATAL:\n" + traceback.format_exc())
        raise
