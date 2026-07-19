import {
  escapeHtmlAttribute,
  toCssLength,
  animationToCSS,
  uniqueByName,
  highlightersToCSS,
  buildGoogleFontFamilyParam,
  googleFonts,
  mergeFonts,
  fontsToCSS,
  fontsToHeadMarkup,
  generatePromiseId,
  htmlContent,
} from "../utils";
import type { AnimationOptions, Highlighter } from "../types";

describe("toCssLength", () => {
  it("returns the fallback for undefined", () => {
    expect(toCssLength(undefined, "2px")).toBe("2px");
  });
  it("appends px to numbers (including 0)", () => {
    expect(toCssLength(4, "2px")).toBe("4px");
    expect(toCssLength(0, "2px")).toBe("0px");
  });
  it("passes strings through unchanged", () => {
    expect(toCssLength("1rem", "2px")).toBe("1rem");
  });
});

describe("escapeHtmlAttribute", () => {
  it("escapes the five HTML-sensitive characters", () => {
    expect(escapeHtmlAttribute(`<a href="x">&'`)).toBe(
      `&lt;a href=&quot;x&quot;&gt;&amp;&#39;`
    );
  });
  it("escapes & first so it does not double-escape", () => {
    expect(escapeHtmlAttribute("<")).toBe("&lt;");
    expect(escapeHtmlAttribute("&lt;")).toBe("&amp;lt;");
  });
});

describe("animationToCSS", () => {
  const anim: AnimationOptions = {
    name: "pulse",
    keyframesCss: "@keyframes pulse {}",
    duration: "2s",
    timingFunction: "linear",
    iterationCount: "infinite",
  };
  it("returns an empty string when there is no animation", () => {
    expect(animationToCSS(undefined)).toBe("");
  });
  it("builds the animation shorthand", () => {
    expect(animationToCSS(anim)).toBe("animation: pulse 2s linear infinite;");
  });
  it("supports a numeric iteration count", () => {
    expect(animationToCSS({ ...anim, iterationCount: 3 })).toBe(
      "animation: pulse 2s linear 3;"
    );
  });
});

describe("uniqueByName", () => {
  it("keeps the last highlighter when names repeat", () => {
    const list: Highlighter[] = [
      { name: "a", options: { type: "background-color", color: "red" } },
      { name: "a", options: { type: "background-color", color: "blue" } },
    ];
    const result = uniqueByName(list);
    expect(result).toHaveLength(1);
    expect(result[0].options).toMatchObject({ color: "blue" });
  });
});

describe("highlightersToCSS", () => {
  it("renders a background-color rule", () => {
    const css = highlightersToCSS([
      { name: "yh", options: { type: "background-color", color: "yellow" } },
    ]);
    expect(css).toContain(".yh {");
    expect(css).toContain("background-color: yellow;");
  });

  it("appends the animation rule and keyframes when provided", () => {
    const css = highlightersToCSS([
      {
        name: "bub",
        options: {
          type: "background-color",
          color: "yellow",
          animation: {
            name: "bubbles",
            keyframesCss: "@keyframes bubbles { from {} to {} }",
            duration: "2s",
            timingFunction: "linear",
            iterationCount: "infinite",
          },
        },
      },
    ]);
    expect(css).toContain("animation: bubbles 2s linear infinite;");
    expect(css).toContain("@keyframes bubbles { from {} to {} }");
  });

  it("applies text-decoration defaults", () => {
    const css = highlightersToCSS([
      { name: "u", options: { type: "text-decoration-color", color: "red" } },
    ]);
    expect(css).toContain("text-decoration-color: red;");
    expect(css).toContain("text-decoration-line: underline;");
    expect(css).toContain("text-decoration-style: solid;");
    expect(css).toContain("text-decoration-thickness: 2px;");
    expect(css).toContain("text-underline-offset: 2px;");
  });

  it("applies outline defaults", () => {
    const css = highlightersToCSS([
      { name: "o", options: { type: "outline-color", color: "red" } },
    ]);
    expect(css).toContain("outline-color: red;");
    expect(css).toContain("outline-style: solid;");
    expect(css).toContain("outline-width: 2px;");
    expect(css).toContain("outline-offset: 2px;");
  });

  it("applies background-image defaults", () => {
    const css = highlightersToCSS([
      {
        name: "bi",
        options: { type: "background-image", image: "url(x.png)" },
      },
    ]);
    expect(css).toContain("background-image: url(x.png);");
    expect(css).toContain("background-size: auto;");
    expect(css).toContain("background-position: left;");
    expect(css).toContain("background-repeat: no-repeat;");
  });
});

describe("buildGoogleFontFamilyParam", () => {
  it("encodes spaces and defaults the weight", () => {
    expect(buildGoogleFontFamilyParam({ family: "Source Sans 3" })).toBe(
      "Source+Sans+3:wght@400"
    );
  });
  it("keeps a multi-weight list", () => {
    expect(
      buildGoogleFontFamilyParam({ family: "Inter", weights: "400;700" })
    ).toBe("Inter:wght@400;700");
  });
  it("expands italic axes for a weight list", () => {
    expect(
      buildGoogleFontFamilyParam({
        family: "Inter",
        weights: "400;700",
        italic: true,
      })
    ).toBe("Inter:ital,wght@0,400;0,700;1,400;1,700");
  });
  it("expands italic axes for a weight range", () => {
    expect(
      buildGoogleFontFamilyParam({
        family: "Roboto",
        weights: "200..900",
        italic: true,
      })
    ).toBe("Roboto:ital,wght@0,200..900;1,200..900");
  });
});

describe("googleFonts", () => {
  it("builds a single-family stylesheet with preconnects", () => {
    const fonts = googleFonts({ family: "Inter", weights: "400;700" });
    expect(fonts.stylesheets?.[0].href).toContain("family=Inter:wght@400;700");
    expect(fonts.stylesheets?.[0].href).toContain("&display=swap");
    expect(fonts.preconnect).toEqual([
      { href: "https://fonts.googleapis.com" },
      { href: "https://fonts.gstatic.com", crossOrigin: true },
    ]);
  });
  it("joins multiple families", () => {
    const fonts = googleFonts({
      families: [{ family: "A" }, { family: "B" }],
    });
    expect(fonts.stylesheets?.[0].href).toContain(
      "family=A:wght@400&family=B:wght@400"
    );
  });
  it("honors the display override", () => {
    const fonts = googleFonts({ family: "A", display: "block" });
    expect(fonts.stylesheets?.[0].href).toContain("&display=block");
  });
});

describe("mergeFonts", () => {
  it("dedupes preconnect by href + crossOrigin", () => {
    const merged = mergeFonts(
      { preconnect: [{ href: "x" }] },
      { preconnect: [{ href: "x" }, { href: "x", crossOrigin: true }] }
    );
    expect(merged.preconnect).toEqual([
      { href: "x" },
      { href: "x", crossOrigin: true },
    ]);
  });
  it("dedupes stylesheets by href and concatenates faces", () => {
    const merged = mergeFonts(
      { stylesheets: [{ href: "s" }], faces: [{ fontFamily: "A", src: "a" }] },
      { stylesheets: [{ href: "s" }], faces: [{ fontFamily: "B", src: "b" }] }
    );
    expect(merged.stylesheets).toHaveLength(1);
    expect(merged.faces).toHaveLength(2);
  });
  it("prunes empty buckets and skips undefined inputs", () => {
    const merged = mergeFonts(undefined, {});
    expect(merged.preconnect).toBeUndefined();
    expect(merged.stylesheets).toBeUndefined();
    expect(merged.faces).toBeUndefined();
  });
});

describe("fontsToCSS", () => {
  it("returns an empty string without faces", () => {
    expect(fontsToCSS(undefined)).toBe("");
    expect(fontsToCSS({ faces: [] })).toBe("");
  });
  it("renders a @font-face with a single source", () => {
    const css = fontsToCSS({
      faces: [{ fontFamily: "Inter", src: "a.woff2", fontWeight: 700 }],
    });
    expect(css).toContain("@font-face {");
    expect(css).toContain(`font-family: "Inter";`);
    expect(css).toContain(`src: url("a.woff2");`);
    expect(css).toContain("font-weight: 700;");
  });
  it("joins multiple sources", () => {
    const css = fontsToCSS({
      faces: [{ fontFamily: "Inter", src: ["a.woff2", "b.woff"] }],
    });
    expect(css).toContain(`src: url("a.woff2"), url("b.woff");`);
  });
});

describe("fontsToHeadMarkup", () => {
  it("returns an empty string for undefined", () => {
    expect(fontsToHeadMarkup(undefined)).toBe("");
  });
  it("renders preconnect links with optional crossorigin", () => {
    expect(
      fontsToHeadMarkup({
        preconnect: [{ href: "https://x", crossOrigin: true }],
      })
    ).toContain(`<link rel="preconnect" href="https://x" crossorigin>`);
    expect(
      fontsToHeadMarkup({ preconnect: [{ href: "https://x" }] })
    ).toContain(`<link rel="preconnect" href="https://x">`);
  });
  it("renders stylesheet links and escapes the href", () => {
    const markup = fontsToHeadMarkup({
      stylesheets: [{ href: `https://s?q="x"`, crossOrigin: "anonymous" }],
    });
    expect(markup).toContain(`rel="stylesheet"`);
    expect(markup).toContain(`crossorigin="anonymous"`);
    expect(markup).toContain("&quot;");
  });
});

describe("generatePromiseId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generatePromiseId()).toBe("string");
    expect(generatePromiseId().length).toBeGreaterThan(0);
  });
  it("returns distinct ids", () => {
    expect(generatePromiseId()).not.toBe(generatePromiseId());
  });
});

describe("htmlContent", () => {
  const html = htmlContent({
    hl: [
      { name: "yh", options: { type: "background-color", color: "yellow" } },
    ],
    h: undefined,
    c: "<p>hi</p>",
    css: ".x{color:red}",
    f: undefined,
    ho: undefined,
    p: "ios",
    o: { userScalable: false, initialScale: 1, maximumScale: 2 },
  });

  it("injects the content and css", () => {
    expect(html).toContain("<p>hi</p>");
    expect(html).toContain(".x{color:red}");
  });
  it("renders the user highlighter and the always-present default", () => {
    expect(html).toContain(".yh {");
    expect(html).toContain("background-color: yellow;");
    expect(html).toContain(".yellow-highlighter {");
  });
  it("includes the default focus class", () => {
    expect(html).toContain(".mnst-default-focus");
  });
  it("wires the visibility-change bridge event", () => {
    expect(html).toContain("onHighlightsVisibilityStateChange");
  });
  it("applies the viewport options", () => {
    expect(html).toContain("user-scalable=no");
    expect(html).toContain("maximum-scale=2");
  });
  it("uses the default ignored elements", () => {
    expect(html).toContain("a, sup, sub");
  });
});
