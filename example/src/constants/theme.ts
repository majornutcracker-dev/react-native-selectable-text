/**
 * Single source of truth for the whole example.
 *
 * Everything that carries colour derives from here — the native chrome, the
 * highlighter definitions in `highlighters.ts`, and the per-document accents in
 * `documents.ts` — so the app, the WebView content, and the highlights always
 * belong to the same palette.
 */

const palette = {
  ink900: "#080A10",
  ink800: "#0F131D",
  ink700: "#171C2A",
  ink600: "#212839",
  line: "#2B3448",
  lineSoft: "#1E2536",

  mist: "#F2F5FA",
  mist2: "#9AA6BF",
  mist3: "#5E6B86",

  violet: "#7C5CFF",
  violetSoft: "#A78BFF",
  violetDim: "#221A47",

  /** The highlighter family. Reused as document accents so the two rhyme. */
  amber: "#FFC857",
  coral: "#FF7A93",
  mint: "#4FE0C0",
  azure: "#5BC8FF",

  danger: "#FF6B6B",
} as const;

/** A highlight colour plus the derived tints the UI needs around it. */
function swatch(base: string, dim: string) {
  return { base, dim } as const;
}

export const theme = {
  color: {
    bg: palette.ink900,
    bgElevated: palette.ink800,
    bgCard: palette.ink700,
    bgRaised: palette.ink600,
    border: palette.line,
    borderSoft: palette.lineSoft,

    text: palette.mist,
    textMuted: palette.mist2,
    textFaint: palette.mist3,

    accent: palette.violet,
    accentSoft: palette.violetSoft,
    accentDim: palette.violetDim,
    /** Text/icon colour to place on top of an accent fill. */
    onAccent: "#0B0713",

    danger: palette.danger,
    success: palette.mint,

    scrim: "rgba(4, 6, 12, 0.72)",
    hairline: "rgba(255, 255, 255, 0.08)",
  },

  /** Named highlight colours, shared by highlighters and document accents. */
  highlight: {
    amber: swatch(palette.amber, "#43350F"),
    coral: swatch(palette.coral, "#45202B"),
    mint: swatch(palette.mint, "#0F3B34"),
    azure: swatch(palette.azure, "#123245"),
  },

  radius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },

  /** 4pt grid. `space(3)` reads better than a bare 12 at the call site. */
  space: (n: number) => n * 4,

  font: {
    size: { xs: 11, sm: 12, base: 14, md: 15, lg: 17, xl: 20, display: 34 },
    weight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      heavy: "800",
    },
  },

  /** Motion used by the native chrome; the WebView content mirrors these. */
  motion: {
    fast: 180,
    base: 260,
    slow: 460,
  },
} as const;

export type HighlightSwatchName = keyof typeof theme.highlight;
