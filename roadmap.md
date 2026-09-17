# Upload reliability roadmap

- [x] Audit direct storage, retry, auth, batch, and conversion paths.
- [x] Add per-file resumable session records and exact 6 MB TUS chunks.
- [x] Refresh authentication during long uploads and retry transient failures.
- [x] Preserve monotonic byte progress, speed, ETA, and meaningful states.
- [x] Verify committed offset and final storage object before success.
- [x] Preserve `.mkv.mp4` filenames and avoid loading complete files into memory.
- [x] Queue large video transfers and isolate batch episode finalization failures.
- [x] Keep Upload on Embed independent and preserve the existing dashboard design.
- [x] Add focused retry, backoff, and filename tests.
- [ ] Validate a multi-gigabyte upload on a real slow/interrupted network.
  - Blocked: the sandbox cannot supply or retain a real multi-gigabyte local video/network interruption session.