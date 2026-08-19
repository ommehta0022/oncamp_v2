import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVER_SOURCE = (ROOT / "server.py").read_text(encoding="utf-8")
MOBILE_API_SOURCE = (ROOT / "frontend" / "src" / "lib" / "api.ts").read_text(encoding="utf-8")
SERVER_TREE = ast.parse(SERVER_SOURCE)


def find_node(name: str, node_type: type[ast.AST]) -> ast.AST:
    for node in ast.walk(SERVER_TREE):
        if isinstance(node, node_type) and getattr(node, "name", None) == name:
            return node
    raise AssertionError(f"{name} not found in server.py")


class InstitutionOtpRegressionTests(unittest.TestCase):
    def test_released_apk_payload_does_not_require_phone(self):
        dto = find_node("VerifyInstitutionOtpDto", ast.ClassDef)
        phone_field = next(
            node
            for node in dto.body
            if isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and node.target.id == "phone"
        )

        self.assertIsInstance(phone_field.value, ast.Constant)
        self.assertIsNone(phone_field.value.value)
        self.assertIn("Optional", ast.unparse(phone_field.annotation))

    def test_backend_falls_back_from_identifier_to_phone(self):
        handler = find_node("verify_institution_otp", ast.FunctionDef)
        source = ast.get_source_segment(SERVER_SOURCE, handler) or ""

        self.assertIn("payload.identifier or payload.phone", source)
        self.assertIn("payload.phone or registered_phone", source)
        self.assertIn("verify_phone_otp_code(registered_phone, code)", source)

    def test_new_mobile_build_also_sends_phone(self):
        self.assertIn('"/auth/institution/otp/verify"', MOBILE_API_SOURCE)
        self.assertIn('{ phone: identifier }', MOBILE_API_SOURCE)


class LatencyRegressionTests(unittest.TestCase):
    def test_high_traffic_endpoints_use_single_rpc_calls(self):
        expected = {
            "feed": "oncampus_fast_feed",
            "my_groups": "oncampus_my_groups",
            "discover_groups": "oncampus_discovery_groups",
            "create_auth_session_for_user": "oncampus_create_auth_session",
        }

        for function_name, rpc_name in expected.items():
            with self.subTest(function=function_name):
                function = find_node(function_name, ast.FunctionDef)
                source = ast.get_source_segment(SERVER_SOURCE, function) or ""
                self.assertIn(rpc_name, source)

    def test_platform_settings_use_one_batched_query(self):
        function = find_node("public_platform_settings", ast.FunctionDef)
        source = ast.get_source_segment(SERVER_SOURCE, function) or ""

        self.assertIn('"key": f"in.({keys})"', source)
        self.assertEqual(source.count('db.get("system_settings"'), 1)


if __name__ == "__main__":
    unittest.main()
