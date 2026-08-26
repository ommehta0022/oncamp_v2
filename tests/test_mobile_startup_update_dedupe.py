from pathlib import Path


UPDATE_GATE = Path("frontend/src/components/AppUpdateGate.tsx")


def test_startup_update_prompts_are_persistently_deduped():
    source = UPDATE_GATE.read_text(encoding="utf-8")
    assert "DEFER_KEY" in source
    assert "DEFER_MS" in source
    assert "readDeferred" in source
    assert "isDeferred" in source
    assert "deferUpdate" in source
    assert "downloadedPendingKey" in source
    assert 'void showDownloadedPending("automatic")' in source


def test_automatic_update_checks_stay_silent_for_transient_failures():
    source = UPDATE_GATE.read_text(encoding="utf-8")
    assert 'if (mode === "manual")' in source
    assert 'emitUpdateUi(INITIAL_UI);' in source
    assert 'checkForAppUpdate("automatic")' in source
