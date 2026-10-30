- [x] Enforce Hentai filtering when Mature Content Filter is enabled; classifier and projected-join tests passed.
- [x] Confirm cached-image clearing and remove account-wide Continue Watching safely; signed-in confirmation/cancellation checked, destructive account-wide deletion not executed against the owner's real history.
- [x] Enforce Data Saver HLS quality and refresh compact liquid-glass player settings; 14 regressions passed, signed-in controls and real-episode menu checked at desktop and 390px (184px menu). Actual streaming rendition unverified because the selected source failed. Single-resolution MP4 and third-party iframes cannot be converted to 1080p by this setting.
- [ ] Second-password login protection: blocked on choosing a genuine supported second factor or a separately designed server-enforced authentication system. No bypassable client lock was added as 2FA.
- [x] Refresh login, notification bell and Continue Watching popups without changing existing account or resume behavior.
- [x] Show AnimeSavi Team for missing token issuers and contain the iOS navbar logo.
- [x] Hide Report and Telegram buttons on clone pages and verify affected screens.

Verified this refresh: 49 tests pass; preview build OK. Desktop/mobile login branding, signup and reset form navigation checked. Signed-in notifications open; issuer shows AnimeSavi Team and End Token cancellation preserves access. At 390px the logo image is fully inside the navbar and no horizontal overflow appears. Actual ToonStream clone shell hides both floating buttons. No browser page errors. Continue Watching notification did not trigger with the current account history, so its refreshed appearance and resume action remain unverified live; physical iOS testing and credential-based sign-in were not performed.
- [x] Refresh What's New and Release Notes without changing version or release content.
- [x] Refresh Report, Telegram contact/promotion, navigation and footer presentation.
- [x] Simplify homepage sharing and verify desktop/mobile interactions.
- [x] Repair Settings layout and remove Settings from hamburger options.
- [x] Redesign Welcome with real catalogue artwork and lightweight glass.
- [x] Keep only Type, Sort and Genres in Browse filters; refresh the pictured catalogue pages.
- [x] Verify signed-in settings, catalogue filters and navigation.
- [x] Move the Watch episode selector left and widen mobile Continue Watching artwork.
- [x] Refresh hamburger options, Profile and Settings with lightweight liquid glass.
- [x] Replace anime detail loading presentation with a glass loading screen.
- [x] Verify signed-in menu, profiles, navigation and mobile layouts.
- [x] Make Continue Watching slightly wider with compact metadata while preserving 16:9 artwork.
- [x] Redesign Watch and Upload presentation without changing playback, uploads or permissions.
- [x] Correct Hindi-dub fallback audio labels and test concrete language rules.
- [x] Verify signed-in Watch, Upload and mobile layouts.
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
- [x] Update What's New to S2-V2.1 with performance, stability and bug-fix news at 15MB.
- [x] Verify the popup shows the new version and size to returning users.
- [x] Refresh homepage expiry, Watch expiry and hamburger Verify Token with shared liquid glass.
- [x] Verify signed-in token status, confirmation cancellation and compact layouts without ending a real token.

Token refresh verified: signed-in Verify Token loads active account status; End Token confirmation cancels without deleting access; 390px dialog fits the viewport. Existing popup regressions: 16 pass; build OK. Natural expiry on a real expired account and physical iOS/Android devices remain unverified.

Verified: build OK and 49 regressions pass. Signed-in What's New opens from the hamburger and links to Release Notes, now showing S2-V2.1 with a 15MB update size; the popup re-appears for returning users because its seen-marker follows the app version. Desktop check opened the popup with S2-V2.1 and 15MB, no 12MB remnant, and the item list clears the action button when scrolled. Report input enables Send; no report was submitted. Telegram contact has both destinations; a real Watch episode shows the daily promotion and dismissal works. Footer Privacy and Terms dialogs open. Homepage Copy link reads back https://animesavi.com. Embed and S2-home retain zero Report/Telegram buttons. Desktop and 390px screenshots show readable popups, simple sharing and footer without overflow; no browser page errors. Physical devices, native OS share sheets and actual video playback remain unverified.

- [x] Redesign Admin with lightweight liquid glass and remove the upload unlock password.
- [x] Fix Upload → Edit authorization and add editable series descriptions.
- [x] Verify signed-in admin, upload edit, and saved description persistence.
- [x] Compact resume popups, widen mobile 16:9 resume artwork and round navbar logo.
- [x] Refresh homepage recommendations and slightly enlarge desktop catalogue cards; remove Watch recommendations.
- [x] Center pending preparation popups above page content and verify real interactions.
- [x] Recreate series settings, seasons, episode lists, batch upload and new-series forms with cohesive liquid glass.
- [x] Verify signed-in editor and upload interactions on desktop and phone widths.
- [x] Repair uneven upload form layout and conflicting panel styles.
- [x] Recreate Add Movie and remove Embed Upload navigation.
- [x] Expand Welcome with useful catalogue, account and viewing information; verify all affected screens.
- [x] Point the Welcome Telegram community link at t.me/AnimeSaviInhindiDUB, add more Good to know answers, and show the full 16:9 welcome banner on phones.

Verified: build OK. At 390px the welcome banner renders as a full 16:9 strip (390x219, no crop of the 1200x675 artwork) with title, buttons, search field and pagination readable below it; the Telegram community link reads https://t.me/AnimeSaviInhindiDUB and Good to know now lists nine answers. Desktop hero sizing is unchanged. Physical iOS/Android devices remain untested.
- [x] Redesign Crunchy and MuseIN loading screens with lightweight liquid glass and verify both platform transitions.

Verified: both homepage platform links display the new branded loading screen and then load real catalogues. Desktop and 390px layouts, loaded artwork, reduced-motion and low-tier blur fallbacks checked; no browser page errors. Physical iOS/Android devices remain untested.
- [x] Recreate Crunchy and MuseIN collection headers, trending rows and libraries with shared liquid glass; preserve filters and title actions and verify both layouts.

Verified both live catalogues, Crunchy All/New/Trending filters and anime navigation. Desktop and phone-width screenshots checked with no horizontal overflow or browser errors; no pending titles were available to exercise the existing popup. Physical devices remain untested.
- [x] Allow shadowflixxorg@gmail.com to see and use Shadow Link V2 and Copy Shadow Link without unrelated privileges; run focused access tests.

Verified: three sharing-access tests pass and preview build OK. Both controls and copied URLs checked with the available signed-in account; the requested email is covered by the access tests, not a separate live sign-in. Existing public Shadow playback and administrator/domain bypasses remain unchanged.
