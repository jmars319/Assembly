# Module Manifest

Generated from `tenra Hub/contracts/handoff-catalog.json` by `tenra Hub/scripts/generate-suite-contract-docs.mjs`.

## Standalone Mode

Runs as a complete document and project-note workspace with local drafting, content records, project notes, and proxy-notice export.

## Repository Path

`business/supporting/tenra Assembly`

## Required Suite Dependencies

- None

## Optional Suite Dependencies

- tenra Registry: Optional document request intake.
- tenra Scout: Optional opportunity-to-draft intake.
- tenra Proxy: Optional tone and format shaping for outbound notices.
- tenra Derive: Optional reasoning brief intake for content drafting.
- tenra Sentinel: Optional risk brief intake for content context.
- Vicina by tenra: Optional workflow signal intake.

## Provides

- document drafting
- content assembly
- project-note inbox
- proxy notice handoff

## Consumes

- registry document request
- scout opportunity
- derive reasoning brief
- sentinel risk brief
- vicina workflow signal

## Contracts

Emits:

- `tenra-assembly.proxy-notice-handoff.v1`

Accepts:

- `tenra-registry.assembly-document-request.v1`
- `tenra-scout.opportunity-handoff.v1`
- `tenra-facet.orientation-packet.v1`
- `tenra-derive.reasoning-brief.v1`
- `tenra-sentinel.risk-brief.v1`
- `tenra-vicina.workflow-handoff.v1`

## Rules

- Each app must remain complete and usable without another tenra app running.
- Suite integrations are optional module links, not required runtime dependencies.
- Shared functions should be exposed through explicit local APIs, exports, imports, or schemas.
- No app may read another app's private filesystem, database, or localStorage state.
- Registry can index and audit the module graph, but it must not become a hidden runtime bus.
