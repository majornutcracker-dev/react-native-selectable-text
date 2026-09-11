import {
  CSSString,
  HTMLString,
  SelectableTextViewFonts,
  googleFonts,
} from "@majornutcracker/react-native-selectable-text";

import { highlightMotionCss } from "./highlighters";
import { theme } from "./theme";

export type ReaderDocument = {
  id: string;
  title: string;
  kicker: string;
  blurb: string;
  readingTime: string;
  /** Drives the native card + reader chrome so each doc feels like its own app. */
  accent: string;
  accentDim: string;
  content: HTMLString;
  css: CSSString;
  fonts: SelectableTextViewFonts;
};

/**
 * Styles shared by every document. Anything document-specific lives in that
 * document's own `css`, so the three read as completely different designs while
 * the highlight/focus behaviour stays consistent.
 */
const baseCss = `
html, body { overflow-x: hidden; max-width: 100%; margin: 0; }
.doc {
  overflow-wrap: anywhere;
  word-break: break-word;
  padding: 0 20px 64px;
  line-height: 1.65;
}
.doc h1, .doc h2, .doc h3 { line-height: 1.15; }
.doc p { margin: 0 0 1.1em; }
.doc figure { margin: 2rem 0; }
.doc figcaption {
  font-size: 12px;
  opacity: .7;
  margin-top: .6rem;
  text-align: center;
}
.doc svg { display: block; width: 100%; height: auto; }

/* Entrance: content fades up in sequence as the document opens. */
.reveal { animation: reveal .7s cubic-bezier(.2,.8,.2,1) both; }
.reveal:nth-of-type(2) { animation-delay: .06s; }
.reveal:nth-of-type(3) { animation-delay: .12s; }
.reveal:nth-of-type(4) { animation-delay: .18s; }
.reveal:nth-of-type(5) { animation-delay: .24s; }
@keyframes reveal {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}

/* Focus pulse + the staged exit animation, shared by every document. */
${highlightMotionCss}
`;

/* ------------------------------------------------------------------ */
/* 1. Editorial — magazine feel, drop cap, animated gradient wordmark   */
/* ------------------------------------------------------------------ */

const attentionContent: HTMLString = `
<article class="doc">
  <header class="masthead reveal">
    <p class="kicker">Essay · Cognition</p>
    <h1>The Anatomy of <span class="grad">Attention</span></h1>
    <p class="standfirst">
      Every act of reading is an act of selection. Long before you highlight a
      sentence, your mind has already decided it matters.
    </p>
  </header>

  <p class="lede reveal">
    <span class="dropcap">W</span>e like to imagine attention as a spotlight —
    a clean circle of light we aim at the world. The metaphor is comforting and
    almost entirely wrong. Attention is less a beam than a negotiation, a
    constant argument between what you intended to notice and what refused to
    be ignored.
  </p>

  <figure class="reveal">
    <svg viewBox="0 0 320 130" role="img" aria-label="Three overlapping fields of focus">
      <defs>
        <radialGradient id="f1"><stop offset="0" stop-color="${theme.highlight.amber.base}" stop-opacity=".9"/><stop offset="1" stop-color="${theme.highlight.amber.base}" stop-opacity="0"/></radialGradient>
        <radialGradient id="f2"><stop offset="0" stop-color="${theme.highlight.coral.base}" stop-opacity=".85"/><stop offset="1" stop-color="${theme.highlight.coral.base}" stop-opacity="0"/></radialGradient>
        <radialGradient id="f3"><stop offset="0" stop-color="#3E63DD" stop-opacity=".85"/><stop offset="1" stop-color="#3E63DD" stop-opacity="0"/></radialGradient>
      </defs>
      <circle class="orb o1" cx="110" cy="65" r="52" fill="url(#f1)"/>
      <circle class="orb o2" cx="160" cy="65" r="52" fill="url(#f2)"/>
      <circle class="orb o3" cx="210" cy="65" r="52" fill="url(#f3)"/>
    </svg>
    <figcaption>Overlapping fields — inline SVG, animated in pure CSS.</figcaption>
  </figure>

  <h2 class="reveal">The cost of noticing</h2>
  <p>
    Nothing is free. To attend to this sentence you are actively suppressing the
    weight of the device in your hand, the sound of the room, the memory you were
    turning over a moment ago. Psychologists call the leftovers
    <em>attentional residue</em>: the part of the previous thought that refuses
    to leave when you switch tasks.
  </p>

  <blockquote class="pull">
    Reading is not consumption. It is the slow, deliberate act of deciding what
    deserves to survive.
  </blockquote>

  <p>
    This is why highlighting endures as a technology. Not because the colour helps
    you remember — the research there is unkind — but because the
    <strong>act of choosing</strong> forces the argument into the open. You cannot
    highlight passively. Something must be preferred over something else.
  </p>

  <h2 class="reveal">A note on notation</h2>
  <p>
    Notation collapses effort. Writing H<sub>2</sub>O rather than
    <em>dihydrogen monoxide</em> frees the working memory that would otherwise be
    spent on bookkeeping — the same reason E = mc<sup>2</sup> fits on a shirt and
    its derivation does not. Try selecting across this sentence: the
    <code>sub</code> and <code>sup</code> nodes stay copyable but skip the visible
    highlight.
  </p>

  <p class="ignored">
    This aside is marked <code>.ignored</code>. Select it, copy it — it simply
    refuses to wear a highlight.
  </p>

  <p>
    Further reading lives at
    <a href="https://en.wikipedia.org/wiki/Attention">the usual place</a>; links
    are routed through <code>onLink</code> rather than navigating the WebView.
  </p>
</article>
`;

const attentionCss: CSSString = `
${baseCss}
.doc {
  font-family: "Source Sans 3", system-ui, sans-serif;
  background: #FBF9F4;
  color: #21201C;
  font-size: 16px;
}
.masthead { padding: 40px 0 8px; }
.kicker {
  font-size: 11px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: #A18072;
  margin-bottom: 10px;
}
.doc h1 {
  font-family: "Source Serif 4", Georgia, serif;
  font-size: 40px;
  font-weight: 600;
  margin: 0 0 14px;
  letter-spacing: -.02em;
}
.grad {
  background: linear-gradient(100deg, ${theme.highlight.amber.base}, ${theme.highlight.coral.base} 45%, ${theme.color.accent});
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: sweep 7s ease-in-out infinite;
}
@keyframes sweep {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
.standfirst {
  font-size: 17px;
  color: #6F6B64;
  font-style: italic;
  border-left: 2px solid #E8E2D6;
  padding-left: 14px;
}
.dropcap {
  float: left;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: 58px;
  line-height: .82;
  padding: 6px 10px 0 0;
  color: ${theme.highlight.coral.base};
}
.doc h2 {
  font-family: "Source Serif 4", Georgia, serif;
  font-size: 22px;
  margin: 2rem 0 .7rem;
}
.pull {
  margin: 1.8rem 0;
  padding: 18px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, #FFF4E0, #FDE8E9);
  font-family: "Source Serif 4", Georgia, serif;
  font-size: 19px;
  font-style: italic;
  color: #3B372F;
}
.doc code {
  font-family: ui-monospace, monospace;
  font-size: .87em;
  background: #EFE9DC;
  padding: .12em .38em;
  border-radius: 4px;
}
.doc a { color: #AD5700; text-underline-offset: 3px; }
.ignored {
  border-left: 3px solid #E8E2D6;
  padding-left: 14px;
  color: #6F6B64;
  font-size: 15px;
}
.orb { transform-origin: center; animation: drift 9s ease-in-out infinite; mix-blend-mode: multiply; }
.o2 { animation-delay: -3s; }
.o3 { animation-delay: -6s; }
@keyframes drift {
  0%, 100% { transform: translateX(0) scale(1); }
  33%      { transform: translateX(-16px) scale(1.08); }
  66%      { transform: translateX(16px) scale(.94); }
}
`;

/* ------------------------------------------------------------------ */
/* 2. Dark science piece — glow, grid, animated dashes                  */
/* ------------------------------------------------------------------ */

const glowContent: HTMLString = `
<article class="doc">
  <header class="reveal">
    <p class="tag">Field notes</p>
    <h1>Living <span class="glow">Light</span></h1>
    <p class="standfirst">
      Three kilometres down, where sunlight has never reached, roughly four in
      five animals make their own.
    </p>
  </header>

  <figure class="reveal">
    <svg viewBox="0 0 320 150" role="img" aria-label="Bioluminescent pulse">
      <g class="jelly">
        <ellipse cx="160" cy="58" rx="46" ry="38" class="bell"/>
        <path class="tent" d="M126 84 q6 34 -4 54"/>
        <path class="tent" d="M144 92 q4 32 -2 50"/>
        <path class="tent" d="M176 92 q-4 32 2 50"/>
        <path class="tent" d="M194 84 q-6 34 4 54"/>
      </g>
    </svg>
    <figcaption>A pulse cycle rendered with stroke-dash animation.</figcaption>
  </figure>

  <p class="reveal">
    Bioluminescence is a chemical accident that evolution kept rediscovering — at
    least <strong>forty separate times</strong> across the tree of life. A
    molecule called luciferin meets oxygen in the presence of an enzyme, and the
    energy that would otherwise leave as heat leaves as light instead.
  </p>

  <h2 class="reveal">Cold light</h2>
  <p>
    Nearly all of it is cold. An incandescent bulb throws away most of its energy
    as heat; a firefly runs at something close to <span class="stat">96%</span>
    efficiency. Nothing we manufacture comes close.
  </p>

  <ul class="specs">
    <li><span>Peak wavelength</span><b>470–490 nm</b></li>
    <li><span>Depth range</span><b>200–4000 m</b></li>
    <li><span>Independent origins</span><b>~40</b></li>
  </ul>

  <blockquote class="pull">
    In the largest habitat on Earth, light is not a constant. It is a sentence
    someone chose to speak.
  </blockquote>

  <p>
    The colours cluster in the blue-green band for an unglamorous reason: those
    wavelengths travel furthest through seawater. Red light dies within metres,
    which is why a handful of dragonfish evolved red searchlights — a private
    channel their prey cannot see.
  </p>
</article>
`;

const glowCss: CSSString = `
${baseCss}
.doc {
  font-family: "Inter", system-ui, sans-serif;
  background:
    radial-gradient(1200px 400px at 50% -10%, #10314A 0%, transparent 70%),
    #05070D;
  color: #DCE7F2;
  font-size: 16px;
}
.tag {
  font-size: 11px;
  letter-spacing: .2em;
  text-transform: uppercase;
  color: ${theme.highlight.mint.base};
  margin: 40px 0 10px;
}
.doc h1 { font-size: 42px; font-weight: 700; margin: 0 0 14px; letter-spacing: -.03em; }
.glow {
  color: ${theme.highlight.azure.base};
  animation: pulse 3.4s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { text-shadow: 0 0 8px rgba(110,231,249,.45), 0 0 26px rgba(110,231,249,.2); }
  50%      { text-shadow: 0 0 18px rgba(110,231,249,.9), 0 0 54px rgba(110,231,249,.5); }
}
.standfirst { color: #8FA6BC; font-size: 17px; }
.doc h2 { font-size: 22px; margin: 2rem 0 .7rem; color: #A5F3FC; }
.stat {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: ${theme.highlight.azure.base};
}
.specs { list-style: none; padding: 0; margin: 1.6rem 0; }
.specs li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 14px;
  border: 1px solid #17324A;
  border-radius: 10px;
  margin-bottom: 8px;
  background: rgba(23,50,74,.35);
}
.specs span { color: #8FA6BC; font-size: 14px; }
.specs b { color: #E6F6FF; font-variant-numeric: tabular-nums; }
.pull {
  margin: 1.8rem 0;
  padding: 18px 20px;
  border-left: 3px solid ${theme.highlight.mint.base};
  background: linear-gradient(90deg, rgba(79,209,197,.14), transparent);
  font-size: 18px;
  font-style: italic;
  color: #CFFAFE;
}
.bell {
  fill: none;
  stroke: ${theme.highlight.azure.base};
  stroke-width: 2;
  filter: drop-shadow(0 0 6px rgba(110,231,249,.8));
  animation: breathe 3.4s ease-in-out infinite;
  transform-origin: 160px 58px;
}
@keyframes breathe {
  0%, 100% { transform: scaleY(1) scaleX(1); opacity: .95; }
  50%      { transform: scaleY(.86) scaleX(1.06); opacity: .6; }
}
.tent {
  fill: none;
  stroke: ${theme.highlight.mint.base};
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-dasharray: 6 10;
  animation: swim 2.6s linear infinite;
}
@keyframes swim { to { stroke-dashoffset: -32; } }
`;

/* ------------------------------------------------------------------ */
/* 3. Typography showcase — big type, letterpress, animated rules       */
/* ------------------------------------------------------------------ */

const typeContent: HTMLString = `
<article class="doc">
  <header class="reveal">
    <h1>Set in <em>Stone</em>,<br/>Read on Glass</h1>
    <p class="byline">On the eight hundred years between the chisel and the screen</p>
    <div class="rule"><span></span></div>
  </header>

  <p class="reveal">
    A typeface is an argument about how much of itself a text should show. The
    Romans cut letters into marble with a brush first and a chisel second, and
    the serif — that small finishing stroke — is the brush refusing to disappear.
  </p>

  <div class="specimen reveal">
    <div class="glyph">Aa</div>
    <div class="meta">
      <b>Source Serif 4</b>
      <span>Transitional · 1 axis · 400–700</span>
    </div>
  </div>

  <h2 class="reveal">Measure and rhythm</h2>
  <p>
    The single most consequential decision in setting text is not the typeface.
    It is the <em>measure</em> — the line length. Too long and the eye loses its
    return path; too short and the sentence fragments into stutters. Somewhere
    between forty-five and seventy-five characters, reading stops feeling like
    work.
  </p>

  <p>
    Everything else — leading, tracking, the exact grey of the paragraph on the
    page — is in service of that one number.
  </p>

  <blockquote class="pull">
    Typography exists to honour content. When it draws attention to itself, it
    has usually failed.
  </blockquote>

  <h2 class="reveal">What the screen changed</h2>
  <p>
    Almost nothing, and almost everything. The letterforms survived; the surface
    did not. Ink on paper is subtractive and fixed. Light through glass is
    additive, resizable, and — as this paragraph demonstrates — annotatable by
    anyone holding the device.
  </p>

  <p class="colophon">
    Select any line above. The highlight is a real DOM range, serialized and
    restored across launches.
  </p>
</article>
`;

const typeCss: CSSString = `
${baseCss}
.doc {
  font-family: "Source Serif 4", Georgia, serif;
  background: #14110E;
  color: #EDE6DA;
  font-size: 17px;
}
.doc h1 {
  font-size: 44px;
  font-weight: 600;
  margin: 44px 0 12px;
  letter-spacing: -.02em;
  text-shadow: 0 1px 0 rgba(255,255,255,.14), 0 -1px 0 rgba(0,0,0,.55);
}
.doc h1 em { font-style: italic; color: ${theme.highlight.coral.base}; }
.byline {
  font-family: "Source Sans 3", system-ui, sans-serif;
  font-size: 13px;
  letter-spacing: .06em;
  color: #9A8F80;
  text-transform: uppercase;
}
.rule { height: 1px; background: #2E2823; margin: 22px 0 30px; overflow: hidden; }
.rule span {
  display: block;
  height: 100%;
  width: 38%;
  background: linear-gradient(90deg, transparent, ${theme.highlight.coral.base}, transparent);
  animation: slide 4.5s ease-in-out infinite;
}
@keyframes slide {
  0%, 100% { transform: translateX(-110%); }
  50%      { transform: translateX(300%); }
}
.specimen {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px;
  border: 1px solid #2E2823;
  border-radius: 16px;
  margin: 1.8rem 0;
  background: linear-gradient(160deg, #1B1713, #14110E);
}
.glyph {
  font-size: 56px;
  line-height: 1;
  color: ${theme.highlight.coral.base};
  animation: weight 6s ease-in-out infinite;
}
@keyframes weight {
  0%, 100% { font-variation-settings: "wght" 400; }
  50%      { font-variation-settings: "wght" 700; }
}
.meta { display: flex; flex-direction: column; gap: 4px; }
.meta b { font-family: "Source Sans 3", sans-serif; font-size: 15px; }
.meta span { font-family: "Source Sans 3", sans-serif; font-size: 12px; color: #9A8F80; }
.doc h2 {
  font-size: 24px;
  margin: 2.2rem 0 .7rem;
  color: #F3EADB;
}
.pull {
  margin: 2rem 0;
  padding: 0 0 0 20px;
  border-left: 2px solid ${theme.highlight.coral.base};
  font-size: 21px;
  font-style: italic;
  color: #E4D4B8;
}
.colophon {
  font-family: "Source Sans 3", sans-serif;
  font-size: 13px;
  color: #9A8F80;
  border-top: 1px solid #2E2823;
  padding-top: 16px;
  margin-top: 2rem;
}
`;

export const documents: ReaderDocument[] = [
  {
    id: "attention",
    title: "The Anatomy of Attention",
    kicker: "Essay · Cognition",
    blurb:
      "Why highlighting works — and why it has almost nothing to do with the colour.",
    readingTime: "4 min",
    accent: theme.highlight.amber.base,
    accentDim: theme.highlight.amber.dim,
    content: attentionContent,
    css: attentionCss,
    fonts: googleFonts({
      families: [
        { family: "Source Sans 3", weights: "300..700", italic: true },
        { family: "Source Serif 4", weights: "400;600", italic: true },
      ],
    }),
  },
  {
    id: "glow",
    title: "Living Light",
    kicker: "Field notes · Marine biology",
    blurb:
      "Forty separate times, evolution invented the same trick: making your own light.",
    readingTime: "3 min",
    accent: theme.highlight.azure.base,
    accentDim: theme.highlight.azure.dim,
    content: glowContent,
    css: glowCss,
    fonts: googleFonts({ family: "Inter", weights: "400..700" }),
  },
  {
    id: "type",
    title: "Set in Stone, Read on Glass",
    kicker: "Craft · Typography",
    blurb:
      "Eight hundred years of letterforms, and the one number that still decides everything.",
    readingTime: "3 min",
    accent: theme.highlight.coral.base,
    accentDim: theme.highlight.coral.dim,
    content: typeContent,
    css: typeCss,
    fonts: googleFonts({
      families: [
        { family: "Source Serif 4", weights: "400;600", italic: true },
        { family: "Source Sans 3", weights: "400;600" },
      ],
    }),
  },
];

export function documentById(id: string | undefined): ReaderDocument {
  return documents.find((d) => d.id === id) ?? documents[0];
}
