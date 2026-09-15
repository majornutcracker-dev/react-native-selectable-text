# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-14

Initial release.

### Added

- `SelectableTextView`: renders an HTML string inside `react-native-webview` on
  iOS and Android, with native text selection. Web is not supported.
- Persistent highlights backed by Rangy. Named highlighters style them as
  `background-color`, `text-decoration-color`, `outline-color`, or
  `background-image`, with an optional entrance or ambient animation.
  `onHighlightsChange` serializes them and the `highlights` prop restores them.
- Ref methods to highlight and unhighlight the selection, optionally behind an
  async validation; remove a highlight by id or clear them all; focus and
  unfocus a highlight; toggle highlight visibility; and read the selected text
  and the highlight data.
- Callbacks for selection changes, highlight taps (with the tapped highlight's
  position), links, visibility changes, and errors with a typed `code`.
- A bridge for custom actions: `evaluateJavaScript` runs a script in the page
  and resolves with its result, and `window.SelectableText.postMessage` sends
  page messages to `onCustomMessage`.
- Font helpers (`googleFonts()`, `mergeFonts()`), ignored elements, and viewport
  zoom options.

[unreleased]: https://github.com/majornutcracker-dev/react-native-selectable-text/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/majornutcracker-dev/react-native-selectable-text/releases/tag/v1.0.0
