import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAMPUS_API = (ROOT / "frontend" / "src" / "lib" / "campusApi.ts").read_text(encoding="utf-8")
IMAGE_UPLOAD = (ROOT / "frontend" / "src" / "lib" / "imageUpload.ts").read_text(encoding="utf-8")
BUTTON = (ROOT / "frontend" / "src" / "components" / "Button.tsx").read_text(encoding="utf-8")
SETTINGS_ROW = (ROOT / "frontend" / "src" / "components" / "SettingsRow.tsx").read_text(encoding="utf-8")


class MobileResilienceTests(unittest.TestCase):
    def test_safe_student_surfaces_have_account_scoped_offline_cache(self):
        self.assertIn('accountCacheScope', CAMPUS_API)
        self.assertIn('cacheTtlMs', CAMPUS_API)
        self.assertIn('cache.get<T>', CAMPUS_API)
        self.assertIn('cache.set', CAMPUS_API)
        self.assertNotIn('digitalId: () => campusRequest<any>("/campus/digital-id", { cacheTtlMs:', CAMPUS_API)
        self.assertNotIn('emergency: () => campusRequest<any[]>("/campus/emergency", { cacheTtlMs:', CAMPUS_API)

    def test_get_retry_uses_new_timeout_controller_per_attempt(self):
        self.assertIn('const attempts = method === "GET" ? 3 : 1', CAMPUS_API)
        self.assertIn('const controller = new AbortController()', CAMPUS_API)
        self.assertIn('300 * (2 ** attempt)', CAMPUS_API)

    def test_photos_are_recompressed_but_video_and_pdf_are_preserved(self):
        self.assertIn('ImageManipulator.manipulateAsync', IMAGE_UPLOAD)
        self.assertIn('compressPhoto', IMAGE_UPLOAD)
        self.assertIn('extension === "pdf" || VIDEO_EXTENSIONS.has(extension)', IMAGE_UPLOAD)


class AccessibilityRegressionTests(unittest.TestCase):
    def test_shared_buttons_have_semantics_state_and_scaling(self):
        self.assertIn('accessibilityRole="button"', BUTTON)
        self.assertIn('accessibilityState=', BUTTON)
        self.assertIn('allowFontScaling', BUTTON)
        self.assertIn('maxFontSizeMultiplier', BUTTON)

    def test_settings_rows_expose_single_readable_accessible_label(self):
        self.assertIn('accessibilityLabel={accessibleLabel}', SETTINGS_ROW)
        self.assertIn('accessibilityHint=', SETTINGS_ROW)
        self.assertIn('allowFontScaling', SETTINGS_ROW)


if __name__ == "__main__":
    unittest.main()
