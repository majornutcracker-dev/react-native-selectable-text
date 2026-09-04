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
  it("routes onHighlightsChange", async () => {
    const cb = jest.fn();
    renderComponent({ onHighlightsChange: cb });
    await fireMessage(BridgingNames.events.onHighlightsChange, "serialized");
    expect(cb).toHaveBeenCalledWith("serialized");
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

    expect(onHighlightPressed).toHaveBeenCalledWith(payload);
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.focusHighlight,
      value: { id: "h1", className: "focus-cls", scroll: false },
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
      value: "yh",
    });
  });

  it("focusHighlight forwards id + className (and no scroll flag)", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.focusHighlight("h1", "cls"));
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.focusHighlight,
      value: { id: "h1", className: "cls" },
    });
  });

  it("unhighlightById", () => {
    const ref = renderComponent();
    mockPostMessage.mockClear();
    act(() => ref.current!.unhighlightById("h9"));
    expect(lastPosted()).toEqual({
      type: BridgingNames.functions.unhighlightById,
      value: "h9",
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
      value: "yellow-highlighter",
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
