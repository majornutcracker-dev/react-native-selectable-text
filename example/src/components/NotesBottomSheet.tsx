import { HighlightData } from "@majornutcracker/react-native-selectable-text";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  assetForClassName,
  type HighlighterAsset,
} from "@/constants/highlighters";

import { theme } from "@/constants/theme";

type NotesBottomSheetProps = {
  visible: boolean;
  highlight: HighlightData | null;
  onClose: () => void;
  onFocusHighlight: (id: string) => void;
  onUnhighlight: (id: string) => void;
};

const SHEET_HEIGHT = 440;
const ANIMATION_MS = 260;

function formatHighlightText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function HighlightHandle(props: { asset: HighlighterAsset | undefined }) {
  const isImage = props.asset?.type === "background-image" && props.asset.image;
  // Every highlighter now reports a representative colour — gradient-backed
  // ones included — so the handle no longer needs a contrast special case:
  // all four swatches are light, so the bar is always the dark on-accent ink.
  const color = props.asset?.color ?? theme.color.textFaint;
  const handleBarColor = theme.color.onAccent;

  return (
    <View
      style={[
        styles.handleContainer,
        !isImage ? { backgroundColor: color } : undefined,
      ]}
    >
      {isImage ? (
        <Image
          source={{ uri: props.asset?.image }}
          style={styles.handleImage}
          contentFit="cover"
        />
      ) : null}
      <View style={[styles.handleBar, { backgroundColor: handleBarColor }]} />
    </View>
  );
}

export function NotesBottomSheet({
  visible,
  highlight,
  onClose,
  onFocusHighlight,
  onUnhighlight,
}: NotesBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const highlightAsset = assetForClassName(highlight?.name ?? "");
  const formattedText = highlight ? formatHighlightText(highlight.text) : "";

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slideAnim.setValue(SHEET_HEIGHT);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: ANIMATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: ANIMATION_MS,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!mounted) {
      return;
    }

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: ANIMATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATION_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [visible, mounted, slideAnim, fadeAnim]);

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.backdropPressable} onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.45],
                }),
              },
            ]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: SHEET_HEIGHT,
              paddingBottom: insets.bottom,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <HighlightHandle asset={highlightAsset} />
          <View style={styles.content}>
            <Text style={styles.label}>Highlight ID</Text>
            <Text style={styles.metaValue}>
              {highlight?.id ?? "Select a highlight in the content"}
            </Text>

            <Text style={styles.label}>Highlighted text</Text>
            <Text style={styles.highlightText} numberOfLines={3}>
              {formattedText || "No highlight selected yet"}
            </Text>

            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Write a note for this highlight..."
              placeholderTextColor={theme.color.textFaint}
              multiline
              textAlignVertical="top"
            />
            {highlight ? (
              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.focusButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  disabled={!highlight}
                  onPress={() => highlight && onFocusHighlight(highlight.id)}
                >
                  <Text
                    style={[styles.actionButtonText, styles.focusButtonText]}
                  >
                    Focus
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.unhighlightButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  disabled={!highlight}
                  onPress={() => highlight && onUnhighlight(highlight.id)}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      styles.unhighlightButtonText,
                    ]}
                  >
                    Unhighlight
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.color.scrim,
  },
  sheet: {
    backgroundColor: theme.color.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleImage: {
    ...StyleSheet.absoluteFill,
  },
  handleBar: {
    width: 56,
    height: 5,
    borderRadius: 999,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.color.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 4,
  },
  metaValue: {
    fontSize: 14,
    color: theme.color.text,
    fontVariant: ["tabular-nums"],
  },
  highlightText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.color.textMuted,
  },
  noteInput: {
    minHeight: 120,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    fontSize: 15,
    lineHeight: 22,
    color: theme.color.text,
    backgroundColor: theme.color.bgElevated,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  focusButton: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.border,
  },
  focusButtonText: {
    color: theme.color.text,
  },
  unhighlightButton: {
    backgroundColor: theme.color.bgCard,
    borderColor: theme.color.border,
  },
  unhighlightButtonText: {
    color: theme.color.danger,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
