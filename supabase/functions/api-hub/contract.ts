// Canonical, versioned AnimeSavi API Hub contract.
// Served by the API (/v1/openapi.json, /v1/integration-prompt) AND imported by the
// public docs page, so the published prompt and schema can never drift from the API.

export const API_VERSION = '1.0.0'
export const PUBLIC_BASE_URL = 'https://yqeurpyiejesyikcpmdy.supabase.co/functions/v1/api-hub'
export const DOCS_URL = 'https://animesavi.com/developers'

export const ENDPOINTS = [
  { method: 'GET', path: '/v1/health', auth: 'none', summary: 'Service status and current change cursor.' },
  { method: 'GET', path: '/v1/catalog/stats', auth: 'none', summary: 'Published totals for anime, seasons and episodes (import validation).' },
  { method: 'GET', path: '/v1/catalog/anime', auth: 'none', summary: 'Paginated published anime (cursor, limit ≤ 200).' },
  { method: 'GET', path: '/v1/catalog/seasons', auth: 'none', summary: 'Paginated published seasons (optional anime_id).' },
  { method: 'GET', path: '/v1/catalog/episodes', auth: 'none', summary: 'Paginated published episodes (optional anime_id).' },
  { method: 'GET', path: '/v1/anime/{id}', auth: 'none', summary: 'One anime with its complete published seasons and episodes (include=none for metadata only).' },
  { method: 'GET', path: '/v1/seasons/{id}', auth: 'none', summary: 'One season (include=episodes for its complete episode list).' },
  { method: 'GET', path: '/v1/episodes/{id}', auth: 'none', summary: 'One episode.' },
  { method: 'GET', path: '/v1/changes', auth: 'none', summary: 'Incremental change feed after an opaque cursor (limit ≤ 500).' },
  { method: 'GET', path: '/v1/changes/head', auth: 'none', summary: 'Cursor for "now" (start of the change feed).' },
  { method: 'GET', path: '/v1/openapi.json', auth: 'none', summary: 'Machine-readable OpenAPI 3.1 schema.' },
  { method: 'GET', path: '/v1/integration-prompt', auth: 'none', summary: 'This Universal Integration Prompt as Markdown.' },
  { method: 'POST', path: '/v1/connections/pair', auth: 'challenge', summary: 'Server-to-server pairing; auto-approved after webhook verification.' },
  { method: 'GET', path: '/v1/connections/me', auth: 'signed', summary: 'Connection and delivery status.' },
  { method: 'POST', path: '/v1/connections/me/test', auth: 'signed', summary: 'Send a signed ping webhook now.' },
  { method: 'POST', path: '/v1/connections/me/resume', auth: 'signed', summary: 'Re-arm a failing connection, optionally replaying from a cursor.' },
  { method: 'POST', path: '/v1/connections/me/rotate-secret', auth: 'signed', summary: 'Issue a new webhook secret (old one stays valid 24 h).' },
  { method: 'POST', path: '/v1/connections/me/disconnect', auth: 'signed', summary: 'Revoke this connection (also DELETE /v1/connections/me).' },
] as const

const err = { $ref: '#/components/schemas/Error' }
const errResp = (d: string) => ({ description: d, content: { 'application/json': { schema: err } } })
const listOf = (ref: string) => ({
  type: 'object',
  required: ['api_version', 'object', 'kind', 'data', 'page', 'generated_at'],
  properties: {
    api_version: { type: 'string' },
    object: { const: 'list' },
    kind: { type: 'string' },
    data: { type: 'array', items: { $ref: ref } },
    page: { $ref: '#/components/schemas/Page' },
    changes_cursor: { type: 'string', description: 'Present on the first page only. Save it and poll /v1/changes from it after the import.' },
    generated_at: { type: 'string', format: 'date-time' },
  },
})
const pageParams = [
  { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Opaque next_cursor from the previous page.' },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 } },
]
const signedHeaders = [
  { name: 'X-AnimeSavi-Connection', in: 'header', required: true, schema: { type: 'string', format: 'uuid' } },
  { name: 'X-AnimeSavi-Timestamp', in: 'header', required: true, schema: { type: 'string' }, description: 'Unix seconds; ±300 s.' },
  { name: 'X-AnimeSavi-Nonce', in: 'header', required: true, schema: { type: 'string', minLength: 16, maxLength: 128 }, description: 'Random, single use.' },
  { name: 'X-AnimeSavi-Signature', in: 'header', required: true, schema: { type: 'string' }, description: 'v1=<hex HMAC-SHA256(secret, `${timestamp}.${nonce}.${METHOD}.${path}.${raw_body}`)>, path like /v1/connections/me' },
]
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }

export function buildOpenApi() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'AnimeSavi API Hub',
      version: API_VERSION,
      description:
        'Public, read-only mirror API for the published AnimeSavi catalogue plus signed webhooks for receiving websites. ' +
        'No API key is needed for catalogue reads. Video/stream URLs are included on purpose and are therefore retrievable by anyone.',
    },
    servers: [{ url: PUBLIC_BASE_URL }],
    externalDocs: { url: DOCS_URL },
    paths: {
      '/v1/health': { get: { summary: 'Health', responses: { 200: { description: 'OK' }, 503: errResp('Source temporarily unavailable') } } },
      '/v1/catalog/stats': { get: { summary: 'Published totals', responses: { 200: { description: 'Totals', content: { 'application/json': { schema: { $ref: '#/components/schemas/Stats' } } } } } } },
      '/v1/catalog/anime': { get: { summary: 'Published anime page', parameters: pageParams, responses: { 200: { description: 'Page', content: { 'application/json': { schema: listOf('#/components/schemas/Anime') } } }, 304: { description: 'Not modified (If-None-Match)' }, 400: errResp('Bad cursor'), 503: errResp('Temporary') } } },
      '/v1/catalog/seasons': { get: { summary: 'Published seasons page', parameters: [...pageParams, { name: 'anime_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Page', content: { 'application/json': { schema: listOf('#/components/schemas/Season') } } } } } },
      '/v1/catalog/episodes': { get: { summary: 'Published episodes page', parameters: [...pageParams, { name: 'anime_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Page', content: { 'application/json': { schema: listOf('#/components/schemas/Episode') } } } } } },
      '/v1/anime/{id}': { get: { summary: 'Anime with complete subtree', parameters: [idParam, { name: 'include', in: 'query', schema: { enum: ['all', 'none'], default: 'all' } }], responses: { 200: { description: 'Anime', content: { 'application/json': { schema: { $ref: '#/components/schemas/AnimeTree' } } } }, 404: errResp('not_public: unpublished, hidden or deleted — authoritative') } } },
      '/v1/seasons/{id}': { get: { summary: 'Season', parameters: [idParam, { name: 'include', in: 'query', schema: { enum: ['episodes'] } }], responses: { 200: { description: 'Season' }, 404: errResp('not_public') } } },
      '/v1/episodes/{id}': { get: { summary: 'Episode', parameters: [idParam], responses: { 200: { description: 'Episode' }, 404: errResp('not_public') } } },
      '/v1/changes': { get: { summary: 'Change feed', parameters: [{ name: 'cursor', in: 'query', required: true, schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 500, default: 100 } }], responses: { 200: { description: 'Changes', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangeList' } } } }, 400: errResp('Bad cursor'), 410: errResp('cursor_expired: run a full import') } } },
      '/v1/changes/head': { get: { summary: 'Current cursor', responses: { 200: { description: 'Cursor' } } } },
      '/v1/connections/pair': {
        post: {
          summary: 'Pair a receiving website (server-to-server)',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PairRequest' } } } },
          responses: { 201: { description: 'Connected', content: { 'application/json': { schema: { $ref: '#/components/schemas/PairResponse' } } } }, 400: errResp('Invalid or unsafe input'), 422: errResp('verification_failed'), 429: errResp('rate_limited') },
        },
      },
      '/v1/connections/me': {
        get: { summary: 'Connection status', parameters: signedHeaders, responses: { 200: { description: 'Status' }, 401: errResp('unauthorized') } },
        delete: { summary: 'Disconnect', parameters: signedHeaders, responses: { 200: { description: 'Disconnected' } } },
      },
      '/v1/connections/me/test': { post: { summary: 'Send ping webhook', parameters: signedHeaders, responses: { 200: { description: 'Result' } } } },
      '/v1/connections/me/resume': { post: { summary: 'Resume / replay', parameters: signedHeaders, requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { replay_from_cursor: { type: 'string' } } } } } }, responses: { 200: { description: 'Resumed' } } } },
      '/v1/connections/me/rotate-secret': { post: { summary: 'Rotate webhook secret', parameters: signedHeaders, responses: { 200: { description: 'New secret' } } } },
      '/v1/connections/me/disconnect': { post: { summary: 'Disconnect', parameters: signedHeaders, responses: { 200: { description: 'Disconnected' } } } },
    },
    webhooks: {
      'content.changes': {
        post: {
          summary: 'Batch of content changes (also type "ping" and "animesavi.verification")',
          parameters: [
            { name: 'X-AnimeSavi-Signature', in: 'header', required: true, schema: { type: 'string' }, description: 't=<unix>,v1=<hex HMAC-SHA256(secret, `${t}.${raw_body}`)> — may contain two v1 values during rotation.' },
            { name: 'X-AnimeSavi-Delivery', in: 'header', schema: { type: 'string', format: 'uuid' } },
            { name: 'X-AnimeSavi-Event', in: 'header', schema: { enum: ['content.changes', 'ping', 'verification'] } },
          ],
          requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookDelivery' } } } },
          responses: { 200: { description: 'Respond 2xx ONLY after the events are durably recorded. Anything else is retried with backoff.' } },
        },
      },
    },
    components: {
      schemas: {
        Error: { type: 'object', properties: { api_version: { type: 'string' }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, retryable: { type: 'boolean' } } } } },
        Page: { type: 'object', properties: { limit: { type: 'integer' }, has_more: { type: 'boolean' }, next_cursor: { type: ['string', 'null'] } } },
        Stats: { type: 'object', properties: { totals: { type: 'object', properties: { anime: { type: 'integer' }, seasons: { type: 'integer' }, episodes: { type: 'integer' } } }, changes_cursor: { type: 'string' } } },
        Anime: {
          type: 'object',
          required: ['object', 'id', 'revision', 'title', 'visibility'],
          properties: {
            object: { const: 'anime' }, id: { type: 'string', format: 'uuid', description: 'Permanent source ID' },
            revision: { type: 'string', description: 'Monotonic integer as string; compare with BigInt' },
            title: { type: 'string' }, description: { type: ['string', 'null'] },
            poster_url: { type: ['string', 'null'] }, banner_url: { type: ['string', 'null'] },
            genres: { type: 'array', items: { type: 'string' } },
            rating: { type: 'object', properties: { content_rating: { type: ['string', 'null'] } } },
            languages: { type: 'object', properties: { audio: { type: 'array', items: { type: 'string' } }, subtitles: { type: 'array', items: { type: 'string' } }, label: { type: 'string' } } },
            format: { type: ['string', 'null'], description: 'series | movie' },
            release: { type: 'object', properties: { year: { type: ['integer', 'null'] }, status: { type: ['string', 'null'], description: 'ongoing | completed (release status, not visibility)' }, schedule_day: { type: ['integer', 'null'] }, total_episodes: { type: ['integer', 'null'] } } },
            studio: { type: ['string', 'null'] }, source_material: { type: ['string', 'null'] }, trailer_url: { type: ['string', 'null'] },
            collections: { type: 'object', properties: { crunchyroll: { type: 'boolean' } } },
            visibility: { const: 'published' }, page_url: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Season: { type: 'object', properties: { object: { const: 'season' }, id: { type: 'string', format: 'uuid' }, anime_id: { type: 'string', format: 'uuid' }, revision: { type: 'string' }, season_number: { type: 'integer' }, title: { type: ['string', 'null'] }, release_date: { type: ['string', 'null'] }, visibility: { const: 'published' }, created_at: { type: 'string' } } },
        Episode: {
          type: 'object',
          properties: {
            object: { const: 'episode' }, id: { type: 'string', format: 'uuid' }, anime_id: { type: 'string', format: 'uuid' }, season_id: { type: 'string', format: 'uuid' },
            revision: { type: 'string' }, episode_number: { type: 'integer' }, title: { type: 'string' }, description: { type: ['string', 'null'] },
            poster_url: { type: ['string', 'null'] }, duration_seconds: { type: ['integer', 'null'] }, audio_language: { type: ['string', 'null'] },
            streams: { type: 'object', properties: { video_url: { type: ['string', 'null'] }, sub_video_url: { type: ['string', 'null'] }, embed_url: { type: ['string', 'null'] } } },
            captions_url: { type: ['string', 'null'] },
            intro: { type: 'object', properties: { start: { type: ['integer', 'null'] }, end: { type: ['integer', 'null'] } } },
            outro: { type: 'object', properties: { start: { type: ['integer', 'null'] }, end: { type: ['integer', 'null'] } } },
            visibility: { const: 'published' }, watch_url: { type: 'string' }, created_at: { type: 'string' },
          },
        },
        AnimeTree: { type: 'object', properties: { data: { $ref: '#/components/schemas/Anime' }, seasons: { type: 'array', items: { allOf: [{ $ref: '#/components/schemas/Season' }, { type: 'object', properties: { episodes: { type: 'array', items: { $ref: '#/components/schemas/Episode' } } } }] } }, complete: { const: true } } },
        Event: {
          type: 'object',
          required: ['event_id', 'type', 'entity_type', 'entity_id', 'action', 'revision', 'occurred_at'],
          properties: {
            event_id: { type: 'string', format: 'uuid', description: 'Deduplicate on this' },
            type: { type: 'string', description: 'anime.upsert | anime.unpublish | anime.delete | season.* | episode.*' },
            entity_type: { enum: ['anime', 'season', 'episode'] }, entity_id: { type: 'string', format: 'uuid' },
            anime_id: { type: ['string', 'null'] }, season_id: { type: ['string', 'null'] },
            action: { enum: ['upsert', 'unpublish', 'delete'] },
            revision: { type: 'string' }, occurred_at: { type: 'string', format: 'date-time' },
            data: { description: 'Current public record for upsert; null otherwise', oneOf: [{ $ref: '#/components/schemas/Anime' }, { $ref: '#/components/schemas/Season' }, { $ref: '#/components/schemas/Episode' }, { type: 'null' }] },
            fetch_url: { type: 'string' },
          },
        },
        ChangeList: { type: 'object', properties: { events: { type: 'array', items: { $ref: '#/components/schemas/Event' } }, next_cursor: { type: 'string' }, has_more: { type: 'boolean' } } },
        WebhookDelivery: { type: 'object', properties: { type: { enum: ['content.changes', 'ping'] }, api_version: { type: 'string' }, delivery_id: { type: 'string' }, connection_id: { type: 'string' }, sent_at: { type: 'string' }, events: { type: 'array', items: { $ref: '#/components/schemas/Event' } }, next_cursor: { type: ['string', 'null'] } } },
        PairRequest: { type: 'object', required: ['site_name', 'site_origin', 'webhook_url', 'challenge'], properties: { site_name: { type: 'string', minLength: 2, maxLength: 80 }, site_origin: { type: 'string', example: 'https://example.com' }, webhook_url: { type: 'string', example: 'https://example.com/api/animesavi/webhook' }, challenge: { type: 'string', pattern: '^[A-Za-z0-9_-]{32,256}$' } } },
        PairResponse: { type: 'object', properties: { connection_id: { type: 'string' }, status: { const: 'active' }, webhook_secret: { type: 'string', description: 'Shown once. Server-side storage only.' }, changes_cursor: { type: 'string' }, api_base: { type: 'string' } } },
      },
    },
  }
}

export const INTEGRATION_PROMPT = `# Connect this website to AnimeSavi (Full Mirror) — Universal Integration Prompt

You are an AI website builder (Lovable, Bolt, Replit, Cursor, v0 or similar). Add an **AnimeSavi Full Mirror** to THIS website so its anime catalogue automatically mirrors the published AnimeSavi catalogue. AnimeSavi is always the single source of truth.

API base URL: ${PUBLIC_BASE_URL}
API version: ${API_VERSION}
Docs: ${DOCS_URL}
OpenAPI schema: ${PUBLIC_BASE_URL}/v1/openapi.json

## 0. Before changing anything
1. Inspect this project first: framework, server runtime (server routes / edge or serverless functions / PHP), database and its current schema, how admins sign in, and the existing admin area UI.
2. Preserve the entire existing design, routes, branding and unrelated features. Only add what is listed here. Reuse the site's existing components and styles for the new admin controls.
3. Use ONLY the routes and fields documented here and in the OpenAPI schema. Do not guess other routes.
4. Everything that touches secrets runs on the server. Never put the webhook secret or pairing challenge in browser code, local storage, logs or public responses.

## 1. Data model (add to this site's database)
- \`animesavi_anime\`, \`animesavi_seasons\`, \`animesavi_episodes\`: keyed by the AnimeSavi \`id\` (UUID, permanent, never changes when titles change). Store every field from the API record plus \`source_revision\` (store as text or bigint; compare as big integers).
  - Episodes reference \`anime_id\` and \`season_id\`; seasons reference \`anime_id\`.
- \`animesavi_tombstones\`: (entity_type, entity_id, revision, kind 'unpublished'|'deleted', created_at). Keep ≥ 30 days.
- \`animesavi_processed_events\`: event_id (unique), processed_at. Keep ≥ 30 days.
- \`animesavi_connection\` (server-only, one row): connection_id, webhook_secret (encrypted or in the platform's secret store), status, changes_cursor, last_sync_at, last_error, import_state.
- If the site already has its own anime tables, map the mirrored records into them by AnimeSavi id (add a \`source_id\` column) instead of creating duplicates. Never key by title or slug.

## 2. One-click "Connect AnimeSavi" in the existing admin area
Only authenticated admins of this site can see or use it. Implement it server-side:
1. Generate a random challenge (≥ 32 URL-safe chars, e.g. 32 random bytes base64url), store it with a 10-minute expiry, single use.
2. Make sure the public webhook endpoint (section 4) is deployed and answers the verification request: when the body \`type\` is \`"animesavi.verification"\`, look up the challenge; if it is pending and unexpired, respond HTTP 200 with JSON \`{"challenge": <same>, "hub_nonce": <same>}\` and mark the challenge used. Otherwise respond 400.
3. From the server: \`POST ${PUBLIC_BASE_URL}/v1/connections/pair\` with JSON
   \`{"site_name": "<this site name>", "site_origin": "https://<this site's public domain>", "webhook_url": "https://<same domain or a subdomain>/<your webhook path>", "challenge": "<challenge>"}\`
   Requirements: HTTPS, default port 443, public domain name (no IPs, localhost or internal hosts), webhook on the same domain as site_origin or its subdomain. Use the site's published production domain, not a preview URL that requires login.
4. On HTTP 201 the response contains \`connection_id\`, \`webhook_secret\` (shown once) and \`changes_cursor\`. Store the secret server-side immediately. Approval is automatic — there is no manual approval step.
5. Start the initial Full Mirror import (section 3). Show the admin real status only: Connected / Importing (x of y) / Synced at … / Error with message. Never show "synced" before the import really finished.
6. Provide "Disconnect" (section 7), "Send test webhook" (\`POST /v1/connections/me/test\`) and "Re-sync now" buttons in the same admin panel.
Errors: 400 invalid/unsafe input, 422 verification failed (your endpoint did not echo), 429 too many attempts.

## 3. Initial Full Mirror import (safe)
1. GET \`/v1/catalog/anime?limit=200\` → save \`changes_cursor\` from the FIRST page. Follow \`page.next_cursor\` until \`has_more\` is false. Do the same for \`/v1/catalog/seasons\` and \`/v1/catalog/episodes\`.
2. Write into a staging set (or mark rows with an import run id); do not touch the live catalogue until the import is complete.
3. Validate: GET \`/v1/catalog/stats\` and compare totals with the counts you received (allow small differences caused by edits during the import; the change feed fixes them). Any network error, non-200, malformed JSON or missing page = import FAILED → keep the existing catalogue unchanged, record the error, retry later with backoff.
4. Only after a complete, validated import: upsert everything by id, then remove local AnimeSavi records whose ids were NOT in the snapshot (that is the only bulk deletion ever allowed).
5. Then process the change feed from the saved \`changes_cursor\` (section 6) and switch on webhooks + polling.

## 4. Webhook endpoint (public server route)
Request: \`POST\` JSON with headers \`X-AnimeSavi-Event\` (content.changes | ping | verification), \`X-AnimeSavi-Delivery\`, \`X-AnimeSavi-Signature: t=<unix>,v1=<hex>[,v1=<hex>]\`.
1. Read the RAW body text before parsing JSON.
2. Verification requests (type \`animesavi.verification\`) are unsigned: handle as in section 2 step 2.
3. Everything else: verify the signature — HMAC-SHA256 with the webhook secret over \`<t>.<raw body>\`, hex encoded; accept if ANY v1 value matches (constant-time compare) and |now − t| ≤ 300 s. Otherwise 401.
4. \`ping\` → 200.
5. \`content.changes\` → apply \`events\` (section 5) inside a transaction, record each \`event_id\` in processed_events, save \`next_cursor\` if it is ahead of your stored cursor, THEN respond 200. Respond non-2xx if anything failed; the Hub retries with exponential backoff. Respond within 10 seconds (queue heavy work if needed, but only acknowledge after it is durably stored).

## 5. Applying events (idempotent, order-independent)
Each event: \`event_id, type, entity_type (anime|season|episode), entity_id, anime_id, season_id, action (upsert|unpublish|delete), revision, data, fetch_url\`.
- Skip events whose event_id is already processed. Deliveries can repeat and arrive out of order.
- Compare revisions as big integers (e.g. BigInt). Never let an older revision overwrite a newer one.
- **upsert**: \`data\` is the current public record.
  - Blocked if a 'deleted' tombstone exists for this id.
  - Blocked if an 'unpublished' tombstone has a higher revision.
  - Apply when there is no local row or \`revision >= local source_revision\`; clear the 'unpublished' tombstone.
  - Episodes/seasons: apply only if their parent anime (and season) exist locally. If a parent is missing, call \`GET /v1/anime/{anime_id}\` and import the complete subtree.
  - anime.upsert for an anime you do not have yet (or that was unpublished): \`GET /v1/anime/{id}\` and import all seasons/episodes it returns.
- **unpublish**: remove the entity from the public catalogue (for anime: also its seasons and episodes; for seasons: its episodes). Store an 'unpublished' tombstone with the event revision.
- **delete**: remove permanently (cascade like unpublish). Store a 'deleted' tombstone — ids are never reused.
- \`GET /v1/anime/{id}\` returns \`complete: true\`: its seasons/episodes are the full published subtree, so local children of that anime missing from it may be removed. HTTP 404 with code \`not_public\` is authoritative (treat as unpublish). Any 5xx/429/timeout is NOT a deletion — retry later.

## 6. Backup polling and recovery
- Every ~5 minutes (±60 s random jitter, exponential backoff on errors up to 1 hour) call \`GET /v1/changes?cursor=<stored cursor>&limit=200\`. Apply events, store \`next_cursor\`, repeat while \`has_more\` is true. Send \`If-None-Match\` with the last ETag when supported.
- If the response is 410 \`cursor_expired\` (cursor older than 30 days) run the full safe import again.
- Use a scheduled job/cron of this platform for polling. Never poll the full catalogue frequently — only the change feed.
- After downtime nothing is lost: polling from the stored cursor catches up, and the Hub keeps retrying webhooks with exponential backoff for about a day, then every 12 hours, until your endpoint answers again.

## 7. Connection management (signed requests)
Sign server-side requests to \`/v1/connections/me*\` with headers:
\`X-AnimeSavi-Connection: <connection_id>\`, \`X-AnimeSavi-Timestamp: <unix seconds>\`, \`X-AnimeSavi-Nonce: <random 16-128 URL-safe chars, single use>\`,
\`X-AnimeSavi-Signature: v1=<hex HMAC-SHA256(secret, "<timestamp>.<nonce>.<METHOD>.<path>.<raw body>")>\` where path is e.g. \`/v1/connections/me\` (no query string, body "" for GET).
- Status: \`GET /v1/connections/me\` · Test: \`POST /v1/connections/me/test\` · Resume/replay: \`POST /v1/connections/me/resume\` with optional \`{"replay_from_cursor": "..."}\` · Rotate: \`POST /v1/connections/me/rotate-secret\` (store the new secret; the old one keeps working for 24 h) · Disconnect: \`POST /v1/connections/me/disconnect\`.
- On disconnect: stop polling, delete the stored secret, keep or remove the mirrored catalogue as the admin chooses (ask in the UI).

## 8. Display
Show mirrored anime and episodes using this site's existing design. Respect \`visibility\` (always "published" in the API) separately from \`release.status\` (ongoing/completed). Stream URLs in \`streams\` are public by design. Credit AnimeSavi where appropriate.

## 9. Test before reporting done
Test with the real API: pairing succeeds; import produces exactly the published totals; a repeated webhook does not duplicate rows; an older revision does not overwrite a newer one; an invalid signature gets 401; a failed import leaves the existing catalogue intact; polling advances the cursor; disconnect revokes access. Report honestly what was and was not tested.
`
