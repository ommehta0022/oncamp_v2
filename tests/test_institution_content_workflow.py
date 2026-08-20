import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / "institution_content_workflow.py").read_text(encoding="utf-8")
PRODUCTION = (ROOT / "production_server.py").read_text(encoding="utf-8")
FEED = (ROOT / "frontend" / "app" / "(tabs)" / "feed.tsx").read_text(encoding="utf-8")
POST_CARD = (ROOT / "frontend" / "src" / "components" / "PostCard.tsx").read_text(encoding="utf-8")
EDITOR = (ROOT / "frontend" / "app" / "institution" / "content-create.tsx").read_text(encoding="utf-8")
DETAIL = (ROOT / "frontend" / "app" / "institution" / "content-request" / "[id].tsx").read_text(encoding="utf-8")
NOTIFICATIONS = (ROOT / "frontend" / "app" / "(tabs)" / "notifications.tsx").read_text(encoding="utf-8")


class InstitutionContentSecurityTests(unittest.TestCase):
    def test_student_legacy_publishing_routes_are_server_guarded(self):
        self.assertIn('path == "/v1/posts"', PRODUCTION)
        self.assertIn('(repost|share)', PRODUCTION)
        self.assertIn('post-requests', PRODUCTION)
        self.assertIn('server.require_institution_admin(user)', PRODUCTION)

    def test_only_target_institution_can_review_and_publish(self):
        self.assertIn('side != "target"', WORKFLOW)
        self.assertIn('Only the receiving institution can approve', WORKFLOW)
        self.assertIn('Only the receiving institution can reject', WORKFLOW)
        self.assertIn('Only the receiving institution can publish', WORKFLOW)

    def test_only_source_can_revise_or_withdraw(self):
        self.assertIn('Only the sending institution can submit a revision', WORKFLOW)
        self.assertIn('Only the sending institution can withdraw', WORKFLOW)
        self.assertIn('row.get("status") != "changes_requested"', WORKFLOW)

    def test_group_destination_must_belong_to_target_institution(self):
        self.assertIn('"institution_id": f"eq.{institution_id}"', WORKFLOW)
        self.assertIn('Selected group does not belong to your institution', WORKFLOW)

    def test_publication_is_idempotent_per_destination(self):
        self.assertIn('"destination_key": f"eq.{key}"', WORKFLOW)
        self.assertIn('"duplicate": True', WORKFLOW)

    def test_notifications_cover_request_lifecycle(self):
        for event in ["created", "changes_requested", "revised", "approved", "rejected", "published"]:
            self.assertIn(f'event_type="{event}"', WORKFLOW)


class StudentSurfaceRegressionTests(unittest.TestCase):
    def test_student_feed_has_no_create_post_entry(self):
        self.assertNotIn('/create-post', FEED)
        self.assertNotIn('Composer', FEED)

    def test_generic_post_card_has_no_repost_or_share_action(self):
        self.assertNotIn('repeat-outline', POST_CARD)
        self.assertNotIn('Share.share', POST_CARD)
        self.assertNotIn('api.posts.repost', POST_CARD)


class InstitutionPublishingUiTests(unittest.TestCase):
    def test_editor_supports_direct_publish_and_cross_institution_request(self):
        self.assertIn('Publish here', EDITOR)
        self.assertIn('Request institution', EDITOR)
        self.assertIn('institutionContentApi.createPost', EDITOR)
        self.assertIn('institutionContentApi.createRequest', EDITOR)
        self.assertIn('saveDraft', EDITOR)

    def test_editor_has_rich_formatting_and_engagement_controls(self):
        for capability in ['bold', 'italic', 'heading', 'bullet', 'quote', 'link']:
            self.assertIn(f'insertFormatting("{capability}")', EDITOR)
        self.assertIn('Allow comments', EDITOR)
        self.assertIn('Allow reactions', EDITOR)

    def test_request_workspace_has_full_review_lifecycle(self):
        for method in ['requestChanges', 'revise', 'approve', 'reject', 'withdraw', 'publish']:
            self.assertIn(f'institutionContentApi.{method}', DETAIL)
        self.assertIn('Request timeline', DETAIL)
        self.assertIn('Published destinations', DETAIL)

    def test_notifications_deep_link_to_request_workspace(self):
        self.assertIn('institution_post_request', NOTIFICATIONS)
        self.assertIn('/institution/content-request/', NOTIFICATIONS)


if __name__ == "__main__":
    unittest.main()
