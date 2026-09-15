# Reliable resumable episode uploads

## Goal
Replace the fragile episode-video transfer path with a direct-to-storage, resumable upload pipeline while preserving the current AnimeSavi Upload Dashboard, embed fallback, filenames, episode metadata, and conversion workflow.

## Root causes found
- Large videos already use the storage provider’s TUS endpoint, but the upload keeps one access token for the entire transfer. A token expiring during a long upload can turn a recoverable interruption into a permanent failure.
- Retry state is only surfaced after the TUS client exhausts its internal retries, so users see a generic failure instead of retrying/resuming status.
- Resume state uses one global progress snapshot and an incomplete custom previous-upload record. Multiple upload fields can overwrite each other’s recovery data.
- The UI discards the safe storage error and replaces it with “Upload failed. Please retry.”
- Completion checks only the TUS offset. They do not independently verify that the final object exists with the expected size before returning its URL.
- Batch upload fields can transfer independently without a shared queue, allowing large files to compete for bandwidth.
- Video paths preserve only the final extension. A name ending in `.mkv.mp4` remains accepted, but the path-generation and MIME tests need explicit regression coverage.

## Implementation

### 1. Resumable upload engine
- Extract the TUS transport and persistence logic into a dedicated upload module used by all episode, movie, batch, and embed video uploads.
- Continue sending video bytes directly to storage; no video data will pass through an edge function or be loaded fully into memory.
- Use the storage service’s required exact **6 MB TUS chunks**. Although 8–16 MB was suggested, this backend requires 6 MB PATCH chunks; larger chunks are the known cause of failures shortly after an upload starts.
- Keep one in-flight chunk per file because the storage endpoint does not support TUS concatenation/parallel chunk assembly.
- Add upload IDs and per-upload persisted records containing file fingerprint, original filename, size, MIME type, destination, upload URL, confirmed offset, status, retries, and timestamps.
- Scope persistence by bucket/path/file fingerprint so simultaneous fields cannot overwrite each other.

### 2. Retry, reconnect, and authentication recovery
- Retry network failures and HTTP 408/409/423/429/500/502/503/504 with exponential backoff and jitter.
- Surface `retrying`, `offline`, `resuming`, `verifying`, `completed`, `failed`, and `cancelled` states.
- Refresh the user session before starting and when authorization expires, then recreate the TUS client against the same verified upload URL/offset.
- On reconnect or retry, issue a HEAD probe and resume from the storage-confirmed offset.
- Only create a fresh upload session for a confirmed expired/invalid TUS URL; retain the original destination and never overwrite an existing completed object accidentally.

### 3. Accurate progress and recovery UI
- Keep the existing visual design.
- Drive percentage, uploaded bytes, speed, chunk count, and ETA only from acknowledged bytes.
- Never move displayed progress backward and reserve 100% for verified completion.
- Replace the generic error with the safe underlying reason and show automatic retry/resume states.
- Change “Try again” to “Resume Upload” after a recoverable failure; reusing the selected file resumes the verified session rather than restarting blindly.
- Preserve “Upload on embed” as an independent path with no false local-upload failure after embed success.

### 4. Final verification and consistency
- After TUS completion, verify both the final committed offset and the storage object’s existence/expected size before returning a public URL.
- Do not populate `video_url`, create an episode record, or trigger conversion until verification succeeds.
- Keep upload and iOS conversion as separate stages.
- Make finalization idempotent so duplicate clicks cannot create duplicate completion events or episode inserts.

### 5. Batch reliability
- Route every batch video field through the same resumable engine.
- Add a shared FIFO upload coordinator so large episode videos upload one at a time by default.
- Keep each episode’s upload ID, progress, retries, and result isolated; one failure will not erase or corrupt successful neighboring episodes.
- Preserve current batch form persistence and episode numbering.

### 6. Diagnostics and cleanup
- Add structured, credential-safe logs for upload ID, stage, chunk/offset, retry, HTTP status, verification, and completion.
- Never log access tokens or private credentials.
- Expire abandoned local session metadata after a retention period without deleting completed storage objects.
- Preserve intentionally cancelled sessions only when they are resumable; provide explicit cleanup for abandoned incomplete sessions.

## Validation
- Add focused tests for retry classification/backoff, file fingerprints, `.mkv.mp4`, monotonic progress, session restoration, stale upload URLs, auth refresh, and final verification.
- Exercise small and large-file code paths with mocked TUS failures, multiple failed chunks, offline/online transitions, expired authorization, and component remount.
- Test independent batch items and embed fallback behavior.
- Verify the upload screen in the running app without changing its visual design.
- Confirm the final build and runtime logs are clean.

## Technical note
A browser cannot resume after refresh without the user reselecting the local file because web pages cannot retain unrestricted access to local files. After the same file is reselected, the persisted upload ID and server offset will resume from confirmed progress. Browsers supporting persistent file handles can receive deeper recovery later without weakening security.
