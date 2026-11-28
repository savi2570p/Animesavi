## Nov 23 API Hub
- [x] Public keyless catalogue API (/v1) with cursor pages, ETags and OpenAPI
- [x] Change tracking on anime/seasons/episodes + change feed with 30-day history
- [x] One-click pairing with endpoint verification, signed webhooks, retries, rotation, disconnect
- [x] Developers page with live tester and Universal Integration Prompt

## Nov 19 downloads removal
- [x] Watchlist and Favorites delete buttons remove the title instead of opening it
- [x] PC: notifications moved into the profile menu
- [x] Hamburger: remove Downloads; player page: remove Save Offline; SUB server: no Download button
- [x] Opening notice pop-up: downloads / save offline removed due to restrictions
- [x] Profile menu: "Notice" row re-opens the downloads notice on any page

## Nov 13 Premium badges
- [x] Redesign shared card crowns and profile-photo Premium badges without changing access rules

## Nov 10 pass 3
- [x] Mobile/iOS hero banner shows full 16:9 artwork
- [x] Poster cards everywhere (Favorites, Watch List, Upcoming, Coming Soon, Recommended, Episode Progress, Share)
- [x] Hamburger: remove Upload Anime, Admin Panel, Settings
- [x] Combine Join Party + View Parties into one Watch Party item/dialog
- [x] Flat theme on clone sites and platforms pages
- [x] Footer redesign (AnimeSavi+), Telegram, YouTube, Instagram links

## Nov 10 Re:ANIME pass 2
- [x] Re:ANIME-style poster cards across home rows, browse/search, listing, platform and detail pages
- [x] Browse/search page: top filter bar + left facets + pagination (Movie filter 263→32 checked)
- [x] Navbar: hamburger + logo + search left, bell/avatar right; PC-only left icon rail with show/hide (checked)
- [x] Remove global Report button; Report an Issue only under the video player (5 options verified)
- [x] Anime detail page: Re:ANIME layout with only Overview and Recommendations tabs (desktop + 390px)
- [x] Admin: Top Trending list — Bleach added showed as #1 on home, removed, fallback returned

## Nov 28 security audit
- [ ] Review quick and deep security scan results; fix confirmed findings without changing intentional public catalogue access
- [ ] Patch vulnerable production dependencies and rerun the dependency scanner
- [ ] Audit environment variables and git history for exposed secrets without printing sensitive values
- [ ] Verify admin authorization, user access rules, password handling, XSS protections, API authentication, CORS and debug settings
- [ ] Add verified production security headers where the hosting configuration supports them
- [ ] Add user-approved best-effort database-backed throttling to sensitive public requests; document that it is not DDoS protection

## Open
- [x] Admin "API Access" tab to copy the public API address and setup prompt
- [ ] Second-password login protection: blocked on choosing a genuine supported second factor or a separately designed server-enforced authentication system.

## Nov 11 pass
- [x] Mobile header: hamburger on right, bell moved into profile menu as "Notifications", search icon only
- [x] PC side rail: remove Favorites, History, Movies, Most Popular, Settings; hidden by default, arrow to show
- [x] New-episode notifications for favorites use poster image
- [x] Mobile watch layout like reference; servers grouped DUB (H.Savi, AS+) and SUB (4K+)
- [x] SUB server locks audio to Japanese; SUB-only anime shows only SUB
- [x] Upload: choose DUB/SUB servers when adding

## Nov 12 pass
- [x] All embed players resume where the viewer left off (embed id/short, slug, minimal, Shadow v2, token)
- [x] Schedule page redesign (PC + phone)

## Nov 12 pass 2
- [x] Shadow link players: numbered tile episode picker (lime active tile) like reference
- [x] Keyboard shortcuts on every embed player (shared useEmbedHotkeys)
