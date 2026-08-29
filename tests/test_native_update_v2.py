from pathlib import Path

import native_update_v2


ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_v2_semver_maps_to_android_version_code() -> None:
    assert native_update_v2._version_code("1.7.0") == 10700
    assert native_update_v2._version_code("2.3.4") == 20304


def test_production_registers_native_v2_routes() -> None:
    source = text("production_server.py")
    assert "native_update_v2_router" in source
    assert 'app.include_router(native_update_v2_router)' in source
    for route in (
        '"/v1/updates/v2/latest"',
        '"/v1/updates/v2/apk/{version}"',
        '"/v1/updates/v2/telemetry"',
    ):
        assert route in source


def test_v2_backend_is_first_party_resumable_and_observable() -> None:
    source = text("native_update_v2.py")
    assert 'transport": "native-apk"' in source
    assert '"requireSameSigningCertificate": True' in source
    assert '"requireHigherVersionCode": True' in source
    assert 'headers["Range"] = requested_range' in source
    assert 'upstream.status_code != 206' in source
    assert '"Accept-Ranges"' in source
    assert '"Content-Range"' in source
    assert '"X-Checksum-Sha256"' in source
    assert '@router.post("/v1/updates/v2/telemetry")' in source
    assert "Native OTA v2 trace=%s stage=%s" in source


def test_final_android_binary_disables_legacy_expo_remote_ota() -> None:
    app = text("frontend/app.json")
    manifest = text("frontend/android/app/src/main/AndroidManifest.xml")
    layout = text("frontend/app/_layout.tsx")
    assert '"version": "1.7.0"' in app
    assert '"versionCode": 10700' in app
    assert '"enabled": false' in app
    assert '"updateEngine": "native-apk-v2"' in app
    assert 'expo.modules.updates.ENABLED" android:value="false"' in manifest
    assert "EXPO_UPDATES_URL" not in manifest
    assert "BackgroundOtaCoordinator" not in layout
    assert "NativeOtaStartupGuard" not in layout


def test_v2_native_client_verifies_hash_package_version_and_signer() -> None:
    source = text("frontend/android/app/src/main/java/com/oncampus/app/OnCampusApkInstallerModule.kt")
    assert "DownloadManager" in source
    assert 'uri.path == "/v1/updates/v2/apk/$targetVersion"' in source
    assert "APK checksum verification failed" in source
    assert "getPackageArchiveInfo" in source
    assert "archive.packageName != reactContext.packageName" in source
    assert "archiveVersionCode != expectedVersionCode" in source
    assert "archiveVersionCode <= installedVersionCode()" in source
    assert "PackageManager.GET_SIGNING_CERTIFICATES" in source
    assert "apkContentsSigners" in source
    assert "signingCertificateHistory" in source
    assert "installedCertificate != archiveCertificate" in source
    assert "fun getStatus(" in source
    assert "reconcileInstalledTarget()" in source
    assert "github.com" not in source


def test_v2_ui_and_polling_do_not_depend_on_expo_updates() -> None:
    gate = text("frontend/src/components/AppUpdateGate.tsx")
    coordinator = text("frontend/src/components/ServerUpdateCoordinator.tsx")
    assert "expo-updates" not in gate
    assert "prefetchLatestOta" not in gate
    assert "/updates/v2/latest" in gate
    assert "/updates/v2/telemetry" in gate
    assert "nativeInstaller.getStatus()" in gate
    assert "nativeInstaller.startInstall(" in gate
    assert "expo-updates" not in coordinator
    assert "Updates.isEnabled" not in coordinator
    assert 'UPDATE_ENGINE_ID = "native-apk-v2"' in coordinator
