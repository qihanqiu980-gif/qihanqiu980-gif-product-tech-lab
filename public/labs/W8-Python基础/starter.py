import csv
import json
import sys
from collections import defaultdict
from pathlib import Path


def load_orders(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"找不到输入文件: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON 格式错误，第 {exc.lineno} 行") from exc
    if not isinstance(data, list):
        raise ValueError("输入根节点必须是订单列表 list")
    return data


def summarize(orders: list[dict]) -> tuple[dict, list[dict]]:
    totals = defaultdict(float)
    valid_paid_orders = 0
    exceptions: list[dict] = []
    for index, order in enumerate(orders, start=1):
        if order.get("status") != "paid":
            continue
        try:
            order_id = str(order["order_id"])
            channel = str(order["channel"])
            amount = float(order["paid_amount"])
            if amount < 0:
                raise ValueError("金额为负数")
        except (KeyError, TypeError, ValueError) as exc:
            exceptions.append({"row": index, "order_id": order.get("order_id", ""), "reason": str(exc)})
            continue
        valid_paid_orders += 1
        # TODO：将 amount 累加到 totals[channel]
    return {"valid_paid_orders": valid_paid_orders, "by_channel": dict(totals)}, exceptions


def write_outputs(summary: dict, exceptions: list[dict], output_dir: Path) -> None:
    output_dir.mkdir(exist_ok=True)
    lines = [f"有效支付订单: {summary['valid_paid_orders']}"]
    total = sum(summary["by_channel"].values())
    lines.append(f"有效支付金额: {total:.2f}")
    for channel, amount in sorted(summary["by_channel"].items()):
        lines.append(f"- {channel}: {amount:.2f}")
    lines.append(f"异常行数: {len(exceptions)}")
    (output_dir / "summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    with (output_dir / "exceptions.csv").open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=["row", "order_id", "reason"])
        writer.writeheader()
        writer.writerows(exceptions)


def main() -> int:
    input_path = Path(sys.argv[1] if len(sys.argv) > 1 else "orders.json")
    try:
        orders = load_orders(input_path)
        summary, exceptions = summarize(orders)
        write_outputs(summary, exceptions, Path("output"))
    except ValueError as exc:
        print(f"无法完成分析：{exc}")
        return 1
    print("完成：请查看 output/summary.txt 与 output/exceptions.csv")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
