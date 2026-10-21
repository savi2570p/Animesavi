- [x] Optimize shared playback buffering and eliminate speculative fragment prefetch.
- [x] Optimize homepage database reads and verify backend health.
- [x] Redesign Trending Now, Latest Series and Latest Episodes with lightweight liquid glass.
- [x] Update What's New to S2-V2 with a 12MB display size.
- [x] Run focused tests and verify homepage and attempt real signed-in playback on all three servers.

Verification: public catalogue returns 12 series and 200 episode rows with one shared request; desktop/mobile layouts have no page errors or horizontal overflow. Latest scan improved from 3.55ms to 0.58ms with indexed access. Backend has no current resource exhaustion. Sustained playback and heavy-traffic capacity are unverified: this Chromium browser rejects the real episode source on all three servers (media error 4); no load test was performed against production.
