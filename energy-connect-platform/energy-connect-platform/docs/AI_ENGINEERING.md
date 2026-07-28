# AI-assisted engineering workflow

AI tools can accelerate engineering, but generated output is treated as untrusted until verified.

Useful tasks:

- generate test-case ideas from an interface or incident description;
- propose debugging hypotheses from structured logs and metrics;
- review code for missing error paths, race conditions and observability gaps;
- draft migration/checklist documentation;
- explain unfamiliar SDK behavior before confirming against primary documentation.

Guardrails:

- never paste secrets, tokens, customer data or private production payloads into external tools;
- run tests and static checks after generated code changes;
- review SQL migrations and infrastructure changes manually;
- verify cloud/service claims against official documentation;
- prefer small, reviewable diffs over large generated rewrites.

This demonstrates familiarity with AI-assisted engineering workflows while preserving human judgment and verification.
