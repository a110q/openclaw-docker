# Changelog

All notable changes to this project will be documented in this file.

The format is loosely based on Keep a Changelog, and this project currently tracks changes manually.

## [Unreleased]

### Added
- Added Control UI locale overlay with default Simplified Chinese, a floating language/text-mode switcher, bilingual labels, and Chinese settings search bridge
- Added host-editable `openclaw.json` workflow
- Added `openclaw-cli` and `openclaw-tools` service patterns
- Added sandbox image build helper script
- Added OpenAI Compatible base URL support through `.env`
- Added comprehensive open source manual in `docs/open-source-manual.md`
- Added `bootstrap.sh` for low-friction first-time deployment
- Added `scripts/bootstrap-first-control-ui-admin.sh` to bootstrap the first Control UI admin browser in pairing mode

### Changed
- Updated Compose services to support Docker socket access on macOS Docker Desktop
- Updated sandbox workspace paths to use host-visible absolute paths
- Improved README to serve as the concise operator entrypoint
- Rewrote `docs/open-source-manual.md` into a navigation-style overview
- Split operator docs into `docs/operations.md` and `docs/faq.md`
- Expanded login and pairing documentation to explain Mode A, Mode B, and first-admin bootstrap flow

### Fixed
- Fixed sandbox Docker permission issue caused by socket group access
- Fixed Docker Desktop bind mount failures caused by container-only workspace paths
- Fixed end-to-end chat execution path for sandbox-backed agent runs

## [2026-04-08]

### Added
- Initial public documentation set
- Initial Docker deployment template
- Initial multi-agent configuration template
- Initial sandbox build and data-dir initialization scripts
