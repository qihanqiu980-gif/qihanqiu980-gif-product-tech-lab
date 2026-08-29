#!/usr/bin/env python3
"""Deterministically package public/labs directories with UTF-8 ZIP names."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import sys
import zipfile


PROJECT_ROOT = Path(__file__).resolve().parent.parent
LAB_ROOT = PROJECT_ROOT / "public" / "labs"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def lab_directories() -> list[Path]:
    return sorted(
        (path for path in LAB_ROOT.iterdir() if path.is_dir() and path.name.startswith("W")),
        key=lambda path: path.name,
    )


def expected_entries(lab_dir: Path) -> dict[str, str]:
    entries: dict[str, str] = {}
    for source in sorted(path for path in lab_dir.rglob("*") if path.is_file()):
        archive_name = (Path(lab_dir.name) / source.relative_to(lab_dir)).as_posix()
        entries[archive_name] = digest(source.read_bytes())
    return entries


def inspect_archive(lab_dir: Path) -> list[str]:
    archive_path = lab_dir.with_suffix(".zip")
    if not archive_path.exists():
        return [f"缺少 {archive_path.name}"]

    expected = expected_entries(lab_dir)
    issues: list[str] = []
    with zipfile.ZipFile(archive_path) as archive:
        files = {item.filename: item for item in archive.infolist() if not item.is_dir()}
        if set(files) != set(expected):
            missing = sorted(set(expected) - set(files))
            extra = sorted(set(files) - set(expected))
            issues.append(f"内容清单不一致；缺少={missing}，多出={extra}")
        for name, expected_hash in expected.items():
            item = files.get(name)
            if item is None:
                continue
            if any(ord(character) > 127 for character in name) and not item.flag_bits & 0x800:
                issues.append(f"{name} 未设置 UTF-8 filename flag")
            if digest(archive.read(item)) != expected_hash:
                issues.append(f"{name} 内容哈希不一致")
    return issues


def package_lab(lab_dir: Path) -> None:
    archive_path = lab_dir.with_suffix(".zip")
    temporary_path = archive_path.with_suffix(".zip.tmp")
    if temporary_path.exists():
        temporary_path.unlink()
    try:
        with zipfile.ZipFile(
            temporary_path,
            mode="w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as archive:
            for source in sorted(path for path in lab_dir.rglob("*") if path.is_file()):
                archive_name = (Path(lab_dir.name) / source.relative_to(lab_dir)).as_posix()
                archive.write(source, archive_name)
        temporary_path.replace(archive_path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="只验证现有 ZIP，不重新打包")
    args = parser.parse_args()

    directories = lab_directories()
    if len(directories) != 10:
        print(f"FAIL：预期 10 个 W3–W12 实验目录，实际 {len(directories)} 个。", file=sys.stderr)
        return 1

    if not args.check:
        for directory in directories:
            package_lab(directory)

    failures: dict[str, list[str]] = {}
    for directory in directories:
        issues = inspect_archive(directory)
        if issues:
            failures[directory.name] = issues

    if failures:
        print("FAIL：实验 ZIP 校验失败。", file=sys.stderr)
        for name, issues in failures.items():
            for issue in issues:
                print(f"- {name}: {issue}", file=sys.stderr)
        return 1

    action = "验证" if args.check else "打包并验证"
    print(f"PASS：{action} 10 个实验资料包；目录内容一致，中文路径均使用 UTF-8 ZIP 标记。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
