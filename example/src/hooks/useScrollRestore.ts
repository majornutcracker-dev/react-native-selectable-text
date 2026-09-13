import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WebViewProps } from "react-native-webview";

import { useHighlights } from "@/context/HighlightsProvider";

type ScrollHandler = NonNullable<WebViewProps["onScroll"]>;
type MessageHandler = NonNullable<WebViewProps["onMessage"]>;

/** Posted by the injected script once the saved position has been applied. */
const RESTORED_MESSAGE = "example:scrollRestored";

/**
 * How long after the load to stop waiting for that message. A page that failed
 * to load never sends it, and the reader must not stay behind the spinner.
 */
const RESTORE_FALLBACK_MS = 2000;

function clampFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * Runs once the document has loaded. It waits for web fonts first: the readers
 * use Google Fonts with `display=swap`, so scrolling before they arrive lands on
 * a layout that is about to reflow, and the position drifts. It reports back
 * even when there is nowhere to scroll, because that report is also what lifts
 * the loading overlay.
 */
function buildRestoreScript(fraction: number): string {
  return `
(function () {
  var fraction = ${JSON.stringify(clampFraction(fraction))};
  function restore() {
    if (fraction > 0) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0) {
        window.scrollTo(0, fraction * max);
      }
    }
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: ${JSON.stringify(RESTORED_MESSAGE)} })
    );
  }
  var fonts = document.fonts && document.fonts.ready;
  (fonts || Promise.resolve()).then(restore, restore);
})();
true;
`;
}

/**
 * Remembers where a reader was left and puts it back on the next visit.
 *
 * The position is kept as a fraction of the scrollable height, not in pixels:
 * the same pixel offset points at different text after a rotation or on a wider
 * screen. `onScroll` reports offset, content size and viewport in one unit per
 * platform — points on iOS, dp on Android — so the fraction is unit-free.
 *
 * Returns the WebView props to spread, and `ready` for the loading overlay.
 */
export function useScrollRestore(documentId: string) {
  const { scrollFor, saveScroll } = useHighlights();
  const [ready, setReady] = useState(false);

  // Read once: injectedJavaScript only runs on the first load, and a prop that
  // changed on every render would only be noise.
  const [injectedJavaScript] = useState(() =>
    buildRestoreScript(scrollFor(documentId))
  );

  // Positions are only recorded after the restore. Before it, the page sits at
  // the top, and iOS can report that during layout — leaving right then would
  // otherwise overwrite the saved position with 0.
  const restored = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fallback.current), []);

  const reveal = useCallback(() => {
    clearTimeout(fallback.current);
    restored.current = true;
    setReady(true);
  }, []);

  const onScroll = useCallback<ScrollHandler>(
    (event) => {
      if (!restored.current) {
        return;
      }
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const max = contentSize.height - layoutMeasurement.height;
      saveScroll(
        documentId,
        max > 0 ? clampFraction(contentOffset.y / max) : 0
      );
    },
    [documentId, saveScroll]
  );

  const onMessage = useCallback<MessageHandler>(
    (event) => {
      // Every bridge message comes through here as well; only ours matters.
      try {
        if (JSON.parse(event.nativeEvent.data)?.type === RESTORED_MESSAGE) {
          reveal();
        }
      } catch {
        // Not JSON, so not ours.
      }
    },
    [reveal]
  );

  const onLoadEnd = useCallback(() => {
    if (!restored.current) {
      fallback.current = setTimeout(reveal, RESTORE_FALLBACK_MS);
    }
  }, [reveal]);

  return useMemo(
    () => ({
      ready,
      webViewProps: { injectedJavaScript, onScroll, onMessage, onLoadEnd },
    }),
    [ready, injectedJavaScript, onScroll, onMessage, onLoadEnd]
  );
}
