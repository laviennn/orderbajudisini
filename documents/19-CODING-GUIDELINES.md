# Coding Guidelines

## TypeScript

-   strict mode
-   no casual `any`
-   domain types explicit
-   infer from Zod/Drizzle where useful without coupling everything

## React/Next.js

-   Server Components default
-   client boundary as low as practical
-   do not use `useEffect` for server-fetchable initial data
-   no giant page components
-   separate domain logic from presentation
-   use route-level loading/error/not-found intentionally

## Naming

-   components: PascalCase
-   functions/variables: camelCase
-   DB: consistent snake_case or project convention
-   permissions: `domain.action`
-   environment variables documented

## Error Handling

-   user-friendly messages
-   structured server logs
-   provider errors normalized
-   no swallowed errors
-   no raw exception/SQL details in UI

## Data

-   migrations are source-controlled
-   seed only legitimate development fixtures
-   production seed must never create fake customer reviews/orders
-   money stored as integer smallest unit
-   dates UTC in DB; format in application locale

## Comments

Explain why, not obvious syntax. Do not fill files with AI-generated
narrative comments.

## Dependencies

Before adding a dependency: 1. verify native/framework capability is
insufficient 2. prefer maintained package 3. avoid large package for
tiny utility 4. document meaningful architectural dependencies

## Git/Commits

Small coherent changes. Do not mix schema migration, visual redesign,
and unrelated refactor in one opaque commit when avoidable.
