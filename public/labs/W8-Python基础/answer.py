from starter import load_orders, write_outputs
from collections import defaultdict
from pathlib import Path


def summarize(orders: list[dict]) -> tuple[dict, list[dict]]:
    totals = defaultdict(float)
    valid_paid_orders = 0
    exceptions = []
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
        totals[channel] += amount
    return {"valid_paid_orders": valid_paid_orders, "by_channel": dict(totals)}, exceptions


orders = load_orders(Path("orders.json"))
write_outputs(*summarize(orders), Path("answer_output"))
print("答案已生成到 answer_output")
