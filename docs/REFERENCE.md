# API Reference

`SelectableTextView` renders an HTML string inside a WebView with native text
selection, [Rangy](https://github.com/timdown/rangy)-backed highlights, and a
message bridge to React Native.

This page is the full surface. For a quick start see the
[README](../README.md); for a runnable demo see [`example/`](../example).

## Props

| Prop                 | Description                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content`            | The HTML string rendered inside the WebView. Changing it does **not** re-render — remount the component to show new content.                                                                         |
| `css`                | Injected styles for layout and typography. Scope your rules to a wrapper class to avoid clashing with the SDK's own classes.                                                                         |
| `fonts`              | WebView font setup via `googleFonts()`, `mergeFonts()`, or custom `preconnect`, `stylesheets`, and `@font-face` rules. Multiple families are supported in a single config.                           |
| `highlighters`       | Named highlight classes. A name must be a valid CSS class name — letters, digits, `-` and `_`, not starting with a digit — and invalid names are dropped with a console warning.                     |
| `highlights`         | **State prop.** Serialized highlights to restore. `undefined` leaves the current highlights untouched; an empty string clears them. Obtain the value from `getHighlights()` or `onHighlightsChange`. |
| `highlighterOptions` | `ignoredElements` — tags or selectors such as `a`, `sup`, `.ignored`. Ignored nodes skip the visible highlight but stay selectable and copyable.                                                     |
| `options`            | Viewport zoom: `userScalable`, `initialScale`, `maximumScale`.                                                                                                                                       |
| `webViewProps`       | Pass-through to `react-native-webview`. `javaScriptEnabled`, `source`, and `onShouldStartLoadWithRequest` are owned by the component and cannot be overridden.                                       |

## Callbacks

| Callback                                     | Fires when                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onTextSelectionChange(text)`                | The selection changes. Receives the selected text, or `""` when the selection is cleared.                                                                                            |
| `onHighlightsChange(highlights)`             | The serialized highlight payload changes. Feed this back into the `highlights` prop to persist and restore.                                                                          |
| `onLink(url)`                                | A link is tapped. Without this prop, `http(s)` URLs open through `Linking`.                                                                                                          |
| `onError(error)`                             | The WebView SDK reports an error: `{ code, message, details }`. Try highlighting over an existing highlight for `overlapping_highlight`, or with no selection for `empty_selection`. |
| `onHighlightPressed(highlight)`              | A highlight is tapped. Receives `{ id, name, text }`. Return a `className` to style the pressed highlight (define it in `css`), or return nothing to leave it unstyled.              |
| `onHighlightsVisibilityStateChange(visible)` | Highlight visibility changes. Receives `true` when visible, `false` when hidden.                                                                                                     |

A callback that throws is caught and logged rather than crashing the bridge, so
a bug in your handler will not take the component down with it.

## Ref API

### Highlighting

- **`highlightSelection(name?)`** — applies a highlighter to the cached selection.
- **`highlightSelectionWithValidation(validation, name?)`** — highlights only if `validation(text)` returns, or resolves to, `true`.
- **`unhighlightSelection()`** — removes the highlight from the cached selection.
- **`unhighlightById(id)`** — removes a single highlight.
- **`clearHighlights()`** — removes every highlight from the content.

### Reading state

- **`getSelectedText(): Promise<string>`** — the cached selected text.
- **`getHighlights(): Promise<string>`** — the serialized highlights string, suitable for the `highlights` prop.
- **`getAllHighlightsData(): Promise<HighlightData[]>`** — an array of `{ id, name, text }` for every highlight.
- **`getHighlightsVisibilityState(): Promise<boolean>`** — `true` when highlights are visible.

### Focus and visibility

- **`focusHighlight(id, className?)`** — scrolls to a highlight and applies a focus style. Pass a `className` to style it through `css`, or omit it for the default focus style.
- **`unfocusHighlight()`** — removes the focus style without deleting the highlight.
- **`toggleHighlightsVisibility(): Promise<boolean>`** — hides or shows highlights without deleting them; resolves with the new visibility. On a document with no highlights it still flips the state, so a toggle control stays in sync.

> **`onHighlightPressed` vs `focusHighlight`** — a class name returned from
> `onHighlightPressed` is applied **in place, without scrolling**, since the user
> is already looking at what they tapped. Call `focusHighlight(id, className?)`
> when you also want the content scrolled to the highlight.

Promise-returning methods reject after a 2 second timeout, and reject with
`"Component unmounted"` if the view goes away while a call is in flight. Calls
made before the WebView finishes loading are queued and flushed on load rather
than dropped.

## Highlighters

Each `Highlighter` has a unique `name` — used as the class name of the element
wrapping the selection, so `css` rules under that class apply to every highlight
of that kind — and an `options` object. If names are repeated, the last one wins.

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

The default, when `highlighters` is omitted, is a single
`{ name: "yellow-highlighter", options: { type: "background-color", color: "yellow" } }`.

### Animations

Every option type accepts an optional `animation`. The `@keyframes` rule is
injected as-is, so it can be shared by several highlighters.

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

The `fonts` prop is injected into the WebView head. Build it by hand or with the
exported helpers:

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

- **`googleFonts({ families })`** — builds `preconnect` + stylesheet entries for
  one Google Fonts request covering every family.
- **`mergeFonts(...configs)`** — combines several configs, de-duplicating
  entries.
- **`fontsToCSS(fonts)`** / **`fontsToHeadMarkup(fonts)`** — the raw `@font-face`
  CSS and the head markup, if you need to inspect or inline them yourself.

## Ignored elements

`highlighterOptions.ignoredElements` defaults to `["a", "sup", "sub"]`. Ignored
nodes are skipped by the _visible_ highlight while remaining selectable and
copyable, which is what you want for links and for notation like H<sub>2</sub>O
or E = mc<sup>2</sup> sitting inside a sentence.

Any CSS selector works, so `.ignored` on a wrapper element opts a whole block
out of visible highlighting.

## Error codes

`onError` receives a `SelectableTextViewError` with `{ code, message, details }`.
The possible `code` values are:

| Code                                                               | Meaning                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `empty_selection`                                                  | A highlight was requested with no active selection.                 |
| `overlapping_highlight`                                            | The selection overlaps an existing highlight.                       |
| `highlight_not_found`                                              | No highlight matches the given id.                                  |
| `invalid_range`, `invalid_class_applier`, `invalid_highlight`      | Rangy rejected the range, highlighter class, or highlight payload.  |
| `initialization_error`, `bridge_message_error`                     | The WebView SDK failed to start, or a bridge message was malformed. |
| `failed_to_highlight_selection`, `failed_to_unhighlight_selection` | The highlight or unhighlight operation failed.                      |
| `failed_to_clear_highlights`, `failed_to_unhighlight_by_id`        | The removal operation failed.                                       |
| `failed_to_focus_highlight`                                        | Focusing a highlight failed.                                        |
| `unknown`                                                          | An error that does not match any of the above.                      |

## Security note

`content` is rendered as-is; the module does not sanitize it. If the HTML comes
from an untrusted source, sanitize it before passing it in. See
[SECURITY.md](../SECURITY.md) for the full trust boundary.
