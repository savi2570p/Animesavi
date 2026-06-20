# Embed Player QA Checklist

Covers both player variants:
- **Normal Embed** — `/embed/...` (`src/pages/EmbedPlayer.tsx`)
- **Special / Copy Shadow Link Embed** — `/e/:slug` (`src/pages/EmbedSlugPlayer.tsx`)
- **Iframe Bridge** — `src/components/video/EmbedIframePlayer.tsx`

---

## 1. Timeline / Seek Bar

| # | Check | Normal | Shadow | Notes |
|---|---|---|---|---|
| 1 | Thumb dot stays vertically centered on the track at rest | ☐ | ☐ | Should sit on the 4px line, not above/below |
| 2 | Thumb stays centered while dragging (scales 14→20px) | ☐ | ☐ | `margin-top` is recalculated in `.smooth-seekbar` |
| 3 | Drag is buttery smooth on iOS Safari | ☐ | ☐ | No frame lag, no thumb detach |
| 4 | Drag is buttery smooth on Android Chrome | ☐ | ☐ | |
| 5 | Fast scrubbing (rapid finger sweep) updates `currentTime` continuously | ☐ | ☐ | |
| 6 | Click-to-seek on the track jumps to the correct % | ☐ | ☐ | |
| 7 | Buffered band (white/40) tracks `video.buffered` correctly | ☐ | ☐ | |
| 8 | Played fill (primary) matches thumb position exactly | ☐ | ☐ | |
| 9 | In fullscreen mode (Normal) thumb stays aligned | ☐ | n/a | `VideoPlayer.tsx` fullscreen variant |
| 10 | TV browser / large desktop: hitbox is reachable with mouse | ☐ | ☐ | 36px touch target |

## 2. Buffering Display

| # | Check | Normal | Shadow |
|---|---|---|---|
| 1 | Spinner shows on initial load | ☐ | ☐ |
| 2 | "Buffering…" label shows during stalls | ☐ | ☐ |
| 3 | Spinner hides as soon as playback resumes | ☐ | ☐ |
| 4 | No spinner flicker during normal seek | ☐ | ☐ |

## 3. Progress Sync (Watch Party / Multi-viewer)

| # | Check | Result |
|---|---|---|
| 1 | Host seek propagates to all participants within ~500 ms | ☐ |
| 2 | Late joiner snaps to host's current time | ☐ |
| 3 | Pause/play state stays consistent across viewers | ☐ |
| 4 | AI Recap auto-sync starts at the same timestamp for everyone | ☐ |
| 5 | Network drop + recover → re-sync without manual reload | ☐ |

## 4. Flat Control Styling Consistency

Verify across **mobile, tablet, desktop, TV browser** for both embed variants:

| # | Check | Normal | Shadow |
|---|---|---|---|
| 1 | No `rounded-full` chips around play / skip / mute / cc / settings / fullscreen buttons | ☐ | ☐ |
| 2 | Mobile button size: `w-6 h-6` with 13px icons | ☐ | ☐ |
| 3 | Desktop button size: `w-8 h-8` with 18px icons | ☐ | ☐ |
| 4 | Center play button is the only circular element (intentional) | ☐ | ☐ |
| 5 | Hover state uses color shift only (`text-white/90 → text-white`), no background ring | ☐ | ☐ |
| 6 | Captions / Audio / Settings menus open above the bar without overlapping the thumb | ☐ | ☐ |

## 5. iOS-Specific

| # | Check | Result |
|---|---|---|
| 1 | Pinch-zoom does not trigger seek | ☐ |
| 2 | `touch-action: none` on `.smooth-seekbar` prevents page scroll while dragging | ☐ |
| 3 | Lock-screen Media Session metadata still shows correct title | ☐ |
| 4 | PWA standalone mode: timeline is not clipped by safe-area | ☐ |

## 6. Android-Specific

| # | Check | Result |
|---|---|---|
| 1 | Long-press on thumb does not open context menu | ☐ |
| 2 | System back gesture does not interfere with edge drag | ☐ |
| 3 | Chrome PIP mode preserves progress | ☐ |

## 7. Regression Smoke

- [ ] Normal embed plays HLS without errors
- [ ] Shadow link embed plays direct MP4/HLS without errors
- [ ] Subtitles toggle on/off
- [ ] Audio track switch works
- [ ] Quality / settings menu opens and closes
- [ ] Fullscreen toggle works in both variants
- [ ] Episode panel slides in/out without breaking the timeline

---

**How to run:** Open each variant on a real iOS device, real Android device, desktop Chrome, and a TV browser (or 1920×1080 desktop with mouse). Walk the table top-to-bottom; mark ☐ as ✅ or ❌ with a note.
