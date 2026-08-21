import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "frontend" / "app" / "+html.tsx").read_text(encoding="utf-8")
MANIFEST = (ROOT / "frontend" / "public" / "manifest.webmanifest").read_text(encoding="utf-8")
SERVICE_WORKER = (ROOT / "frontend" / "public" / "sw.js").read_text(encoding="utf-8")
LANGUAGE = (ROOT / "frontend" / "src" / "context" / "LanguageProvider.tsx").read_text(encoding="utf-8")
LANGUAGE_SCREEN = (ROOT / "frontend" / "app" / "settings" / "language.tsx").read_text(encoding="utf-8")
TABS = (ROOT / "frontend" / "app" / "(tabs)" / "_layout.tsx").read_text(encoding="utf-8")
SETTINGS = (ROOT / "frontend" / "app" / "settings" / "index.tsx").read_text(encoding="utf-8")
MEDIA = (ROOT / "frontend" / "src" / "lib" / "imageUpload.ts").read_text(encoding="utf-8")
GROUP_COMPOSER = (ROOT / "frontend" / "src" / "components" / "GroupVoiceNoteButton.tsx").read_text(encoding="utf-8")


class PwaTests(unittest.TestCase):
    def test_web_is_installable_and_registers_service_worker(self):
        self.assertIn('rel="manifest"', HTML)
        self.assertIn("serviceWorker.register('/sw.js'", HTML)
        self.assertIn('"display": "standalone"', MANIFEST)
        self.assertIn('"purpose": "any maskable"', MANIFEST)

    def test_service_worker_never_caches_api_data(self):
        self.assertIn('url.pathname.startsWith("/v1/")', SERVICE_WORKER)
        self.assertIn('request.method !== "GET"', SERVICE_WORKER)
        self.assertIn('url.origin !== self.location.origin', SERVICE_WORKER)


class LocalizationTests(unittest.TestCase):
    def test_core_language_support_is_persistent(self):
        self.assertIn('type AppLanguage = "en" | "hi" | "mr"', LANGUAGE)
        self.assertIn("AsyncStorage.setItem", LANGUAGE)
        self.assertIn('useLanguage()', LANGUAGE_SCREEN)
        self.assertIn('t("nav.feed")', TABS)
        self.assertIn('t("settings.title")', SETTINGS)


class RichMediaTests(unittest.TestCase):
    def test_gif_is_preserved_and_not_flattened_by_image_compression(self):
        self.assertIn('if (extension === "gif") return "image/gif"', MEDIA)
        self.assertIn('PASSTHROUGH_IMAGE_EXTENSIONS = new Set(["gif"])', MEDIA)
        self.assertIn("pickGif", GROUP_COMPOSER)
        self.assertIn('type: "image"', GROUP_COMPOSER)

    def test_stickers_use_existing_authenticated_group_message_api(self):
        self.assertIn("StickerPicker", GROUP_COMPOSER)
        self.assertIn("api.groups.sendMessage", GROUP_COMPOSER)
        self.assertIn("client-sticker-", GROUP_COMPOSER)


if __name__ == "__main__":
    unittest.main()
