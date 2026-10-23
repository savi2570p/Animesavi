- [ ] Shrink Clones and Platforms to compact tiles.
- [ ] Ensure Continue Watching artwork is fully visible at 16:9 with titles below.
- [ ] Remove public Flox navigation and routes without touching partner integrations.
- [ ] Redesign the main hero with lightweight liquid glass and verify layouts.
- [x] Redesign Browse Top 10 Most Popular from the supplied reference.
- [x] Redesign Continue Watching while preserving resume and Done actions.
- [x] Remove player theme controls and saved theme overrides.
- [x] Correct SUB audio fallback labels and initial track selection to Japanese on desktop and Android.
- [x] Redesign Clones and Platforms with lightweight glass and native snap scrolling.
- [x] Run focused tests and check the updated views.

Verified: eight regression tests pass; authenticated homepage shows Continue Watching, Clones and Platforms with real content. Browse mobile screenshots show the new Top 10 and no horizontal page overflow. No browser page errors. Real SUB episode opens without theme controls, but playback errors prevented checking its audio menu end-to-end; selection and fallback are regression-tested. Known non-Japanese audio tracks retain their truthful labels. Done database behavior remains unchanged and was not invoked during visual checks.
