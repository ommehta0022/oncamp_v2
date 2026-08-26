from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_student_create_post_route_redirects_to_feed():
    source = read("frontend/app/create-post.tsx")
    assert 'router.replace(canManageInstitution ? "/institution/content-create" as any : "/(tabs)/feed" as any)' in source


def test_student_and_group_roles_never_receive_post_composer_permission():
    source = read("frontend/src/context/RoleProvider.tsx")
    assert 'const canCreatePosts = role === "institution_admin" || role === "platform_admin";' in source
    assert '!!user?.canCreatePosts ||' not in source
    assert 'role === "group_owner" || role === "group_admin" || role === "platform_admin"' not in source.split("const canCreatePosts", 1)[1].split(";", 1)[0]


def test_group_profile_has_no_student_publishing_request_actions():
    source = read("frontend/app/group/info/[id].tsx")
    assert "Submit a post / poster request" not in source
    assert "Send request to institution" not in source
    assert "submit-post-request-btn" not in source
    assert "submit-institution-post-request-btn" not in source
    assert "/institution/post-request/" not in source
    assert "/group/post-request/" not in source


def test_legacy_institution_request_screen_is_redirect_only():
    source = read("frontend/app/institution/post-request/[id].tsx")
    assert 'router.replace("/(tabs)/feed" as any)' in source
    assert "api.institutions.postRequest" not in source
    assert "Submit institution request" not in source


def test_group_admin_no_longer_surfaces_student_post_requests():
    source = read("frontend/app/group/admin/[id].tsx")
    assert "api.groups.postRequests" not in source
    assert "Post / poster requests" not in source
    assert "Scheduled posts" not in source
    assert "/group/admin/post-requests/" not in source


def test_legacy_group_request_inbox_is_redirect_only():
    source = read("frontend/app/group/admin/post-requests/[id].tsx")
    assert "api.groups.postRequests" not in source
    assert "approvePostRequest" not in source
    assert "rejectPostRequest" not in source
    assert "Student post requests are retired." in source


def test_production_api_retires_request_creation_and_keeps_posting_admin_only():
    source = read("production_server.py")
    assert 'status_code=410' in source
    assert 'r"/v1/groups/[^/]+/post-requests"' in source
    assert 'r"/v1/institutions/[^/]+/post-requests"' in source
    assert '(method == "POST" and path == "/v1/posts")' in source
    assert "institution_admin_or_error(request)" in source


def test_discover_is_institution_focused_and_invite_join_remains_dedicated():
    discover = read("frontend/app/(tabs)/discover.tsx")
    join = read("frontend/app/join.tsx")
    assert "campusApi.student.institutions" in discover
    assert "/institution-profile/" in discover
    assert 'placeholder="Search campuses"' in discover
    assert "campusApi.student.invite(value)" in join
    assert "campusApi.student.acceptInvite(resolvedCode)" in join
    assert "Join by QR or code" in join
    assert "postRequest(" not in discover
    assert "/institution/post-request/" not in discover
