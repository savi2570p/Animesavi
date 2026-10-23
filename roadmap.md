- [x] Fix bounded download audio discovery and download confirmation handoff.
- [x] Add per-episode native-media resume to copied embed players.
- [x] Redesign Latest Movies, ENG DUB, SUB-ONLY and Recently Completed with shared lightweight glass cards.
- [x] Run focused regression tests and attempt live browser checks.

Verification: 11 regression tests cover stalled metadata, ignored ranges, selected audio/quality under blocked storage, and saving/restoring native playback. Preview compilation passes. Live download/player and homepage visual checks remain unverified: Chromium rejected the test media, and homepage sections were not reachable in the browser session. Third-party iframe resume depends on the provider; no estimated positions are claimed. Downloads retain the source's audio streams and quality unless separate renditions are supplied; these changes do not remux or transcode files.
