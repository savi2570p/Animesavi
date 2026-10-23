- [x] Restore mobile hero overlay and immersive desktop sizing; remove navigation button group.
- [x] Recreate anime details with glass styling while preserving existing actions.
- [x] Verify banners and real anime detail interactions on desktop and mobile.
- [x] Fill Continue Watching artwork without side gutters.
- [x] Give mobile hero artwork a true 16:9 frame and remove hero counter numbers.
- [x] Shrink Trending Now and redesign Pending Upload without changing access or actions.
- [x] Verify signed-in desktop and mobile views.
- [x] Shrink Clones and Platforms to compact tiles.
- [x] Ensure Continue Watching artwork is fully visible at 16:9 with titles below.
- [x] Remove public Flox navigation and routes without touching partner integrations.
- [x] Redesign the main hero with lightweight liquid glass and verify layouts.
- [x] Redesign Browse Top 10 Most Popular from the supplied reference.
- [x] Redesign Continue Watching while preserving resume and Done actions.
- [x] Remove player theme controls and saved theme overrides.
- [x] Correct SUB audio fallback labels and initial track selection to Japanese on desktop and Android.
- [x] Redesign Clones and Platforms with lightweight glass and native snap scrolling.
- [x] Run focused tests and check the updated views.

Verified: seven focused regressions pass. Mobile hero is exactly 16:9 with actions inside the artwork; the previous/pause/next group is absent. Desktop hero fills the viewport minus a small next-section hint. Signed-in real anime details render episodes and season selector, and More info opens correctly without mobile overflow or page errors. Favorite, Watch List, sharing, downloads, reviews and watched-state logic remain intact.
