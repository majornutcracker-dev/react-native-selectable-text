import { HighlightData } from "@majornutcracker/react-native-selectable-text";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Session-scoped highlight state, kept in memory on purpose.
 *
 * The demo deliberately ships no persistence layer — the point is the module,
 * not a storage dependency. This is only what the library screen needs to show
 * live counts and what the highlights screen needs to aggregate across
 * documents; everything resets when the app does.
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
};

const HighlightsContext = createContext<HighlightsContextValue | null>(null);

const EMPTY: DocumentHighlights = { serialized: "", items: [] };

export function HighlightsProvider(props: { children: ReactNode }) {
  const [states, setStates] = useState<Record<string, DocumentHighlights>>({});

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

  const value = useMemo<HighlightsContextValue>(() => {
    const countFor = (documentId: string) =>
      states[documentId]?.items.length ?? 0;
    const total = Object.values(states).reduce(
      (sum, entry) => sum + entry.items.length,
      0
    );
    return { states, setSerialized, setItems, reset, countFor, total };
  }, [states, setSerialized, setItems, reset]);

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
