#!/usr/bin/env python3
"""一次性生成 Android release keystore，并写入 Gradle 使用的 keystore.properties。

    python scripts/setup_android_signing.py

密码只在本机输入，会写入 gen/android/keystore.properties（已被 gitignore）。
"""

from __future__ import annotations

import argparse
import getpass
import os
import shutil
import subprocess
import sys
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
GEN_ANDROID = ROOT / "frontend" / "src-tauri" / "gen" / "android"
PROPERTIES_FILE = GEN_ANDROID / "keystore.properties"


def find_keytool() -> Path:
    candidates = []
    java_home = os.environ.get("JAVA_HOME")
    if java_home:
        candidates.append(Path(java_home) / "bin" / "keytool.exe")
    candidates.append(
        Path(r"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe")
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    found = shutil.which("keytool")
    if found:
        return Path(found)
    raise RuntimeError("找不到 keytool，请确认 JDK 已安装，或设置 JAVA_HOME")


def ask(prompt: str, default: str) -> str:
    value = input(f"{prompt} [{default}]: ").strip()
    return value or default


def escape_property(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r")


def ask_password() -> str:
    while True:
        password = getpass.getpass("设置 keystore 密码（至少 6 位）: ")
        if len(password) < 6:
            print("密码至少 6 位。")
            continue
        confirm = getpass.getpass("再输入一次: ")
        if password != confirm:
            print("两次输入不一致。")
            continue
        return password


def main() -> int:
    parser = argparse.ArgumentParser(description="生成 Android release keystore")
    parser.add_argument("--keystore", help="keystore 保存路径，不传则交互式询问")
    parser.add_argument("--alias", help="key alias，默认交互式询问")
    args = parser.parse_args()

    if not GEN_ANDROID.is_dir():
        print(
            "Android 工程还没初始化，请先执行：\n"
            "  cd frontend\n"
            "  npx tauri android init",
            file=sys.stderr,
        )
        return 1
    if PROPERTIES_FILE.exists():
        print(f"{PROPERTIES_FILE} 已存在。")
        print("如果只是想重新生成，请先备份并删除它和对应的 keystore。")
        return 1

    try:
        keytool = find_keytool()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    default_keystore = Path.home() / "AndroidKeys" / "todo-release.jks"
    keystore = (
        Path(args.keystore).expanduser()
        if args.keystore
        else Path(ask("keystore 保存路径", str(default_keystore))).expanduser()
    )
    alias = args.alias or ask("key alias", "todo")
    if not alias.replace("-", "").replace("_", "").isalnum():
        print("alias 只能包含字母、数字、下划线和短横线。", file=sys.stderr)
        return 1
    if keystore.exists():
        print(f"keystore 已存在，不会覆盖：{keystore}", file=sys.stderr)
        return 1

    password = ask_password()
    keystore.parent.mkdir(parents=True, exist_ok=True)

    dname = "CN=Todo, OU=Personal, O=Todo, L=Local, ST=Local, C=CN"
    command = [
        str(keytool),
        "-genkeypair",
        "-v",
        "-keystore",
        str(keystore),
        "-alias",
        alias,
        "-keyalg",
        "RSA",
        "-keysize",
        "2048",
        "-validity",
        "10000",
        "-dname",
        dname,
        "-storepass",
        password,
        "-keypass",
        password,
    ]
    print()
    print(f"生成 keystore：{keystore}")
    try:
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as exc:
        print(f"keytool 失败，退出码 {exc.returncode}。", file=sys.stderr)
        return exc.returncode or 1

    PROPERTIES_FILE.write_text(
        "\n".join(
            [
                f"storeFile={keystore.as_posix()}",
                f"storePassword={escape_property(password)}",
                f"keyAlias={alias}",
                f"keyPassword={escape_property(password)}",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print()
    print(f"已写入：{PROPERTIES_FILE}")
    print("请备份 keystore 和 keystore.properties，丢失后无法覆盖升级正式包。")
    print("下一步：")
    print(
        '  python .\\scripts\\build_android.py --release '
        '--api-base-url "https://你的域名"'
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
