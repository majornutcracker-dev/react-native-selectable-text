import * as React from "react";
import { WebView, type WebViewProps } from "react-native-webview";
import {
  BridgingNames,
  type Message,
  type SelectableTextViewPropsBase,
  type SelectableTextViewRef,
  type Highlights,
  type SelectableTextViewError,
  type HighlightData,
  type PressedHighlightData,
  type HighlighterName,
  type SelectionActionOptions,
  type FocusHighlightOptions,
  type UnhighlightOptions,
} from "./types";
import { generatePromiseId, htmlContent } from "./utils";
import { Linking, Platform } from "react-native";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

/** How long a request to the WebView may go unanswered before it rejects. */
const PROMISE_TIMEOUT_MS = 2000;

export type SelectableTextViewProps = SelectableTextViewPropsBase & {
  webViewProps?: Omit<
    WebViewProps,
    "javaScriptEnabled" | "source" | "onShouldStartLoadWithRequest"
  >;
};

const SelectableTextView = React.forwardRef<
  SelectableTextViewRef,
  SelectableTextViewProps
>((props, ref) => {
  const {
    highlighters,
    highlights,
    content,
    css,
    fonts,
    highlighterOptions,
    options,
    onLink,
    onTextSelectionChange,
    onHighlightsChange,
    onError,
    onHighlightPressed,
    onHighlightsVisibilityStateChange,
    webViewProps,
  } = props;
  const promises = React.useRef<{
    [key: string]: {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timer?: ReturnType<typeof setTimeout>;
    };
  }>({});

  /**
   * Forgets a pending request and cancels its timeout.
   *
   * The timer used to outlive the answer: harmless, since it checked the entry
   * before firing, but it kept the closure alive for two seconds past every
   * call and past unmount.
   */
  const settlePromise = (id: string) => {
    const pending = promises.current[id];
    if (pending?.timer) {
      clearTimeout(pending.timer);
    }
    delete promises.current[id];
  };

  const webviewRef = React.useRef<WebView>(null);

  // The last payload this view reported through onHighlightsChange, seeded with
  // the value baked into the HTML so the very first echo is recognised too.
  const lastEmittedHighlights = React.useRef<Highlights | undefined>(
    highlights
  );

  // Which selection the last getSelectedText() read, so an action decided on
  // that text can refuse to land on a different one.
  const lastSelectionVersion = React.useRef<number | undefined>(undefined);

  // Anything posted before the WebView document is ready is dropped on the
  // floor. Queue instead: a `highlights` change during the initial load would
  // otherwise be lost for good, and early imperative calls would reject with a
  // misleading "Timeout".
  const isWebViewReady = React.useRef(false);
  const pendingMessages = React.useRef<Message[]>([]);

  const finalSource = React.useRef({
    html: htmlContent({
      hl: highlighters,
      h: highlights,
      c: content,
      css: css,
      f: fonts,
      ho: highlighterOptions,
      p: Platform.OS,
      o: options,
    }),
  });

  const handleMessage = React.useCallback(
    async (event: any) => {
      webViewProps?.onMessage?.(event);

      // Any script in the rendered content can call postMessage, so the payload
      // is not guaranteed to be ours or to be JSON. Without this guard the throw
      // escapes an async handler as an unhandled promise rejection.
      let data: Message;
      try {
        data = JSON.parse(event.nativeEvent.data) as Message;
      } catch {
        return;
      }
      if (data?.type == null) {
        return;
      }

      try {
        if (data.type === BridgingNames.events.onHighlightsChange) {
          const serialized = (data.value?.highlights ?? "") as Highlights;
          // Remembered so the effect below can tell a genuine restore request
          // from the consumer echoing back what this view just reported.
          lastEmittedHighlights.current = serialized;
          onHighlightsChange?.(
            serialized,
            (data.value?.items ?? []) as HighlightData[]
          );
        } else if (data.type === BridgingNames.events.onTextSelectionChange) {
          onTextSelectionChange?.(data.value as string);
        } else if (data.type === BridgingNames.promises.getSelectedText) {
          const success = data.value.success;
          const id = data.value.promiseId;
          const text = data.value.text;
          const error = data.value.error;
          if (success) {
            // Kept aside rather than resolved with the text: getSelectedText is
            // public and resolves to a plain string.
            lastSelectionVersion.current = data.value.selectionVersion;
            promises.current[id]?.resolve(text ?? "");
          } else {
            promises.current[id]?.reject(
              new Error(error ?? "Unknown error while getting selected text")
            );
          }
          settlePromise(id);
        } else if (data.type === BridgingNames.promises.getHighlights) {
          const success = data.value.success;
          const id = data.value.promiseId;
          const highlights = data.value.highlights;
          const error = data.value.error;
          if (success) {
            promises.current[id]?.resolve(highlights ?? "");
          } else {
            promises.current[id]?.reject(
              new Error(error ?? "Unknown error while getting highlights")
            );
          }
          settlePromise(id);
        } else if (data.type === BridgingNames.promises.getAllHighlightsData) {
          const success = data.value.success;
          const id = data.value.promiseId;
          const highlightsData = data.value.highlightsData;
          const error = data.value.error;
          if (success) {
            promises.current[id]?.resolve(highlightsData ?? []);
          } else {
            promises.current[id]?.reject(
              new Error(
                error ?? "Unknown error while getting all highlights data"
              )
            );
          }
          settlePromise(id);
        } else if (data.type === BridgingNames.events.log) {
          console.log("Log: ", data.value);
        } else if (data.type === BridgingNames.events.onError) {
          onError?.(data.value as SelectableTextViewError);
        } else if (data.type === BridgingNames.events.onHighlightPressed) {
          const pressed = data.value as PressedHighlightData;
          const className = await onHighlightPressed?.({
            ...pressed,
            // A highlighter whose spans were all unwrapped reports no boxes;
            // hand the callback a usable shape rather than undefined.
            rect: pressed.rect ?? { x: 0, y: 0, width: 0, height: 0 },
            rects: pressed.rects ?? [],
          });
          if (className) {
            _postMessage({
              type: BridgingNames.functions.focusHighlight,
              value: {
                id: data.value.id,
                className,
                options: { scroll: false },
              },
            });
          }
        } else if (
          data.type === BridgingNames.promises.getHighlightsVisibilityState
        ) {
          const success = data.value.success;
          const id = data.value.promiseId;
          const visible = data.value.visible;
          const error = data.value.error;
          if (success) {
            promises.current[id]?.resolve(visible ?? false);
          } else {
            promises.current[id]?.reject(
              new Error(
                error ??
                  "Unknown error while getting highlights visibility state"
              )
            );
          }
          settlePromise(id);
        } else if (
          data.type === BridgingNames.promises.toggleHighlightsVisibility
        ) {
          const success = data.value.success;
          const id = data.value.promiseId;
          const visible = data.value.visible;
          const error = data.value.error;
          if (success) {
            promises.current[id]?.resolve(visible ?? false);
          } else {
            promises.current[id]?.reject(
              new Error(
                error ?? "Unknown error while toggling highlights visibility"
              )
            );
          }
          settlePromise(id);
        } else if (
          data.type === BridgingNames.events.onHighlightsVisibilityStateChange
        ) {
          onHighlightsVisibilityStateChange?.(data.value as boolean);
        }
      } catch (error) {
        // A consumer callback threw or rejected. This handler is async, so
        // letting it escape would surface as an unhandled promise rejection
        // detached from the callback that actually caused it.
        console.error(
          "[@majornutcracker/react-native-selectable-text] Error handling bridge message:",
          error
        );
      }
    },
    [
      onTextSelectionChange,
      onHighlightsChange,
      onError,
      onHighlightsVisibilityStateChange,
      onHighlightPressed,
      webViewProps?.onMessage,
    ]
  );

  const handleShouldStartLoadWithRequest = React.useCallback(
    (request: ShouldStartLoadRequest) => {
      if (request.url === "about:blank") return true;

      if (onLink) {
        onLink?.(request.url);
      } else {
        if (
          request.url.startsWith("https://") ||
          request.url.startsWith("http://")
        ) {
          Linking.openURL(request.url);
          return false;
        }
      }
      return false;
    },
    [onLink]
  );

  const isFirstHighlightsEffect = React.useRef(true);
  React.useEffect(() => {
    // The initial value is already baked into the generated HTML; re-posting it
    // would replay the highlights and emit a redundant change event.
    if (isFirstHighlightsEffect.current) {
      isFirstHighlightsEffect.current = false;
      return;
    }
    // Echo of this view's own last change event: restoring it would wipe and
    // re-deserialize the highlights the content already has, dropping the focus
    // style and looping back through onHighlightsChange.
    if (highlights === lastEmittedHighlights.current) {
      return;
    }
    _postMessage({
      type: BridgingNames.functions.updateHighlights,
      value: highlights,
    });
  }, [highlights]);

  React.useEffect(() => {
    return () => {
      for (const key in promises.current) {
        promises.current[key]?.reject(new Error("Component unmounted"));
        settlePromise(key);
      }
    };
  }, []);

  const highlightSelection = (
    highlighterName?: HighlighterName,
    options?: SelectionActionOptions,
    expectSelectionVersion?: number
  ) => {
    _postMessage({
      type: BridgingNames.functions.highlightSelection,
      value: {
        name: highlighterName,
        keepSelection: options?.keepSelection === true,
        expectSelectionVersion,
      },
    });
  };

  const highlightSelectionWithValidation = async (
    validation: (text: string) => boolean | Promise<boolean>,
    highlighterName?: HighlighterName,
    options?: SelectionActionOptions
  ) => {
    try {
      const text = await getSelectedText();
      // Pinned before awaiting: validation may be slow, and the reader can keep
      // selecting while it runs. The WebView refuses a stale one.
      const selectionVersion = lastSelectionVersion.current;
      const result = await validation(text);
      if (result) {
        highlightSelection(highlighterName, options, selectionVersion);
      }
    } catch (error) {
      // This is a fire-and-forget action, and every call site would otherwise
      // need its own catch to keep a timeout, an unmount, or a throwing
      // validation from surfacing as an unhandled rejection.
      onError?.({
        name: "SelectableTextViewError",
        code: "failed_to_highlight_selection",
        message: "Failed to highlight the selection",
        details: error instanceof Error ? error.message : String(error),
      } as SelectableTextViewError);
    }
  };

  const unhighlightSelection = (
    options?: SelectionActionOptions & UnhighlightOptions
  ) => {
    _postMessage({
      type: BridgingNames.functions.unhighlightSelection,
      value: {
        keepSelection: options?.keepSelection === true,
        options: { className: options?.className, delay: options?.delay },
      },
    });
  };

  const clearHighlights = () => {
    _postMessage({
      type: BridgingNames.functions.clearHighlights,
      value: undefined,
    });
  };

  const focusHighlight = (
    id: string,
    className?: string,
    options?: FocusHighlightOptions
  ) => {
    _postMessage({
      type: BridgingNames.functions.focusHighlight,
      value: {
        id,
        className,
        options,
      },
    });
  };

  const unfocusHighlight = () => {
    _postMessage({
      type: BridgingNames.functions.unfocusHighlight,
      value: undefined,
    });
  };

  const unhighlightById = (id: string, options?: UnhighlightOptions) => {
    _postMessage({
      type: BridgingNames.functions.unhighlightById,
      value: { id, options },
    });
  };

  const getSelectedText = async () => {
    return new Promise<string>((resolve, reject) => {
      const id = generatePromiseId();
      promises.current[id] = {
        resolve,
        reject,
      };
      _postMessage({
        type: BridgingNames.promises.getSelectedText,
        value: id,
      });
      promises.current[id].timer = setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          settlePromise(id);
        }
      }, PROMISE_TIMEOUT_MS);
    });
  };

  const getHighlights = async () => {
    return new Promise<Highlights>((resolve, reject) => {
      const id = generatePromiseId();
      promises.current[id] = {
        resolve,
        reject,
      };
      _postMessage({
        type: BridgingNames.promises.getHighlights,
        value: id,
      });
      promises.current[id].timer = setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          settlePromise(id);
        }
      }, PROMISE_TIMEOUT_MS);
    });
  };

  const getAllHighlightsData = async () => {
    return new Promise<HighlightData[]>((resolve, reject) => {
      const id = generatePromiseId();
      promises.current[id] = {
        resolve,
        reject,
      };
      _postMessage({
        type: BridgingNames.promises.getAllHighlightsData,
        value: id,
      });
      promises.current[id].timer = setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          settlePromise(id);
        }
      }, PROMISE_TIMEOUT_MS);
    });
  };

  const getHighlightsVisibilityState = () => {
    return new Promise<boolean>((resolve, reject) => {
      const id = generatePromiseId();
      promises.current[id] = {
        resolve,
        reject,
      };
      _postMessage({
        type: BridgingNames.promises.getHighlightsVisibilityState,
        value: id,
      });
      promises.current[id].timer = setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          settlePromise(id);
        }
      }, PROMISE_TIMEOUT_MS);
    });
  };

  const toggleHighlightsVisibility = () => {
    return new Promise<boolean>((resolve, reject) => {
      const id = generatePromiseId();
      promises.current[id] = {
        resolve,
        reject,
      };
      _postMessage({
        type: BridgingNames.promises.toggleHighlightsVisibility,
        value: id,
      });
      promises.current[id].timer = setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          settlePromise(id);
        }
      }, PROMISE_TIMEOUT_MS);
    });
  };

  const _postMessage = (message: Message) => {
    if (!isWebViewReady.current) {
      pendingMessages.current.push(message);
      return;
    }
    webviewRef.current?.postMessage(JSON.stringify(message));
  };

  const handleLoadEnd = React.useCallback(
    (event: any) => {
      isWebViewReady.current = true;
      const queued = pendingMessages.current;
      pendingMessages.current = [];
      queued.forEach((message) => {
        webviewRef.current?.postMessage(JSON.stringify(message));
      });
      webViewProps?.onLoadEnd?.(event);
    },
    [webViewProps?.onLoadEnd]
  );

  React.useImperativeHandle(ref, () => ({
    highlightSelection,
    highlightSelectionWithValidation,
    unhighlightSelection,
    getSelectedText,
    getHighlights,
    clearHighlights,
    focusHighlight,
    unfocusHighlight,
    unhighlightById,
    getAllHighlightsData,
    getHighlightsVisibilityState,
    toggleHighlightsVisibility,
  }));

  return (
    <WebView
      {...webViewProps}
      ref={webviewRef}
      source={finalSource.current}
      javaScriptEnabled
      onMessage={handleMessage}
      onLoadEnd={handleLoadEnd}
      onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
    />
  );
});

SelectableTextView.displayName = "SelectableTextView";

export default SelectableTextView;
