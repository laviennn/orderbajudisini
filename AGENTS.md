AGENTS.md --- Codex Instructions
You are implementing the Thrift Commerce project.
Mandatory Reading
Read documents/00-README.md, then all domain docs relevant to your task.
The documents are authoritative.
Non-Negotiables
- Next.js App Router + TypeScript.
- Neon PostgreSQL + Drizzle.
- Cloudflare R2 for media; payment proofs private.
- Manual bank transfer; no payment gateway in MVP.
- Customer checkout requires no account.
- Admin/operator RBAC is server-enforced.
- Inventory/order creation is transaction-safe.
- Product detail includes approved product reviews.
- Admin supports product upload, operator creation, payment
  management, order management, and editable basic SEO/meta title/meta
  description.
- Mobile-first.
- No fabricated production content.
- Follow 20-ANTI-AI-SLOP.md.
Work Method
1. Inspect existing code before editing.
2. State/derive the smallest coherent implementation plan.
3. Reuse patterns and tokens.
4. Implement end-to-end, including errors/loading/permissions.
5. Run typecheck/lint/tests/build relevant to the change.
6. Do not claim completion with failing checks.
7. If an external provider is not configured, implement a typed adapter
   and explicit configuration state; never fake successful production
   data.
UI Rule
A working page that looks like an untouched template is not finished.