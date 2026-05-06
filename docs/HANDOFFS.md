# tenra Assembly Handoffs

tenra Assembly stays a unique app because human-approved content production, review gates, templates, and export workflows form a real workbench.

## Consumes

- `tenra-scout.opportunity-handoff.v1` for opportunity briefs and outreach content.
- `tenra-registry.assembly-document-request.v1` for customer letters, notices, statements, agreements, and other rental documents.
- `tenra-derive.reasoning-brief.v1` for structured answer cards that need to become publishable or reusable content.
- Proxy-shaped output plus validation/rewrite traces for final editorial review.

## Produces

- Markdown exports and JSON workbench backups.
- Draft content that can be sent to Proxy before external delivery.
- External delivery candidates that should go through Guardrail when publishing, emailing, or writing to another system.

Assembly should not own search, risk assessment, voice enforcement, or operational permission decisions.
