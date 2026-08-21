import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPS = (ROOT / "campus_ops_extension.py").read_text(encoding="utf-8")
PRODUCTION = (ROOT / "production_server.py").read_text(encoding="utf-8")
SETTINGS = (ROOT / "frontend" / "app" / "institution" / "settings.tsx").read_text(encoding="utf-8")
GOVERNANCE = (ROOT / "frontend" / "app" / "institution" / "governance.tsx").read_text(encoding="utf-8")
JOIN = (ROOT / "frontend" / "app" / "join.tsx").read_text(encoding="utf-8")
APP_CONFIG = (ROOT / "frontend" / "app.json").read_text(encoding="utf-8")


class GovernanceBackendTests(unittest.TestCase):
    def test_audit_logs_are_institution_scoped(self):
        self.assertIn('"institution_id": f"eq.{ctx[\'institution_id\']}"', OPS)
        self.assertIn('"user_activity_events"', OPS)
        self.assertIn('require_operator("analytics.view")', OPS)

    def test_export_links_are_short_lived_and_signed(self):
        self.assertIn("timedelta(minutes=2)", OPS)
        self.assertIn("server.JWT_SECRET", OPS)
        self.assertIn('"kind": "institution_export"', OPS)
        self.assertIn('@server.limiter.limit("20/minute")', OPS)
        self.assertIn('@server.limiter.limit("30/minute")', OPS)

    def test_public_export_revalidates_signed_claims(self):
        self.assertIn("jwt.decode", OPS)
        self.assertIn("ExpiredSignatureError", OPS)
        self.assertIn("InvalidTokenError", OPS)
        self.assertIn("campus_platform.export_institution_data", OPS)

    def test_governance_routes_are_required_at_startup(self):
        self.assertIn('"/v1/campus/institution/audit-logs"', PRODUCTION)
        self.assertIn('"/v1/campus/institution/export-link"', PRODUCTION)
        self.assertIn('"/v1/campus/public/export"', PRODUCTION)


class GovernanceUiTests(unittest.TestCase):
    def test_roles_audit_and_exports_are_real_api_backed(self):
        self.assertIn("governanceApi.roles", GOVERNANCE)
        self.assertIn("governanceApi.auditLogs", GOVERNANCE)
        self.assertIn("governanceApi.exportLink", GOVERNANCE)
        self.assertIn("governanceApi.createRole", GOVERNANCE)
        self.assertIn("governanceApi.updateRole", GOVERNANCE)

    def test_student_post_request_setting_is_not_exposed(self):
        self.assertNotIn("allowExternalRequests", SETTINGS)
        self.assertIn("Student publishing requests and external post-sharing controls are intentionally not exposed", SETTINGS)


class InviteQrUiTests(unittest.TestCase):
    def test_join_screen_has_real_qr_scanner_and_live_api_validation(self):
        self.assertIn('CameraView', JOIN)
        self.assertIn('barcodeTypes: ["qr"]', JOIN)
        self.assertIn('campusApi.student.invite', JOIN)
        self.assertIn('campusApi.student.acceptInvite', JOIN)
        self.assertIn('extractInviteCode', JOIN)

    def test_existing_native_baseline_already_has_camera_and_deep_link_support(self):
        self.assertIn('"scheme": "oncampus"', APP_CONFIG)
        self.assertIn('"CAMERA"', APP_CONFIG)
        self.assertIn('"version": "1.4.0"', APP_CONFIG)
        self.assertIn('"runtimeVersion": "1.4.0"', APP_CONFIG)


if __name__ == "__main__":
    unittest.main()
