# @majornutcracker/react-native-selectable-text

Expo module for **iOS and Android** built on `react-native-webview`. It enables advanced text selection, custom context menus, and persistent highlighting via [Rangy](https://github.com/timdown/rangy), with a native bridge (Swift/Kotlin) to serialize, sync, and restore HTML content selections.

**Platforms:** iOS, Android. Web is not supported.

## Installation

```
npm install @majornutcracker/react-native-selectable-text
```

This is an Expo module. In bare React Native projects, make sure you have [installed and configured the `expo` package](https://docs.expo.dev/bare/installing-expo-modules/) first, and run `npx pod-install` after installing.

### Peer dependencies

- `expo`
- `react`
- `react-native`
- `react-native-webview` `^13.16.1` (`>=13.16.1 <14`; v14 ships incompatible types)

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

Restore highlights on remount by passing the serialized string (from `getHighlights()` or `onHighlightsChange`) to the `highlights` prop.

## Props

| Prop                 | Type                        | Description                                                                                                                                                                               |
| -------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content`            | `HTMLString`                | HTML rendered inside the WebView. Changing it does **not** trigger a re-render — remount the component to render new content.                                                             |
| `css`                | `CSSString`                 | CSS injected into the WebView to style the content (and any highlighter class names).                                                                                                     |
| `highlighters`       | `Highlighter[]`             | Named highlight styles. The `name` is used as the class name wrapping the selection. Default: `[{ name: "yellow-highlighter", options: { type: "background-color", color: "yellow" } }]`. |
| `highlights`         | `Highlights` (`string`)     | Serialized highlights to restore. Re-applies whenever the string changes.                                                                                                                 |
| `fonts`              | `SelectableTextViewFonts`   | Fonts injected into the WebView head. Build manually or with the `googleFonts()` helper.                                                                                                  |
| `highlighterOptions` | `HighlighterOptions`        | Rangy options. `ignoredElements` (default `['a','sub','sup']`) are skipped by the visible highlight but stay selectable/copyable.                                                         |
| `options`            | `SelectableTextViewOptions` | Viewport zoom: `userScalable` (default `true`), `initialScale` (default `1`), `maximumScale` (default `2.5`).                                                                             |
| `webViewProps`       | `WebViewProps`              | Pass-through to `react-native-webview` (e.g. a custom selection menu).                                                                                                                    |

### Callbacks

| Prop                                | Type                                                                      | Description                                                                                                                                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onTextSelectionChange`             | `(selectedText: string) => void`                                          | Fired when the selection changes.                                                                                                                                                                                                                                          |
| `onHighlightsChange`                | `(highlights: Highlights) => void`                                        | Fired with the serialized highlights after every change. Persist this to restore later.                                                                                                                                                                                    |
| `onHighlightPressed`                | `(highlight: HighlightData) => string \| void \| Promise<string \| void>` | Fired when a highlight is tapped. Return a **class name** to apply a focus style to it (styled via the `css` prop), or `void` for no style. The style is applied **in place without scrolling**. May be async — return a `Promise` and the resolved class name is applied. |
| `onHighlightsVisibilityStateChange` | `(visibilityState: boolean) => void`                                      | Fired whenever highlight visibility changes (e.g. via `toggleHighlightsVisibility()`); receives the new state (`true` = visible, `false` = hidden).                                                                                                                        |
| `onLink`                            | `(url: string) => void`                                                   | Fired when a link is tapped. WebView does not support local navigation, so handle it yourself here.                                                                                                                                                                        |
| `onError`                           | `(error: SelectableTextViewError) => void`                                | Fired on WebView SDK errors (`code`, `message`, `details`). See [Error codes](#error-codes).                                                                                                                                                                               |

## Ref API

Access these through a `ref` typed as `SelectableTextViewRef`.

| Method                             | Signature                                                                                              | Description                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `highlightSelection`               | `(name?: HighlighterName) => void`                                                                     | Highlights the current selection with the named highlighter. If `name` is not a defined highlighter, nothing is applied.                                                  |
| `highlightSelectionWithValidation` | `(validation: (text: string) => boolean \| Promise<boolean>, name?: HighlighterName) => Promise<void>` | Reads the selected text, runs `validation` with it, and highlights only if it resolves to `true`. `validation` may be sync or async.                                      |
| `unhighlightSelection`             | `() => void`                                                                                           | Removes the highlight from the current selection.                                                                                                                         |
| `clearHighlights`                  | `() => void`                                                                                           | Removes all highlights.                                                                                                                                                   |
| `unhighlightById`                  | `(id: string) => void`                                                                                 | Removes a single highlight by id.                                                                                                                                         |
| `getSelectedText`                  | `() => Promise<string>`                                                                                | Resolves the currently selected text.                                                                                                                                     |
| `getHighlights`                    | `() => Promise<Highlights>`                                                                            | Resolves the serialized highlights string (feed it back into the `highlights` prop to restore).                                                                           |
| `getAllHighlightsData`             | `() => Promise<HighlightData[]>`                                                                       | Resolves an array of `{ id, name, text }` for every highlight.                                                                                                            |
| `focusHighlight`                   | `(id: string, className?: string) => void`                                                             | Scrolls to a highlight by id and applies a focus style. Pass a `className` (styled via the `css` prop) or omit it to use the built-in default focus style (a box-shadow). |
| `unfocusHighlight`                 | `() => void`                                                                                           | Clears the current focus style without deleting the highlight. Use after `focusHighlight`.                                                                                |
| `getHighlightsVisibilityState`     | `() => Promise<boolean>`                                                                               | Resolves `true` if highlights are visible, `false` if hidden.                                                                                                             |
| `toggleHighlightsVisibility`       | `() => Promise<boolean>`                                                                               | Toggles highlight visibility without deleting them; resolves the new state.                                                                                               |

> **`onHighlightPressed` vs `focusHighlight`** — returning a class name from `onHighlightPressed` applies the focus style **in place** (no scroll), since the user is already looking at what they tapped. Call `focusHighlight(id, className?)` when you also want to scroll the content to the highlight.

### Highlighters

Each `Highlighter` has a unique `name` (used as the wrapping element's class name, so you can add extra rules under that class in `css`) and an `options` object. If names are repeated, the last one wins.

```ts
type Highlighter = {
  name: string;
  options:
    | { type: "background-color"; color: string; animation?: AnimationOptions }
    | {
        type: "text-decoration-color";
        color: string;
        line?: "underline" | "overline" | "line-through";
        thickness?: number;
        offset?: number;
        style?: "solid" | "double" | "dotted" | "dashed" | "wavy";
        animation?: AnimationOptions;
      }
    | {
        type: "outline-color";
        color: string;
        width?: number;
        offset?: number;
        style?:
          | "solid"
          | "dotted"
          | "dashed"
          | "double"
          | "groove"
          | "ridge"
          | "inset"
          | "outset";
        animation?: AnimationOptions;
      }
    | {
        type: "background-image";
        image: string;
        position?: string;
        repeat?: string;
        size?: string;
        animation?: AnimationOptions;
      };
};
```

Every option type accepts an optional `animation`:

```ts
type AnimationOptions = {
  name: string; // keyframes name
  keyframesCss: string; // the @keyframes rule, injected as-is
  duration: string; // e.g. "2s"
  timingFunction:
    "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | string;
  iterationCount: number | "infinite";
};
```

```ts
const highlighters: Highlighter[] = [
  {
    name: "pulse",
    options: {
      type: "background-color",
      color: "#ffe08a",
      animation: {
        name: "pulse-anim",
        duration: "1.5s",
        timingFunction: "ease-in-out",
        iterationCount: "infinite",
        keyframesCss: `@keyframes pulse-anim { 0% { opacity: 1; } 50% { opacity: .6; } 100% { opacity: 1; } }`,
      },
    },
  },
];
```

## Fonts

Inject fonts into the WebView head with the `fonts` prop. Use the exported helpers or build the config manually:

```ts
import {
  googleFonts,
  mergeFonts,
  fontsToCSS,
  fontsToHeadMarkup,
} from "@majornutcracker/react-native-selectable-text";

const fonts = googleFonts({
  families: [{ family: "Inter", weights: "400;700" }],
});
// <SelectableTextView fonts={fonts} ... />
```

## Error codes

`onError` receives a `SelectableTextViewError` with a `code`:

`unknown`, `overlapping_highlight`, `empty_selection`, `invalid_range`, `invalid_class_applier`, `invalid_highlight`, `initialization_error`, `bridge_message_error`, `failed_to_highlight_selection`, `failed_to_unhighlight_selection`, `failed_to_clear_highlights`, `highlight_not_found`, `failed_to_focus_highlight`, `failed_to_unhighlight_by_id`.

## Example

A full demo lives in [`example/`](./example) (`MainTest` screen). Open the native projects with `yarn open:ios` / `yarn open:android`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, workflow, and commit conventions.

## License

MIT — see [LICENSE](./LICENSE).

This package bundles [Rangy](https://github.com/timdown/rangy) (© Tim Down, MIT). See [THIRD-PARTY-NOTICES.md](./docs/THIRD-PARTY-NOTICES.md).
