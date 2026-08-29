import json
import sys
from pathlib import Path
from typing import Any

ALLOWED_FIELDS = {"name", "color", "description"}
ALLOWED_COLORS = {"orange", "blue", "green", "gray"}


def validate(payload: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(payload, dict):
        actual_type = (
            "array"
            if isinstance(payload, list)
            else "null"
            if payload is None
            else type(payload).__name__
        )
        return [f"JSON 根节点必须是 object，当前是 {actual_type}"]

    unknown = set(payload) - ALLOWED_FIELDS
    if unknown:
        errors.append(f"未知字段: {', '.join(sorted(unknown))}")

    name = payload.get("name")
    if not isinstance(name, str):
        errors.append("name 必须是 string")
    elif not 1 <= len(name.strip()) <= 30:
        errors.append("name 去首尾空格后必须为 1–30 字符")

    color = payload.get("color")
    if color not in ALLOWED_COLORS:
        errors.append(f"color 必须是 {sorted(ALLOWED_COLORS)} 之一")

    description = payload.get("description")
    if description is not None and not isinstance(description, str):
        errors.append("description 必须是 string 或 null")
    if isinstance(description, str) and (not description or len(description) > 200):
        errors.append("description 不允许空字符串，且最长 200 字符")
    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("用法: python3 validate_payload.py payload.json")
        return 2
    path = Path(sys.argv[1])
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL 无法读取 JSON: {exc}")
        return 1
    errors = validate(payload)
    if errors:
        print("FAIL")
        for error in errors:
            print(f"- {error}")
        return 1
    print("PASS payload 满足当前字段契约")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
