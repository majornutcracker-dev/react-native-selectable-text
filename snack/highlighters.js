import { theme } from "./theme";

const { amber, coral, azure } = theme.highlight;

/**
 * One highlighter per colour, plus an underline that shows a different
 * `type`. The entrance animation runs once — it is an arrival, not a loop.
 */
export const highlighters = [
  {
    name: "amber",
    options: {
      type: "background-color",
      color: amber,
      animation: {
        keyframesCss: `
          @keyframes markerIn {
            from { background-color: transparent; }
            to   { background-color: ${amber}; }
          }
        `,
        name: "markerIn",
        duration: "420ms",
        timingFunction: "cubic-bezier(.2,.8,.2,1)",
        iterationCount: 1,
      },
    },
  },
  { name: "coral", options: { type: "background-color", color: coral } },
  { name: "azure", options: { type: "background-color", color: azure } },
  {
    name: "underline",
    options: {
      type: "text-decoration-color",
      color: theme.color.accent,
      line: "underline",
      style: "wavy",
      thickness: 2,
      offset: 4,
    },
  },
];

/** The three swatches the toolbar offers, in order. */
export const swatches = [
  { name: "amber", color: amber },
  { name: "coral", color: coral },
  { name: "azure", color: azure },
];
