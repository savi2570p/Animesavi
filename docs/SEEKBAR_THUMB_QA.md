# Seekbar Thumb Alignment — Cross-Device QA

**Goal:** the purple thumb sits exactly on the timeline's center axis at every state — idle, hover, dragging, fast-scrub, after fullscreen toggle, and after viewport rotation. It must NEVER float above the track.

**Last fix:** `src/index.css` `.smooth-seekbar` — removed `margin-top` hacks; track + input share 36px so browsers auto-center the thumb.

---

## Devices in scope

| # | Device                       | Browser            | Variants                |
|---|------------------------------|--------------------|-------------------------|
| 1 | iPhone (iOS 16+)             | Safari             | portrait, landscape     |
| 2 | iPad (iPadOS 16+)            | Safari             | portrait, landscape     |
| 3 | Android phone (Android 12+)  | Chrome             | portrait, landscape     |
| 4 | Desktop                      | Chrome / Edge      | windowed + fullscreen   |
| 5 | Desktop                      | Firefox            | windowed + fullscreen   |
| 6 | TV browser (smart TV / Tizen)| native             | landscape only          |

## Players in scope

- `src/components/video/VideoPlayer.tsx` — main player (windowed + fullscreen seekbars).
- `src/pages/EmbedPlayer.tsx` — normal embed.
- `src/pages/EmbedSlugPlayer.tsx` — Shadow Link / Special embed.
- `src/components/video/EmbedIframePlayer.tsx` — iframe wrapper.

---

## Test matrix (run on every device × every player)

For each cell, record **PASS / FAIL** + screenshot.

| Step | Action                                           | Expected                                                                  |
|------|--------------------------------------------------|---------------------------------------------------------------------------|
| 1    | Load video, hover (or tap) the seekbar           | Thumb (14px) is vertically centered on the visible track. No vertical gap above the bar. |
| 2    | Begin drag — hold and slowly move left/right     | Thumb scales to 20px and stays centered. Track and thumb share the same horizontal axis. |
| 3    | Fast-scrub: flick the thumb edge-to-edge         | No flicker, no vertical jump, thumb stays on the track centerline.        |
| 4    | Release drag                                     | Thumb scales back to 14px, still centered.                                |
| 5    | Toggle fullscreen ↔ windowed                     | Thumb re-centers automatically; no offset after layout reflow.            |
| 6    | Rotate device portrait ↔ landscape (mobile/iPad) | Thumb re-centers automatically; no leftover offset.                       |
| 7    | Resize desktop window (drag corner)              | Thumb stays centered through every reflow.                                |
| 8    | Buffering kicks in mid-drag                      | Buffered band updates; thumb position remains centered on the track.     |
| 9    | Pause then scrub                                 | Same alignment as during playback.                                        |
| 10   | After AI recap auto-sync (watch party)           | Thumb sits on the track when host seeks; no vertical offset.              |

## Regression guards (must remain absent in code)

Search the player files for any of these — if found while thumb misalignment returns, remove them:

- `margin-top:` on `::-webkit-slider-thumb` / `::-moz-range-thumb`
- Negative `top-` utilities on the `.smooth-seekbar` element (e.g. `-top-4`, `-top-2`)
- `translateY(-50%)` applied to the thumb itself (the wrapping seekbar element using `top-1/2 -translate-y-1/2` is correct; the thumb pseudo-element must NOT carry one)

```bash
# quick grep when triaging a regression
rg -n "margin-top" src/index.css | rg -i "thumb\|seekbar"
rg -n "smooth-seekbar" src
```

## Pass criteria

- All 10 steps PASS on every device × every player.
- No console errors during interaction.
- Drag latency feels identical to YouTube / Netflix (smooth, no stutter).

## Reporting template

```
Device: <model> / <OS> / <browser version>
Orientation: <portrait | landscape>
Player: <VideoPlayer | EmbedPlayer | EmbedSlugPlayer>
Result: PASS / FAIL
Notes: <screenshot link, anomalies>
```
