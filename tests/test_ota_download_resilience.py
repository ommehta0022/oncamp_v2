from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PRODUCTION = (ROOT / "production_server.py").read_text(encoding="utf-8")
BACKGROUND = (ROOT / "frontend" / "src" / "updates" / "backgroundOta.ts").read_text(encoding="utf-8")
WORKFLOW = (ROOT / ".github" / "workflows" / "ota-update.yml").read_text(encoding="utf-8")


def test_manifest_uses_oncampus_asset_relay_not_direct_client_github_downloads():
    assert '"/v1/updates/assets/{runtime_version}/{asset_name}"' in PRODUCTION
    assert "_ota_rewrite_manifest_for_client" in PRODUCTION
    assert 'asset["url"] = f"{origin}/v1/updates/assets/{runtime}/{name}"' in PRODUCTION
    assert "return ota_updates.expo_updates_manifest(request)" not in PRODUCTION
    assert "ota_updates._sign_manifest(body)" in PRODUCTION


def test_asset_relay_is_integrity_checked_cached_and_resumable():
    assert "_ota_fetch_verified_asset" in PRODUCTION
    assert "actual_hash != expected_hash" in PRODUCTION
    assert "OTA asset integrity verification failed" in PRODUCTION
    assert "_ota_asset_cache" in PRODUCTION
    assert '"Cache-Control": "public, max-age=31536000, immutable"' in PRODUCTION
    assert '"Accept-Ranges": "bytes"' in PRODUCTION
    assert '"Content-Range": f"bytes {start}-{end}/{total}"' in PRODUCTION
    assert '"Content-Length": str(len(segment))' in PRODUCTION
    assert "status_code=206" in PRODUCTION
    assert "status_code=416" in PRODUCTION


def test_ota_asset_relay_only_serves_promoted_content_addressed_assets():
    assert 're.fullmatch(r"(?:launch|asset)-[0-9a-f]{64}' in PRODUCTION
    assert "_ota_asset_record(source, asset_name)" in PRODUCTION
    assert "OTA asset is not part of the promoted release" in PRODUCTION
    assert "ota_updates.fetch_latest_source(runtime_version)" in PRODUCTION


def test_mobile_download_does_not_retry_fetch_update_in_a_loop():
    assert "FETCH_ATTEMPTS" not in BACKGROUND
    assert "fetchUpdateWithRetry" not in BACKGROUND
    assert "fetchUpdateOnce" in BACKGROUND
    assert BACKGROUND.count("Updates.fetchUpdateAsync()") == 1
    assert "getLastOtaPrefetchError" in BACKGROUND
    assert "retry storm" in BACKGROUND


def test_ota_workflow_still_verifies_production_delivery():
    assert "Verify production OTA delivery end to end" in WORKFLOW
    assert "ACTUAL_MANIFEST_ID" in WORKFLOW
