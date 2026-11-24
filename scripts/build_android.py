#!/usr/bin/env python3
"""交互式构建 Android APK。

默认构建 debug APK，适合直接安装测试；release 需要 HTTPS 和已配置的签名。

    python scripts/build_android.py
    python scripts/build_android.py --api-base-url https://todo.example.com --release
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
GEN_ANDROID = FRONTEND / "src-tauri" / "gen" / "android"


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
        raise ValueError("release 包必须使用 HTTPS 地址")
    return url


def ask_api_url(require_https: bool) -> str:
    while True:
        raw = input(
            "后端 API 地址（手机可访问的地址，例如 https://todo.example.com）: "
        ).strip()
        if not raw:
            continue
        try:
            return normalize_api_url(raw, require_https=require_https)
        except ValueError as exc:
            print(f"地址无效：{exc}")


def find_android_env() -> tuple[Path, Path, Path]:
    java_home = Path(
        os.environ.get("JAVA_HOME")
        or r"C:\Program Files\Android\Android Studio\jbr"
    )
    sdk_home = Path(
        os.environ.get("ANDROID_HOME")
        or os.environ.get("ANDROID_SDK_ROOT")
        or (Path(os.environ.get("LOCALAPPDATA", "")) / "Android" / "Sdk")
    )

    ndk_home_raw = os.environ.get("NDK_HOME")
    ndk_home = Path(ndk_home_raw) if ndk_home_raw else None
    if ndk_home is None or not ndk_home.is_dir():
        ndk_root = sdk_home / "ndk"
        versions = sorted(
            (path for path in ndk_root.glob("*") if path.is_dir()),
            reverse=True,
        ) if ndk_root.is_dir() else []
        if not versions:
            raise RuntimeError(f"找不到 NDK，请先安装到 {ndk_root}")
        ndk_home = versions[0]

    for label, path in (
        ("JAVA_HOME", java_home),
        ("ANDROID_HOME", sdk_home),
        ("NDK_HOME", ndk_home),
    ):
        if not path.is_dir():
            raise RuntimeError(f"{label} 不存在：{path}")

    os.environ["JAVA_HOME"] = str(java_home)
    os.environ["ANDROID_HOME"] = str(sdk_home)
    os.environ["ANDROID_SDK_ROOT"] = str(sdk_home)
    os.environ["NDK_HOME"] = str(ndk_home)
    os.environ["ANDROID_NDK_HOME"] = str(ndk_home)
    return java_home, sdk_home, ndk_home


def npx_command(args: list[str]) -> list[str]:
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not npx:
        raise RuntimeError("找不到 npx，请确认 Node.js 已安装并加入 PATH")
    if os.name == "nt":
        return ["cmd.exe", "/d", "/s", "/c", npx, *args]
    return [npx, *args]


def release_signing_configured() -> bool:
    gradle = GEN_ANDROID / "app" / "build.gradle.kts"
    if not gradle.is_file():
        return False
    text = gradle.read_text(encoding="utf-8", errors="ignore")
    return "signingConfig" in text or "signingConfigs" in text


def choose_build_type(force_release: bool, force_debug: bool) -> str:
    if force_release:
        return "release"
    if force_debug:
        return "debug"
    print("构建类型：")
    print("  1) Debug APK（直接安装测试，允许 HTTP）")
    print("  2) Release APK（正式包，需要 HTTPS 和签名）")
    answer = input("选择 [1]: ").strip() or "1"
    return "release" if answer == "2" else "debug"


def main() -> int:
    parser = argparse.ArgumentParser(description="构建 Todo Android APK")
    parser.add_argument("--api-base-url", help="后端 API 地址，不传则交互式询问")
    parser.add_argument("--release", action="store_true", help="构建 release APK")
    parser.add_argument("--debug", action="store_true", help="构建 debug APK（默认）")
    parser.add_argument(
        "--target",
        default="aarch64",
        choices=["aarch64", "armv7", "i686", "x86_64"],
        help="CPU 架构，默认 aarch64（绝大多数真机）",
    )
    parser.add_argument("--yes", "-y", action="store_true", help="跳过确认")
    parser.add_argument("--dry-run", action="store_true", help="只打印构建命令，不执行")
    args = parser.parse_args()

    if args.release and args.debug:
        print("--release 和 --debug 不能同时使用。", file=sys.stderr)
        return 1
    if not FRONTEND.is_dir():
        print(f"找不到 frontend 目录：{FRONTEND}", file=sys.stderr)
        return 1
    if not (FRONTEND / "node_modules").is_dir():
        print("frontend/node_modules 不存在，请先执行：cd frontend; npm install", file=sys.stderr)
        return 1
    if not GEN_ANDROID.is_dir():
        print(
            "Android 工程还没初始化，请先执行：\n"
            "  cd frontend\n"
            "  npx tauri android init",
            file=sys.stderr,
        )
        return 1

    build_type = choose_build_type(args.release, args.debug)
    is_release = build_type == "release"

    if is_release and not release_signing_configured():
        print(
            "release 签名还没配置。请先在 gen/android/app/build.gradle.kts 里配置 "
            "signingConfigs，并把 keystore 放在不会被提交的位置。",
            file=sys.stderr,
        )
        return 1

    try:
        _, sdk_home, _ = find_android_env()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    try:
        api_url = (
            normalize_api_url(args.api_base_url, require_https=is_release)
            if args.api_base_url
            else ask_api_url(require_https=is_release)
        )
    except ValueError as exc:
        print(f"地址无效：{exc}", file=sys.stderr)
        return 1

    print()
    print(f"构建类型：{build_type}")
    print(f"目标架构：{args.target}")
    print(f"后端地址：{api_url}")
    if not is_release and urlparse(api_url).scheme == "http":
        print("提示：HTTP 只适合本地测试；正式包请使用 HTTPS 并构建 release。")
    if not args.yes and not args.dry_run:
        answer = input("按回车开始构建，输入 n 取消: ").strip().lower()
        if answer == "n":
            print("已取消。")
            return 0

    env = os.environ.copy()
    env["VITE_API_BASE_URL"] = api_url

    command = ["tauri", "android", "build"]
    if not is_release:
        command.append("--debug")
    command += ["--apk", "--target", args.target]

    try:
        full_command = npx_command(command)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print("执行：", subprocess.list2cmdline(full_command))
    if args.dry_run:
        return 0

    try:
        subprocess.run(full_command, cwd=FRONTEND, env=env, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"\n构建失败，退出码 {exc.returncode}。", file=sys.stderr)
        return exc.returncode or 1
    except KeyboardInterrupt:
        print("\n已取消。")
        return 130

    apk_root = GEN_ANDROID / "app" / "build" / "outputs" / "apk"
    apks = sorted(
        apk_root.rglob("*.apk"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    ) if apk_root.is_dir() else []

    print()
    if apks:
        print(f"APK：{apks[0]}")
        adb = sdk_home / "platform-tools" / ("adb.exe" if os.name == "nt" else "adb")
        if adb.is_file():
            print(f'安装命令："{adb}" install -r "{apks[0]}"')
    else:
        print(f"构建完成，但没在 {apk_root} 找到 APK。")
    print(f"内置 API 地址：{api_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
