# API Hub
- hub_public_* views are the only definition of "published"; change eligibility there, not in endpoint code.
- Triggers bump content_revision and write hub_content_events in the content transaction (durable outbox); never write events from app code.
- Feed/delivery cursor is (tx_id, seq) and only serves events below the snapshot xmin, so in-flight transactions are never skipped.
- contract.ts is the single source for the OpenAPI schema and Integration Prompt; the API serves it and /developers imports it, so edit only there.
- Events carry the entity's current public state at delivery time, so late or repeated deliveries cannot restore stale data.
