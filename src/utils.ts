import {
  classApplier,
  core,
  highlighter,
  saveStore,
  serializer,
  textRange,
} from "./rangy@1.3.2";
import { BridgingNames, HISTORY_LIMIT } from "./types";
import type {
  Highlighter,
  AnimationOptions,
  CSSString,
  HTMLString,
  HighlighterOptions,
  Highlights,
  SelectableTextViewFonts,
  SelectableTextViewOptions,
  GoogleFontFamily,
} from "./types";

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// U+2028/U+2029 are valid inside a JSON string but were line terminators in
// JS before ES2019. The pattern is built at runtime because neither form
// survives well in a regex literal: the raw character IS a line terminator,
// which makes the literal a syntax error.
const JS_LINE_SEPARATORS = new RegExp(
  String.fromCharCode(0x2028) + "|" + String.fromCharCode(0x2029),
  "g"
);

/**
 * Serializes a value for interpolation into the injected `<script>` block.
 *
 * `JSON.stringify` on its own is not enough: the HTML parser scans for the
 * literal `</script` before the JS parser ever runs, so an unescaped `<` in
 * the data closes the script element early and takes the whole bridge down
 * with it.
 */
export function toScriptLiteral(value: unknown): string {
  // `?? null` because JSON.stringify(undefined) returns undefined, not a string.
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(JS_LINE_SEPARATORS, (char) =>
      char === String.fromCharCode(0x2028) ? "\\u2028" : "\\u2029"
    );
}

/**
 * Escapes a value for use inside a double-quoted CSS string, e.g. `url("…")`.
 *
 * HTML-entity escaping is wrong in this position: `<style>` is a raw-text
 * element, so its content is never entity-decoded and an `&amp;` would be sent
 * to the network as those five literal characters. What actually needs escaping
 * is the backslash and the quote; newlines are invalid inside a CSS string, and
 * `<` is neutralized so a value can never close the style element.
 */
export function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, "")
    .replace(/</g, "\\00003c");
}

const CSS_CLASS_NAME = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/;

/**
 * A highlighter name becomes both a CSS class (`.name { … }`) and a selector
 * handed to `querySelectorAll`/`closest` inside the WebView. An invalid
 * identifier — a leading digit, a space, a quote — either throws a DOMException
 * from a bare event listener or silently degrades into a selector that matches
 * nothing, so names are validated once, up front, instead of failing at
 * whichever call site happens to run first.
 */
export function isValidHighlighterName(name: string): boolean {
  return CSS_CLASS_NAME.test(name);
}

export function fontsToHeadMarkup(
  fonts: SelectableTextViewFonts | undefined
): string {
  if (!fonts) {
    return "";
  }

  const chunks: string[] = [];

  fonts.preconnect?.forEach((link) => {
    const crossOrigin = link.crossOrigin ? " crossorigin" : "";
    chunks.push(
      `<link rel="preconnect" href="${escapeHtmlAttribute(link.href)}"${crossOrigin}>`
    );
  });

  fonts.stylesheets?.forEach((sheet) => {
    const crossOrigin = sheet.crossOrigin
      ? ` crossorigin="${sheet.crossOrigin}"`
      : "";
    chunks.push(
      `<link rel="stylesheet" href="${escapeHtmlAttribute(sheet.href)}"${crossOrigin}>`
    );
  });

  return chunks.join("\n    ");
}

export function fontsToCSS(fonts: SelectableTextViewFonts | undefined): string {
  if (!fonts?.faces?.length) {
    return "";
  }

  return fonts.faces
    .map((face) => {
      const sources = (Array.isArray(face.src) ? face.src : [face.src])
        .map((source) => `url("${escapeCssString(source)}")`)
        .join(", ");
      const rules = [
        `font-family: "${escapeCssString(face.fontFamily)}";`,
        `src: ${sources};`,
      ];

      if (face.fontWeight != null) {
        rules.push(`font-weight: ${face.fontWeight};`);
      }
      if (face.fontStyle) {
        rules.push(`font-style: ${face.fontStyle};`);
      }
      if (face.fontDisplay) {
        rules.push(`font-display: ${face.fontDisplay};`);
      }
      if (face.fontStretch) {
        rules.push(`font-stretch: ${face.fontStretch};`);
      }
      if (face.unicodeRange) {
        rules.push(`unicode-range: ${face.unicodeRange};`);
      }

      return `@font-face {\n  ${rules.join("\n  ")}\n}`;
    })
    .join("\n");
}

export function buildGoogleFontFamilyParam(options: GoogleFontFamily): string {
  const family = options.family.trim().replace(/\s+/g, "+");
  const weights = options.weights ?? "400";
  const isRange = weights.includes("..");

  if (options.italic) {
    if (isRange) {
      return `${family}:ital,wght@0,${weights};1,${weights}`;
    }

    const weightList = weights.split(";").filter(Boolean);
    const normalAxis = weightList.map((weight) => `0,${weight}`).join(";");
    const italicAxis = weightList.map((weight) => `1,${weight}`).join(";");
    return `${family}:ital,wght@${normalAxis};${italicAxis}`;
  }

  return `${family}:wght@${weights}`;
}

export function mergeFonts(
  ...fonts: Array<SelectableTextViewFonts | undefined>
): SelectableTextViewFonts {
  const merged: SelectableTextViewFonts = {
    preconnect: [],
    stylesheets: [],
    faces: [],
  };
  const seenPreconnect = new Set<string>();
  const seenStylesheets = new Set<string>();

  fonts.forEach((font) => {
    if (!font) {
      return;
    }

    font.preconnect?.forEach((link) => {
      const key = `${link.href}:${link.crossOrigin ? "1" : "0"}`;
      if (seenPreconnect.has(key)) {
        return;
      }
      seenPreconnect.add(key);
      merged.preconnect!.push(link);
    });

    font.stylesheets?.forEach((sheet) => {
      if (seenStylesheets.has(sheet.href)) {
        return;
      }
      seenStylesheets.add(sheet.href);
      merged.stylesheets!.push(sheet);
    });

    font.faces?.forEach((face) => {
      merged.faces!.push(face);
    });
  });

  if (!merged.preconnect!.length) {
    delete merged.preconnect;
  }
  if (!merged.stylesheets!.length) {
    delete merged.stylesheets;
  }
  if (!merged.faces!.length) {
    delete merged.faces;
  }

  return merged;
}

type GoogleFontsSingleOptions = {
  family: string;
  weights?: string;
  italic?: boolean;
  display?: "auto" | "block" | "swap" | "fallback" | "optional";
};

type GoogleFontsMultipleOptions = {
  families: GoogleFontFamily[];
  display?: "auto" | "block" | "swap" | "fallback" | "optional";
};

export function googleFonts(
  options: GoogleFontsSingleOptions | GoogleFontsMultipleOptions
): SelectableTextViewFonts {
  const display = options.display ?? "swap";
  const familyParams =
    "families" in options
      ? options.families.map(buildGoogleFontFamilyParam)
      : [
          buildGoogleFontFamilyParam({
            family: options.family,
            weights: options.weights,
            italic: options.italic,
          }),
        ];
  const href = `https://fonts.googleapis.com/css2?${familyParams
    .map((param) => `family=${param}`)
    .join("&")}&display=${display}`;

  return {
    preconnect: [
      { href: "https://fonts.googleapis.com" },
      { href: "https://fonts.gstatic.com", crossOrigin: true },
    ],
    stylesheets: [{ href }],
  };
}

export function generatePromiseId(): string {
  const id =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  return id;
}

export function uniqueByName(list: Highlighter[]): Highlighter[] {
  const map = new Map<string, Highlighter>();
  for (const item of list) {
    map.set(item.name, item);
  }
  return Array.from(map.values());
}

export function toCssLength(
  value: number | string | undefined,
  fallback: string
): string {
  if (value === undefined) {
    return fallback;
  }
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * The page-side half of the custom-message bridge: `window.SelectableText`.
 *
 * It is emitted in `<head>` because it has to exist before `content` runs. The
 * module's own script sits after the content in `<body>`, so a script in the
 * content sending a message while the page is still being parsed would find
 * nothing there. It posts under a single bridge type of its own, which is what
 * keeps consumer messages from ever being read as the module's.
 */
export function customBridgeScript(): string {
  return `
(function () {
  var MESSAGE_TYPE = ${toScriptLiteral(BridgingNames.events.onCustomMessage)};
  function postMessage(type, data) {
    if (typeof type !== "string" || type === "") {
      throw new TypeError(
        "SelectableText.postMessage: type must be a non-empty string"
      );
    }
    var message;
    try {
      message = JSON.stringify({
        type: MESSAGE_TYPE,
        value: { type: type, data: data },
      });
    } catch (e) {
      throw new TypeError(
        "SelectableText.postMessage: data must be JSON-serializable (" +
          (e && e.message) +
          ")"
      );
    }
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(message);
    }
  }
  window.SelectableText = Object.freeze({ postMessage: postMessage });
})();
`;
}

/**
 * State class carried by a highlight while its entrance animation plays. The
 * WebView runtime adds it when a highlight is created or restored and drops it
 * as soon as that animation ends or is interrupted.
 */
export const ENTERING_CLASS = "mnst-entering";

export function animationToCSS(animation?: AnimationOptions): string {
  if (!animation) {
    return "";
  }
  return `animation: ${animation.name} ${animation.duration} ${animation.timingFunction} ${animation.iterationCount};`;
}

export function highlightersToCSS(list: Highlighter[]): string {
  return list
    .map(({ name, options }) => {
      const declarations: string[] = [];
      switch (options.type) {
        case "background-color":
          declarations.push(`background-color: ${options.color};`);
          break;
        case "text-decoration-color":
          declarations.push(
            `text-decoration-color: ${options.color};`,
            `text-decoration-line: ${options.line ?? "underline"};`,
            `text-decoration-style: ${options.style ?? "solid"};`,
            `text-decoration-thickness: ${toCssLength(options.thickness, "2px")};`,
            `text-underline-offset: ${toCssLength(options.offset, "2px")};`
          );
          break;
        case "outline-color":
          declarations.push(
            `outline-color: ${options.color};`,
            `outline-style: ${options.style ?? "solid"};`,
            `outline-width: ${toCssLength(options.width, "2px")};`,
            `outline-offset: ${toCssLength(options.offset, "2px")};`
          );
          break;
        case "background-image":
          declarations.push(
            `background-image: ${options.image};`,
            `background-size: ${options.size ?? "auto"};`,
            `background-position: ${options.position ?? "left"};`,
            `background-repeat: ${options.repeat ?? "no-repeat"};`
          );
          break;
        default:
          return `.${name} {}`;
      }

      const animation = options.animation;
      const animationRule = animationToCSS(animation);
      // A finite animation is an entrance, so it goes on the entering state class
      // rather than on the highlighter class. Declared on the class itself it
      // restarts whenever its animation-name is re-applied — a focus class being
      // removed, hidden highlights shown again, an exit being cancelled — and so
      // replays on each of them. `:where()` keeps the specificity of a single
      // class, so a consumer's focus or exit rule still overrides it. Infinite
      // animations are ambient and stay where they were.
      const isEntrance = !!animation && animation.iterationCount !== "infinite";
      if (animationRule && !isEntrance) {
        declarations.push(animationRule);
      }

      const rule = `.${name} {\n  ${declarations.join("\n  ")}\n}`;
      const entranceRule = isEntrance
        ? `\n.${name}:where(.${ENTERING_CLASS}) {\n  ${animationRule}\n}`
        : "";
      const keyframes = animation?.keyframesCss ?? "";
      return `${rule}${entranceRule}${keyframes ? `\n${keyframes}` : ""}`;
    })
    .join("\n");
}

function sanitizeOptions(
  options: SelectableTextViewOptions | undefined
): SelectableTextViewOptions {
  if (!options) {
    return {
      userScalable: true,
      initialScale: 1,
      maximumScale: 2.5,
    };
  }
  return {
    userScalable: options.userScalable ?? true,
    initialScale: Math.abs(options.initialScale ?? 1),
    maximumScale: Math.abs(options.maximumScale ?? 2.5),
  };
}

export const htmlContent = ({
  hl,
  h,
  c,
  css,
  f,
  ho,
  p,
  o,
}: {
  hl: Highlighter[] | undefined;
  h: Highlights | undefined;
  c: HTMLString | undefined;
  css: CSSString | undefined;
  f: SelectableTextViewFonts | undefined;
  ho: HighlighterOptions | undefined;
  p: string;
  o: SelectableTextViewOptions | undefined;
}) => {
  const options = sanitizeOptions(o);
  const platform = p;
  const highlights = h;
  const ignoredElementsString = (
    ho?.ignoredElements ?? ["a", "sup", "sub"]
  ).join(", ");

  const uniqueHL: Highlighter[] = hl
    ? uniqueByName([
        {
          name: "yellow-highlighter",
          options: {
            type: "background-color",
            color: "yellow",
          },
        },
        ...hl,
      ])
    : [
        {
          name: "yellow-highlighter",
          options: {
            type: "background-color",
            color: "yellow",
          },
        },
      ];
  // A name that is not a valid CSS class would be interpolated straight into a
  // stylesheet and into `closest()`/`querySelectorAll()` selectors inside the
  // WebView, where it either throws or silently matches nothing. Drop it here,
  // loudly, rather than letting it fail later with an unrelated-looking error.
  const validHL = uniqueHL.filter((highlighter) => {
    if (isValidHighlighterName(highlighter.name)) {
      return true;
    }
    console.warn(
      `[@majornutcracker/react-native-selectable-text] Ignoring highlighter "${highlighter.name}": ` +
        `a highlighter name must be a valid CSS class name (letters, digits, "-" and "_", not starting with a digit).`
    );
    return false;
  });
  const applierNames = toScriptLiteral(validHL.map((c) => c.name));
  // Must agree with `highlightersToCSS`: these are the highlighters whose
  // animation it moved onto the entering state class.
  const entrances = validHL.flatMap(({ name, options }) =>
    options.animation && options.animation.iterationCount !== "infinite"
      ? [{ highlighter: name, animation: options.animation.name }]
      : []
  );
  const entranceHighlighterNames = toScriptLiteral(
    entrances.map((e) => e.highlighter)
  );
  const entranceAnimationNames = toScriptLiteral(
    entrances.map((e) => e.animation)
  );
  const content = c ?? "";
  const style = css ?? "";
  const cssClasses = highlightersToCSS(validHL);
  const fontsHeadMarkup = fontsToHeadMarkup(f);
  const fontsCSS = fontsToCSS(f);

  return `
<!doctype html>
<html>
  <head>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=${options.initialScale}, maximum-scale=${options.maximumScale}, user-scalable=${options.userScalable ? "yes" : "no"}"
    />
    <script>
      ${customBridgeScript()}
    </script>
    ${fontsHeadMarkup}
    <style>
      ${fontsCSS}
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
      }
      ${cssClasses}
      .mnst-default-focus {
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      }
      /* The consumer's CSS comes last so it wins on equal specificity: a rule
         of theirs targeting a highlight (an exit animation, say) has to be able
         to override the generated highlighter class, which is a single class
         too and would otherwise win just by being declared later. */
      ${style}
      /* Visibility is the one thing they cannot override: it is toggled at
         runtime and is marked !important for that reason. */
      .mnst-highlighter-hidden {
        background-color: transparent !important;
        background-image: none !important;
        outline-color: transparent !important;
        text-decoration-color: transparent !important;
        animation: none !important;
      }
    </style>
  </head>
  <body>
    ${content}
    <script>
      ${core}
    </script>
    <script>
      ${highlighter}
    </script>
    <script>
      ${classApplier}
    </script>
    <script>
      ${saveStore}
    </script>
    <script>
      ${serializer}
    </script>
    <script>
      ${textRange}
    </script>

    <script>
      const Platform = {
        ios: "ios",
        android: "android",
      };

      document.documentElement.style.webkitUserSelect = "text";
      document.documentElement.style.webkitTouchCallout = "none";

      rangy.init();

      if (!window.__MNST__) {
        window.__MNST__ = {
          // state
          state: {
            history: [],
            historyIndex: -1,
            focusedElements: [],
            visible: true,
            // id -> timer, for removals waiting on an exit animation.
            pendingRemovals: {},
          },
          // constants
          platform: {
            platform: "${platform}",
            isIos: "${platform}" === Platform.ios,
            isAndroid: "${platform}" === Platform.android,
          },
          // selection
          selector: {
            cache: {
              text: "",
              range: null,
              // Bumped on every change, so an async caller can prove the
              // selection it validated is still the one it is acting on.
              version: 0,
            },
            getSelected: function () {
              let t;
              if (window.getSelection) {
                t = window.getSelection();
              } else if (document.getSelection) {
                t = document.getSelection();
              } else if (document.selection) {
                t = document.selection.createRange().text;
              }
              return t;
            },
          },
          // rangy
          highlighter: rangy.createHighlighter(),
          // extra
          overlapping: false
        };
      }

      // <------------------------------ Bridging ----------------------------------->

      // Interpolated from the TypeScript constant, so the two sides of the
      // bridge cannot disagree about a message name.
      const BridgingNames = ${toScriptLiteral(BridgingNames)};

      // @native-receiver
      function onMessage(type, value) {
        if (type === BridgingNames.functions.updateHighlights) {
          updateHighlights(value, false); // highlights
        } else if (type === BridgingNames.functions.highlightSelection) {
          // { name, keepSelection, expectSelectionVersion }
          highlightSelection(
            value?.name ?? "yellow-highlighter",
            value?.keepSelection === true,
            value?.expectSelectionVersion
          );
        } else if (type === BridgingNames.functions.unhighlightSelection) {
          unhighlightSelection(value?.keepSelection === true, value?.options); // { keepSelection, options }
        } else if (type === BridgingNames.functions.clearHighlights) {
          clearHighlights();
        } else if (type === BridgingNames.functions.focusHighlight) {
          focusHighlight(value.id, value.className, value.options); // id, className, options
        } else if (type === BridgingNames.functions.unfocusHighlight) {
          unfocusHighlight();
        } else if (type === BridgingNames.functions.unhighlightById) {
          unhighlightById(value.id, value.options); // id, options
        } else if (type === BridgingNames.promises.getSelectedText) {
          getSelectedText(value); // promiseId
        } else if (type === BridgingNames.promises.getHighlights) {
          getHighlights(value); // promiseId
        } else if (type === BridgingNames.promises.getAllHighlightsData) {
          getAllHighlightsData(value); // promiseId
        } else if (type === BridgingNames.promises.getHighlightsVisibilityState) {
          getHighlightsVisibilityState(value); // promiseId
        } else if (type === BridgingNames.promises.toggleHighlightsVisibility) {
          toggleHighlightsVisibility(value); // promiseId
        } else if (type === BridgingNames.promises.evaluateJavaScript) {
          evaluateJavaScript(value); // { promiseId, script }
        } else if (type === BridgingNames.promises.getHistory) {
          sendGetHistory(value);
        } else if (type === BridgingNames.functions.redo) {
          redo();
        } else if (type === BridgingNames.functions.undo) {
          undo();
        } else if (type === BridgingNames.functions.clearHistory) {
          clearHistory();
        } else {
          sendOnError(
            "bridge_message_error",
            "Unknown bridge message type",
            String(type)
          );
        }
      }

      // @native-sender
      function postMessage(type, value) {
        const message = JSON.stringify({ type, value });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(message);
        }
      }

      // @native-event
      function sendOnTextSelectionChange(text) {
        postMessage(BridgingNames.events.onTextSelectionChange, text);
      }

      // @sdk-internal
      function collectHighlightsData() {
        const highlights = __MNST__.highlighter.highlights || [];
        return highlights.map((h) => ({
          id: String(h.id),
          name: h.classApplier.className,
          text: getTextFromElements(h.getHighlightElements()),
        }));
      }

      // @sdk-internal
      function pushHistory(highlights) {
        // Anything the reader had stepped back from is dropped, the way typing
        // after an undo does in an editor.
        const kept = __MNST__.state.history.slice(0, __MNST__.state.historyIndex + 1);
        kept.push(highlights);
        // Bounded: every entry is a whole serialized payload, so a long reading
        // session would otherwise grow one forever.
        if (kept.length > ${HISTORY_LIMIT}) {
          kept.shift();
        }
        __MNST__.state.history = kept;
        __MNST__.state.historyIndex = kept.length - 1;
        sendOnHistoryChange("HISTORY");
      }

      // @sdk-internal
      function clearHistory() {
        // Starts again from what is on screen, so undo has a floor to stop at —
        // the same state a freshly mounted view starts with.
        let current = "";
        try {
          current = __MNST__.highlighter.serialize();
        } catch (e) {
          current = "";
        }
        seedHistory(current);
      }

      // @sdk-internal
      function seedHistory(highlights) {
        __MNST__.state.history = [highlights];
        __MNST__.state.historyIndex = 0;
        sendOnHistoryChange("HISTORY");
      }

      // @sdk-internal
      function redo() {
        if (__MNST__.state.historyIndex < __MNST__.state.history.length - 1) {
          __MNST__.state.historyIndex = __MNST__.state.historyIndex + 1;
          sendOnHistoryChange("HISTORY_INDEX");
          const highlights = __MNST__.state.history[__MNST__.state.historyIndex];
          updateHighlights(highlights, true);
        }
      }

      // @sdk-internal
      function undo() {
        if (__MNST__.state.historyIndex > 0) {
          __MNST__.state.historyIndex = __MNST__.state.historyIndex - 1;
          sendOnHistoryChange("HISTORY_INDEX");
          const highlights = __MNST__.state.history[__MNST__.state.historyIndex];
          updateHighlights(highlights, true);
        }
      }

      // @sdk-internal
      function historyState() {
        // One shape for both the event and getHistory, so the two can never
        // disagree about where the history stands.
        return {
          history: __MNST__.state.history,
          historyIndex: __MNST__.state.historyIndex,
          length: __MNST__.state.history.length,
          canUndo: __MNST__.state.historyIndex > 0,
          canRedo: __MNST__.state.historyIndex < __MNST__.state.history.length - 1,
        };
      }

      // @native-event
      function sendOnHistoryChange(change) {
        const state = historyState();
        state.change = change;
        postMessage(BridgingNames.events.onHistoryChange, state);
      }

      // @native-event
      function sendOnHighlightChange(highlights, ignoreHistory) {
        // The items are already in memory at this point, so they ride along and
        // save the consumer a getAllHighlightsData() round-trip per change.
        let items = [];
        try {
          items = collectHighlightsData();
        } catch (e) {
          items = [];
        }
        postMessage(BridgingNames.events.onHighlightsChange, {
          highlights: highlights,
          items: items,
        });
        if (ignoreHistory) return;
        pushHistory(highlights);
      }

      // @native-event
      function sendOnError(code, message, details) {
        postMessage(BridgingNames.events.onError, {
          code,
          message,
          details,
        });
      }

      // @native-event
      function sendOnHighlightPressed(highlights, text, rects) {
        const list = rects || [];
        postMessage(BridgingNames.events.onHighlightPressed, {
          id: String(highlights.id),
          name: highlights.classApplier.className,
          text: text ?? "",
          rect: unionRect(list),
          rects: list,
        });
      }

      /**
       * Measures a highlight in the frame the WebView itself occupies.
       *
       * getClientRects gives one box per line box rather than one per element,
       * so a highlight wrapping across lines is reported line by line instead
       * of as one tall box spanning the full column width.
       *
       * Coordinates are relative to the visual viewport, not the layout one, so
       * a pinched-in page reports where the text actually is on screen. The
       * fallbacks keep it correct on engines without visualViewport, where the
       * two viewports are the same thing.
       *
       * @sdk-internal
       */
      function measureElements(elements) {
        const viewport = window.visualViewport;
        const scale = (viewport && viewport.scale) || 1;
        const offsetLeft = (viewport && viewport.offsetLeft) || 0;
        const offsetTop = (viewport && viewport.offsetTop) || 0;
        const measured = [];
        elements.forEach(function (element) {
          if (!element.getClientRects) {
            return;
          }
          const boxes = element.getClientRects();
          for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            // Zero-sized boxes come from collapsed or hidden fragments and
            // would only drag a union box off towards the origin.
            if (box.width <= 0 || box.height <= 0) {
              continue;
            }
            measured.push({
              x: (box.left - offsetLeft) * scale,
              y: (box.top - offsetTop) * scale,
              width: box.width * scale,
              height: box.height * scale,
            });
          }
        });
        return measured;
      }

      // @sdk-internal
      function unionRect(rects) {
        if (rects.length === 0) {
          return { x: 0, y: 0, width: 0, height: 0 };
        }
        let left = rects[0].x;
        let top = rects[0].y;
        let right = rects[0].x + rects[0].width;
        let bottom = rects[0].y + rects[0].height;
        rects.forEach(function (rect) {
          left = Math.min(left, rect.x);
          top = Math.min(top, rect.y);
          right = Math.max(right, rect.x + rect.width);
          bottom = Math.max(bottom, rect.y + rect.height);
        });
        return { x: left, y: top, width: right - left, height: bottom - top };
      }

      // @native-event
      function sendOnHighlightsVisibilityStateChange(visibilityState) {
        postMessage(BridgingNames.events.onHighlightsVisibilityStateChange, visibilityState);
      }

      // @native-promise-resolve
      function sendGetHistory(promiseId) {
        const state = historyState();
        state.promiseId = promiseId;
        postMessage(BridgingNames.promises.getHistory, state);
      }

      // @native-promise-resolve
      function sendGetSelectedText(promiseId, success, text, error) {
        postMessage(BridgingNames.promises.getSelectedText, {
          promiseId,
          success,
          text,
          error,
          selectionVersion: __MNST__.selector.cache.version,
        });
      }

      // @native-promise-resolve
      function sendGetHighlights(promiseId, success, highlights, error) {
        postMessage(BridgingNames.promises.getHighlights, {
          promiseId,
          success,
          highlights,
          error,
        });
      }

      // @native-promise-resolve
      function sendGetAllHighlightsData(promiseId, success, highlightsData, error) {
        postMessage(BridgingNames.promises.getAllHighlightsData, {
          promiseId,
          success,
          highlightsData,
          error,
        });
      }
      
      // @native-promise-resolve
      function sendGetHighlightsVisibilityState(promiseId, success, visible, error) {
        postMessage(BridgingNames.promises.getHighlightsVisibilityState, {
          promiseId,
          success,
          visible,
          error,
        });
      }

      // @native-promise-resolve
      // @native-promise-resolve
      function sendEvaluateJavaScript(promiseId, success, result, error) {
        postMessage(BridgingNames.promises.evaluateJavaScript, {
          promiseId,
          success,
          result,
          error,
        });
      }

      // Runs a consumer script as the body of an async function, so it can
      // await and return a value. Every failure is reported through the promise
      // rather than thrown: nothing on this side is listening for a throw.
      // @native-promise
      function evaluateJavaScript(request) {
        const promiseId = request && request.promiseId;
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        let run;
        try {
          run = new AsyncFunction(String(request && request.script));
        } catch (e) {
          // A syntax error surfaces here, before any of the script has run.
          sendEvaluateJavaScript(promiseId, false, undefined, e?.message ?? String(e));
          return;
        }
        run().then(
          (result) => {
            // The result crosses as JSON. Checked here so an unserializable one
            // rejects with a reason, instead of failing inside postMessage and
            // leaving the caller to time out.
            try {
              JSON.stringify(result);
            } catch (e) {
              sendEvaluateJavaScript(
                promiseId,
                false,
                undefined,
                "The script's result is not JSON-serializable: " + (e?.message ?? String(e))
              );
              return;
            }
            sendEvaluateJavaScript(promiseId, true, result, undefined);
          },
          (e) => {
            sendEvaluateJavaScript(promiseId, false, undefined, e?.message ?? String(e));
          }
        );
      }

      function sendToggleHighlightsVisibility(promiseId, success, visible, error) {
        postMessage(BridgingNames.promises.toggleHighlightsVisibility, {
          promiseId,
          success,
          visible,
          error,
        });
      }

      // <------------------------ Internal functions ------------------------------->

      // @sdk-internal-with-event
      function updateHighlights(highlights, fromHistory) {
        // \`null\`/\`undefined\` means "leave as is", while an empty string means
        // "clear everything". Treating "" as a no-op would make the highlights
        // impossible to reset.
        if (highlights == null) {
          return;
        }
        // Refused before anything is touched: a payload that is not one cannot
        // cost the reader the highlights they already have.
        // Rangy looks at the same first segment, and throws when it is missing.
        const payloadType = String(highlights).split("|")[0];
        if (highlights && !/^type:[A-Za-z0-9_]+$/.test(payloadType)) {
          sendOnError(
            "invalid_highlight",
            "Failed to restore highlights",
            "Not a serialized highlights payload: " + String(highlights).slice(0, 60)
          );
          return;
        }
        // What the content holds right now, to put back if the payload turns
        // out to be unusable halfway through deserializing it.
        let previous = null;
        try {
          previous = __MNST__.highlighter.serialize();
        } catch (e) {
          previous = null;
        }
        try {
          clearHighlightFocusStyle();
          flushPendingExitClasses();
          __MNST__.highlighter.removeAllHighlights();
          if (highlights) {
            __MNST__.highlighter.deserialize(highlights);
          }
          reconcileIgnoredElements();
          if (!fromHistory) {
            // Every highlight here is new — the old ones were just removed — so
            // restored highlights play their entrance once, as they did before.
            //
            // Stepping through the history is the exception: an undo puts back
            // a state the reader has already seen, and replaying the entrance
            // would announce it as something that just happened.
            markEntering(__MNST__.highlighter.highlights || []);
          }
          applyHighlightVisibilityClass(false, true);
          sendOnHighlightChange(__MNST__.highlighter.serialize(), fromHistory);
        } catch (e) {
          rollbackHighlights(previous);
          sendOnError(
            "invalid_highlight",
            "Failed to restore highlights",
            e?.message ?? String(e)
          );
        }
      }

      // @sdk-internal
      function rollbackHighlights(previous) {
        // Deserializing can fail partway, leaving some of the payload applied,
        // so the content is put back rather than left in between. No change
        // event: as far as the consumer is concerned nothing happened, and the
        // history must not record a state the reader never saw.
        try {
          __MNST__.highlighter.removeAllHighlights();
          if (previous) {
            __MNST__.highlighter.deserialize(previous);
          }
          reconcileIgnoredElements();
          applyHighlightVisibilityClass(false, true);
        } catch (e) {
          sendOnError(
            "invalid_highlight",
            "Failed to restore the previous highlights",
            e?.message ?? String(e)
          );
        }
      }

      // @sdk-internal-with-event
      function highlightSelection(classApplierName, keepSelection, expectVersion) {
        try {
          // An async validation runs while the reader can keep selecting. The
          // caller pins the selection it approved, and anything else is refused
          // rather than silently highlighting whatever is selected by now.
          if (
            expectVersion != null &&
            expectVersion !== __MNST__.selector.cache.version
          ) {
            sendOnError(
              "selection_changed",
              "The selection changed before it was highlighted",
              "Validated selection version " + String(expectVersion) +
                ", current is " + String(__MNST__.selector.cache.version) + "."
            );
            return;
          }
          const highlightNames = ${applierNames}
          if (!highlightNames.includes(classApplierName)) {
            sendOnError(
              "invalid_class_applier",
              "Unknown highlight class applier",
              "No class applier registered for: " + classApplierName
            );
            return;
          }
          if (!__MNST__.selector.cache.range) {
            sendOnError(
              "invalid_range",
              "No selection to highlight",
              "The cached selection range is missing"
            );
            return;
          }
          const selector = highlightNames.map((c) => "."+c).join(",")
          const sel = document.getSelection();
          sel.removeAllRanges();
          sel.addRange(__MNST__.selector.cache.range);
          const range = sel.getRangeAt(0);
          if (range.collapsed) {
            sendOnError(
              "empty_selection",
              "No selection to highlight",
              "The selection range is collapsed"
            );
            return;
          }
          const hasHighlightedNode = Array.from(
            document.querySelectorAll(selector)
          ).some(node => range.intersectsNode(node))
          if (hasHighlightedNode) {
            sendOnError(
              "overlapping_highlight", 
              "Overlapping highlight detected", 
              "The highlight intersects with a node that is already highlighted"
            );
            return
          }
          const rangySel = rangy.getSelection();
          if (!rangySel.isCollapsed) {
            const created = __MNST__.highlighter.highlightSelection(classApplierName, {
              exclusive:
                typeof __MNST__.overlapping === "boolean"
                  ? !__MNST__.overlapping
                  : true,
            });
            reconcileIgnoredElements();
            markEntering(created || []);
            applyHighlightVisibilityClass(false, true);
            sendOnHighlightChange(__MNST__.highlighter.serialize());
            if (!keepSelection) {
              clearDomSelection();
            }
          }
        } catch (e) {
          sendOnError(
            "failed_to_highlight_selection",
            "Failed to highlight selection",
            e?.message ?? String(e)
          );
        }
      }

      // @sdk-internal-with-event
      function unhighlightSelection(keepSelection, options) {
        try {
          if (!__MNST__.selector.cache.range) {
            sendOnError(
              "invalid_range",
              "No selection to unhighlight",
              "The cached selection range is missing"
            );
            return;
          }
          const sel = document.getSelection();
          sel.removeAllRanges();
          sel.addRange(__MNST__.selector.cache.range);
          const rangySel = rangy.getSelection();
          if (rangySel.isCollapsed) {
            sendOnError(
              "empty_selection",
              "No selection to unhighlight",
              "The selection range is collapsed"
            );
            return;
          }
          // Resolved now, not after the wait: the selection is about to be
          // dropped, and by then it could point somewhere else entirely.
          const affected = __MNST__.highlighter.getHighlightsInSelection();
          stageRemoval(affected, options, function (className) {
            removeHighlightsNow(
              affected,
              className,
              "failed_to_unhighlight_selection",
              "Failed to unhighlight selection"
            );
          });
          if (!keepSelection) {
            clearDomSelection();
          }
        } catch (e) {
          sendOnError(
            "failed_to_unhighlight_selection",
            "Failed to unhighlight selection",
            e?.message ?? String(e)
          );
        }
      }
      
      // @sdk-internal-with-event
      function clearHighlights() {
        try {
          // Before the removal: a span still carrying one of these classes is
          // not removable, so Rangy would leave it behind.
          clearHighlightFocusStyle();
          flushPendingExitClasses();
          __MNST__.highlighter.removeAllHighlights();
          reconcileIgnoredElements();
          sendOnHighlightChange(__MNST__.highlighter.serialize());
        } catch (e) {
          sendOnError(
            "failed_to_clear_highlights",
            "Failed to clear highlights",
            e?.message ?? String(e)
          );
        }
      }

      // @sdk-internal
      function focusHighlight(id, className, options) {
        try {
          const highlight = findHighlightById(id);
          if (!highlight) {
            sendOnError(
              "highlight_not_found",
              "Highlight not found",
              "No highlight registered for id: " + String(id)
            );
            return;
          }
          clearHighlightFocusStyle();
          const elements = highlight.getHighlightElements();
          applyFocusStyle(elements, className);
          const opts = options || {};
          if (opts.scroll !== false && elements.length > 0) {
            scrollToHighlight(elements[0], opts);
          }
        } catch (e) {
          sendOnError(
            "failed_to_focus_highlight",
            "Failed to focus highlight",
            e?.message ?? String(e)
          );
        }
      }

      // @sdk-internal
      function unfocusHighlight() {
        clearHighlightFocusStyle();
      }

      // @sdk-internal-with-event
      function unhighlightById(id, options) {
        try {
          const highlight = findHighlightById(id);
          if (!highlight) {
            sendOnError(
              "highlight_not_found",
              "Highlight not found",
              "No highlight registered for id: " + String(id)
            );
            return;
          }
          stageRemoval([highlight], options, function (className) {
            removeHighlightsNow(
              [highlight],
              className,
              "failed_to_unhighlight_by_id",
              "Failed to unhighlight by id"
            );
          });
        } catch (e) {
          sendOnError(
            "failed_to_unhighlight_by_id",
            "Failed to unhighlight by id",
            e?.message ?? String(e)
          );
        }
      }

      /**
       * Runs a removal now, or after an exit animation when "delay" is set.
       *
       * The wait lives here rather than in React Native so there is no timer to
       * cancel on unmount, and so a bulk removal in the meantime can take the
       * class back off (see flushPendingExitClasses).
       *
       * @sdk-internal
       */
      function stageRemoval(highlights, options, remove) {
        const opts = options || {};
        const delay =
          typeof opts.delay === "number" && opts.delay > 0 ? opts.delay : 0;
        const className = opts.className;
        if (!delay || highlights.length === 0) {
          remove(className);
          return;
        }
        const pending = __MNST__.state.pendingRemovals;
        // Already staged: keep the running animation rather than restarting it.
        const fresh = highlights.filter(function (highlight) {
          return !pending[String(highlight.id)];
        });
        if (fresh.length === 0) {
          return;
        }
        if (className) {
          // Deliberately not tracked as a focus style: a focusHighlight() call
          // in the meantime clears those, killing the exit animation.
          fresh.forEach(function (highlight) {
            setExitClass(highlight, className, true);
          });
        }
        const timer = setTimeout(function () {
          fresh.forEach(function (highlight) {
            delete pending[String(highlight.id)];
          });
          remove(className);
        }, delay);
        fresh.forEach(function (highlight) {
          pending[String(highlight.id)] = {
            className: className,
            timer: timer,
          };
        });
      }

      // @sdk-internal
      function setExitClass(highlight, className, on) {
        if (!className) {
          return;
        }
        highlight.getHighlightElements().forEach(function (el) {
          if (on) {
            endEntrance(el);
            el.classList.add(className);
          } else {
            el.classList.remove(className);
          }
        });
      }

      /**
       * Cancels every staged removal and takes its class back off.
       *
       * Rangy only unwraps a highlight's span when its class list is exactly
       * the highlighter class; any extra class left on it makes Rangy keep the
       * element and merely drop its own class. An exit animation with
       * "forwards" would then be stranded on the text for good, so a bulk
       * removal has to strip these first.
       *
       * @sdk-internal
       */
      function flushPendingExitClasses() {
        const pending = __MNST__.state.pendingRemovals;
        Object.keys(pending).forEach(function (id) {
          const entry = pending[id];
          if (!entry) {
            return;
          }
          clearTimeout(entry.timer);
          delete pending[id];
          const highlight = findHighlightById(id);
          if (highlight) {
            setExitClass(highlight, entry.className, false);
          }
        });
      }

      // @sdk-internal-with-event
      function removeHighlightsNow(highlights, exitClassName, code, message) {
        try {
          clearHighlightFocusStyle();
          // Same tick as the removal, so the restored styles are never painted.
          highlights.forEach(function (highlight) {
            setExitClass(highlight, exitClassName, false);
          });
          __MNST__.highlighter.removeHighlights(highlights);
          reconcileIgnoredElements();
          sendOnHighlightChange(__MNST__.highlighter.serialize());
        } catch (e) {
          sendOnError(code, message, e?.message ?? String(e));
        }
      }

      // @sdk-internal-with-resolve
      function getSelectedText(id) {
        try {
          if (!__MNST__.selector.cache.text) {
            sendGetSelectedText(id, true, "", undefined);
            return;
          } else {
            sendGetSelectedText(id, true, __MNST__.selector.cache.text, undefined);
          }
        } catch (e) {
          console.error("Failed to get selected text: ", e);
          sendGetSelectedText(id, false, undefined, e.message);
        }
      }

      // @sdk-internal-with-resolve
      function getHighlights(id) {
        try {
          sendGetHighlights(id, true, __MNST__.highlighter.serialize(), undefined);
        } catch (e) {
          console.error("Failed to get highlights: ", e);
          sendGetHighlights(id, false, undefined, e.message);
        }
      }

      // @sdk-internal-with-resolve
      function getAllHighlightsData(id) {
        try {
          sendGetAllHighlightsData(id, true, collectHighlightsData(), undefined);
        } catch (e) {
          console.error("Failed to get all highlights data: ", e);
          sendGetAllHighlightsData(id, false, undefined, e.message);
        }
      }

      // @sdk-internal-with-resolve
      function getHighlightsVisibilityState(id) {
        try {
          sendGetHighlightsVisibilityState(id, true, __MNST__.state.visible, undefined);
        } catch (e) {
          console.error("Failed to get highlights visibility state: ", e);
          sendGetHighlightsVisibilityState(id, false, undefined, e.message);
        }
      }

      // @sdk-internal-with-resolve
      function toggleHighlightsVisibility(id) {
        try {
          clearHighlightFocusStyle();
          const toggle = applyHighlightVisibilityClass(true, false);
          __MNST__.state.visible = toggle;
          sendOnHighlightsVisibilityStateChange(__MNST__.state.visible);
          sendToggleHighlightsVisibility(id, true, __MNST__.state.visible, undefined);
        } catch (e) {
          console.error("Failed to toggle highlights visibility: ", e);
          sendToggleHighlightsVisibility(id, false, undefined, e.message);
        }
      }

      // @sdk-internal-with-event
      function prepareSendOnHighlightPressed(element) {
        const highlight = __MNST__.highlighter.getHighlightForElement(element);
        if (!highlight) {
          return;
        }
        const elements = highlight.getHighlightElements();
        const text = getTextFromElements(elements);
        sendOnHighlightPressed(highlight, text, measureElements(elements));
      }

      // <------------------- Internal utils functions ------------------------>

      function applyHighlightVisibilityClass(isToggle = false, inverse = false) {
        const visible = __MNST__.state.visible;
        const highlightNames = ${applierNames};
        const selector = highlightNames.map((c) => "."+c).join(", ");
        // querySelectorAll("") throws, and the list can be empty if every
        // configured highlighter name was rejected as an invalid CSS class.
        const nodes = selector ? [...document.querySelectorAll(selector)] : [];
        if (nodes.length === 0) {
          // Nothing rendered to show or hide. An explicit toggle still flips the
          // state so the consumer's control stays in sync with what the next
          // highlight will do; a passive sync leaves the state untouched.
          return isToggle ? !visible : visible;
        }
        const condition = inverse ? !visible: visible;
        if (condition) {
          nodes.forEach((node) => {
            node.classList.add("mnst-highlighter-hidden");
          });
        } else {
          nodes.forEach((node) => {
            node.classList.remove("mnst-highlighter-hidden");
          });
        }
        return !visible;
      }

      function findHighlightById(id) {
        const highlights = __MNST__.highlighter.highlights || [];
        for (let i = 0; i < highlights.length; i++) {
          if (String(highlights[i].id) === String(id)) {
            return highlights[i];
          }
        }
        return null;
      }

      // Drops the DOM selection, which is what dismisses the platform selection
      // UI (on iOS the handles and callout menu, on Android the action mode).
      // The cached range is cleared here rather than waiting for the async
      // "selectionchange" event, so a caller that acts immediately afterwards
      // sees consistent state.
      function clearDomSelection() {
        const sel = document.getSelection();
        if (sel) {
          sel.removeAllRanges();
        }
        const hadText = __MNST__.selector.cache.text !== "";
        __MNST__.selector.cache.text = "";
        __MNST__.selector.cache.range = null;
        __MNST__.selector.cache.version++;
        if (hadText) {
          sendOnTextSelectionChange("");
        }
      }

      // Entrance animations run on a state class that goes away once they have
      // played (or been interrupted), so re-applying a highlighter's
      // animation-name later has nothing left to replay.
      const ENTRANCE_HIGHLIGHTERS = new Set(${entranceHighlighterNames});
      const ENTRANCE_ANIMATIONS = new Set(${entranceAnimationNames});

      // @sdk-internal
      function markEntering(highlights) {
        if (ENTRANCE_HIGHLIGHTERS.size === 0) {
          return;
        }
        highlights.forEach((highlight) => {
          if (!ENTRANCE_HIGHLIGHTERS.has(highlight.classApplier.className)) {
            return;
          }
          highlight.getHighlightElements().forEach((el) => {
            el.classList.add("${ENTERING_CLASS}");
          });
        });
      }

      // @sdk-internal
      function onEntranceSettled(event) {
        const target = event.target;
        if (
          ENTRANCE_ANIMATIONS.has(event.animationName) &&
          target &&
          target.classList
        ) {
          target.classList.remove("${ENTERING_CLASS}");
        }
      }

      // Interacting with a highlight ends its entrance. The animationcancel
      // listener covers this as well; doing it here too means the fix does not
      // rest on that event alone.
      function endEntrance(el) {
        el.classList.remove("${ENTERING_CLASS}");
      }

      function clearHighlightFocusStyle() {
        __MNST__.state.focusedElements.forEach((entry) => {
          entry.el.classList.remove(entry.className);
        });
        __MNST__.state.focusedElements = [];
      }

      // @sdk-internal
      function scrollToHighlight(el, opts) {
        const block = opts.block || "center";
        const behavior = opts.behavior || "smooth";
        const offset = typeof opts.offset === "number" ? opts.offset : 0;

        if (!offset && el.scrollIntoView) {
          el.scrollIntoView({ behavior: behavior, block: block });
          return;
        }

        // "offset" is the height of the band covered at the top of the viewport
        // (a floating header), so the usable area is the viewport minus it.
        const rect = el.getBoundingClientRect();
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop || 0;
        const viewport = window.innerHeight;
        const usable = Math.max(0, viewport - offset);
        const elTop = rect.top + scrollTop;
        const elBottom = elTop + rect.height;
        let target;

        if (block === "start") {
          target = elTop - offset;
        } else if (block === "end") {
          target = elBottom - viewport;
        } else if (block === "nearest") {
          if (elTop >= scrollTop + offset && elBottom <= scrollTop + viewport) {
            return;
          }
          target =
            elTop < scrollTop + offset ? elTop - offset : elBottom - viewport;
        } else {
          target = elTop - offset - (usable - rect.height) / 2;
        }

        target = Math.max(0, target);
        if (window.scrollTo) {
          window.scrollTo({ top: target, behavior: behavior });
        }
      }

      function applyFocusStyle(elements, className) {
        const focusClassName = className || "mnst-default-focus";
        elements.forEach((el) => {
          if(__MNST__.state.visible) {
            endEntrance(el);
            el.classList.add(focusClassName);
            __MNST__.state.focusedElements.push({ el, className: focusClassName });
          }
        });
      }

      function getTextFromElements(elements) {
        let text = "";
        elements.forEach((el) => {
          text += el.textContent ?? "";
        });
        return text;
      }
      
      /**
       * Takes the visible highlight back off anything on the ignored list, then
       * makes the highlighter's registry agree with what is left in the DOM.
       *
       * A selection landing entirely inside ignored content leaves a highlight
       * with every one of its spans unwrapped: invisible, yet still registered,
       * still counted, and still serialized into the payload that gets restored
       * later. Those are dropped here and reported, so the caller can say why
       * nothing happened.
       *
       * @sdk-internal
       */
      function reconcileIgnoredElements() {
        const ignoredSelector = ${toScriptLiteral(ignoredElementsString)}.trim();
        if (!ignoredSelector) {
          return [];
        }

        const selector = ${applierNames}
          .map((c) => "."+c)
          .join(", ");
        if (!selector) {
          return [];
        }

        const roots = [...document.querySelectorAll(ignoredSelector)];

        const nodes = roots.flatMap((root) =>
          Array.from(root.querySelectorAll(selector))
        );

        nodes.forEach((node) => {
          while (node.firstChild) {
            node.parentNode.insertBefore(node.firstChild, node);
          }
          node.remove();
        });

        dropFullyIgnoredHighlights();

        return nodes;
      }

      // @sdk-internal-with-event
      function dropFullyIgnoredHighlights() {
        const all = __MNST__.highlighter.highlights || [];
        const kept = all.filter(function (highlight) {
          try {
            return highlight.getHighlightElements().length > 0;
          } catch (e) {
            // Unreadable range: keep it rather than silently losing a highlight.
            return true;
          }
        });
        if (kept.length === all.length) {
          return;
        }
        const dropped = all.length - kept.length;
        __MNST__.highlighter.highlights = kept;
        sendOnError(
          "highlight_fully_ignored",
          "Nothing to highlight in the selection",
          "The selection lies entirely inside elements excluded by " +
            "highlighterOptions.ignoredElements, so " + String(dropped) +
            " highlight(s) had no visible text and were discarded."
        );
      }

      // @dev
      function nativeLog(message) {
        try {
          const json = JSON.stringify(message, null, 2);
          console.log(message);
          postMessage(BridgingNames.events.log, json);
        } catch (e) {
          console.error("Failed to log: ", e);
          postMessage(
            BridgingNames.events.log, 
            e.message ?? "Unknown error while stringifying message for logging"
          );
        }
      }

      // <------------------------ Bootstrap ----------------------------------->

      if (!window.__MNST__init) {
        window.__MNST__init = true;

        try {
          const applierNames = ${applierNames};
          const highlighterOptions = { ignoreWhiteSpace: true };
          applierNames.forEach((name) => {
            __MNST__.highlighter.addClassApplier(
              rangy.createClassApplier(name, {
                ignoreWhiteSpace: highlighterOptions.ignoreWhiteSpace ?? true,
                elementTagName: "span",
              })
            );
          });
        } catch (e) {
          sendOnError(
            "initialization_error",
            "Failed to initialize highlight class appliers",
            e?.message ?? String(e)
          );
        }

        // null (not "") so that mounting without highlights stays a no-op —
        // an empty string means "clear", which would emit a spurious change event.
        updateHighlights(${toScriptLiteral(highlights ?? null)}, false);

        // The state the reader opens with is the floor of the history, so undo
        // stops here instead of stepping into a set that never existed. Mounting
        // with highlights already recorded it, through the change it emitted.
        if (__MNST__.state.history.length === 0) {
          seedHistory(__MNST__.highlighter.serialize());
        }

        if (__MNST__.platform.isAndroid) {
          document.addEventListener("message", function (event) {
            try {
              const data = JSON.parse(event.data);
              onMessage(data.type, data.value);
            } catch (e) {
              sendOnError(
                "bridge_message_error",
                "Failed to parse bridge message",
                e?.message ?? String(e)
              );
            }
          });
        } else {
          window.addEventListener("message", function (event) {
            try {
              const data = JSON.parse(event.data);
              onMessage(data.type, data.value);
            } catch (e) {
              sendOnError(
                "bridge_message_error",
                "Failed to parse bridge message",
                e?.message ?? String(e)
              );
            }
          });
        }

        // Delegated: animation events bubble, and highlights come and go.
        document.addEventListener("animationend", onEntranceSettled);
        document.addEventListener("animationcancel", onEntranceSettled);

        document.addEventListener("selectionchange", function (e) {
          e.preventDefault();
          const selection = __MNST__.selector.getSelected();
          if (!selection || selection.toString().trim() === "") {
            const prev =__MNST__.selector.cache.text;
            const next = "";
            __MNST__.selector.cache.text = next;
            __MNST__.selector.cache.range = null;
            __MNST__.selector.cache.version++;
            if (prev !== next) {
              sendOnTextSelectionChange(next);
            }
          } else {
            const prev =__MNST__.selector.cache.text;
            const next = selection.toString();
            __MNST__.selector.cache.text = next;
            if (selection.rangeCount > 0) {
              __MNST__.selector.cache.range = selection.getRangeAt(0).cloneRange();
            }
            __MNST__.selector.cache.version++;
            if (prev !== next) {
              sendOnTextSelectionChange(next);
            }
          }
        });

        document.addEventListener("click", function (event) {
          if (!__MNST__.state.visible) {
            return;
          }
          const highlightNames = ${applierNames};
          const selector = highlightNames.map((c) => "." + c).join(",");
          const target = event.target;
          const node =
            target && target.closest && selector
              ? target.closest(selector)
              : null;

          clearHighlightFocusStyle();

          if (node) {
            prepareSendOnHighlightPressed(node);
          }
        });
      }

      true;
    </script>
  </body>
</html>
`;
};
