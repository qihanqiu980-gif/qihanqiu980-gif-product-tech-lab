import unittest

from validate_payload import validate


class ValidatePayloadTests(unittest.TestCase):
    def test_accepts_valid_object(self) -> None:
        self.assertEqual(validate({"name": "新用户", "color": "orange"}), [])

    def test_rejects_array_root_with_contract_error(self) -> None:
        self.assertEqual(
            validate([{"name": "新用户", "color": "orange"}]),
            ["JSON 根节点必须是 object，当前是 array"],
        )

    def test_rejects_null_root_with_contract_error(self) -> None:
        self.assertEqual(
            validate(None),
            ["JSON 根节点必须是 object，当前是 null"],
        )

    def test_rejects_scalar_root_with_contract_error(self) -> None:
        self.assertEqual(
            validate("not-an-object"),
            ["JSON 根节点必须是 object，当前是 str"],
        )


if __name__ == "__main__":
    unittest.main()
