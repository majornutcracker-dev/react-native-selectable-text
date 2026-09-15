import * as React from "react";
import { render, act } from "@testing-library/react-native";

import SelectableTextView from "../SelectableTextView";
import { BridgingNames } from "../types";
import type { SelectableTextViewRef } from "../types";
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

describe("highlights state prop", () => {
  it("does not re-post the initial value, which the HTML already carries", () => {
    renderComponent({ highlights: "serialized" });
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("posts an empty string so the prop can be cleared", () => {
    const ref = React.createRef<SelectableTextViewRef>();
    const view = render(
      <SelectableTextView ref={ref} content="<p>hi</p>" highlights="abc" />
    );
    fireLoadEnd();
    mockPostMessage.mockClear();

    view.rerender(
      <SelectableTextView ref={ref} content="<p>hi</p>" highlights="" />
    );

    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.updateHighlights,
      value: "",
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

describe("highlights prop echo suppression", () => {
  function renderRerenderable(props: Partial<SelectableTextViewProps> = {}) {
    const view = render(<SelectableTextView content="<p>hi</p>" {...props} />);
    fireLoadEnd();
    return (next: Partial<SelectableTextViewProps>) =>
      view.rerender(
        <SelectableTextView content="<p>hi</p>" {...props} {...next} />
      );
  }

  const updateCalls = () =>
    mockPostMessage.mock.calls
      .map((call) => JSON.parse(call[0]))
      .filter(
        (message) => message.type === BridgingNames.functions.updateHighlights
      );

  it("ignores a value the view itself just reported", async () => {
    const rerender = renderRerenderable({ highlights: "A" });
    await fireMessage(BridgingNames.events.onHighlightsChange, {
      highlights: "B",
      items: [],
    });
    mockPostMessage.mockClear();

    // What a controlled consumer does: store the emitted payload, pass it back.
    rerender({ highlights: "B" });

    expect(updateCalls()).toHaveLength(0);
  });

  it("still restores a payload the view did not emit", async () => {
    const rerender = renderRerenderable({ highlights: "A" });
    await fireMessage(BridgingNames.events.onHighlightsChange, {
      highlights: "B",
      items: [],
    });
    mockPostMessage.mockClear();

    rerender({ highlights: "C" });

    expect(updateCalls()).toEqual([
      { type: BridgingNames.functions.updateHighlights, value: "C" },
    ]);
  });

  it("still clears when reset to an empty string", async () => {
    const rerender = renderRerenderable({ highlights: "A" });
    await fireMessage(BridgingNames.events.onHighlightsChange, {
      highlights: "B",
      items: [],
    });
    mockPostMessage.mockClear();

    rerender({ highlights: "" });

    expect(updateCalls()).toEqual([
      { type: BridgingNames.functions.updateHighlights, value: "" },
    ]);
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
