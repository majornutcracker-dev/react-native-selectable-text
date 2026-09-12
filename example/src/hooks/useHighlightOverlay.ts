import type {
  HighlightData,
  PressedHighlightData,
} from "@majornutcracker/react-native-selectable-text";
import { useCallback, useMemo, useState } from "react";

/**
 * What is currently open on top of the reader.
 *
 * Modelled as one value rather than a flag per surface: the menu and the sheet
 * are alternatives, and each needs a highlight to act on. Separate pieces of
 * state let those drift — a sheet open on a highlight the menu had already
 * removed, or both showing at once — and the transitions between them (tapping
 * "Note" hands the menu's highlight to the sheet) become an ordering problem.
 *
 * The menu carries the richer payload because it anchors itself to the
 * highlight's box; the sheet only needs the highlight, and accepts none at all
 * when it is opened from the FAB rather than from a highlight.
 */
export type HighlightOverlay =
  | { kind: "none" }
  | { kind: "menu"; highlight: PressedHighlightData }
  | { kind: "note"; highlight: HighlightData | null };

export function useHighlightOverlay() {
  const [overlay, setOverlay] = useState<HighlightOverlay>({ kind: "none" });

  const showMenu = useCallback((highlight: PressedHighlightData) => {
    setOverlay({ kind: "menu", highlight });
  }, []);

  const showNote = useCallback((highlight: HighlightData | null) => {
    setOverlay({ kind: "note", highlight });
  }, []);

  const dismiss = useCallback(() => setOverlay({ kind: "none" }), []);

  return useMemo(
    () => ({
      /** The tapped highlight while the menu is open, else null. */
      menuHighlight: overlay.kind === "menu" ? overlay.highlight : null,
      /** The highlight the sheet is annotating; null when opened from the FAB. */
      noteHighlight: overlay.kind === "note" ? overlay.highlight : null,
      noteVisible: overlay.kind === "note",
      showMenu,
      showNote,
      dismiss,
    }),
    [overlay, showMenu, showNote, dismiss]
  );
}
