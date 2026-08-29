import argparse
import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


MATRIX_PATH = Path(__file__).with_name("acceptance-matrix.csv")


@dataclass
class Response:
    http: int
    body: dict


@dataclass
class CaseResult:
    case_id: str
    responses: tuple[Response, ...]
    business_ok: bool
    observation: str


class DemoAPI:
    """只模拟 API 与核心业务状态，不伪装成真实页面、数据库或日志系统。"""

    def __init__(self) -> None:
        self.orders: dict[str, dict] = {
            "O900": {"owner": "alice", "status": "pending"},
        }
        self.idempotency: dict[str, str] = {}
        self.activity = {"version": 3, "name": "开学季"}
        self.items = [6, 5, 4, 3, 2, 1]

    def create_order(
        self,
        key: str,
        *,
        user: str | None = "alice",
        amount: int = 100,
        timeout_after_commit: bool = False,
    ) -> Response:
        if user is None:
            return Response(401, {"error": "LOGIN_REQUIRED"})
        if amount <= 0:
            return Response(
                400,
                {"error": "INVALID_AMOUNT", "fix_hint": "amount 必须大于 0"},
            )
        if key in self.idempotency:
            order_id = self.idempotency[key]
            return Response(200, {"order_id": order_id, "replayed": True})

        order_id = f"O{len(self.orders) + 1:03d}"
        self.orders[order_id] = {"owner": user, "status": "pending"}
        self.idempotency[key] = order_id
        if timeout_after_commit:
            return Response(
                504,
                {
                    "error": "UPSTREAM_TIMEOUT",
                    "request_id": "req-timeout-001",
                    "result_queryable": True,
                },
            )
        return Response(201, {"order_id": order_id, "replayed": False})

    def get_order(self, order_id: str, *, user: str, role: str = "user") -> Response:
        order = self.orders.get(order_id)
        if order is None:
            return Response(404, {"error": "ORDER_NOT_FOUND", "back_path": "/orders"})
        if role != "admin" and order["owner"] != user:
            return Response(403, {"error": "ORDER_FORBIDDEN"})
        return Response(200, {"order_id": order_id, **order})

    def list_items(self, *, cursor: int | None = None, page_size: int = 2) -> Response:
        if not 1 <= page_size <= 3:
            return Response(400, {"error": "PAGE_SIZE_RANGE", "allowed": "1..3"})
        start = 0
        if cursor is not None:
            if cursor not in self.items:
                return Response(400, {"error": "INVALID_CURSOR"})
            start = self.items.index(cursor) + 1
        page = self.items[start : start + page_size]
        next_cursor = page[-1] if len(page) == page_size else None
        return Response(200, {"ids": page, "next_cursor": next_cursor})

    def insert_latest_item(self) -> int:
        item_id = max(self.items) + 1
        self.items.insert(0, item_id)
        return item_id

    def update_activity(self, version: int, name: str) -> Response:
        if version != self.activity["version"]:
            return Response(
                409,
                {
                    "error": "VERSION_CONFLICT",
                    "current": self.activity.copy(),
                    "preserve_input": name,
                    "next_action": "merge",
                },
            )
        self.activity = {"version": version + 1, "name": name}
        return Response(200, self.activity.copy())

    def pay_order(self, order_id: str) -> Response:
        order = self.orders[order_id]
        if order["status"] != "pending":
            return Response(409, {"error": "ILLEGAL_STATE_TRANSITION"})
        order["status"] = "paid"
        return Response(200, {"order_id": order_id, "status": "paid"})

    @staticmethod
    def rate_limited(*, waited_retry_after: bool = False) -> Response:
        if waited_retry_after:
            return Response(200, {"recovered": True})
        return Response(429, {"error": "RATE_LIMITED", "retry_after_seconds": 2})

    @staticmethod
    def unknown_error() -> Response:
        return Response(
            500,
            {
                "error": "INTERNAL_ERROR",
                "request_id": "req-500-001",
                "next_action": "retry_later",
            },
        )


def result(case_id: str, responses: list[Response], ok: bool, note: str) -> CaseResult:
    return CaseResult(case_id, tuple(responses), ok, note)


def auth_01() -> CaseResult:
    api = DemoAPI()
    before = len(api.orders)
    response = api.create_order("auth-01", user=None)
    return result("AUTH-01", [response], len(api.orders) == before, "401 后订单数不变")


def auth_02() -> CaseResult:
    api = DemoAPI()
    response = api.get_order("O900", user="bob")
    return result("AUTH-02", [response], "owner" not in response.body, "未泄露他人订单内容")


def auth_03() -> CaseResult:
    api = DemoAPI()
    response = api.get_order("O900", user="admin", role="admin")
    return result("AUTH-03", [response], response.body.get("order_id") == "O900", "管理员读取授权数据")


def idem_01() -> CaseResult:
    api = DemoAPI()
    responses = [api.create_order("same-key") for _ in range(3)]
    ids = [response.body["order_id"] for response in responses]
    return result(
        "IDEM-01",
        responses,
        len(api.orders) == 2 and len(set(ids)) == 1,
        "首次 201，两次重放 200，且只新增 1 单",
    )


def idem_02() -> CaseResult:
    api = DemoAPI()
    responses = [api.create_order("key-a"), api.create_order("key-b")]
    ids = [response.body["order_id"] for response in responses]
    return result("IDEM-02", responses, len(set(ids)) == 2, "不同幂等键创建 2 单")


def idem_03() -> CaseResult:
    api = DemoAPI()
    responses = [
        api.create_order("timeout-key", timeout_after_commit=True),
        api.create_order("timeout-key"),
    ]
    replay = responses[1]
    return result(
        "IDEM-03",
        responses,
        len(api.orders) == 2 and replay.body.get("replayed") is True,
        "超时后用原键找回原订单",
    )


def page_01() -> CaseResult:
    api = DemoAPI()
    responses: list[Response] = []
    cursor = None
    ids: list[int] = []
    for _ in range(3):
        response = api.list_items(cursor=cursor)
        responses.append(response)
        ids.extend(response.body["ids"])
        cursor = response.body["next_cursor"]
    return result("PAGE-01", responses, ids == [6, 5, 4, 3, 2, 1], "3 页无重复无遗漏")


def page_02() -> CaseResult:
    api = DemoAPI()
    first = api.list_items()
    inserted = api.insert_latest_item()
    second = api.list_items(cursor=first.body["next_cursor"])
    combined = first.body["ids"] + second.body["ids"]
    ok = combined == [6, 5, 4, 3] and inserted not in second.body["ids"]
    return result("PAGE-02", [first, second], ok, "插入新数据不破坏旧游标的稳定顺序")


def page_03() -> CaseResult:
    response = DemoAPI().list_items(page_size=0)
    return result("PAGE-03", [response], response.body.get("allowed") == "1..3", "明确提示合法范围")


def page_04() -> CaseResult:
    response = DemoAPI().list_items(page_size=4)
    return result("PAGE-04", [response], response.body.get("allowed") == "1..3", "超上限按契约拒绝")


def conflict_01() -> CaseResult:
    api = DemoAPI()
    response = api.update_activity(3, "开学季-A")
    return result("CONFLICT-01", [response], api.activity["version"] == 4, "版本 3 成功更新为 4")


def conflict_02() -> CaseResult:
    api = DemoAPI()
    api.update_activity(3, "开学季-A")
    response = api.update_activity(3, "开学季-B")
    ok = response.body.get("preserve_input") == "开学季-B" and api.activity["name"] == "开学季-A"
    return result("CONFLICT-02", [response], ok, "拒绝旧版本并保留客户端输入")


def state_01() -> CaseResult:
    api = DemoAPI()
    response = api.pay_order("O900")
    return result("STATE-01", [response], api.orders["O900"]["status"] == "paid", "pending 可转 paid")


def state_02() -> CaseResult:
    api = DemoAPI()
    api.orders["O900"]["status"] = "cancelled"
    response = api.pay_order("O900")
    return result("STATE-02", [response], api.orders["O900"]["status"] == "cancelled", "cancelled 不可转 paid")


def rate_01() -> CaseResult:
    response = DemoAPI.rate_limited()
    ok = response.body.get("retry_after_seconds") == 2
    return result("RATE-01", [response], ok, "429 携带 Retry-After 语义")


def rate_02() -> CaseResult:
    responses = [DemoAPI.rate_limited(), DemoAPI.rate_limited(waited_retry_after=True)]
    return result("RATE-02", responses, responses[1].body.get("recovered") is True, "等待后仅重试 1 次并恢复")


def error_01() -> CaseResult:
    response = DemoAPI().create_order("invalid-amount", amount=0)
    return result("ERROR-01", [response], "amount" in response.body.get("fix_hint", ""), "错误包含可执行改法")


def error_02() -> CaseResult:
    response = DemoAPI().get_order("O404", user="alice")
    return result("ERROR-02", [response], response.body.get("back_path") == "/orders", "404 提供返回路径")


def error_03() -> CaseResult:
    api = DemoAPI()
    timeout = api.create_order("dependency-timeout", timeout_after_commit=True)
    order_id = api.idempotency["dependency-timeout"]
    query = api.get_order(order_id, user="alice")
    return result("ERROR-03", [timeout, query], len(api.orders) == 2, "超时后可查原结果且未重复创建")


def error_04() -> CaseResult:
    response = DemoAPI.unknown_error()
    ok = bool(response.body.get("request_id")) and response.body.get("next_action") == "retry_later"
    return result("ERROR-04", [response], ok, "500 包含 request_id 和后续动作")


CASE_RUNNERS: dict[str, Callable[[], CaseResult]] = {
    "AUTH-01": auth_01,
    "AUTH-02": auth_02,
    "AUTH-03": auth_03,
    "IDEM-01": idem_01,
    "IDEM-02": idem_02,
    "IDEM-03": idem_03,
    "PAGE-01": page_01,
    "PAGE-02": page_02,
    "PAGE-03": page_03,
    "PAGE-04": page_04,
    "CONFLICT-01": conflict_01,
    "CONFLICT-02": conflict_02,
    "STATE-01": state_01,
    "STATE-02": state_02,
    "RATE-01": rate_01,
    "RATE-02": rate_02,
    "ERROR-01": error_01,
    "ERROR-02": error_02,
    "ERROR-03": error_03,
    "ERROR-04": error_04,
}


def load_matrix() -> list[dict[str, str]]:
    with MATRIX_PATH.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    case_ids = [row["case_id"] for row in rows]
    if len(case_ids) != 20 or len(set(case_ids)) != 20:
        raise ValueError("权威 CSV 必须恰好包含 20 个唯一用例 ID")
    if set(case_ids) != set(CASE_RUNNERS):
        missing = sorted(set(case_ids) - set(CASE_RUNNERS))
        extra = sorted(set(CASE_RUNNERS) - set(case_ids))
        raise ValueError(f"模拟器与 CSV 用例不一致：未覆盖={missing}，多余={extra}")
    return rows


def parse_http_sequence(value: str) -> tuple[int, ...]:
    try:
        return tuple(int(part.strip()) for part in value.split("→"))
    except ValueError as exc:
        raise ValueError(f"无法解析 expected_http={value!r}，请使用如 201→200 的格式") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description="执行 W7 的 API/核心业务教学模拟")
    parser.add_argument("--case", help="只执行一个用例，例如 IDEM-01")
    args = parser.parse_args()

    rows = load_matrix()
    selected = rows
    if args.case:
        selected = [row for row in rows if row["case_id"] == args.case]
        if not selected:
            parser.error(f"未知用例 {args.case}")

    failures = 0
    for row in selected:
        case = CASE_RUNNERS[row["case_id"]]()
        observed = tuple(response.http for response in case.responses)
        expected = parse_http_sequence(row["expected_http"])
        passed = observed == expected and case.business_ok
        failures += not passed
        status = "PASS" if passed else "FAIL"
        observed_text = "→".join(map(str, observed))
        print(f"{status} {case.case_id} HTTP {observed_text} | {case.observation}")
        if observed != expected:
            print(f"  期望 HTTP: {'→'.join(map(str, expected))}")
        if not case.business_ok:
            print("  核心业务断言未通过")

    print(f"\n可执行覆盖：{len(selected)}/{len(rows)} 条（API 状态码 + 核心业务状态）")
    print("边界声明：页面文案、真实数据库和日志证据仍需在目标系统中人工验收。")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
