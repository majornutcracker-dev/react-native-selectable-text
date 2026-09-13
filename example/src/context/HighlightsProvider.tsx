import { HighlightData } from "@majornutcracker/react-native-selectable-text";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { documents } from "@/constants/documents";

/**
 * Session-scoped document state, kept in memory on purpose.
 *
 * The demo deliberately ships no persistence layer — the point is the module,
 * not a storage dependency. This is what the library screen needs to show live
 * counts, what the highlights screen needs to aggregate across documents, and
 * where each reader left off; everything resets when the app does.
 */

type DocumentHighlights = {
  /** Serialized payload from `onHighlightsChange`, fed back into the prop. */
  serialized: string;
  items: HighlightData[];
};

type HighlightsContextValue = {
  states: Record<string, DocumentHighlights>;
  setSerialized: (documentId: string, serialized: string) => void;
  setItems: (documentId: string, items: HighlightData[]) => void;
  reset: (documentId: string) => void;
  countFor: (documentId: string) => number;
  total: number;
  /** Where a document was left, as a 0–1 fraction of its scrollable height. */
  scrollFor: (documentId: string) => number;
  saveScroll: (documentId: string, fraction: number) => void;
};

const HighlightsContext = createContext<HighlightsContextValue | null>(null);

const EMPTY: DocumentHighlights = { serialized: "", items: [] };

export function HighlightsProvider(props: { children: ReactNode }) {
  // Each document opens with the highlights it ships with. `items` stays empty
  // until its reader loads: the text of a highlight is only known once the
  // WebView has resolved the offsets against the rendered page.
  const [states, setStates] = useState<Record<string, DocumentHighlights>>(() =>
    Object.fromEntries(
      documents.map((doc) => [
        doc.id,
        { serialized: doc.initialHighlights, items: [] },
      ])
    )
  );

  const setSerialized = useCallback(
    (documentId: string, serialized: string) => {
      setStates((prev) => ({
        ...prev,
        [documentId]: { ...(prev[documentId] ?? EMPTY), serialized },
      }));
    },
    []
  );

  const setItems = useCallback((documentId: string, items: HighlightData[]) => {
    setStates((prev) => ({
      ...prev,
      [documentId]: { ...(prev[documentId] ?? EMPTY), items },
    }));
  }, []);

  const reset = useCallback((documentId: string) => {
    setStates((prev) => ({ ...prev, [documentId]: EMPTY }));
  }, []);

  // A ref, not state: onScroll fires every frame, and state would re-render the
  // reader and its WebView the whole time. Nothing displays this value — it is
  // only read once, when a reader opens.
  const scrolls = useRef<Record<string, number>>({});

  const scrollFor = useCallback(
    (documentId: string) => scrolls.current[documentId] ?? 0,
    []
  );

  const saveScroll = useCallback((documentId: string, fraction: number) => {
    scrolls.current[documentId] = fraction;
  }, []);

  const value = useMemo<HighlightsContextValue>(() => {
    const countFor = (documentId: string) =>
      states[documentId]?.items.length ?? 0;
    const total = Object.values(states).reduce(
      (sum, entry) => sum + entry.items.length,
      0
    );
    return {
      states,
      setSerialized,
      setItems,
      reset,
      countFor,
      total,
      scrollFor,
      saveScroll,
    };
  }, [states, setSerialized, setItems, reset, scrollFor, saveScroll]);

  return (
    <HighlightsContext.Provider value={value}>
      {props.children}
    </HighlightsContext.Provider>
  );
}

export function useHighlights(): HighlightsContextValue {
  const context = useContext(HighlightsContext);
  if (!context) {
    throw new Error("useHighlights must be used inside a HighlightsProvider");
  }
  return context;
}
