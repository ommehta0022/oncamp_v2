from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = (ROOT / "frontend" / "src" / "updates" / "backgroundOta.ts").read_text(encoding="utf-8")
UPDATE_GATE = (ROOT / "frontend" / "src" / "components" / "AppUpdateGate.tsx").read_text(encoding="utf-8")


def test_native_fetch_only_marks_an_actual_new_update_ready():
    assert "if (!fetched.isNew)" in BACKGROUND
    assert "await persistReady(manifestId)" in BACKGROUND
    assert "fetched.isNew ||" not in BACKGROUND
    assert "expectedUpdateId !== String(Updates.updateId" not in BACKGROUND


def test_forced_native_failures_are_not_collapsed_to_generic_false():
    assert "if (!downloaded && force && lastPrefetchError)" in BACKGROUND
    assert "throw new Error(lastPrefetchError)" in BACKGROUND
    assert "await persistFailure(error)" in BACKGROUND
    assert "BackgroundTask.BackgroundTaskResult.Failed" in BACKGROUND


def test_status_failure_is_recorded_and_stale_errors_are_cleared():
    assert 'persistFailure(new Error("Couldn’t reach the OnCampus update service.' in BACKGROUND
    assert "async function clearFailure()" in BACKGROUND
    assert "await clearFailure();" in BACKGROUND


def test_app_update_gate_receives_real_prefetch_exception():
    # AppUpdateGate wraps prefetchLatestOta(true) in its own try/catch, so the
    # forced prefetch throw above reaches the visible error detail rather than
    # the old generic `Download paused / check connection` false-result branch.
    assert "await prefetchLatestOta(true)" in UPDATE_GATE
    assert "detail: error instanceof Error ? error.message.slice(0, 180)" in UPDATE_GATE
