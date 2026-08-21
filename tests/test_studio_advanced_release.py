from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_studio_media_assignment_backend_contracts_exist():
    source = read("institution_studio_operations.py")
    assert '@router.patch("/announcements/{item_id}")' in source
    assert '@router.patch("/departments/{item_id}")' in source
    assert '"avatarUrl": "avatar_url"' in source
    assert '"metadata": "metadata"' in source
    assert 'media_url' in source


def test_studio_advanced_editor_and_media_center_are_real_ui():
    kit = read("admin-panel/src/components/StudioKit.tsx")
    content = read("admin-panel/src/app/studio/content/page.tsx")
    media = read("admin-panel/src/app/studio/media/page.tsx")
    api = read("admin-panel/src/lib/institutionStudioApi.ts")
    assert "StudioRichEditor" in kit
    assert "StudioMediaUploader" in kit
    assert "Campus announcement" in kit and "Event promotion" in kit
    assert "upload.onprogress" in api
    assert "updateStudioAnnouncement" in api
    assert "updateStudioDepartment" in api
    assert "Media Library & Image Assignment" in media
    for target in ["profile-cover", "group-avatar", "department-cover", "event-cover", "opportunity-cover", "place-cover", "announcement-cover"]:
        assert target in media
    assert "Student preview" in content
    assert "Publish now" in content
    assert "Schedule" in content


def test_studio_zoom_responsiveness_contract():
    css = read("admin-panel/src/app/studio/studio.css")
    layout = read("admin-panel/src/app/studio/layout.tsx")
    shell = read("admin-panel/src/components/InstitutionStudioShell.tsx")
    assert 'import "./studio.css"' in layout
    assert ".studio-responsive" in css
    for breakpoint in ["1439px", "1180px", "900px", "720px", "480px", "2200px"]:
        assert breakpoint in css
    assert "studio-sidebar-desktop" in shell
    assert "studio-main-offset" in shell
    assert "Media Library" in shell
    assert "studio-click-feedback" in shell


def test_discover_and_institution_profile_use_fast_cache_first_reads():
    source = read("frontend/src/lib/campusApi.ts")
    assert "preferCache?: boolean" in source
    assert "memoryCache" in source
    assert 'institutions: (filters:' in source
    assert 'cacheTtlMs: MINUTE, preferCache: true' in source
    assert 'institutionProfile: (id: string)' in source
    assert 'cacheTtlMs: 5 * MINUTE, preferCache: true' in source
    assert "void cache.set" in source
