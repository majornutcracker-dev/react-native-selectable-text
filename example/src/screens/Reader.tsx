import {
  SelectableTextView,
  SelectableTextViewRef,
  HighlighterName,
} from "@majornutcracker/react-native-selectable-text";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Clipboard from "@react-native-clipboard/clipboard";

import { ActionsFab } from "@/components/ActionsFab";
import { HighlighterFab } from "@/components/HighlighterFab";
import { HighlightMenu } from "@/components/HighlightMenu";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { NotesBottomSheet } from "@/components/NotesBottomSheet";
import { useToastNotification } from "@/context/ToastNotificationProvider";
import { useHighlights } from "@/context/HighlightsProvider";
import { useHighlightOverlay } from "@/hooks/useHighlightOverlay";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import {
  HIGHLIGHT_EXIT_CLASS,
  HIGHLIGHT_EXIT_MS,
  HIGHLIGHT_FOCUS_CLASS,
  highlighters,
} from "@/constants/highlighters";
import { theme } from "@/constants/theme";
import { documentById } from "@/constants/documents";

export default function Reader(props: { documentId: string }) {
  const doc = documentById(props.documentId);
  const router = useRouter();
  const viewRef = useRef<SelectableTextViewRef>(null);
  const { showToast } = useToastNotification();
  const { states, setSerialized, setItems, reset } = useHighlights();

  const [currentHighlighterName, setCurrentHighlighterName] =
    useState<HighlighterName>(highlighters[0].name);
  // Puts the reader back where it was left; `ready` once that has happened.
  const scroll = useScrollRestore(doc.id);
  // The WebView's own box: the frame onHighlightPressed reports against.
  const [contentBounds, setContentBounds] = useState({ width: 0, height: 0 });
  const {
    menuHighlight,
    noteHighlight,
    noteVisible,
    showMenu,
    showNote,
    dismiss,
  } = useHighlightOverlay();

  /** Closing by hand also drops the focus style the press applied. */
  const closeOverlay = useCallback(() => {
    viewRef.current?.unfocusHighlight();
    dismiss();
  }, [dismiss]);

  const count = states[doc.id]?.items.length ?? 0;

  /** The SDK stages the removal itself, so the exit animation gets to play. */
  const removeHighlight = useCallback((id: string) => {
    viewRef.current?.focusHighlight(id, HIGHLIGHT_FOCUS_CLASS);
    viewRef.current?.unhighlightById(id, {
      className: HIGHLIGHT_EXIT_CLASS,
      delay: HIGHLIGHT_EXIT_MS,
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerKicker, { color: doc.accent }]}>
            {doc.kicker}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {doc.title}
          </Text>
        </View>
        <Pressable
          onPress={async () => {
            try {
              const data = await viewRef.current?.getAllHighlightsData();
              router.push({
                pathname: "/highlights",
                params: { data: JSON.stringify(data ?? []) },
              });
            } catch (error) {
              showToast(
                error instanceof Error ? error.message : "Unknown error"
              );
            }
          }}
          style={[styles.counter, { backgroundColor: doc.accentDim }]}
        >
          <Text style={[styles.counterText, { color: doc.accent }]}>
            {count}
          </Text>
        </Pressable>
      </View>

      <View
        style={styles.content}
        onLayout={(event) => setContentBounds(event.nativeEvent.layout)}
      >
        <SelectableTextView
          ref={viewRef}
          webViewProps={{
            ...scroll.webViewProps,
            style: [styles.webview, { backgroundColor: doc.background }],
            menuItems: [
              { key: "highlight", label: "Highlight" },
              { key: "highlight-validated", label: "Highlight (4+ chars)" },
              { key: "unhighlight", label: "Unhighlight" },
              { key: "copy", label: "Copy" },
            ],
            onCustomMenuSelection: (event) => {
              const key = event.nativeEvent.key;
              if (key === "highlight") {
                // The selection is dropped by default, which dismisses the iOS
                // callout so the entrance animation is actually visible.
                viewRef.current?.highlightSelection(currentHighlighterName);
              } else if (key === "highlight-validated") {
                viewRef.current?.highlightSelectionWithValidation((text) => {
                  const valid = text.trim().length >= 4;
                  if (!valid) {
                    showToast("Selection too short to highlight (min 4 chars)");
                  }
                  return valid;
                }, currentHighlighterName);
              } else if (key === "unhighlight") {
                viewRef.current?.unhighlightSelection({
                  className: HIGHLIGHT_EXIT_CLASS,
                  delay: HIGHLIGHT_EXIT_MS,
                });
              } else if (key === "copy") {
                Clipboard.setString(event.nativeEvent.selectedText);
                if (Platform.OS === "ios") {
                  Alert.alert("Copied to clipboard");
                }
              }
            },
          }}
          highlighters={highlighters}
          content={doc.content}
          css={doc.css}
          fonts={doc.fonts}
          highlights={states[doc.id]?.serialized ?? ""}
          highlighterOptions={{
            ignoredElements: [
              "a",
              "sup",
              "sub",
              ".ignored",
              ".kicker",
              ".tag",
              ".byline",
              "h1",
              "h2",
              "h3",
              "figcaption",
            ],
          }}
          options={{ userScalable: false, initialScale: 1, maximumScale: 1 }}
          onLink={(url) => Linking.openURL(url)}
          onHighlightsChange={(serialized, items) => {
            setSerialized(doc.id, serialized);
            setItems(doc.id, items);
          }}
          onError={(error) => showToast(error.message)}
          onHighlightPressed={(highlight) => {
            showMenu(highlight);
            return HIGHLIGHT_FOCUS_CLASS;
          }}
          onHighlightsVisibilityStateChange={(visible) => {
            showToast(visible ? "Highlights visible" : "Highlights hidden");
          }}
        />
        <LoadingOverlay
          visible={!scroll.ready}
          background={doc.background}
          color={doc.accent}
        />
        <HighlightMenu
          highlight={menuHighlight}
          bounds={contentBounds}
          onClose={closeOverlay}
          onFocus={(id) => {
            dismiss();
            viewRef.current?.focusHighlight(id, HIGHLIGHT_FOCUS_CLASS);
          }}
          // The focus style stays on, so the sheet is clearly about that one.
          onAnnotate={(highlight) => showNote(highlight)}
          onUnhighlight={(id) => {
            dismiss();
            removeHighlight(id);
          }}
        />
      </View>
      <ActionsFab
        selectableTextViewRef={viewRef}
        accent={doc.accent}
        onClearHighlights={() => {
          dismiss();
          reset(doc.id);
        }}
      />
      <HighlighterFab
        highlighters={highlighters}
        currentHighlighterName={currentHighlighterName}
        setCurrentHighlighterName={setCurrentHighlighterName}
      />
      <NotesBottomSheet
        visible={noteVisible}
        onClose={closeOverlay}
        highlight={noteHighlight}
        onFocusHighlight={(id) => {
          dismiss();
          viewRef.current?.focusHighlight(id, HIGHLIGHT_FOCUS_CLASS);
        }}
        onUnhighlight={(id) => {
          dismiss();
          removeHighlight(id);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.borderSoft,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.bgElevated,
  },
  backText: { color: theme.color.text, fontSize: 18, lineHeight: 20 },
  headerText: { flex: 1 },
  headerKicker: {
    fontSize: theme.font.size.xs,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: theme.color.text,
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold,
    marginTop: 1,
  },
  counter: {
    minWidth: 30,
    height: 26,
    paddingHorizontal: theme.space(2),
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold,
  },
  content: { flex: 1 },
  webview: { flex: 1 },
});
