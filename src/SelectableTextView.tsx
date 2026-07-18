import * as React from "react";
import { WebView, WebViewProps } from "react-native-webview";

import {
  BridgingNames,
  Message,
  SelectableTextViewPropsBase,
  SelectableTextViewRef,
  Highlights,
  SelectableTextViewError,
  HighlightData,
  HighlighterName,
} from "./types";
import { generatePromiseId, htmlContent } from "./utils";
import { Linking, Platform } from "react-native";
import { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

export type SelectableTextViewProps = SelectableTextViewPropsBase & {
  webViewProps?: WebViewProps;
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
    webViewProps,
  } = props;
  const promises = React.useRef<{
    [key: string]: {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
    };
  }>({});

  const webviewRef = React.useRef<WebView>(null);

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
      const data = JSON.parse(event.nativeEvent.data) as Message;
      if (data.type === BridgingNames.events.onHighlightsChange) {
        onHighlightsChange?.(data.value as string);
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
              scroll: false,
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
              error ?? "Unknown error while getting highlights visibility state"
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
      }
    },
    [onTextSelectionChange, onHighlightsChange, onError]
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

  React.useEffect(() => {
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

  const highlightSelection = (highlighterName?: HighlighterName) => {
    _postMessage({
      type: BridgingNames.functions.highlightSelection,
      value: highlighterName,
    });
  };

  const highlightSelectionWithValidation = async (
    validation: (text: string) => boolean | Promise<boolean>,
    highlighterName?: HighlighterName
  ) => {
    const text = await getSelectedText();
    const result = await validation(text);
    if (result) {
      highlightSelection(highlighterName);
    }
  };

  const unhighlightSelection = () => {
    _postMessage({
      type: BridgingNames.functions.unhighlightSelection,
      value: undefined,
    });
  };

  const clearHighlights = () => {
    _postMessage({
      type: BridgingNames.functions.clearHighlights,
      value: undefined,
    });
  };

  const focusHighlight = (id: string, className?: string) => {
    _postMessage({
      type: BridgingNames.functions.focusHighlight,
      value: {
        id,
        className,
      },
    });
  };

  const unfocusHighlight = () => {
    _postMessage({
      type: BridgingNames.functions.unfocusHighlight,
      value: undefined,
    });
  };

  const unhighlightById = (id: string) => {
    _postMessage({
      type: BridgingNames.functions.unhighlightById,
      value: id,
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
    webviewRef.current?.postMessage(JSON.stringify(message));
  };

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
      domStorageEnabled={false}
      javaScriptEnabled
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
    />
  );
});

SelectableTextView.displayName = "SelectableTextView";

export default SelectableTextView;
