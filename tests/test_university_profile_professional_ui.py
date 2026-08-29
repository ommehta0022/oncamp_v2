from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def source() -> str:
    return (ROOT / "frontend/src/screens/InstitutionProfileV2.tsx").read_text(encoding="utf-8")


def test_profile_menu_is_clickable_and_routes_to_real_sections():
    ui = source()
    assert 'testID="institution-profile-menu"' in ui
    assert 'onPress={() => setMenuVisible(true)}' in ui
    assert "<OptionsMenu" in ui
    assert 'label: "About this campus"' in ui
    assert 'label: "Campus groups"' in ui
    assert 'label: "Events & opportunities"' in ui


def test_profile_removes_duplicate_visible_share_and_save_controls():
    ui = source()
    assert '<Identity institution={institution} onFollow={() => void toggleFollow()} />' in ui
    assert "bookmarked" not in ui
    assert "onBookmark" not in ui
    assert 'label="Save"' not in ui
    assert 'accessibilityLabel="Share campus profile"' in ui


def test_cover_logo_and_gallery_images_open_image_viewer():
    ui = source()
    assert 'accessibilityLabel={coverUrl ? "Open campus cover image" : "Campus cover"}' in ui
    assert 'accessibilityLabel={logoUrl ? "Open campus logo" : "Campus logo"}' in ui
    assert 'accessibilityLabel={isVideo ? "Campus video" : "Open campus image"}' in ui
    assert ui.count("<ImageViewer") >= 3


def test_name_spacing_and_verified_identity_are_professional():
    ui = source()
    assert 'identity: { paddingHorizontal: 18, paddingTop: 64' in ui
    assert 'const VERIFIED_BLUE = "#1D73E8"' in ui
    assert 'accessibilityLabel="Verified campus"' in ui
    assert 'accessibilityLabel="Verified official group"' not in ui  # groups tab badge does not misuse text tags


def test_gallery_view_all_is_functional_not_dead_text():
    ui = source()
    assert "galleryExpanded" in ui
    assert 'galleryExpanded ? "Show less" : "View all"' in ui
    assert 'onAction={gallery.length > 6 ? () => setGalleryExpanded((value) => !value) : undefined}' in ui
    assert "function Section({ title, subtitle, action, onAction, children }" in ui
    assert "<Pressable onPress={onAction}" in ui


def test_groups_remove_dead_see_all_and_misleading_join_action():
    ui = source()
    assert 'title="Featured Groups"' in ui
    assert 'title={featured.length ? "More Communities" : "Campus Communities"}' in ui
    assert 'action="See All"' not in ui
    assert ">Join<" not in ui
    assert ">Open group<" in ui


def test_events_and_opportunities_have_real_expand_controls_and_rsvp_api():
    ui = source()
    assert "showAllEvents" in ui
    assert "showAllOpportunities" in ui
    assert 'showAllEvents ? "Show less" : `View all ${events.length}`' in ui
    assert 'showAllOpportunities ? "Show less" : `View all ${opportunities.length}`' in ui
    assert 'await campusApi.student.rsvp(event.id, "going")' in ui
    assert 'await campusApi.student.followInstitution(institutionId)' in ui
    assert 'campusApi.student.institutionProfile(institutionId)' in ui


def test_profile_uses_section_shaped_animated_skeletons():
    ui = source()
    assert "InstitutionProfileSkeleton" in ui
    assert "LoadingSkeleton" in ui
    assert 'accessibilityLabel="Loading campus profile"' in ui
