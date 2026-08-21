import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_CONFIG = (ROOT / "frontend" / "app.json").read_text(encoding="utf-8")
JOIN = (ROOT / "frontend" / "app" / "group" / "join.tsx").read_text(encoding="utf-8")
SETTINGS = (ROOT / "frontend" / "app" / "(tabs)" / "settings.tsx").read_text(encoding="utf-8")
AI = (ROOT / "campus_ai.py").read_text(encoding="utf-8")


class StudentPublishingGuardTests(unittest.TestCase):
    def test_student_settings_do_not_expose_external_publishing_controls(self):
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


if __name__ == "__main__":
    unittest.main()
