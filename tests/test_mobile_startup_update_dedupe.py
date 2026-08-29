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


def test_automatic_update_checks_stay_silent_without_dismissing_active_progress():
    source = UPDATE_GATE.read_text(encoding="utf-8")
    assert 'if (mode === "manual")' in source
    assert 'checkForAppUpdate("automatic")' in source
    assert "Automatic checks never hide or replace an active update UI" in source
    automatic_catch = source.split('if (mode === "manual") {', 1)[1].split("Automatic checks never hide or replace an active update UI", 1)[0]
    assert "emitUpdateUi(INITIAL_UI)" not in automatic_catch
