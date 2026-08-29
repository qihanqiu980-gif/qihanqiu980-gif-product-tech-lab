from pathlib import Path
import sys

actual_path = Path("output/quality_report.txt")
expected_path = Path("expected-quality-report.txt")

if not actual_path.exists():
    raise SystemExit("FAIL：缺少 output/quality_report.txt，请先运行 python3 starter.py。")

actual = actual_path.read_text(encoding="utf-8").strip()
expected = expected_path.read_text(encoding="utf-8").strip()

if actual != expected:
    print("FAIL：质量报告尚未达到预期。")
    print("\n当前报告：\n" + actual)
    print("\n预期报告：\n" + expected)
    print("\n请检查 TODO 1、TODO 2 与 QUALITY_RULES_IMPLEMENTED。")
    sys.exit(1)

print("PASS：两条 TODO 规则、行数守恒和各问题计数均符合预期。")
