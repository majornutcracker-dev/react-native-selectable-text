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
  type HighlighterName,
  type SelectionActionOptions,
  type FocusHighlightOptions,
  type UnhighlightOptions,
} from "./types";
import { generatePromiseId, htmlContent } from "./utils";
import { Linking, Platform } from "react-native";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

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
    };
  }>({});

  const webviewRef = React.useRef<WebView>(null);

  // The last payload this view reported through onHighlightsChange, seeded with
  // the value baked into the HTML so the very first echo is recognised too.
  const lastEmittedHighlights = React.useRef<Highlights | undefined>(
    highlights
  );

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
            promises.current[id]?.resolve(text ?? "");
          } else {
            promises.current[id]?.reject(
              new Error(error ?? "Unknown error while getting selected text")
            );
          }
          delete promises.current[id];
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
          delete promises.current[id];
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
          delete promises.current[id];
        } else if (data.type === BridgingNames.events.log) {
          console.log("Log: ", data.value);
        } else if (data.type === BridgingNames.events.onError) {
          onError?.(data.value as SelectableTextViewError);
        } else if (data.type === BridgingNames.events.onHighlightPressed) {
          const className = await onHighlightPressed?.(
            data.value as HighlightData
          );
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
          delete promises.current[id];
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
          delete promises.current[id];
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
        delete promises.current[key];
      }
    };
  }, []);

  const highlightSelection = (
    highlighterName?: HighlighterName,
    options?: SelectionActionOptions
  ) => {
    _postMessage({
      type: BridgingNames.functions.highlightSelection,
      value: {
        name: highlighterName,
        keepSelection: options?.keepSelection === true,
      },
    });
  };

  const highlightSelectionWithValidation = async (
    validation: (text: string) => boolean | Promise<boolean>,
    highlighterName?: HighlighterName,
    options?: SelectionActionOptions
  ) => {
    const text = await getSelectedText();
    const result = await validation(text);
    if (result) {
      highlightSelection(highlighterName, options);
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
      setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          delete promises.current[id];
        }
      }, 2000); // 2 second timeout
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
      setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          delete promises.current[id];
        }
      }, 2000); // 2 second timeout
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
      setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          delete promises.current[id];
        }
      }, 2000); // 2 second timeout
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
      setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          delete promises.current[id];
        }
      }, 2000); // 2 second timeout
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
      setTimeout(() => {
        if (promises.current[id]) {
          promises.current[id]?.reject(new Error("Timeout"));
          delete promises.current[id];
        }
      }, 2000); // 2 second timeout
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
