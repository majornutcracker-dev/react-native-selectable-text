import {
  SelectableTextView,
  SelectableTextViewRef,
  HighlighterName,
  HighlightData,
  PressedHighlightData,
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
import { BottomSheetFab } from "@/components/BottomSheetFab";
import { HighlighterFab } from "@/components/HighlighterFab";
import { HighlightMenu } from "@/components/HighlightMenu";
import { NotesBottomSheet } from "@/components/NotesBottomSheet";
import { useToastNotification } from "@/context/ToastNotificationProvider";
import { useHighlights } from "@/context/HighlightsProvider";
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
  const [visibleNote, setVisibleNote] = useState(false);
  const [pressedHighlight, setPressedHighlight] =
    useState<HighlightData | null>(null);
  // The tapped highlight and where it sits, so the menu can anchor to it.
  const [menuHighlight, setMenuHighlight] =
    useState<PressedHighlightData | null>(null);
  // The WebView's own box: the frame onHighlightPressed reports against.
  const [contentBounds, setContentBounds] = useState({ width: 0, height: 0 });

  const closeMenu = useCallback(() => {
    viewRef.current?.unfocusHighlight();
    setMenuHighlight(null);
  }, []);

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
        <View style={[styles.counter, { backgroundColor: doc.accentDim }]}>
          <Text style={[styles.counterText, { color: doc.accent }]}>
            {count}
          </Text>
        </View>
      </View>

      <View
        style={styles.content}
        onLayout={(event) => setContentBounds(event.nativeEvent.layout)}
      >
        <SelectableTextView
          ref={viewRef}
          webViewProps={{
            style: styles.webview,
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
            setPressedHighlight(highlight);
            setMenuHighlight(highlight);
            return HIGHLIGHT_FOCUS_CLASS;
          }}
          onHighlightsVisibilityStateChange={(visible) => {
            showToast(visible ? "Highlights visible" : "Highlights hidden");
          }}
        />

        <HighlightMenu
          highlight={menuHighlight}
          bounds={contentBounds}
          onClose={closeMenu}
          onFocus={(id) => {
            setMenuHighlight(null);
            viewRef.current?.focusHighlight(id, HIGHLIGHT_FOCUS_CLASS);
          }}
          onUnhighlight={(id) => {
            setMenuHighlight(null);
            setPressedHighlight(null);
            removeHighlight(id);
          }}
        />
      </View>

      <BottomSheetFab onPress={() => setVisibleNote(true)} />
      <ActionsFab
        selectableTextViewRef={viewRef}
        accent={doc.accent}
        onClearHighlights={() => {
          setPressedHighlight(null);
          reset(doc.id);
        }}
      />
      <HighlighterFab
        highlighters={highlighters}
        currentHighlighterName={currentHighlighterName}
        setCurrentHighlighterName={setCurrentHighlighterName}
      />
      <NotesBottomSheet
        visible={visibleNote}
        onClose={() => {
          viewRef.current?.unfocusHighlight();
          setVisibleNote(false);
        }}
        highlight={pressedHighlight}
        onFocusHighlight={(id) => {
          setVisibleNote(false);
          viewRef.current?.focusHighlight(id, HIGHLIGHT_FOCUS_CLASS);
        }}
        onUnhighlight={(id) => {
          setVisibleNote(false);
          setPressedHighlight(null);
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
