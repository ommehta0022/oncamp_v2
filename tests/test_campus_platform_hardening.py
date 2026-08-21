import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARDENING = (ROOT / "campus_platform_hardening.py").read_text(encoding="utf-8")
PRODUCTION = (ROOT / "production_server.py").read_text(encoding="utf-8")
POST_REQUEST = (ROOT / "frontend" / "app" / "group" / "post-request" / "[id].tsx").read_text(encoding="utf-8")
SHARE_MODAL = (ROOT / "frontend" / "src" / "components" / "SharePostModal.tsx").read_text(encoding="utf-8")
VOICE_NOTE = (ROOT / "frontend" / "src" / "components" / "VoiceNoteRecorder.tsx").read_text(encoding="utf-8")


class CampusTenantIsolationTests(unittest.TestCase):
    def test_hardening_router_is_registered_before_legacy_router(self):
        hardening_pos = PRODUCTION.index("app.include_router(campus_platform_hardening_router)")
        legacy_pos = PRODUCTION.index("app.include_router(campus_platform_router)")
        self.assertLess(hardening_pos, legacy_pos)

    def test_global_search_scopes_every_campus_dataset(self):
        self.assertIn('groups = platform._search_table', HARDENING)
        self.assertIn('{"institution_id": f"eq.{iid}", "deleted_at": "is.null"}', HARDENING)
        for table in ["posts", "campus_events", "campus_opportunities", "campus_marketplace_items", "campus_lost_found_items"]:
            self.assertIn(f'"{table}"', HARDENING)

    def test_trending_hashtags_are_derived_only_from_tenant_posts(self):
        self.assertIn('post_ids = {str(row["id"]) for row in posts}', HARDENING)
        self.assertIn('if str(row.get("post_id")) not in post_ids', HARDENING)

    def test_reactions_and_polls_require_visible_tenant_post(self):
        self.assertGreaterEqual(HARDENING.count("_visible_post("), 5)
        self.assertIn('"institution_id": f"eq.{iid}"', HARDENING)
        self.assertIn('"status": "eq.published"', HARDENING)


class CampusInviteTests(unittest.TestCase):
    def test_invites_support_campus_group_and_event(self):
        self.assertIn('Literal["institution", "group", "event"]', HARDENING)
        self.assertIn('table = "groups" if invite_type == "group" else "campus_events"', HARDENING)
        self.assertIn('invite_type == "event"', HARDENING)
        self.assertIn('"campus_event_rsvps"', HARDENING)

    def test_group_and_event_invites_require_verified_same_institution_membership(self):
        self.assertIn('membership = platform.student_membership(user.id)', HARDENING)
        self.assertIn('This invite belongs to another institution', HARDENING)

    def test_invite_targets_are_validated_before_creation_and_acceptance(self):
        self.assertGreaterEqual(HARDENING.count("_validate_invite_target("), 3)
        self.assertIn('Invite expiry must be in the future', HARDENING)


class ProductScopeRegressionTests(unittest.TestCase):
    def test_student_post_request_route_is_retired(self):
        self.assertNotIn("api.groups.postRequest", POST_REQUEST)
        self.assertIn('router.replace("/(tabs)/feed"', POST_REQUEST)

    def test_legacy_student_share_modal_cannot_submit(self):
        self.assertNotIn("api.institutions.postRequest", SHARE_MODAL)
        self.assertIn("return null", SHARE_MODAL)

    def test_voice_notes_are_not_exposed(self):
        self.assertNotIn("expo-audio", VOICE_NOTE)
        self.assertNotIn("requestRecordingPermissionsAsync", VOICE_NOTE)
        self.assertIn("return null", VOICE_NOTE)


if __name__ == "__main__":
    unittest.main()
