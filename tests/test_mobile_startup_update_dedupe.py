from pathlib import Path


UPDATE_GATE = Path("frontend/src/components/AppUpdateGate.tsx")
INSTALLER = Path("frontend/android/app/src/main/java/com/oncampus/app/OnCampusApkInstallerModule.kt")


def test_startup_update_prompts_are_persistently_deduped():
    source = UPDATE_GATE.read_text(encoding="utf-8")
    assert "DEFER_KEY" in source
    assert "DEFER_MS" in source
    assert "readDeferred" in source
    assert "isDeferred" in source
    assert "deferUpdate" in source
    assert 'checkForAppUpdate("automatic")' in source
    assert "await recoverNativeStatus()" in source


def test_reopen_recovers_native_transfer_before_starting_an_automatic_check():
    source = UPDATE_GATE.read_text(encoding="utf-8")
    assert 'recoverNativeStatus().then((recovered) => { if (!recovered) void checkForAppUpdate("automatic"); })' in source
    installer = INSTALLER.read_text(encoding="utf-8")
    assert "KEY_DOWNLOAD_ID" in installer
    assert "fun getStatus(" in installer
    assert "prefs.getBoolean(KEY_VERIFIED, false)" in installer
    assert "monitorDownload(downloadId)" in installer


def test_automatic_checks_do_not_replace_a_recovered_native_update():
    source = UPDATE_GATE.read_text(encoding="utf-8")
    assert 'if (await recoverNativeStatus()) return;' in source
    assert 'if (mode === "automatic" && now - lastAutomaticCheckAt < AUTOMATIC_CHECK_INTERVAL_MS) return;' in source
    assert 'if (activeCheck) return activeCheck;' in source
