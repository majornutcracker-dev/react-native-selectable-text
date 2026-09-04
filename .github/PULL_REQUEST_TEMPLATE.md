# Summary

<!-- What does this change, and why? Link the issue it closes: "Closes #123". -->

## Type of change

<!-- Match the Conventional Commit type used in your commit messages. -->

- [ ] `fix` — bug fix (no public API change)
- [ ] `feat` — new backward-compatible API
- [ ] Breaking change to the public API or the RN ↔ WebView bridge contract
- [ ] `docs` / `chore` / `ci` / `test` — no runtime change

## How was this tested?

<!--
Describe what you ran. For a native or bridge change, say which platform(s) you
verified in the example app — the injected WebView runtime is not unit-tested.
-->

- [ ] iOS (example app)
- [ ] Android (example app)

## Checklist

- [ ] `yarn lint`, `yarn typecheck`, and `yarn test` all pass.
- [ ] Public API changes are documented (JSDoc in `types.ts` **and** the README table).
- [ ] Bridge changes keep all three sides in sync: `BridgingNames` (`types.ts`),
      the WebView handler (`utils.ts`), and the RN handler (`SelectableTextView.tsx`).
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`.
- [ ] I did **not** bump the version — releases are cut separately
      (see [docs/VERSION-UPDATE.md](../docs/VERSION-UPDATE.md)).
