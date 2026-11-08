# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-11-08

First public release.

### Added

- Four resumable waiting games shown inline in the current turn's conversation:
  Sudoku, 2048, Minesweeper, and Lights Out.
- Per-game progress in `localStorage`, plus a game switcher in the card header.
- Inline card that follows the host light/dark theme and respects
  `prefers-reduced-motion`.
- English and Chinese UI dictionaries.
- Automatic migration of the old `dsh-sudoku-waiting-v1` / `v2` saves.
- Pure-logic test suite (`node --test`) for puzzle generation, validation, and
  the 2048 / Minesweeper / Lights Out engines.
- npm package metadata, GitHub repository, and release automation.

### Notes

- Built against the DSH `0.2.2-rc.1` Client API; `engines.dsh` is
  `^0.2.2-rc.1`.
- No network access, no telemetry, and no server-side data.
