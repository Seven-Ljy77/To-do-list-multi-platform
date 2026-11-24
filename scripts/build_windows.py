#!/usr/bin/env python3
"""交互式构建 Windows 安装包。

运行后会询问后端 API 地址，并把它写入构建环境变量 VITE_API_BASE_URL。

    python scripts/build_windows.py
    python scripts/build_windows.py --api-base-url https://todo.example.com
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"


def normalize_api_url(raw: str, require_https: bool) -> str:
    url = raw.strip().rstrip("/")
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("地址必须类似 https://todo.example.com，不能省略 http(s)://")
    if parsed.username or parsed.password:
        raise ValueError("地址里不要包含用户名或密码")
    if parsed.query or parsed.fragment:
        raise ValueError("地址不要包含查询参数或 # 片段")
    if any(ch.isspace() for ch in url):
        raise ValueError("地址里不能有空格")
    if require_https and parsed.scheme != "https":
        raise ValueError("正式包必须使用 HTTPS 地址")
    return url


def ask_api_url(default: str = "http://127.0.0.1:8000") -> str:
    while True:
        raw = input(f"后端 API 地址 [{default}]: ").strip() or default
        try:
            url = normalize_api_url(raw, require_https=False)
        except ValueError as exc:
            print(f"地址无效：{exc}")
            continue
        if urlparse(url).scheme == "http":
            print("提示：HTTP 只适合本地测试，正式包请使用 HTTPS。")
        return url


def npx_command(args: list[str]) -> list[str]:
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not npx:
        raise RuntimeError("找不到 npx，请确认 Node.js 已安装并加入 PATH")
    if os.name == "nt":
        return ["cmd.exe", "/d", "/s", "/c", npx, *args]
    return [npx, *args]


def main() -> int:
    parser = argparse.ArgumentParser(description="构建 Todo Windows 安装包")
    parser.add_argument("--api-base-url", help="后端 API 地址，不传则交互式询问")
    parser.add_argument("--yes", "-y", action="store_true", help="跳过确认")
    parser.add_argument("--dry-run", action="store_true", help="只打印构建命令，不执行")
    args = parser.parse_args()

    if not FRONTEND.is_dir():
        print(f"找不到 frontend 目录：{FRONTEND}", file=sys.stderr)
        return 1
    if not (FRONTEND / "node_modules").is_dir():
        print("frontend/node_modules 不存在，请先执行：cd frontend; npm install", file=sys.stderr)
        return 1

    try:
        api_url = (
            normalize_api_url(args.api_base_url, require_https=False)
            if args.api_base_url
            else ask_api_url()
        )
    except ValueError as exc:
        print(f"地址无效：{exc}", file=sys.stderr)
        return 1

    print()
    print(f"将把后端地址打包进 Windows 客户端：{api_url}")
    if not args.yes and not args.dry_run:
        answer = input("按回车开始构建，输入 n 取消: ").strip().lower()
        if answer == "n":
            print("已取消。")
            return 0

    env = os.environ.copy()
    env["VITE_API_BASE_URL"] = api_url

    try:
        command = npx_command(["tauri", "build"])
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print("执行：", subprocess.list2cmdline(command))
    if args.dry_run:
        return 0

    try:
        subprocess.run(command, cwd=FRONTEND, env=env, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"\n构建失败，退出码 {exc.returncode}。", file=sys.stderr)
        return exc.returncode or 1
    except KeyboardInterrupt:
        print("\n已取消。")
        return 130

    bundle_dir = FRONTEND / "src-tauri" / "target" / "release" / "bundle" / "nsis"
    installers = sorted(
        bundle_dir.glob("*.exe"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    ) if bundle_dir.is_dir() else []

    print()
    if installers:
        print(f"安装包：{installers[0]}")
    else:
        print(f"构建完成，但没在 {bundle_dir} 找到安装包。")
    print(f"内置 API 地址：{api_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
