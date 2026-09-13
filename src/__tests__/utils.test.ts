import {
  ENTERING_CLASS,
  escapeHtmlAttribute,
  toScriptLiteral,
  escapeCssString,
  isValidHighlighterName,
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

describe("toScriptLiteral", () => {
  it("neutralizes a </script> terminator in the data", () => {
    const out = toScriptLiteral("a</script>b");
    expect(out).not.toContain("</script");
    expect(out).toContain("\\u003C");
  });

  it("escapes U+2028/U+2029, which were JS line terminators before ES2019", () => {
    expect(toScriptLiteral("a" + String.fromCharCode(0x2028) + "b")).toContain(
      "\\u2028"
    );
    expect(toScriptLiteral("a" + String.fromCharCode(0x2029) + "b")).toContain(
      "\\u2029"
    );
  });

  it("round-trips: the emitted literal evaluates back to the input", () => {
    const inputs = [
      'a[href^="http"]',
      "a</script>b",
      "line" + String.fromCharCode(0x2028) + "sep",
      "back\\slash",
      "",
    ];
    for (const input of inputs) {
      expect(eval(toScriptLiteral(input))).toBe(input);
    }
  });

  it('emits null for undefined instead of the string "undefined"', () => {
    expect(toScriptLiteral(undefined)).toBe("null");

    expect(eval(toScriptLiteral(undefined))).toBeNull();
  });
});

describe("escapeCssString", () => {
  it("leaves & alone, since <style> is never entity-decoded", () => {
    expect(escapeCssString("f.woff2?a=1&b=2")).toBe("f.woff2?a=1&b=2");
  });

  it("escapes the quote and the backslash that would close the CSS string", () => {
    expect(escapeCssString('a"b')).toBe('a\\"b');
    expect(escapeCssString("a\\b")).toBe("a\\\\b");
  });

  it("neutralizes < so a value cannot close the style element", () => {
    expect(escapeCssString("a</style>b")).not.toContain("<");
  });

  it("drops newlines, which are invalid inside a CSS string", () => {
    expect(escapeCssString("a\nb")).toBe("ab");
  });
});

describe("isValidHighlighterName", () => {
  it.each(["yellow-highlighter", "yh", "_x", "-x", "a1"])(
    "accepts %s",
    (name) => {
      expect(isValidHighlighterName(name)).toBe(true);
    }
  );

  it.each(["1st-pass", "two words", 'q"uote', "", "a.b", "a>b"])(
    "rejects %s",
    (name) => {
      expect(isValidHighlighterName(name)).toBe(false);
    }
  );
});

describe("htmlContent hardening against hostile input", () => {
  const html = htmlContent({
    hl: [
      { name: "1st-pass", options: { type: "background-color", color: "red" } },
      { name: "ok-name", options: { type: "background-color", color: "blue" } },
    ],
    h: "a</script><script>alert(1)</script>",
    c: "<p>hi</p>",
    css: undefined,
    f: {
      faces: [{ fontFamily: 'Ev"il', src: "https://x.com/f.woff2?a=1&b=2" }],
    },
    ho: { ignoredElements: ['a[href^="http"]', "sup"] },
    p: "ios",
    o: undefined,
  });

  // The page carries several script blocks (the vendored Rangy bundles among
  // them); the SDK bootstrap is the last one.
  function scriptBlocks() {
    return html
      .split("<script>")
      .slice(1)
      .map((block) => block.slice(0, block.indexOf("</script>")));
  }

  function injectedScript() {
    const blocks = scriptBlocks();
    if (!blocks.length) throw new Error("injected script not found");
    return blocks[blocks.length - 1];
  }

  it("emits a syntactically valid script despite quotes in ignoredElements", () => {
    // A selector like a[href^="http"] used to break out of its string literal
    // and take the whole bridge down with a SyntaxError.
    expect(() => new Function(injectedScript())).not.toThrow();
  });

  it("keeps the consumer's selector intact inside the script", () => {
    expect(injectedScript()).toContain("http");
  });

  it("does not let a </script> in the highlights close the script element", () => {
    // Only "</script" ends script data, so that is the sequence the payload
    // must never reintroduce; a bare "<script>" inside script content (the
    // vendored Rangy has one in a comment) is inert.
    expect(injectedScript()).not.toContain("</script");
    expect(injectedScript()).toContain("alert(1)"); // still present, but inert
  });

  it("drops a highlighter name that is not a valid CSS class", () => {
    expect(html).not.toContain("1st-pass");
    expect(html).toContain("ok-name");
  });

  it("does not HTML-escape font URLs, which <style> would never decode", () => {
    expect(html).toContain("f.woff2?a=1&b=2");
    expect(html).not.toContain("f.woff2?a=1&amp;b=2");
  });

  it("escapes a quote in font-family for CSS, not for HTML", () => {
    expect(html).not.toContain("Ev&quot;il");
  });
});

describe("focusHighlight scrolling", () => {
  // scrollToHighlight lives inside the script injected into the WebView, so it
  // is pulled out of the generated HTML and run against a fake window here.
  function loadScrollToHighlight() {
    const html = htmlContent({
      hl: [
        { name: "yh", options: { type: "background-color", color: "yellow" } },
      ],
      h: undefined,
      c: "<p>hi</p>",
      css: undefined,
      f: undefined,
      ho: undefined,
      p: "ios",
      o: { userScalable: true, initialScale: 1, maximumScale: 2.5 },
    });
    const blocks = html
      .split("<script>")
      .slice(1)
      .map((block) => block.slice(0, block.indexOf("</script>")));
    const script = blocks[blocks.length - 1];

    const start = script.indexOf("function scrollToHighlight");
    if (start === -1) throw new Error("scrollToHighlight not found");
    let depth = 0;
    let end = start;
    for (let i = script.indexOf("{", start); i < script.length; i++) {
      if (script[i] === "{") depth++;
      else if (script[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    const source = script.slice(start, end);

    return (fakeWindow: Record<string, unknown>) =>
      new Function(
        "window",
        "document",
        `${source}; return scrollToHighlight;`
      )(fakeWindow, { documentElement: { scrollTop: 0 } }) as (
        el: unknown,
        opts: Record<string, unknown>
      ) => void;
  }

  const build = (
    { scrollTop = 0, innerHeight = 800 } = {} as {
      scrollTop?: number;
      innerHeight?: number;
    }
  ) => {
    const scrollTo = jest.fn();
    const win = { pageYOffset: scrollTop, innerHeight, scrollTo };
    const fn = loadScrollToHighlight()(win);
    const el = (top: number, height: number) => ({
      getBoundingClientRect: () => ({ top: top - scrollTop, height }),
      scrollIntoView: jest.fn(),
    });
    return { fn, el, scrollTo };
  };

  it("delegates to scrollIntoView when there is no offset", () => {
    const { fn, el } = build();
    const node = el(1000, 20);
    fn(node, {});
    expect(node.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("centers the highlight in the viewport below the offset band", () => {
    const { fn, el, scrollTo } = build({ innerHeight: 800 });
    // usable area = 800 - 100 = 700, so a 20px highlight sits 340px into it.
    fn(el(1000, 20), { offset: 100 });
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1000 - 100 - (700 - 20) / 2,
      behavior: "smooth",
    });
  });

  it("aligns to the top edge below the offset band", () => {
    const { fn, el, scrollTo } = build();
    fn(el(1000, 20), { block: "start", offset: 80, behavior: "auto" });
    expect(scrollTo).toHaveBeenCalledWith({ top: 920, behavior: "auto" });
  });

  it("never scrolls above the top of the document", () => {
    const { fn, el, scrollTo } = build();
    fn(el(10, 20), { block: "start", offset: 80 });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it('leaves an already visible highlight alone with block "nearest"', () => {
    const { fn, el, scrollTo } = build({ scrollTop: 500, innerHeight: 800 });
    fn(el(700, 20), { block: "nearest", offset: 100 });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls a highlight hidden under the offset band with "nearest"', () => {
    const { fn, el, scrollTo } = build({ scrollTop: 500, innerHeight: 800 });
    // 550 sits inside the 100px band covering 500..600, so it counts as hidden.
    fn(el(550, 20), { block: "nearest", offset: 100 });
    expect(scrollTo).toHaveBeenCalledWith({ top: 450, behavior: "smooth" });
  });
});

describe("stylesheet ordering", () => {
  const styleBlock = () => {
    const html = htmlContent({
      hl: [
        {
          name: "azure-sweep",
          options: {
            type: "background-color",
            color: "#bae6fd",
            animation: {
              name: "azureSweep",
              keyframesCss: "@keyframes azureSweep { 0%{opacity:0} }",
              duration: "760ms",
              timingFunction: "ease",
              iterationCount: 1,
            },
          },
        },
      ],
      h: undefined,
      c: "<p>hi</p>",
      css: ".highlight-exit { animation: highlightExit 1s ease forwards; }",
      f: undefined,
      ho: undefined,
      p: "ios",
      o: { userScalable: false, initialScale: 1, maximumScale: 2 },
    });
    return html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  };

  it("lets a consumer rule override a generated highlighter class", () => {
    // Both are single-class selectors, so the one declared later wins. An exit
    // animation on a highlight used to lose to the highlighter's own animation
    // and simply never played.
    const style = styleBlock();
    expect(style.indexOf(".highlight-exit")).toBeGreaterThan(
      style.indexOf(".azure-sweep")
    );
  });

  it("keeps the hidden state out of the consumer's reach", () => {
    // Visibility is toggled at runtime, so it must survive consumer CSS.
    const style = styleBlock();
    expect(style.indexOf(".mnst-highlighter-hidden")).toBeGreaterThan(
      style.indexOf(".highlight-exit")
    );
    expect(style).toContain("animation: none !important");
  });
});

/** Pulls one function's source out of the script injected into the WebView. */
function injectedFunctionSource(name: string): string {
  const html = htmlContent({
    hl: [
      { name: "yh", options: { type: "background-color", color: "yellow" } },
    ],
    h: undefined,
    c: "<p>hi</p>",
    css: undefined,
    f: undefined,
    ho: undefined,
    p: "ios",
    o: { userScalable: true, initialScale: 1, maximumScale: 2.5 },
  });
  const blocks = html
    .split("<script>")
    .slice(1)
    .map((block) => block.slice(0, block.indexOf("</script>")));
  const script = blocks[blocks.length - 1];

  const start = script.indexOf("function " + name);
  if (start === -1) throw new Error(name + " not found");
  let depth = 0;
  for (let i = script.indexOf("{", start); i < script.length; i++) {
    if (script[i] === "{") depth++;
    else if (script[i] === "}") {
      depth--;
      if (depth === 0) return script.slice(start, i + 1);
    }
  }
  throw new Error(name + " is unbalanced");
}

describe("staged removal", () => {
  function fakeElement(classes: string[]) {
    const set = new Set(classes);
    return {
      set,
      classList: {
        add: (c: string) => set.add(c),
        remove: (c: string) => set.delete(c),
      },
    };
  }

  function loadStageRemoval(MNST: Record<string, unknown>) {
    const source = [
      injectedFunctionSource("endEntrance"),
      injectedFunctionSource("setExitClass"),
      injectedFunctionSource("stageRemoval"),
    ].join("\n");
    return new Function("__MNST__", `${source}; return stageRemoval;`)(
      MNST
    ) as (
      highlights: unknown[],
      options: Record<string, unknown> | undefined,
      remove: (className?: string) => void
    ) => void;
  }

  const highlightOf = (id: string, el: ReturnType<typeof fakeElement>) => ({
    id,
    getHighlightElements: () => [el],
  });

  it("removes straight away when no delay is given", () => {
    const stageRemoval = loadStageRemoval({ state: { pendingRemovals: {} } });
    const remove = jest.fn();
    stageRemoval([highlightOf("h1", fakeElement(["yh"]))], {}, remove);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("removes straight away when there is nothing to animate", () => {
    const stageRemoval = loadStageRemoval({ state: { pendingRemovals: {} } });
    const remove = jest.fn();
    // An empty selection still has to emit its change event.
    stageRemoval([], { className: "x", delay: 400 }, remove);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("marks every highlight of a batch, then removes them together", () => {
    jest.useFakeTimers();
    try {
      const pendingRemovals: Record<string, unknown> = {};
      const stageRemoval = loadStageRemoval({ state: { pendingRemovals } });
      const first = fakeElement(["yh"]);
      const second = fakeElement(["yh"]);
      const remove = jest.fn();

      stageRemoval(
        [highlightOf("h1", first), highlightOf("h2", second)],
        { className: "highlight-exit", delay: 400 },
        remove
      );

      expect([...first.set]).toContain("highlight-exit");
      expect([...second.set]).toContain("highlight-exit");
      expect(remove).not.toHaveBeenCalled();
      expect(Object.keys(pendingRemovals)).toEqual(["h1", "h2"]);

      jest.advanceTimersByTime(400);

      expect(remove).toHaveBeenCalledTimes(1);
      expect(Object.keys(pendingRemovals)).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("leaves a running exit animation alone instead of restarting it", () => {
    jest.useFakeTimers();
    try {
      const pendingRemovals: Record<string, unknown> = {};
      const stageRemoval = loadStageRemoval({ state: { pendingRemovals } });
      const el = fakeElement(["yh"]);
      const highlight = highlightOf("h1", el);
      const remove = jest.fn();

      const opts = { className: "highlight-exit", delay: 400 };
      stageRemoval([highlight], opts, remove);
      jest.advanceTimersByTime(200);
      stageRemoval([highlight], opts, remove);

      // The second call is a no-op, so the removal still lands on the original
      // schedule rather than being pushed out by another full delay.
      jest.advanceTimersByTime(200);
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("takes the exit class off before Rangy removes the highlight", () => {
    // Rangy only unwraps the span when its class list is exactly the highlighter
    // class. With the exit class still on, it keeps the element and strips only
    // its own class, stranding an animation's final state on the text forever.
    const el = fakeElement(["yh", "highlight-exit"]);
    const highlight = { getHighlightElements: () => [el] };

    let classesAtRemoval: string[] = [];
    const MNST = {
      state: { pendingRemovals: {} },
      highlighter: {
        removeHighlights: () => {
          classesAtRemoval = [...el.set];
        },
        serialize: () => "",
      },
    };

    const source = [
      injectedFunctionSource("setExitClass"),
      injectedFunctionSource("removeHighlightsNow"),
    ].join("\n");

    const removeHighlightsNow = new Function(
      "__MNST__",
      "clearHighlightFocusStyle",
      "clearIgnoredElementsBackgroundColors",
      "sendOnHighlightChange",
      "sendOnError",
      `${source}; return removeHighlightsNow;`
    )(
      MNST,
      () => {},
      () => {},
      () => {},
      () => {}
    ) as (
      highlights: unknown[],
      className?: string,
      code?: string,
      message?: string
    ) => void;

    removeHighlightsNow([highlight], "highlight-exit", "code", "message");

    expect(classesAtRemoval).toEqual(["yh"]);
  });
});

describe("highlight geometry", () => {
  type Box = { left: number; top: number; width: number; height: number };

  function loadMeasure(visualViewport?: Record<string, number>) {
    const source = [
      injectedFunctionSource("measureElements"),
      injectedFunctionSource("unionRect"),
    ].join("\n");
    const [measureElements, unionRect] = new Function(
      "window",
      `${source}; return [measureElements, unionRect];`
    )({ visualViewport }) as [
      (elements: unknown[]) => { x: number; y: number }[],
      (rects: unknown[]) => Record<string, number>,
    ];
    return { measureElements, unionRect };
  }

  const elementWith = (boxes: Box[]) => ({ getClientRects: () => boxes });

  it("reports one box per line rather than one per element", () => {
    const { measureElements } = loadMeasure();
    // A highlight wrapping across two lines: one element, two line boxes.
    const rects = measureElements([
      elementWith([
        { left: 10, top: 20, width: 100, height: 18 },
        { left: 0, top: 38, width: 60, height: 18 },
      ]),
    ]);
    expect(rects).toEqual([
      { x: 10, y: 20, width: 100, height: 18 },
      { x: 0, y: 38, width: 60, height: 18 },
    ]);
  });

  it("reports where the text is on screen when the page is zoomed", () => {
    const { measureElements } = loadMeasure({
      scale: 2,
      offsetLeft: 5,
      offsetTop: 10,
    });
    const rects = measureElements([
      elementWith([{ left: 15, top: 30, width: 50, height: 20 }]),
    ]);
    // Layout coordinates are relative to the layout viewport; the visual one is
    // offset and magnified, which is what the reader actually sees.
    expect(rects).toEqual([{ x: 20, y: 40, width: 100, height: 40 }]);
  });

  it("skips collapsed boxes that would drag the union towards the origin", () => {
    const { measureElements, unionRect } = loadMeasure();
    const rects = measureElements([
      elementWith([
        { left: 0, top: 0, width: 0, height: 0 },
        { left: 40, top: 50, width: 30, height: 10 },
      ]),
    ]);
    expect(rects).toHaveLength(1);
    expect(unionRect(rects)).toEqual({ x: 40, y: 50, width: 30, height: 10 });
  });

  it("wraps every line in a single box", () => {
    const { unionRect } = loadMeasure();
    expect(
      unionRect([
        { x: 10, y: 20, width: 100, height: 18 },
        { x: 0, y: 38, width: 60, height: 18 },
      ])
    ).toEqual({ x: 0, y: 20, width: 110, height: 36 });
  });

  it("reports an empty box when there is nothing to measure", () => {
    const { unionRect } = loadMeasure();
    // JSON has no Infinity: a seeded union would serialize to null over the bridge.
    expect(unionRect([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("selection pinning", () => {
  /**
   * highlightSelection is only reached through the bridge, so it is pulled out
   * of the injected script and run against a fake selection cache.
   */
  function loadHighlightSelection(version: number) {
    const source = injectedFunctionSource("highlightSelection");
    const sendOnError = jest.fn();
    const highlightSelection = new Function(
      "__MNST__",
      "sendOnError",
      "document",
      `${source}; return highlightSelection;`
    )(
      { selector: { cache: { version, range: null, text: "" } } },
      sendOnError,
      { getSelection: () => null }
    ) as (name: string, keep: boolean, expect?: number) => void;
    return { highlightSelection, sendOnError };
  }

  it("refuses a selection that moved while validation was running", () => {
    const { highlightSelection, sendOnError } = loadHighlightSelection(7);

    highlightSelection("yh", false, 4);

    expect(sendOnError).toHaveBeenCalledWith(
      "selection_changed",
      expect.any(String),
      expect.stringContaining("7")
    );
  });

  it("gets past the check when the selection is the validated one", () => {
    const { highlightSelection, sendOnError } = loadHighlightSelection(7);

    // Reaches the range check further down, which is a different complaint.
    highlightSelection("yh", false, 7);

    expect(sendOnError).not.toHaveBeenCalledWith(
      "selection_changed",
      expect.anything(),
      expect.anything()
    );
  });

  it("skips the check entirely for a direct call", () => {
    const { highlightSelection, sendOnError } = loadHighlightSelection(7);

    highlightSelection("yh", false, undefined);

    expect(sendOnError).not.toHaveBeenCalledWith(
      "selection_changed",
      expect.anything(),
      expect.anything()
    );
  });
});

describe("entrance animations", () => {
  function animated(iterationCount: number | "infinite"): Highlighter {
    return {
      name: "pop",
      options: {
        type: "background-color",
        color: "gold",
        animation: {
          name: "popIn",
          keyframesCss:
            "@keyframes popIn { from { opacity: 0 } to { opacity: 1 } }",
          duration: "300ms",
          timingFunction: "ease-out",
          iterationCount,
        },
      },
    };
  }

  it("moves a finite animation onto the entering state class", () => {
    const css = highlightersToCSS([animated(1)]);
    const classRule = css.slice(0, css.indexOf("}") + 1);
    expect(classRule).toContain("background-color: gold;");
    // Left on the highlighter class, re-applying it would replay the entrance.
    expect(classRule).not.toContain("animation:");
    expect(css).toContain(
      `.pop:where(.${ENTERING_CLASS}) {\n  animation: popIn 300ms ease-out 1;\n}`
    );
    expect(css).toContain("@keyframes popIn");
  });

  it("keeps an infinite animation on the highlighter class", () => {
    const css = highlightersToCSS([animated("infinite")]);
    expect(css).toContain("animation: popIn 300ms ease-out infinite;");
    expect(css).not.toContain(ENTERING_CLASS);
  });

  it("tells the runtime which highlighters and keyframes are entrances", () => {
    const html = htmlContent({
      hl: [animated(1)],
      h: undefined,
      c: "<p>hi</p>",
      css: undefined,
      f: undefined,
      ho: undefined,
      p: "ios",
      o: undefined,
    });
    expect(html).toContain('ENTRANCE_HIGHLIGHTERS = new Set(["pop"])');
    expect(html).toContain('ENTRANCE_ANIMATIONS = new Set(["popIn"])');
  });

  function fakeEl(classes: string[]) {
    const set = new Set(classes);
    return {
      set,
      classList: {
        add: (c: string) => set.add(c),
        remove: (c: string) => set.delete(c),
      },
    };
  }

  type Runtime = {
    markEntering: (highlights: unknown[]) => void;
    onEntranceSettled: (event: unknown) => void;
    setExitClass: (highlight: unknown, className: string, on: boolean) => void;
    applyFocusStyle: (elements: unknown[], className?: string) => void;
  };

  function loadRuntime(): Runtime {
    const source = [
      "endEntrance",
      "markEntering",
      "onEntranceSettled",
      "setExitClass",
      "applyFocusStyle",
    ]
      .map(injectedFunctionSource)
      .join("\n");
    return new Function(
      "ENTRANCE_HIGHLIGHTERS",
      "ENTRANCE_ANIMATIONS",
      "__MNST__",
      `${source}; return { markEntering, onEntranceSettled, setExitClass, applyFocusStyle };`
    )(new Set(["pop"]), new Set(["popIn"]), {
      state: { visible: true, focusedElements: [] },
    });
  }

  it("marks only highlights whose highlighter has an entrance", () => {
    const { markEntering } = loadRuntime();
    const withEntrance = fakeEl(["pop"]);
    const withoutEntrance = fakeEl(["yh"]);
    markEntering([
      {
        classApplier: { className: "pop" },
        getHighlightElements: () => [withEntrance],
      },
      {
        classApplier: { className: "yh" },
        getHighlightElements: () => [withoutEntrance],
      },
    ]);
    expect(withEntrance.set.has(ENTERING_CLASS)).toBe(true);
    // A class that never animates would never be cleaned up.
    expect(withoutEntrance.set.has(ENTERING_CLASS)).toBe(false);
  });

  it("drops the state class once the entrance ends or is cancelled", () => {
    const { onEntranceSettled } = loadRuntime();
    const el = fakeEl(["pop", ENTERING_CLASS]);
    onEntranceSettled({ animationName: "popIn", target: el });
    expect(el.set.has(ENTERING_CLASS)).toBe(false);
  });

  it("ignores a different animation settling on the same element", () => {
    const { onEntranceSettled } = loadRuntime();
    const el = fakeEl(["pop", ENTERING_CLASS]);
    onEntranceSettled({ animationName: "focusPulse", target: el });
    expect(el.set.has(ENTERING_CLASS)).toBe(true);
  });

  it("ends the entrance when a highlight is focused", () => {
    const { applyFocusStyle } = loadRuntime();
    const el = fakeEl(["pop", ENTERING_CLASS]);
    applyFocusStyle([el], "focus");
    expect(el.set.has(ENTERING_CLASS)).toBe(false);
    expect(el.set.has("focus")).toBe(true);
  });

  it("ends the entrance when a highlight starts exiting", () => {
    const { setExitClass } = loadRuntime();
    const el = fakeEl(["pop", ENTERING_CLASS]);
    setExitClass({ getHighlightElements: () => [el] }, "exit", true);
    expect(el.set.has(ENTERING_CLASS)).toBe(false);
    expect(el.set.has("exit")).toBe(true);
  });
});
