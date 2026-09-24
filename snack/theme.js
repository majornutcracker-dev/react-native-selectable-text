/**
 * A trimmed-down version of the example app's palette, so the Snack and the
 * full example clearly belong to the same library.
 */
export const theme = {
  color: {
    bg: "#080A10",
    bgElevated: "#0F131D",
    bgCard: "#171C2A",
    border: "#2B3448",
    text: "#F2F5FA",
    textMuted: "#9AA6BF",
    accent: "#7C5CFF",
    onAccent: "#0B0713",
    paper: "#F7F8FB",
    paperInk: "#141824",
  },
  /** The highlighter family, shared with `highlighters.js`. */
  highlight: {
    amber: "#FFC857",
    coral: "#FF7A93",
    azure: "#5BC8FF",
  },
  radius: { sm: 8, md: 14, lg: 20, pill: 999 },
  space: (n) => n * 4,
};
