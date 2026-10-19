# Project rules
- Download audio discovery uses a lazy, bounded MP4 metadata reader only when native track metadata is unavailable; never fetch the entire video to populate the selector.
- Download confirmation pauses playback and does not automatically resume it on dismissal, so users control playback explicitly.
- Popular catalogue cards retain shared audio/content badges and native scroll snapping; animations must respect reduced motion and device performance tiers.