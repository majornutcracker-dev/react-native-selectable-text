import {
  Highlighter,
  HighlighterType,
} from "@majornutcracker/react-native-selectable-text";

export const highlighters: Highlighter[] = [
  {
    name: "highlight-amber-background-color",
    options: { type: "background-color", color: "#FDE8A0" },
  },
  {
    name: "highlight-coral-underline",
    options: {
      type: "text-decoration-color",
      color: "#FCAAB8",
      line: "underline",
    },
  },
  {
    name: "highlight-mint-outline",
    options: {
      type: "outline-color",
      color: "#A7F0D5",
      style: "dashed",
      width: 3,
      offset: -2,
    },
  },
  {
    name: "highlight-background-image",
    options: {
      type: "background-image",
      image:
        "url('https://img.magnific.com/free-vector/hand-drawn-artistic-leaves-pattern-soft-backdrop-decor_1017-49518.jpg?semt=ais_hybrid&w=740&q=80')",
      repeat: "repeat",
      size: "140px",
      animation: {
        keyframesCss: `
          @keyframes moveBg {
            from {
              background-position: 0 0;
            }
            to {
              background-position: 400px 400px;
            }
          }
        `,
        name: "moveBg",
        duration: "50s",
        timingFunction: "linear",
        iterationCount: "infinite",
      },
    },
  },
];

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

export function assetForClassName(name: string): HighlighterAsset | undefined {
  const highlighter = highlighters.find((h) => h.name === name);
  if (!highlighter) {
    return undefined;
  }
  switch (highlighter.options.type) {
    case "background-color":
      return {
        type: "background-color",
        color: highlighter.options.color,
      };
    case "background-image":
      return {
        type: "background-image",
        image: parseCssImageUrl(highlighter.options.image),
      };
    case "outline-color":
      return {
        type: "outline-color",
        color: highlighter.options.color,
      };
    case "text-decoration-color":
      return {
        type: highlighter.options.type,
        color: highlighter.options.color,
      };
  }
}
