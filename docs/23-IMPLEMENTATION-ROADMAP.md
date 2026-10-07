# Implementation roadmap — current delivery sequence

The source roadmap in `documents/23-IMPLEMENTATION-ROADMAP.md` used an earlier numbering scheme. Later explicit user instructions define the sequence below; they take precedence. The original domain scope is retained.

| Phase | Status                                                                   | Scope                                                                                                                                |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Implemented; prelaunch deployment recorded separately                    | Next.js/TypeScript, tokens, configuration, DB/Auth/R2 infrastructure                                                                 |
| 1A    | Implemented and locally verified; production migration/bootstrap pending | Database, authentication, RBAC, audit, transactional commerce and promotion foundations                                              |
| 2     | Missing at Phase 3 audit; recovered by Phase 3.5                         | Admin Product Management + verified Cloudflare R2 Media Pipeline                                                                     |
| 3     | Implemented in repository; not deployed                                  | Storefront, catalog/category/search/filter/sort, detail/reviews, cart, server pricing preview, SEO and analytics abstraction         |
| 3.5   | Implemented and locally verified; not deployed                           | Recovery of admin product/category operations, private-source upload, optimized media variants, removal/retry and cache invalidation |
| 4     | Not started                                                              | Checkout + Shipping Rates + Transactional Order Creation + Inventory Reservation + Final Server-Side Pricing                         |
| Later | Not started as customer/admin flows                                      | Payment proofs/verification UI, WhatsApp confirmation, shipping/tracking, full admin/content operations and launch hardening         |

Phase 3 reused Phase 1A and accurately reported the absent Phase 2 tooling. Phase 3.5 now supplies that tooling without rewriting the storefront. Production migration/bootstrap, deployment and real R2 configuration verification remain release tasks. No checkout or payment upload UI is exposed.

Recovery details: [ADMIN-PRODUCT-IMPLEMENTATION.md](ADMIN-PRODUCT-IMPLEMENTATION.md) and [MEDIA-PIPELINE.md](MEDIA-PIPELINE.md).

Detailed status, tests and open decisions: [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Storefront architecture and prerequisites: [STOREFRONT-IMPLEMENTATION.md](STOREFRONT-IMPLEMENTATION.md).
