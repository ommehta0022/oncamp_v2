import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPDATE_GATE = (ROOT / "frontend" / "src" / "components" / "AppUpdateGate.tsx").read_text(encoding="utf-8")
COORDINATOR = (ROOT / "frontend" / "src" / "components" / "ServerUpdateCoordinator.tsx").read_text(encoding="utf-8")
APP_JSON = json.loads((ROOT / "frontend" / "app.json").read_text(encoding="utf-8"))
MANIFEST = (ROOT / "frontend" / "android" / "app" / "src" / "main" / "AndroidManifest.xml").read_text(encoding="utf-8")
STRINGS = (ROOT / "frontend" / "android" / "app" / "src" / "main" / "res" / "values" / "strings.xml").read_text(encoding="utf-8")


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
        self.assertIn("only see this confirmation once", UPDATE_GATE)

    def test_up_to_date_ui_is_manual_only(self):
        self.assertIn('if (mode === "manual")', UPDATE_GATE)
        self.assertIn('phase: "current"', UPDATE_GATE)
        self.assertIn("has no newer compatible OTA or Android release right now", UPDATE_GATE)
        self.assertIn('if (mode === "automatic")', UPDATE_GATE)

    def test_later_is_persisted_and_manual_checks_bypass_deferral(self):
        self.assertIn("DEFER_KEY", UPDATE_GATE)
        self.assertIn("DEFER_MS", UPDATE_GATE)
        self.assertIn('mode === "manual" || force', UPDATE_GATE)
        self.assertIn("deferUpdate", UPDATE_GATE)

    def test_current_native_runtime_and_microphone_permission(self):
        expo = APP_JSON["expo"]
        version = expo["version"]
        runtime = expo["runtimeVersion"]
        self.assertRegex(version, r"^\d+\.\d+\.\d+$")
        self.assertEqual(runtime, version)
        self.assertEqual(expo["extra"]["otaRuntimeVersion"], runtime)
        self.assertIn(f'<string name="expo_runtime_version" translatable="false">{runtime}</string>', STRINGS)
        self.assertIn("RECORD_AUDIO", expo["android"]["permissions"])
        self.assertIn("android.permission.RECORD_AUDIO", MANIFEST)


if __name__ == "__main__":
    unittest.main()
