# Suite Handoff Standard

Generated from `tenra Hub/contracts/handoff-catalog.json` by `tenra Hub/scripts/generate-suite-contract-docs.mjs`.

## App Role

document and content assembly module

keep unique; other apps may call Assembly for draft creation, but every producer must still be useful without Assembly.

## Standalone Mode

Runs as a complete document and project-note workspace with local drafting, content records, project notes, and proxy-notice export.

## Repository Path

`business/supporting/tenra Assembly`

## Accepted Inputs

- `tenra-registry.assembly-document-request.v1` from tenra Registry
- `tenra-scout.opportunity-handoff.v1` from tenra Scout
- `tenra-facet.orientation-packet.v1` from tenra Facet
- `tenra-derive.reasoning-brief.v1` from tenra Derive
- `tenra-sentinel.risk-brief.v1` from tenra Sentinel
- `tenra-vicina.workflow-handoff.v1` from Vicina by tenra

## Emitted Outputs

- `tenra-assembly.proxy-notice-handoff.v1` to tenra Proxy

## Standard Controls

- schema badge
- preview payload
- copy payload
- send or export
- history
- download JSON
- replay
- destination presets
- endpoint health
- retry failed
- payload inspection
- brief comparison
- version comparison
- inline errors
- workflow timeline

## Status Vocabulary

- `draft`: Payload or route exists locally but has not been previewed.
- `previewed`: Payload was built and inspected without delivery.
- `queued`: Delivery is waiting for an endpoint, retry, or operator action.
- `sent`: Producer posted or exported the payload successfully.
- `accepted`: Consumer parsed and retained the payload.
- `rejected`: Consumer refused the payload for schema, routing, safety, or policy reasons.
- `failed`: Delivery failed before acceptance or rejection was known.
- `replayed`: Registry or a producer regenerated a prior payload for another delivery attempt.
- `received`: Consumer acknowledged receipt back to the source app.
- `dismissed`: Operator intentionally removed an item from an inbox, queue, or retry list.

## Local Storage

Prefix: `tenra.assembly`

- `tenra.assembly.registryInbox.v1`
- `tenra.assembly.scoutInbox.v1`
- `tenra.assembly.proxyNoticeHistory.v1`

## Endpoints

- POST `/api/handoffs/registry-document` - Registry document intake
- POST `/api/handoffs/scout-opportunity` - Scout opportunity intake
- POST `/api/handoffs/proxy-notice` - Proxy notice intake
