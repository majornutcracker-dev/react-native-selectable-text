# Snack demo

**Published at
[snack.expo.dev/@majornutcracker/selectabletext](https://snack.expo.dev/@majornutcracker/selectabletext)**
— that is the one to update, and the one linked from the README, the directory
listing and anywhere else the demo is shared. It can also be embedded on a page
with `data-snack-id="@majornutcracker/selectabletext"` plus
`snack.expo.dev/embed.js`; GitHub strips scripts, so the README keeps the plain
link.

The source of the [Expo Snack](https://snack.expo.dev) that lets anyone try the
module from a browser or from Expo Go, without cloning anything. It is the
"try it" link in the README, in directory listings, and in answers we post.

It is deliberately small: one screen, one document, four highlighters. The
full tour — several documents, search, notes, animated exits, scroll
restoration — lives in [`example/`](../example).

## Why the source lives here

Snack has no git integration we can rely on, so the editable copy is this
folder and the Snack is a mirror of it. Editing here means the demo is
reviewed, formatted and versioned like the rest of the repo, instead of only
existing inside a web editor nobody else can see.

## Files

| File                    | What it holds                                                         |
| ----------------------- | --------------------------------------------------------------------- |
| `App.js`                | The screen: reader, selection menu, and the save/clear/restore cycle. |
| `highlighters.js`       | The four highlighters and the three swatches the toolbar offers.      |
| `theme.js`              | A trimmed copy of the example app's palette.                          |
| `components/Header.js`  | Icon, title and the highlight counter.                                |
| `components/Toolbar.js` | Colour swatches and the hide / restore / clear actions.               |
| `assets/snack-icon.png` | The example app's icon at 512×512.                                    |
| `package.json`          | The dependencies the Snack declares.                                  |

`expo`, `react` and `react-native` come from the Snack runtime, so they are not
listed even though the module declares them as peer dependencies.

## Updating the Snack

The Snack is a copy of this folder, kept by hand. **Every change here — and
every release — has to be carried over, or the demo shows an older library
than the one people install.**

1. Edit here and review the diff like any other change. `yarn lint` and
   `yarn format` cover this folder.
2. Open the Snack, keep **SDK 55** — the newest Snack offers — and paste each
   changed file. Create the same folders (`components/`, `assets/`) so the
   imports resolve, and upload `snack-icon.png` through the editor: an asset
   cannot be typed in, and `Header.js` requires it on the first render.
3. Check the dependency panel against `package.json`. The versions there are
   the ones SDK 55 bundles, which is what Snack warns about when they differ.
4. Run it on Android **and** iOS before saving. Expo Go is where the optional
   native module is actually exercised.
5. Save, and check the published link still opens the new version.

### The `react-native-webview` mismatch

Snack tops out at **SDK 55**, which bundles `react-native-webview@13.16.0`.
The module's peer range is `^13.16.1`, so Snack reports an unmet peer
dependency. It is a warning, not a wall: 13.16.0 has every API the module
touches, and 13.16.1 only fixed an iOS crash inside the WebView itself
([#3917](https://github.com/react-native-webview/react-native-webview/issues/3917)).

Worth revisiting: a floor of `>=13.16.0` would cover every Expo Go from SDK 55
on and drop the warning, at the cost of allowing a version with that crash. If
the floor is ever relaxed, say so in the README's peer dependency line too.

Automating this was investigated and dropped: Snack's GitHub import is broken,
and `snack-sdk` in CI can save a Snack but is not documented to update an
existing one in place, so the shared link could silently move. Not worth the
moving parts for a demo that changes a few times a year.

## What the demo is meant to prove

- The selection menu is native and its items are yours — they call
  `highlightSelection`, `unhighlightSelection` and friends on the ref.
- A highlight is a string you can store. Clear them, then press undo: they come
  back from the payload `onHighlightsChange` handed over.
- Tapping a highlight reports its text, so anchoring your own popover needs no
  measuring.
- None of this needs a custom native build: the native module is optional, so
  the package loads in Expo Go, where `react-native-webview` already ships.
