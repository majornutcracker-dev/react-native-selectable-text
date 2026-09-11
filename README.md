# @majornutcracker/react-native-selectable-text

Expo module for **iOS and Android** built on `react-native-webview`. It renders
HTML with advanced text selection, custom context menus, and persistent
highlighting via [Rangy](https://github.com/timdown/rangy), with a native bridge
(Swift/Kotlin) to serialize, sync, and restore selections.

Web is not supported.

## Installation

```
npm install @majornutcracker/react-native-selectable-text
```

This is an Expo module. In bare React Native projects,
[install and configure `expo`](https://docs.expo.dev/bare/installing-expo-modules/)
first, then run `npx pod-install`.

**Peer dependencies:** `expo`, `react`, `react-native`, and
`react-native-webview` `^13.16.1` (`>=13.16.1 <14`; v14 ships incompatible types).

## Quick start

```tsx
import * as React from "react";
import {
  SelectableTextView,
  SelectableTextViewRef,
  Highlighter,
} from "@majornutcracker/react-native-selectable-text";

const highlighters: Highlighter[] = [
  {
    name: "yellow-highlighter",
    options: { type: "background-color", color: "yellow" },
  },
];

export default function Screen() {
  const ref = React.useRef<SelectableTextViewRef>(null);

  return (
    <SelectableTextView
      ref={ref}
      content="<h1>Hello</h1><p>Select some text and highlight it.</p>"
      css=".content { padding: 16px; font-size: 18px; }"
      highlighters={highlighters}
      onHighlightsChange={(highlights) => {
        // Persist this serialized string to restore highlights later.
        console.log(highlights);
      }}
      onHighlightPressed={(highlight) => {
        console.log("pressed", highlight.id, highlight.name, highlight.text);
      }}
    />
  );
}

// Highlight the current selection from anywhere with the ref:
// ref.current?.highlightSelection("yellow-highlighter");
```

Pass that serialized string back through the `highlights` prop to restore the
highlights on remount.

## Documentation

- **[API reference](./docs/REFERENCE.md)** — every prop, callback, and ref
  method, plus highlighter styles and animations, fonts, error codes, ignored
  elements, and the content trust boundary.
- **[`example/`](./example)** — a runnable reader app with three documents, each
  a different HTML/CSS design, showing animated highlight entrances and exits.
  Open the native projects with `yarn open:ios` / `yarn open:android`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup,
workflow, and commit conventions.

Hit a blocker, need a feature, or found a bug? [Open an issue](https://github.com/majornutcracker-dev/react-native-selectable-text/issues)
— we follow them closely and keep improving the library.

## License

MIT — see [LICENSE](./LICENSE).

This package bundles [Rangy](https://github.com/timdown/rangy) (© Tim Down, MIT).
See [THIRD-PARTY-NOTICES.md](./docs/THIRD-PARTY-NOTICES.md).
