import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPS = (ROOT / "campus_ops_extension.py").read_text(encoding="utf-8")
AI = (ROOT / "campus_ai.py").read_text(encoding="utf-8")
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

    def test_all_campus_routes_have_boundary_rate_limit(self):
        self.assertIn("async def campus_rate_limit", PRODUCTION)
        self.assertIn('request.url.path.startswith("/v1/campus/")', PRODUCTION)
        self.assertIn("server.redis.check_rate_limit", PRODUCTION)
        self.assertIn("_local_rate_allowed", PRODUCTION)
        self.assertIn('status_code=429', PRODUCTION)


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
        self.assertIn("CameraView", JOIN)
        self.assertIn('barcodeScannerSettings={{ barcodeTypes: ["qr"] }}', JOIN)
        self.assertIn("campusApi.student.invite", JOIN)
        self.assertIn("campusApi.student.acceptInvite", JOIN)
        self.assertIn("extractInviteCode", JOIN)

    def test_native_release_has_camera_deep_link_and_current_runtime(self):
        self.assertIn('"scheme": "oncampus"', APP_CONFIG)
        self.assertIn('"CAMERA"', APP_CONFIG)
        self.assertIn('"version": "1.5.1"', APP_CONFIG)
        self.assertIn('"runtimeVersion": "1.5.0"', APP_CONFIG)


class AiProviderSafetyTests(unittest.TestCase):
    def test_ai_requires_real_external_provider_configuration(self):
        self.assertIn("ONCAMPUS_AI_API_URL", AI)
        self.assertIn("ONCAMPUS_AI_API_KEY", AI)
        self.assertIn("ONCAMPUS_AI_MODEL", AI)
        self.assertIn("AI provider is not configured", AI)
        self.assertIn('"fabricatedFallback": False', AI)

    def test_ai_output_is_schema_validated_and_rate_limited(self):
        self.assertIn("_normalized_result", AI)
        self.assertIn("numeric score", AI)
        self.assertIn('@server.limiter.limit("20/minute")', AI)
        self.assertIn('require_operator("moderation.review")', AI)

    def test_ai_routes_are_required_at_startup(self):
        self.assertIn('"/v1/campus/ai/status"', PRODUCTION)
        self.assertIn('"/v1/campus/institution/ai/analyze"', PRODUCTION)


if __name__ == "__main__":
    unittest.main()
