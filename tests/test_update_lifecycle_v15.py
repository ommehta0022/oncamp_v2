import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPDATE_GATE = (ROOT / "frontend" / "src" / "components" / "AppUpdateGate.tsx").read_text(encoding="utf-8")
COORDINATOR = (ROOT / "frontend" / "src" / "components" / "ServerUpdateCoordinator.tsx").read_text(encoding="utf-8")
APP_JSON = json.loads((ROOT / "frontend" / "app.json").read_text(encoding="utf-8"))
MANIFEST = (ROOT / "frontend" / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(encoding="utf-8")


class UpdateLifecycleV15Tests(unittest.TestCase):
    def test_background_campaign_never_uses_manual_update_mode(self):
        self.assertIn('checkForAppUpdate("campaign", true, true)', COORDINATOR)
        self.assertNotIn("checkForAppUpdate(true)", COORDINATOR)

    def test_stale_retry_state_is_not_persisted(self):
        self.assertIn("PENDING_OTA_KEY", UPDATE_GATE)
        self.assertIn("reconcileAppliedUpdate", UPDATE_GATE)
        self.assertIn("emitUpdateUi(INITIAL_UI)", UPDATE_GATE)
        self.assertIn('if (mode === "manual")', UPDATE_GATE)
        self.assertNotIn('message: "Update could not be installed"', UPDATE_GATE)

    def test_success_is_shown_once_per_applied_identity(self):
        self.assertIn("SUCCESS_SHOWN_KEY", UPDATE_GATE)
        self.assertIn("successShown !== identity", UPDATE_GATE)
        self.assertIn('phase: "applied"', UPDATE_GATE)
        self.assertIn("You will not see this message again for this version", UPDATE_GATE)

    def test_up_to_date_alert_is_not_automatic(self):
        self.assertNotIn("You're up to date", UPDATE_GATE)
        self.assertIn('if (mode === "manual")', UPDATE_GATE)
        self.assertIn("No update available", UPDATE_GATE)

    def test_v15_native_runtime_and_microphone_permission(self):
        expo = APP_JSON["expo"]
        self.assertEqual(expo["version"], "1.5.0")
        self.assertEqual(expo["runtimeVersion"], "1.5.0")
        self.assertEqual(expo["extra"]["otaRuntimeVersion"], "1.5.0")
        self.assertIn("RECORD_AUDIO", expo["android"]["permissions"])
        self.assertIn("android.permission.RECORD_AUDIO", MANIFEST)


if __name__ == "__main__":
    unittest.main()
