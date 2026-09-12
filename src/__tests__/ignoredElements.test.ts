/**
 * @jest-environment jsdom
 */
import { htmlContent } from "../utils";
import {
  core,
  classApplier,
  highlighter as highlighterSrc,
  serializer,
  textRange,
} from "../rangy@1.3.2";

/**
 * These run the real Rangy against a real DOM, because the behaviour under test
 * only shows up once the highlighter's registry and the document disagree.
 */

function injectedFunctionSource(script: string, name: string): string {
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

function sdkScript() {
  const html = htmlContent({
    hl: [{ name: "yh", options: { type: "background-color", color: "red" } }],
    h: undefined,
    c: "<p>x</p>",
    css: undefined,
    ho: { ignoredElements: ["a"] },
    f: undefined,
    p: "ios",
    o: { userScalable: true, initialScale: 1, maximumScale: 2.5 },
  });
  const blocks = html
    .split("<script>")
    .slice(1)
    .map((block) => block.slice(0, block.indexOf("</script>")));
  return blocks[blocks.length - 1];
}

function setup() {
  const run = (src: string) => (0, eval)(src);
  run(core);
  run(classApplier);
  run(highlighterSrc);
  run(serializer);
  run(textRange);

  const rangy = (window as unknown as { rangy: any }).rangy;
  rangy.init();

  document.body.innerHTML =
    '<p id="p">Hello <a href="#">link text</a> world</p>';

  const highlighter = rangy.createHighlighter();
  highlighter.addClassApplier(rangy.createClassApplier("yh"));

  const script = sdkScript();
  const source = [
    injectedFunctionSource(script, "dropFullyIgnoredHighlights"),
    injectedFunctionSource(script, "reconcileIgnoredElements"),
  ].join("\n");

  const sendOnError = jest.fn();
  const reconcile = new Function(
    "__MNST__",
    "sendOnError",
    `${source}; return reconcileIgnoredElements;`
  )({ highlighter }, sendOnError) as () => unknown;

  const highlightContentsOf = (node: Node) => {
    const range = rangy.createRange();
    range.selectNodeContents(node);
    rangy.getSelection().setSingleRange(range);
    highlighter.highlightSelection("yh");
    reconcile();
  };

  return { highlighter, sendOnError, highlightContentsOf };
}

it("drops a highlight whose text is all inside an ignored element", () => {
  const { highlighter, sendOnError, highlightContentsOf } = setup();

  highlightContentsOf(document.querySelector("a")!);

  // Every span was unwrapped, so nothing is on screen: it must not be counted,
  // listed, or serialized into the payload that gets restored later.
  expect(document.querySelectorAll(".yh")).toHaveLength(0);
  expect(highlighter.highlights).toHaveLength(0);
  expect(highlighter.serialize()).not.toContain("yh");
  expect(sendOnError).toHaveBeenCalledWith(
    "highlight_fully_ignored",
    expect.any(String),
    expect.any(String)
  );
});

it("keeps a highlight that merely crosses an ignored element", () => {
  const { highlighter, sendOnError, highlightContentsOf } = setup();

  highlightContentsOf(document.getElementById("p")!);

  // The link loses its visible highlight, the text around it keeps one.
  expect(document.querySelectorAll(".yh")).toHaveLength(2);
  expect(document.querySelector("a .yh")).toBeNull();
  expect(highlighter.highlights).toHaveLength(1);
  expect(sendOnError).not.toHaveBeenCalled();
});
