# Shadcn Base UI Initialization

## Status

`ready`

## Problem

The initial shadcn setup used defaults that brought in Radix/Lucide instead of the required Base UI + Vega + Hugeicons amber preset.

## User Impact

Frontend contributors now get consistent component primitives and theme defaults across both `apps/web` and `apps/docs-site`.

## UI Changes

No product feature UI changes yet. Foundation theming and component system defaults were aligned.

## API Changes

No API changes.

## Security Considerations

No auth or permissions changes.

## Migration and Rollout

Run `bun run ui:init` once after cloning to initialize or re-align both apps.

## Acceptance Criteria

- [x] `components.json` in both apps is `base-vega` with `iconLibrary: hugeicons`.
- [x] `src/styles.css` in both apps includes amber theme tokens and `--radius: 0`.
- [x] `radix-ui` and `lucide-react` are removed from both app dependencies.

## Owner

Frontend platform

## Last Updated

`2026-02-06`
