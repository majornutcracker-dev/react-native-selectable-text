import {
  CSSString,
  Highlighter,
  HighlighterType,
} from "@majornutcracker/react-native-selectable-text";

import { theme } from "./theme";

const { amber, coral, mint, azure } = theme.highlight;

/**
 * Four highlighters, one per supported `HighlighterType`, each pushing its type
 * as far as the option set allows. Every `animation` here runs **once**: it is
 * an entrance, played when Rangy inserts the span, not an ambient loop that
 * would turn a page full of highlights into a disco.
 */
export const highlighters: Highlighter[] = [
  {
    // background-color — ink bleeding outward from the text.
    name: "highlight-amber-marker",
    options: {
      type: "background-color",
      color: amber.base,
      animation: {
        keyframesCss: `
          @keyframes amberBleed {
            0%   { box-shadow: inset 0 0 0 0 ${amber.base}; background-color: transparent; }
            100% { box-shadow: 0 0 0 4px rgba(255,200,87,0); background-color: ${amber.base}; }
          }
        `,
        name: "amberBleed",
        duration: "2000ms",
        timingFunction: "cubic-bezier(.2,.8,.2,1)",
        iterationCount: 1,
      },
    },
  },
  {
    // text-decoration — a wavy rule that sweeps in under the words.
    name: "highlight-coral-wave",
    options: {
      type: "text-decoration-color",
      color: coral.base,
      line: "underline",
      style: "wavy",
      thickness: 2,
      offset: 5,
      animation: {
        keyframesCss: `
          @keyframes coralDraw {
            0%   { text-decoration-color: transparent; text-underline-offset: 12px; }
            60%  { text-decoration-color: ${coral.base}; }
            100% { text-decoration-color: ${coral.base}; text-underline-offset: 5px; }
          }
        `,
        name: "coralDraw",
        duration: "460ms",
        timingFunction: "cubic-bezier(.2,.9,.2,1)",
        iterationCount: 1,
      },
    },
  },
  {
    // outline — a dashed frame that snaps shut around the selection.
    name: "highlight-mint-frame",
    options: {
      type: "outline-color",
      color: mint.base,
      style: "dashed",
      width: 2,
      offset: 3,
      animation: {
        keyframesCss: `
          @keyframes mintSnap {
            0%   { outline-offset: 10px; outline-color: transparent; }
            55%  { outline-color: ${mint.base}; }
            100% { outline-offset: 3px; outline-color: ${mint.base}; }
          }
        `,
        name: "mintSnap",
        duration: "420ms",
        timingFunction: "cubic-bezier(.2,.9,.2,1)",
        iterationCount: 1,
      },
    },
  },
  {
    // background-image — a gradient, not a bitmap: nothing to download, and it
    // can be animated by moving its background-position.
    name: "highlight-azure-prism",
    options: {
      type: "background-image",
      image: `linear-gradient(100deg, ${azure.base}00 0%, ${azure.base}66 20%, ${mint.base}88 50%, ${azure.base}66 80%, ${azure.base}00 100%)`,
      repeat: "no-repeat",
      size: "220% 100%",
      // The animation has no fill-mode, so the element settles back on this
      // declared position: the middle of the gradient, where the colour is.
      position: "50% 0",
      animation: {
        keyframesCss: `
          @keyframes azureSweep {
            0%   { background-position: 140% 0; }
            100% { background-position: 50% 0; }
          }
        `,
        name: "azureSweep",
        duration: "760ms",
        timingFunction: "cubic-bezier(.2,.8,.2,1)",
        iterationCount: 1,
      },
    },
  },
];

/**
 * Exit animation support.
 *
 * `unhighlightById(id, { className, delay })` stages the removal inside the
 * WebView: it adds the class, lets the animation run, and only then deletes the
 * node. `HIGHLIGHT_EXIT_MS` keeps the CSS duration and the delay in sync.
 */
export const HIGHLIGHT_EXIT_CLASS = "highlight-exit";
export const HIGHLIGHT_EXIT_MS = 1000;

/** Class handed to `focusHighlight` when a highlight is opened, not removed. */
export const HIGHLIGHT_FOCUS_CLASS = "highlight-focus";

/** Motion shared by every document: focus pulse + the staged exit above. */
export const highlightMotionCss: CSSString = `
.mnst-default-focus,
.highlight-focus {
  border-radius: 4px;
  box-shadow: 0 6px 20px rgba(0,0,0,.28);
  animation: highlightFocus 620ms cubic-bezier(.2,.9,.2,1);
}
@keyframes highlightFocus {
  0%   { transform: scale(1); }
  45%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}

/*
 * Exit animations, one per highlighter.
 *
 * A highlighter's own class carries its entrance animation, and the exit class
 * is added alongside it — the span ends up as
 * "highlight-amber-marker highlight-exit". A compound selector therefore
 * outranks the highlighter's own rule and replaces the animation, which is what
 * lets each type leave the way it arrived instead of sharing one generic fade.
 *
 * Each one releases the property its type actually set: fading a background out
 * of an outline highlighter would animate a colour it never had, and the
 * highlight would simply vanish at the end of the delay.
 */
.${HIGHLIGHT_EXIT_CLASS} {
  animation: exitFade ${HIGHLIGHT_EXIT_MS}ms cubic-bezier(.4,0,1,1) forwards;
}
@keyframes exitFade {
  0%   { background-color: currentColor; }
  100% { background-color: transparent; }
}

.highlight-amber-marker.${HIGHLIGHT_EXIT_CLASS} {
  animation: amberDrain ${HIGHLIGHT_EXIT_MS}ms cubic-bezier(.4,0,1,1) forwards;
}
@keyframes amberDrain {
  0%   { background-color: ${amber.base}; box-shadow: 0 0 0 0 rgba(255,200,87,0); }
  40%  { box-shadow: 0 0 0 4px rgba(255,200,87,.35); }
  100% { background-color: transparent; box-shadow: 0 0 0 10px rgba(255,200,87,0); }
}

.highlight-coral-wave.${HIGHLIGHT_EXIT_CLASS} {
  animation: coralErase ${HIGHLIGHT_EXIT_MS}ms cubic-bezier(.4,0,1,1) forwards;
}
@keyframes coralErase {
  0%   { text-decoration-color: ${coral.base}; text-underline-offset: 5px; }
  100% { text-decoration-color: transparent; text-underline-offset: 14px; }
}

.highlight-mint-frame.${HIGHLIGHT_EXIT_CLASS} {
  animation: mintRelease ${HIGHLIGHT_EXIT_MS}ms cubic-bezier(.4,0,1,1) forwards;
}
@keyframes mintRelease {
  0%   { outline-color: ${mint.base}; outline-offset: 3px; }
  100% { outline-color: transparent; outline-offset: 14px; }
}

.highlight-azure-prism.${HIGHLIGHT_EXIT_CLASS} {
  animation: azureWithdraw ${HIGHLIGHT_EXIT_MS}ms cubic-bezier(.4,0,1,1) forwards;
}
@keyframes azureWithdraw {
  0%   { background-position: 50% 0; }
  100% { background-position: 140% 0; }
}
`;

export type HighlighterAsset = {
  type: HighlighterType;
  color?: string;
  image?: string;
};

const COLOR_HIGHLIGHTER_TYPES = new Set<HighlighterType>([
  "background-color",
  "text-decoration-color",
  "outline-color",
]);

export function isColorHighlighterType(type: HighlighterType): boolean {
  return COLOR_HIGHLIGHTER_TYPES.has(type);
}

export function parseCssImageUrl(image: string): string | undefined {
  const match = image.match(/url\(['"]?(.*?)['"]?\)/);
  return match?.[1];
}

/**
 * What the native UI needs to draw a preview of a highlighter. Gradient-backed
 * `background-image` highlighters have no URL to show, so they fall back to a
 * representative colour instead of rendering nothing.
 */
export function assetForClassName(name: string): HighlighterAsset | undefined {
  const highlighter = highlighters.find((h) => h.name === name);
  if (!highlighter) {
    return undefined;
  }
  switch (highlighter.options.type) {
    case "background-color":
    case "outline-color":
    case "text-decoration-color":
      return {
        type: highlighter.options.type,
        color: highlighter.options.color,
      };
    case "background-image":
      return {
        type: "background-image",
        image: parseCssImageUrl(highlighter.options.image),
        color: azure.base,
      };
  }
}

/** A solid colour for any highlighter, for swatches and badges. */
export function swatchColor(name: string): string {
  const asset = assetForClassName(name);
  return asset?.color ?? theme.color.textFaint;
}

/** "highlight-amber-marker" → "Amber marker" */
export function highlighterLabel(name: string): string {
  const bare = name.replace(/^highlight-/, "").replace(/-/g, " ");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}
