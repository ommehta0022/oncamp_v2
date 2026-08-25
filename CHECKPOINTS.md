# Change checkpoints

For significant OnCampus changes, preserve rollback points in GitHub before and after the change.

## Convention

- Before a significant change: create `checkpoint/pre-<change>-YYYY-MM-DD` from the current validated `main` commit.
- After the change is implemented and its static/regression checks are in place: create `checkpoint/post-<change>-YYYY-MM-DD` from the resulting `main` commit.
- Do not force-update or delete checkpoint branches unless explicitly requested.
- Keep functional changes and regression-guard changes in separate commits when practical so individual pieces can be reverted cleanly.

## Current dark-mode change

- Pre-change checkpoint: `checkpoint/pre-darkmode-charcoal-2026-08-25`
- Purpose: preserves the last successful OnCampus 1.6.2 release state before the monochrome dark-mode redesign.
- Post-change checkpoint: `checkpoint/post-darkmode-charcoal-2026-08-25`
- Purpose: preserves the charcoal/black dark-mode palette plus its regression guard.
