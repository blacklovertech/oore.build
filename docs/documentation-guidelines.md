# Documentation Guidelines (Public Docs Site)

These guidelines govern the public documentation site at `apps/docs-site/docs/`. They are separate from `docs/documentation-policy.md`, which governs internal feature docs in `docs/features/`.

## Diataxis Classification

Every page must be exactly one type:

| Type | Location | Purpose | Voice |
|------|----------|---------|-------|
| Tutorial | `getting-started/` | Learning-oriented, sequential | "Let's build..." |
| Guide | `guides/` | Task-oriented, one task per page | "How to..." |
| Reference | `reference/` | Information-oriented, precise | Declarative, tables |
| Explanation | `concepts/` | Understanding-oriented | "Why..." |
| Operations | `operations/` | Operator runbooks | Imperative checklists |

If a page can't be classified into exactly one type, it's doing too much — split it.

## Implementation Status Labels

Every page must include a `status` frontmatter field:

```yaml
---
status: implemented    # Feature is fully implemented and verified
status: preview        # Feature exists but may change
status: placeholder    # Feature is planned but not yet implemented
---
```

Pages with `placeholder` status must display a visible banner:

```md
::: warning NOT YET IMPLEMENTED
This feature is planned but not yet available. The information below describes expected behavior based on the platform contract.
:::
```

Guides must never reference placeholder features without clearly marking them.

**Migration note:** The `status` frontmatter requirement applies to new and revalidated pages only. Old pages that haven't been migrated yet are exempt.

## Prerequisites Section

Every guide and tutorial must open with a "What you need" section listing:

- **Required role** (e.g., owner, admin)
- **Prior steps** completed, with links to those pages
- **External accounts** needed, with links to sign-up pages
- **Tools** required, with versions and install links

**Rule: Never tell the user to "upload X" without linking to how to obtain X.**

## External Reference Linking

When a task involves an external system:

- Link to the canonical docs for that system's step
- Use descriptive link text, not bare URLs
- Note when external UIs change frequently

## Source Code Parity

Reference pages (API, CLI, config) must be verified against source code:

- Error codes must match `crates/oored/src/`
- HTTP methods and routes must match Axum router in `crates/oored/src/lib.rs`
- CLI flags must match Clap definitions in `crates/oore/src/main.rs`
- When in doubt, grep the source — never copy-paste from old docs without verification

## Writing Checklists

### Tutorials
- [ ] Clear outcome stated upfront
- [ ] Copy-pasteable commands
- [ ] Expected output shown after each command
- [ ] No architecture internals (Zustand stores, SQLite schema, etc.)

### Guides
- [ ] Imperative title ("Configure X", not "X Configuration")
- [ ] Numbered steps
- [ ] One action per step
- [ ] Ends with a verification step
- [ ] External prerequisites linked

### Reference
- [ ] Every field/param/option documented
- [ ] Consistent formatting across pages
- [ ] Request and response examples
- [ ] Matches actual implementation

### Explanation
- [ ] Answers "why" not "how"
- [ ] Links to guides/reference for practical steps

## Anti-Patterns (reject in review)

1. "Upload your certificate" without linking to how to get one
2. Zustand store fields or route guard internals in user docs
3. "See the source code for details"
4. Single page mixing tutorial + reference + explanation
5. Dead internal links
6. Bare URLs without descriptive text
7. Guide that references an undocumented API endpoint
8. Documenting unimplemented features without a `placeholder` banner
9. Reusing old docs content without revalidating against source code

## Maintenance Rules

- New API endpoint added? Update the reference page in the same PR
- New user-facing feature? Add or update at least one guide
- VitePress sidebar must include every page (no orphans)
- CLI reference pages must be re-verified when `crates/oore/src/main.rs` changes
