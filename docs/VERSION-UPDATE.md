# Updating the version

The package version follows [Semantic Versioning](https://semver.org/). `package.json`
is the source of truth, but several native files **hardcode** the same version and must be
kept in sync by hand. This guide lists every place to change and how to pick the bump.

## Which bump?

Given `MAJOR.MINOR.PATCH`:

- **PATCH** (`1.0.0 → 1.0.1`) — bug fixes only; no public API change.
- **MINOR** (`1.0.0 → 1.1.0`) — new backward-compatible API (a new prop, ref method, callback,
  highlighter option, or bridge event that doesn't break existing usage).
- **MAJOR** (`1.0.0 → 2.0.0`) — breaking change to the public API or the RN ↔ WebView bridge
  contract (renamed/removed prop or method, changed message shape, changed default behavior).

## Files to update (must all match)

| File                                                                                                                       | What to change                                | Note                                       |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| `package.json`                                                                                                             | `"version"`                                   | Source of truth.                           |
| `src/types.ts`                                                                                                             | `export const VERSION`                        | JS constant exposed to consumers.          |
| `android/build.gradle`                                                                                                     | `version = '…'`                               | Semver string.                             |
| `android/build.gradle`                                                                                                     | `versionName "…"`                             | Semver string (same value).                |
| `android/build.gradle`                                                                                                     | `versionCode`                                 | **Integer, +1 every release** (see below). |
| `android/src/main/java/com/majornutcracker/reactnativeselectablewebview/MajornutcrackerReactNativeSelectableTextModule.kt` | the string inside `Constant("version") { … }` | Native `version` constant (Android).       |
| `ios/MajornutcrackerReactNativeSelectableTextModule.swift`                                                                 | the string inside `Constant("version") { … }` | Native `version` constant (iOS).           |

### `versionCode` is not the semver

`versionCode` is an Android build counter. It must **increase by exactly 1 on every release**,
regardless of whether the release is a patch, minor, or major. It is independent of
`versionName`/semver.

## Do NOT edit (auto-derived)

- `ios/MajornutcrackerReactNativeSelectableText.podspec` — `s.version = package['version']`
  reads `package.json` at pod-install time. Its `summary`, `description`, `license`, `author`,
  and `homepage` also come from `package.json`. Leave it alone.
- `example/` — the example app has its own versioning that is irrelevant to the published
  package. Do not bump it as part of a release.

## Changelog

[`CHANGELOG.md`](../CHANGELOG.md) follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
For each release:

1. Rename `## [Unreleased]` to `## [1.1.0] - YYYY-MM-DD` (release date, ISO format) and add a
   fresh, empty `## [Unreleased]` above it.
2. Group the entries under `### Added`, `### Changed`, `### Deprecated`, `### Removed`,
   `### Fixed`, or `### Security`.
3. Update the link references at the bottom:
   ```md
   [unreleased]: https://github.com/majornutcracker-dev/react-native-selectable-text/compare/v1.1.0...HEAD
   [1.1.0]: https://github.com/majornutcracker-dev/react-native-selectable-text/compare/v1.0.0...v1.1.0
   ```

This file is maintainer-only: it is excluded from the npm package (see `files` in
`package.json`), while the rest of `docs/` ships.

## Verify everything matches

After bumping, confirm there is no drift (replace with the new version):

```sh
grep -RIn "1\.1\.0" \
  package.json \
  src/types.ts \
  android/build.gradle \
  android/src/main/java/com/majornutcracker/reactnativeselectablewebview/MajornutcrackerReactNativeSelectableTextModule.kt \
  ios/MajornutcrackerReactNativeSelectableTextModule.swift
```

Every listed file should appear (and `versionCode` should be one higher than before).

## Suggested release flow

Publishing is automated: the [`Release`](../.github/workflows/release.yml) workflow triggers on
any pushed tag matching `v*.*.*`. Do **not** run `npm publish` by hand.

1. Bump all files above and update `CHANGELOG.md`.
2. Commit — `bump:` or `chore:` per the commit conventions, e.g. `bump: v1.1.0`.
3. Push the commit to `main` and let CI pass.
4. Tag and push the tag:
   ```sh
   git tag v1.1.0
   git push origin v1.1.0
   ```
5. The workflow then, in order: verifies the tag matches `package.json`, checks the native files
   for version drift (the table above), runs lint/test/typecheck, publishes to npm with
   provenance (the `prepublishOnly` script builds first), and opens a GitHub Release with
   generated notes.

If the tag and `package.json` disagree, or any native file still holds the old version, the
workflow fails **before** publishing. To recover, delete the tag (`git push --delete origin
v1.1.0`), fix the versions, and re-tag.

### Required repository secret

- `NPM_TOKEN` — an npm automation token with publish rights on the `@majornutcracker` scope.

> Tip: the native/gradle files duplicate the version by hand, which is easy to forget. A future
> improvement is to read the version from `package.json` in `build.gradle` and expose the JS
> `VERSION` from the native `version` constant, so only `package.json` needs bumping.
