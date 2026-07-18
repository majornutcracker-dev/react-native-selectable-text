import {
  classApplier,
  core,
  highlighter,
  saveStore,
  serializer,
  textRange,
} from "./rangy@1.3.2";
import {
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

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
        .map((source) => `url("${escapeHtmlAttribute(source)}")`)
        .join(", ");
      const rules = [
        `font-family: "${face.fontFamily.replace(/"/g, '\\"')}";`,
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

function buildGoogleFontFamilyParam(options: GoogleFontFamily): string {
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

function uniqueByName(list: Highlighter[]): Highlighter[] {
  const map = new Map<string, Highlighter>();
  for (const item of list) {
    map.set(item.name, item);
  }
  return Array.from(map.values());
}

function toCssLength(
  value: number | string | undefined,
  fallback: string
): string {
  if (value === undefined) {
    return fallback;
  }
  return typeof value === "number" ? `${value}px` : value;
}

function animationToCSS(animation?: AnimationOptions): string {
  if (!animation) {
    return "";
  }
  return `animation: ${animation.name} ${animation.duration} ${animation.timingFunction} ${animation.iterationCount};`;
}

function highlightersToCSS(list: Highlighter[]): string {
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
  const applierNames = JSON.stringify(uniqueHL.map((c) => c.name));
  const content = c ?? "";
  const style = css ?? "";
  const cssClasses = highlightersToCSS(uniqueHL);
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
      ${style}
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
      }
      ${cssClasses}
      .mnst-highlighter-hidden {
        background-color: transparent !important;
        background-image: none !important;
        outline-color: transparent !important;
        text-decoration-color: transparent !important;
        animation: none !important;
      }
      .mnst-default-focus {
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
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
            highlights: "type:textContent",
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
          highlightSelection(value ?? "yellow-highlighter"); // classApplierName
        } else if (type === BridgingNames.functions.unhighlightSelection) {
          unhighlightSelection();
        } else if (type === BridgingNames.functions.clearHighlights) {
          clearHighlights();
        } else if (type === BridgingNames.functions.focusHighlight) {
          focusHighlight(value.id, value.className, value.scroll); // id, className, scroll
        } else if (type === BridgingNames.functions.unfocusHighlight) {
          unfocusHighlight();
        } else if (type === BridgingNames.functions.unhighlightById) {
          unhighlightById(value); // id
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

      // @native-event
      function sendOnHighlightChange(highlights) {
        postMessage(BridgingNames.events.onHighlightsChange, highlights);
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
        if (!highlights) {
          return;
        }
        try {
          clearHighlightFocusStyle();
          __MNST__.highlighter.removeAllHighlights();
          __MNST__.highlighter.deserialize(highlights);
          clearIgnoredElementsBackgroundColors();
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
      function highlightSelection(classApplierName) {
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
            clearIgnoredElementsBackgroundColors();
            applyHighlightVisibilityClass(false, true);
            sendOnHighlightChange(__MNST__.highlighter.serialize());
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
      function unhighlightSelection() {
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
          clearHighlightFocusStyle();
          __MNST__.highlighter.unhighlightSelection();
          clearIgnoredElementsBackgroundColors();
          sendOnHighlightChange(__MNST__.highlighter.serialize());
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
          __MNST__.highlighter.removeAllHighlights();
          clearIgnoredElementsBackgroundColors();
          clearHighlightFocusStyle();
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
      function focusHighlight(id, className, scroll) {
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
          if (scroll !== false && elements.length > 0 && elements[0].scrollIntoView) {
            elements[0].scrollIntoView({ behavior: "smooth", block: "start" });
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
      function unhighlightById(id) {
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
          __MNST__.highlighter.removeHighlights([highlight]);
          clearIgnoredElementsBackgroundColors();
          sendOnHighlightChange(__MNST__.highlighter.serialize());
        } catch (e) {
          sendOnError(
            "failed_to_unhighlight_by_id",
            "Failed to unhighlight by id",
            e?.message ?? String(e)
          );
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
          const highlights = __MNST__.highlighter.highlights || [];
          const data = highlights.map((h) => ({
            id: String(h.id),
            name: h.classApplier.className,
            text: h.getText ? h.getText() : "",
          }));
          sendGetAllHighlightsData(id, true, data, undefined);
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

      function applyHighlightVisibilityClass(throwError = false, inverse = false) {
        const visible = __MNST__.state.visible;
        const highlightNames = ${applierNames};
        const selector = highlightNames.map((c) => "."+c).join(", ");
        const nodes = [...document.querySelectorAll(selector)];
        if (nodes.length === 0) {
          if (throwError) {
            throw new Error("No highlights found");
          } else {
            return visible;
          }
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

      function clearHighlightFocusStyle() {
        __MNST__.state.focusedElements.forEach((entry) => {
          entry.el.classList.remove(entry.className);
        });
        __MNST__.state.focusedElements = [];
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
      
      function clearIgnoredElementsBackgroundColors() {
        const ignoredSelector = "${ignoredElementsString}".trim();
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

        return nodes;
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

        updateHighlights(${JSON.stringify(highlights ?? "")});

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
            __MNST__.selector.cache.text = "";
            __MNST__.selector.cache.range = null;
            sendOnTextSelectionChange("");
          } else {
            __MNST__.selector.cache.text = selection.toString();
            if (selection.rangeCount > 0) {
              __MNST__.selector.cache.range = selection.getRangeAt(0).cloneRange();
            }
            sendOnTextSelectionChange(__MNST__.selector.cache.text);
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

/*
function parseActions(actions: Action[] | undefined): string {
  let html = "";
  if (!actions) {
    html = html.concat(
      `<button onclick="sendAction({ value : 'highlight', label : 'Highlight' }, event)">Highlight</button>`
    );
    html = html.concat(
      `<button onclick="sendAction({ value : 'unhighlight', label : 'Unhighlight' }, event)">Unhighlight</button>`
    );
  } else {
    actions.forEach((a) => {
  html = html.concat(
    `<button onclick="sendAction({ value : '${a.value}', label : '${a.label}' }, event)">${a.label}</button>`
  );
});
}
return html;
}

export function blocksRenderer(content: RootBlocks | undefined): string {
  return `
    <div class="content">
      ${content?.map((block, index) => blockRenderer(block, index)).join("")}
    </div>
  `;
}

const blocks = {
  heading: ({ level, children }: HeadingBlock, index: number) =>
    `
      <h${level} data-key="${index}">
        ${children.map((c, i) => inlineRenderer(c, i)).join("")}
      </h${level}>
    `,

  paragraph: ({ children }: ParagraphBlock, index: number) =>
    `
      <p data-key="${index}">
        ${children.map((c, i) => inlineRenderer(c, i)).join("")}
      </p>
    `,

  list: ({ children, format }: ListBlock, index: number) => {
    const tag = format === "ordered" ? "ol" : "ul";
    return `
      <${tag} data-key="${index}">
        ${children.map((c, i) => blockRenderer(c, i)).join("")}
      </${tag}>
    `;
  },

  "list-item": ({ children }: ListItemBlock, index: number) => {
    return `
      <li data-key="${index}">
        ${children.map((c, i) => inlineRenderer(c, i)).join("")}
      </li>
    `;
  },
};

function blockRenderer(
  block: RootBlocks[number] | ListItemBlock | undefined,
  index: number
): string {
  if (!block) return "";
  return blocks[block.type](block as any, index) ?? "";
}

function inlineRenderer(block: TextBlock | LinkBlock, index: number): string {
  if (block.type === "text") {
    let html = escapeHtml(block.text);

    if (block.code) html = `<code>${html}</code>`;
    if (block.strikethrough) html = `<s>${html}</s>`;
    if (block.underline) html = `<u>${html}</u>`;
    if (block.italic) html = `<em>${html}</em>`;
    if (block.bold) html = `<strong>${html}</strong>`;

    return html;
  }

  if (block.type === "link") {
    const isLink =
      block.url.startsWith("https://") || block.url.startsWith("http://");
    const childrenHTML = block.children
      .map((c, i) => inlineRenderer(c, i))
      .join("");

    if (isLink) {
      return `<a href="${block.url}" data-key="${index}">${childrenHTML}</a>`;
    } else {
      return "";
    }
  }

  return "";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const blocksStyle = `
.content {
  font-family: system-ui, sans-serif;
  line-height: 1.6;
  font-size: 16px;
  color: #000000ff;
}

.content p {
  margin: 0.75em 0;
}

.content h1,
.content h2,
.content h3,
.content h4,
.content h5,
.content h6 {
  margin: 1.2em 0 0.6em;
  font-weight: bold;
}

.content ul,
.content ol {
  margin: 1em 2.5em 1em 2.5em;
  padding: 0;
}

.content li {
  margin: 2em 0;
}

.content a {
  color: #0645ad;
  text-decoration: underline;
}

.content code {
  font-family: monospace;
  background: #f4f4f4;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.95em;
}

.content sup {
  font-size: 0.75em;
  line-height: 0;
}
`;
*/
