import {
  classApplier,
  core,
  highlighter,
  saveStore,
  serializer,
  textRange,
} from "./rangy@1.3.2";
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

      const animationRule = animationToCSS(options.animation);
      if (animationRule) {
        declarations.push(animationRule);
      }

      const rule = `.${name} {\n  ${declarations.join("\n  ")}\n}`;
      const keyframes = options.animation?.keyframesCss ?? "";
      return keyframes ? `${rule}\n${keyframes}` : rule;
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

      const BridgingNames = {
        // in
        functions: {
          updateHighlights: "updateHighlights",
          highlightSelection: "highlightSelection",
          unhighlightSelection: "unhighlightSelection",
          clearHighlights: "clearHighlights",
          focusHighlight: "focusHighlight",
          unfocusHighlight: "unfocusHighlight",
          unhighlightById: "unhighlightById",
        },
        // out
        events: {
          onTextSelectionChange: "onTextSelectionChange",
          onHighlightsChange: "onHighlightsChange",
          onError: "onError",
          onHighlightPressed: "onHighlightPressed",
          onHighlightsVisibilityStateChange: "onHighlightsVisibilityStateChange",
          // dev
          log: "log",
        },
        // in - out
        promises: {
          getSelectedText: "getSelectedText",
          getHighlights: "getHighlights",
          getAllHighlightsData: "getAllHighlightsData",
          getHighlightsVisibilityState: "getHighlightsVisibilityState",
          toggleHighlightsVisibility: "toggleHighlightsVisibility",
        },
      };

      // @native-receiver
      function onMessage(type, value) {
        if (type === BridgingNames.functions.updateHighlights) {
          updateHighlights(value); // highlights
        } else if (type === BridgingNames.functions.highlightSelection) {
          // { name, keepSelection }
          highlightSelection(
            value?.name ?? "yellow-highlighter",
            value?.keepSelection === true
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
          text: h.getText ? h.getText() : "",
        }));
      }

      // @native-event
      function sendOnHighlightChange(highlights) {
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
      function sendOnHighlightPressed(highlights, text) {
        postMessage(BridgingNames.events.onHighlightPressed, {
          id: highlights.id,
          name: highlights.classApplier.className,
          text: text ?? "",
        });
      }

      // @native-event
      function sendOnHighlightsVisibilityStateChange(visibilityState) {
        postMessage(BridgingNames.events.onHighlightsVisibilityStateChange, visibilityState);
      }

      // @native-promise-resolve
      function sendGetSelectedText(promiseId, success, text, error) {
        postMessage(BridgingNames.promises.getSelectedText, {
          promiseId,
          success,
          text,
          error,
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
      function updateHighlights(highlights) {
        // \`highlights\` is a state prop: null/undefined means "leave as is",
        // while an empty string means "clear everything". Treating "" as a
        // no-op would make the prop impossible to reset.
        if (highlights == null) {
          return;
        }
        try {
          clearHighlightFocusStyle();
          flushPendingExitClasses();
          __MNST__.highlighter.removeAllHighlights();
          if (highlights) {
            __MNST__.highlighter.deserialize(highlights);
          }
          reconcileIgnoredElements();
          applyHighlightVisibilityClass(false, true);
          sendOnHighlightChange(__MNST__.highlighter.serialize());
        } catch (e) {
          sendOnError(
            "invalid_highlight",
            "Failed to restore highlights",
            e?.message ?? String(e)
          );
        }
      }

      // @sdk-internal-with-event
      function highlightSelection(classApplierName, keepSelection) {
        try {
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
            __MNST__.highlighter.highlightSelection(classApplierName, {
              exclusive:
                typeof __MNST__.overlapping === "boolean"
                  ? !__MNST__.overlapping
                  : true,
            });
            reconcileIgnoredElements();
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
        const text = getTextFromElements(highlight.getHighlightElements());
        sendOnHighlightPressed(highlight, text);
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
        if (hadText) {
          sendOnTextSelectionChange("");
        }
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
        updateHighlights(${toScriptLiteral(highlights ?? null)});

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

        document.addEventListener("selectionchange", function (e) {
          e.preventDefault();
          const selection = __MNST__.selector.getSelected();
          if (!selection || selection.toString().trim() === "") {
            const prev =__MNST__.selector.cache.text;
            const next = "";
            __MNST__.selector.cache.text = next;
            __MNST__.selector.cache.range = null;
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
