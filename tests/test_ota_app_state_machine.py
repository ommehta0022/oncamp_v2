from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UPDATE_GATE = (ROOT / "frontend" / "src" / "components" / "AppUpdateGate.tsx").read_text(encoding="utf-8")
INSTALLER = (ROOT / "frontend" / "android" / "app" / "src" / "main" / "java" / "com" / "oncampus" / "app" / "OnCampusApkInstallerModule.kt").read_text(encoding="utf-8")
LAYOUT = (ROOT / "frontend" / "app" / "_layout.tsx").read_text(encoding="utf-8")


def test_final_runtime_does_not_mount_legacy_expo_update_state_machine():
    assert "prefetchLatestOta" not in UPDATE_GATE
    assert "expo-updates" not in UPDATE_GATE
    assert "BackgroundOtaCoordinator" not in LAYOUT
    assert "NativeOtaStartupGuard" not in LAYOUT


def test_native_v2_recovers_os_owned_download_instead_of_starting_duplicate_transfer():
    assert "nativeInstaller.getStatus()" in UPDATE_GATE
    assert "await recoverNativeStatus()" in UPDATE_GATE
    assert "sameRelease" in INSTALLER
    assert "queryDownload(existingId)" in INSTALLER
    assert "monitorDownload(existingId)" in INSTALLER
    assert "DownloadManager" in INSTALLER
    assert "getSharedPreferences" in INSTALLER


def test_native_v2_only_marks_ready_after_all_local_integrity_checks():
    hash_check = INSTALLER.index("APK checksum verification failed")
    package_check = INSTALLER.index("archive.packageName != reactContext.packageName")
    version_check = INSTALLER.index("archiveVersionCode != expectedVersionCode")
    signer_check = INSTALLER.index("installedCertificate != archiveCertificate")
    ready = INSTALLER.index(".putBoolean(KEY_VERIFIED, true)")
    assert hash_check < ready
    assert package_check < ready
    assert version_check < ready
    assert signer_check < ready


def test_native_v2_surfaces_real_native_error_codes_to_visible_update_ui():
    assert 'putString("errorCode", "DOWNLOAD_$reason")' in INSTALLER
    assert 'errorCode = "VERIFY_FAILED"' in INSTALLER
    assert "event.errorCode" in UPDATE_GATE
    assert 'Code: {state.errorCode}' in UPDATE_GATE
    assert 'phase: "error"' in UPDATE_GATE
