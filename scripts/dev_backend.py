#!/usr/bin/env python3
"""启动本地 FastAPI 后端。

不传参数时会交互式询问监听地址和端口。示例：
    python scripts/dev_backend.py
    python scripts/dev_backend.py --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import argparse
import socket
import subprocess
import sys
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
VENV_PYTHON = BACKEND / ".venv" / "Scripts" / "python.exe"


def ask(prompt: str, default: str) -> str:
    value = input(f"{prompt} [{default}]: ").strip()
    return value or default


def ask_port(prompt: str, default: int) -> int:
    while True:
        raw = input(f"{prompt} [{default}]: ").strip()
        if not raw:
            return default
        try:
            port = int(raw)
        except ValueError:
            print("请输入数字端口。")
            continue
        if 1 <= port <= 65535:
            return port
        print("端口范围是 1-65535。")


def lan_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return str(sock.getsockname()[0])
    except OSError:
        return "127.0.0.1"


def main() -> int:
    parser = argparse.ArgumentParser(description="启动 Todo 后端")
    parser.add_argument("--host", help="监听地址，默认交互式询问")
    parser.add_argument("--port", type=int, help="监听端口，默认交互式询问")
    parser.add_argument("--no-reload", action="store_true", help="关闭 uvicorn 热重载")
    args = parser.parse_args()

    if not VENV_PYTHON.is_file():
        print(f"找不到后端虚拟环境：{VENV_PYTHON}", file=sys.stderr)
        print(
            "请先在 backend 目录创建 .venv 并安装 requirements.txt，"
            "或参考 README 的“首次安装后端依赖”。",
            file=sys.stderr,
        )
        return 1

    if not (BACKEND / ".env").is_file():
        print(
            "警告：backend/.env 不存在。请先根据 .env.example 配置 DATABASE_URL。",
            file=sys.stderr,
        )

    host = args.host or ask("监听地址", "0.0.0.0")
    port = args.port or ask_port("监听端口", 8000)
    if not 1 <= port <= 65535:
        print("端口范围是 1-65535。", file=sys.stderr)
        return 1

    local_url = f"http://127.0.0.1:{port}"
    lan_url = f"http://{lan_ip()}:{port}"
    print()
    print(f"本机地址：{local_url}")
    if host == "0.0.0.0":
        print(f"局域网地址：{lan_url}")
    print(f"接口文档：{local_url}/docs")
    print("按 Ctrl+C 停止后端。")
    print()

    command = [
        str(VENV_PYTHON),
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        host,
        "--port",
        str(port),
    ]
    if not args.no_reload:
        command.append("--reload")

    try:
        subprocess.run(command, cwd=BACKEND, check=False)
    except KeyboardInterrupt:
        print("\n后端已停止。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
