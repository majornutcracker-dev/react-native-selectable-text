import * as React from "react";
import { render, act } from "@testing-library/react-native";

import SelectableTextView from "../SelectableTextView";
import { BridgingNames } from "../types";
import type { HistoryState, SelectableTextViewRef } from "../types";
import type { SelectableTextViewProps } from "../SelectableTextView";

// Mock react-native-webview: expose the last props (so we can invoke onMessage)
// and a postMessage spy (so we can assert what the component sends to the WebView).
const mockPostMessage = jest.fn();
const mockWebview: { props: Record<string, any> } = { props: {} };

jest.mock("react-native-webview", () => {
  const RN = require("react-native");
  const ReactLib = require("react");
  return {
    __esModule: true,
    WebView: ReactLib.forwardRef((props: any, ref: any) => {
      mockWebview.props = props;
      ReactLib.useImperativeHandle(ref, () => ({
        postMessage: mockPostMessage,
      }));
      return ReactLib.createElement(RN.View, null);
    }),
  };
});

function renderComponent(props: Partial<SelectableTextViewProps> = {}) {
  const ref = React.createRef<SelectableTextViewRef>();
  render(<SelectableTextView ref={ref} content="<p>hi</p>" {...props} />);
  // The component queues messages until the WebView document is ready. A real
  // WebView always fires this, so tests start from a loaded view unless they
  // are specifically exercising the queue.
  fireLoadEnd();
  return ref;
}

function fireLoadEnd() {
  act(() => {
    mockWebview.props.onLoadEnd?.({ nativeEvent: {} });
  });
}

async function fireMessage(type: string, value: unknown) {
  await act(async () => {
    await mockWebview.props.onMessage({
      nativeEvent: { data: JSON.stringify({ type, value }) },
    });
  });
}

function lastPosted() {
  const calls = mockPostMessage.mock.calls;
  return JSON.parse(calls[calls.length - 1][0]);
}

beforeEach(() => {
  mockPostMessage.mockClear();
});

describe("incoming events", () => {
  it("routes onHighlightsChange with the resolved items", async () => {
    const cb = jest.fn();
    const items = [{ id: "h1", name: "yh", text: "hello" }];
    renderComponent({ onHighlightsChange: cb });
    await fireMessage(BridgingNames.events.onHighlightsChange, {
      highlights: "serialized",
      items,
    });
    expect(cb).toHaveBeenCalledWith("serialized", items);
  });

  it("falls back to an empty item list", async () => {
    const cb = jest.fn();
    renderComponent({ onHighlightsChange: cb });
    await fireMessage(BridgingNames.events.onHighlightsChange, {
      highlights: "serialized",
    });
    expect(cb).toHaveBeenCalledWith("serialized", []);
  });

  it("routes onTextSelectionChange", async () => {
    const cb = jest.fn();
    renderComponent({ onTextSelectionChange: cb });
    await fireMessage(BridgingNames.events.onTextSelectionChange, "selected");
    expect(cb).toHaveBeenCalledWith("selected");
  });

  it("routes onError", async () => {
    const cb = jest.fn();
    renderComponent({ onError: cb });
    const err = { code: "unknown", message: "boom" };
    await fireMessage(BridgingNames.events.onError, err);
    expect(cb).toHaveBeenCalledWith(err);
  });

  it("routes onHighlightsVisibilityStateChange", async () => {
    const cb = jest.fn();
    renderComponent({ onHighlightsVisibilityStateChange: cb });
    await fireMessage(
      BridgingNames.events.onHighlightsVisibilityStateChange,
      false
    );
    expect(cb).toHaveBeenCalledWith(false);
  });

  it("forwards the consumer's webViewProps.onMessage", async () => {
    const onMessage = jest.fn();
    renderComponent({ webViewProps: { onMessage } });
    await fireMessage(BridgingNames.events.onTextSelectionChange, "x");
    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});

describe("onHighlightPressed", () => {
  it("focuses in place (scroll:false) when a className is returned", async () => {
    const onHighlightPressed = jest.fn(() => "focus-cls");
    renderComponent({ onHighlightPressed });
    mockPostMessage.mockClear();

    const payload = { id: "h1", name: "yh", text: "hi" };
    await fireMessage(BridgingNames.events.onHighlightPressed, payload);

    // A payload with no geometry still reaches the callback with a usable shape.
    expect(onHighlightPressed).toHaveBeenCalledWith({
      ...payload,
      rect: { x: 0, y: 0, width: 0, height: 0 },
      rects: [],
    });
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.focusHighlight,
      value: { id: "h1", className: "focus-cls", options: { scroll: false } },
    });
  });

  it("hands the callback where the highlight is on screen", async () => {
    const onHighlightPressed = jest.fn();
    renderComponent({ onHighlightPressed });

    const rects = [
      { x: 10, y: 20, width: 100, height: 18 },
      { x: 0, y: 38, width: 60, height: 18 },
    ];
    await fireMessage(BridgingNames.events.onHighlightPressed, {
      id: "h1",
      name: "yh",
      text: "hi",
      rect: { x: 0, y: 20, width: 110, height: 36 },
      rects,
    });

    expect(onHighlightPressed).toHaveBeenCalledWith({
      id: "h1",
      name: "yh",
      text: "hi",
      rect: { x: 0, y: 20, width: 110, height: 36 },
      rects,
    });
  });

  it("does not post when the callback returns nothing", async () => {
    const onHighlightPressed = jest.fn(() => undefined);
    renderComponent({ onHighlightPressed });
    mockPostMessage.mockClear();

    await fireMessage(BridgingNames.events.onHighlightPressed, {
      id: "h1",
      name: "yh",
      text: "hi",
    });

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("awaits an async className", async () => {
    const onHighlightPressed = jest.fn(async () => "async-cls");
    renderComponent({ onHighlightPressed });
    mockPostMessage.mockClear();

    await fireMessage(BridgingNames.events.onHighlightPressed, {
      id: "h2",
      name: "yh",
      text: "hi",
    });

    expect(lastPosted().value).toMatchObject({
      id: "h2",
      className: "async-cls",
    });
  });
});

describe("ref methods post the right messages", () => {
  it("highlightSelection", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.highlightSelection("yh"));
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.highlightSelection,
      value: { name: "yh", keepSelection: false },
    });
  });

  it("focusHighlight forwards id + className (and no options)", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.focusHighlight("h1", "cls"));
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.focusHighlight,
      value: { id: "h1", className: "cls", options: undefined },
    });
  });

  it("focusHighlight forwards scroll options", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() =>
      ref.current!.focusHighlight("h1", "cls", {
        block: "start",
        behavior: "auto",
        offset: 80,
      })
    );
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.focusHighlight,
      value: {
        id: "h1",
        className: "cls",
        options: { block: "start", behavior: "auto", offset: 80 },
      },
    });
  });

  it("focusHighlight can opt out of scrolling", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.focusHighlight("h1", undefined, { scroll: false }));
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.focusHighlight,
      value: { id: "h1", className: undefined, options: { scroll: false } },
    });
  });

  it("unhighlightById", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.unhighlightById("h9"));
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.unhighlightById,
      value: { id: "h9", options: undefined },
    });
  });

  it("unhighlightSelection forwards the staged-removal options", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() =>
      ref.current!.unhighlightSelection({
        keepSelection: true,
        className: "highlight-exit",
        delay: 400,
      })
    );
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.unhighlightSelection,
      value: {
        keepSelection: true,
        options: { className: "highlight-exit", delay: 400 },
      },
    });
  });

  it("unhighlightById forwards the staged-removal options", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() =>
      ref.current!.unhighlightById("h9", {
        className: "highlight-exit",
        delay: 1000,
      })
    );
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.unhighlightById,
      value: {
        id: "h9",
        options: { className: "highlight-exit", delay: 1000 },
      },
    });
  });
});

describe("promise round-trips", () => {
  // getSelectedText arms a 2s timeout; fake timers keep it from leaking past the test.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("resolves getSelectedText with the matching promiseId", async () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();

    let pending!: Promise<string>;
    act(() => {
      pending = ref.current!.getSelectedText();
    });
    const posted = lastPosted();
    expect(posted.type).toBe(BridgingNames.promises.getSelectedText);

    await fireMessage(BridgingNames.promises.getSelectedText, {
      success: true,
      promiseId: posted.value,
      text: "hello",
    });

    await expect(pending).resolves.toBe("hello");
  });

  it("rejects getSelectedText on a failure message", async () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();

    let pending!: Promise<string>;
    act(() => {
      pending = ref.current!.getSelectedText();
    });
    const posted = lastPosted();

    const assertion = expect(pending).rejects.toThrow("boom");
    await fireMessage(BridgingNames.promises.getSelectedText, {
      success: false,
      promiseId: posted.value,
      error: "boom",
    });
    await assertion;
  });
});

describe("WebView readiness", () => {
  it("queues messages posted before load and flushes them once loaded", () => {
    const ref = React.createRef<SelectableTextViewRef>();
    render(<SelectableTextView ref={ref} content="<p>hi</p>" />);

    act(() => {
      ref.current!.highlightSelection("yellow-highlighter");
    });
    // Posting now would be dropped by the WebView, so nothing is sent yet.
    expect(mockPostMessage).not.toHaveBeenCalled();

    fireLoadEnd();

    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.highlightSelection,
      value: { name: "yellow-highlighter", keepSelection: false },
    });
  });

  it("flushes the queue in order", () => {
    const ref = React.createRef<SelectableTextViewRef>();
    render(<SelectableTextView ref={ref} content="<p>hi</p>" />);

    act(() => {
      ref.current!.unhighlightSelection();
      ref.current!.clearHighlights();
    });
    fireLoadEnd();

    const types = mockPostMessage.mock.calls.map(
      (call) => JSON.parse(call[0]).type
    );
    expect(types).toEqual([
      BridgingNames.functions.unhighlightSelection,
      BridgingNames.functions.clearHighlights,
    ]);
  });

  it("forwards the consumer's webViewProps.onLoadEnd", () => {
    const onLoadEnd = jest.fn();
    renderComponent({ webViewProps: { onLoadEnd } });
    expect(onLoadEnd).toHaveBeenCalledTimes(1);
  });
});

describe("initialHighlights", () => {
  it("does not post the initial value, which the HTML already carries", () => {
    renderComponent({ initialHighlights: "serialized" });
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("is read once: a later change is not posted", () => {
    const view = render(
      <SelectableTextView content="<p>hi</p>" initialHighlights="A" />
    );
    fireLoadEnd();
    mockPostMessage.mockClear();

    view.rerender(
      <SelectableTextView content="<p>hi</p>" initialHighlights="B" />
    );

    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});

describe("the highlights history", () => {
  it("posts a replacement through setHighlights", () => {
    const ref = renderComponent();

    act(() => ref.current?.setHighlights("payload"));

    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.updateHighlights,
      value: "payload",
    });
  });

  it("clears with an empty string", () => {
    const ref = renderComponent();

    act(() => ref.current?.setHighlights(""));

    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.updateHighlights,
      value: "",
    });
  });

  it.each([
    ["undo", BridgingNames.functions.undo],
    ["redo", BridgingNames.functions.redo],
    ["clearHistory", BridgingNames.functions.clearHistory],
  ])("asks the page to %s", (method, type) => {
    const ref = renderComponent();

    act(() => (ref.current as any)[method]());

    expect(lastPosted()).toEqual({ type, value: null });
  });

  it("hands the reported history state to onHistoryChange", async () => {
    const onHistoryChange = jest.fn();
    renderComponent({ onHistoryChange });

    await fireMessage(BridgingNames.events.onHistoryChange, {
      change: "HISTORY",
      history: ["type:textContent", "type:textContent|1$2$1$yellow$"],
      historyIndex: 1,
      length: 2,
      canUndo: true,
      canRedo: false,
    });

    expect(onHistoryChange).toHaveBeenCalledWith({
      change: "HISTORY",
      history: ["type:textContent", "type:textContent|1$2$1$yellow$"],
      historyIndex: 1,
      length: 2,
      canUndo: true,
      canRedo: false,
    });
  });

  it("fills in what a malformed history message leaves out", async () => {
    const onHistoryChange = jest.fn();
    renderComponent({ onHistoryChange });

    await fireMessage(BridgingNames.events.onHistoryChange, {
      change: "HISTORY_INDEX",
    });

    expect(onHistoryChange).toHaveBeenCalledWith({
      change: "HISTORY_INDEX",
      history: [],
      historyIndex: 0,
      length: 0,
      canUndo: false,
      canRedo: false,
    });
  });

  it("resolves getHistory with the entries the page reports", async () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();

    let pending!: Promise<HistoryState>;
    act(() => {
      pending = ref.current!.getHistory();
    });
    const posted = lastPosted();
    expect(posted.type).toBe(BridgingNames.promises.getHistory);

    await fireMessage(BridgingNames.promises.getHistory, {
      // The page answers with the id it was given.
      promiseId: posted.value,
      history: ["type:textContent"],
      historyIndex: 0,
      length: 1,
      canUndo: false,
      canRedo: true,
    });

    await expect(pending).resolves.toEqual({
      history: ["type:textContent"],
      historyIndex: 0,
      length: 1,
      canUndo: false,
      canRedo: true,
    });
  });
});

describe("malformed bridge messages", () => {
  it("ignores a non-JSON postMessage from page content", async () => {
    const cb = jest.fn();
    renderComponent({ onTextSelectionChange: cb });

    await act(async () => {
      await mockWebview.props.onMessage({
        nativeEvent: { data: "not json at all" },
      });
    });

    expect(cb).not.toHaveBeenCalled();
  });

  it("ignores a JSON payload that is not one of ours", async () => {
    const cb = jest.fn();
    renderComponent({ onTextSelectionChange: cb });

    await act(async () => {
      await mockWebview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ hello: "world" }) },
      });
    });

    expect(cb).not.toHaveBeenCalled();
  });

  it("does not let a throwing consumer callback escape the async handler", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    renderComponent({
      onTextSelectionChange: () => {
        throw new Error("consumer blew up");
      },
    });

    await expect(
      fireMessage(BridgingNames.events.onTextSelectionChange, "x")
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("selection handling", () => {
  it("clears the selection by default when highlighting", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.highlightSelection("yh"));
    // keepSelection:false is what dismisses the iOS callout that would
    // otherwise sit on top of the new highlight.
    expect(lastPosted().value.keepSelection).toBe(false);
  });

  it("honours keepSelection on highlightSelection", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.highlightSelection("yh", { keepSelection: true }));
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.highlightSelection,
      value: { name: "yh", keepSelection: true },
    });
  });

  it("honours keepSelection on unhighlightSelection", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.unhighlightSelection({ keepSelection: true }));
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.unhighlightSelection,
      value: { keepSelection: true, options: {} },
    });
  });

  it("forwards options through highlightSelectionWithValidation", async () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    await act(async () => {
      const pending = ref.current!.highlightSelectionWithValidation(
        () => true,
        "yh",
        { keepSelection: true }
      );
      const posted = lastPosted();
      await fireMessage(BridgingNames.promises.getSelectedText, {
        success: true,
        promiseId: posted.value,
        text: "hello",
      });
      await pending;
    });
    expect(lastPosted().value).toEqual({
      name: "yh",
      keepSelection: true,
      expectSelectionVersion: undefined,
    });
  });

  it("pins the selection it validated, not the one selected by then", async () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    await act(async () => {
      const pending = ref.current!.highlightSelectionWithValidation(
        () => true,
        "yh"
      );
      const posted = lastPosted();
      await fireMessage(BridgingNames.promises.getSelectedText, {
        success: true,
        promiseId: posted.value,
        text: "hello",
        selectionVersion: 7,
      });
      await pending;
    });
    // The WebView refuses the highlight if the selection moved on since.
    expect(lastPosted().value).toMatchObject({ expectSelectionVersion: 7 });
  });

  it("reports a failed validation round-trip instead of rejecting", async () => {
    const onError = jest.fn();
    const ref = renderComponent({ onError });
    mockPostMessage.mockClear();

    // No call site catches this; an unhandled rejection would surface as a
    // red box rather than something the app can show.
    await act(async () => {
      const pending = ref.current!.highlightSelectionWithValidation(
        () => true,
        "yh"
      );
      const posted = lastPosted();
      await fireMessage(BridgingNames.promises.getSelectedText, {
        success: false,
        promiseId: posted.value,
        error: "boom",
      });
      await expect(pending).resolves.toBeUndefined();
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "failed_to_highlight_selection",
        details: "boom",
      })
    );
  });

  it("reports a throwing validation instead of rejecting", async () => {
    const onError = jest.fn();
    const ref = renderComponent({ onError });
    mockPostMessage.mockClear();

    await act(async () => {
      const pending = ref.current!.highlightSelectionWithValidation(() => {
        throw new Error("validation exploded");
      }, "yh");
      const posted = lastPosted();
      await fireMessage(BridgingNames.promises.getSelectedText, {
        success: true,
        promiseId: posted.value,
        text: "hello",
      });
      await expect(pending).resolves.toBeUndefined();
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ details: "validation exploded" })
    );
  });
});

describe("bridging custom actions", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("posts the script and resolves with its result", async () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();

    let pending!: Promise<unknown>;
    act(() => {
      pending = ref.current!.evaluateJavaScript("return 1 + 1;");
    });
    const posted = lastPosted();
    expect(posted.type).toBe(BridgingNames.promises.evaluateJavaScript);
    expect(posted.value.script).toBe("return 1 + 1;");

    await fireMessage(BridgingNames.promises.evaluateJavaScript, {
      success: true,
      promiseId: posted.value.promiseId,
      result: 2,
    });
    await expect(pending).resolves.toBe(2);
  });

  it("rejects with the error the page reported", async () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();

    let pending!: Promise<unknown>;
    act(() => {
      pending = ref.current!.evaluateJavaScript("throw new Error('boom');");
    });
    const assertion = expect(pending).rejects.toThrow("boom");
    await fireMessage(BridgingNames.promises.evaluateJavaScript, {
      success: false,
      promiseId: lastPosted().value.promiseId,
      error: "boom",
    });
    await assertion;
  });

  it("waits for as long as the timeout it was given", async () => {
    const ref = renderComponent();
    let pending!: Promise<unknown>;
    act(() => {
      pending = ref.current!.evaluateJavaScript("return 1;", { timeout: 5000 });
    });
    const settled = jest.fn();
    pending.then(settled, settled);

    // Past the 2s default, still waiting.
    act(() => {
      jest.advanceTimersByTime(4999);
    });
    await act(async () => {});
    expect(settled).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await expect(pending).rejects.toThrow("Timeout");
  });

  it("falls back to the default timeout for a nonsensical one", async () => {
    const ref = renderComponent();
    let pending!: Promise<unknown>;
    act(() => {
      pending = ref.current!.evaluateJavaScript("return 1;", { timeout: -1 });
    });
    const assertion = expect(pending).rejects.toThrow("Timeout");
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await assertion;
  });

  it("passes a page's custom message on to onCustomMessage", async () => {
    const onCustomMessage = jest.fn();
    renderComponent({ onCustomMessage });
    await fireMessage(BridgingNames.events.onCustomMessage, {
      type: "ping",
      data: { n: 1 },
    });
    expect(onCustomMessage).toHaveBeenCalledWith({
      type: "ping",
      data: { n: 1 },
    });
  });

  it("drops a custom message that has no type", async () => {
    const onCustomMessage = jest.fn();
    renderComponent({ onCustomMessage });
    await fireMessage(BridgingNames.events.onCustomMessage, { data: 1 });
    expect(onCustomMessage).not.toHaveBeenCalled();
  });

  it("never hands the module's own messages to onCustomMessage", async () => {
    const onCustomMessage = jest.fn();
    renderComponent({ onCustomMessage });
    await fireMessage(BridgingNames.events.onTextSelectionChange, "x");
    expect(onCustomMessage).not.toHaveBeenCalled();
  });
});
