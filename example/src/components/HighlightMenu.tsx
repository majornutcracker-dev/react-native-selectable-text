import type { PressedHighlightData } from "@majornutcracker/react-native-selectable-text";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { assetForClassName } from "@/constants/highlighters";
import { theme } from "@/constants/theme";

type HighlightMenuProps = {
  /** The tapped highlight, or null when no menu is open. */
  highlight: PressedHighlightData | null;
  /** Size of the area the menu may occupy — the WebView's own box. */
  bounds: { width: number; height: number };
  onClose: () => void;
  onFocus: (id: string) => void;
  onUnhighlight: (id: string) => void;
};

/** Breathing room between the menu and the highlight, and the edges. */
const GAP = theme.space(2);
const MARGIN = theme.space(3);

type Placement = { left: number; top: number; below: boolean };

/**
 * Places the menu against the highlight without letting it leave the view.
 *
 * Preference is below the highlight, where it does not cover the text just
 * tapped; it flips above only when there is no room, and the horizontal centre
 * is clamped so a highlight near an edge does not push the menu off-screen.
 */
function place(
  rect: PressedHighlightData["rect"],
  menu: { width: number; height: number },
  bounds: { width: number; height: number }
): Placement {
  const below =
    rect.y + rect.height + GAP + menu.height + MARGIN <= bounds.height;
  const top = below
    ? rect.y + rect.height + GAP
    : Math.max(MARGIN, rect.y - GAP - menu.height);

  const centered = rect.x + rect.width / 2 - menu.width / 2;
  const maxLeft = Math.max(MARGIN, bounds.width - menu.width - MARGIN);
  const left = Math.min(Math.max(MARGIN, centered), maxLeft);

  return { left, top, below };
}

function Swatch(props: { name: string }) {
  const asset = assetForClassName(props.name);
  const isImage = asset?.type === "background-image" && asset.image;

  return (
    <View
      style={[
        styles.swatch,
        !isImage
          ? { backgroundColor: asset?.color ?? theme.color.accent }
          : null,
      ]}
    >
      {isImage ? (
        <Image
          source={{ uri: asset?.image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}
    </View>
  );
}

export function HighlightMenu({
  highlight,
  bounds,
  onClose,
  onFocus,
  onUnhighlight,
}: HighlightMenuProps) {
  const [menuSize, setMenuSize] = useState({ width: 0, height: 0 });
  const anim = useRef(new Animated.Value(0)).current;

  // Measured before it is placed, so it must not be visible on the first frame.
  const measured = menuSize.width > 0 && menuSize.height > 0;

  useEffect(() => {
    if (!highlight || !measured) {
      anim.setValue(0);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: theme.motion.fast,
      useNativeDriver: true,
    }).start();
  }, [highlight, measured, anim]);

  if (!highlight) {
    return null;
  }

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== menuSize.width || height !== menuSize.height) {
      setMenuSize({ width, height });
    }
  };

  const { left, top, below } = place(highlight.rect, menuSize, bounds);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Catches the tap that dismisses the menu without dimming the page. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <Animated.View
        onLayout={onLayout}
        style={[
          styles.menu,
          {
            left,
            top,
            opacity: measured ? anim : 0,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  // Grows out of the highlight it belongs to.
                  outputRange: [below ? -GAP : GAP, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.header}>
          <Swatch name={highlight.name} />
          <Text style={styles.headerText} numberOfLines={1}>
            {highlight.text.replace(/\s+/g, " ").trim()}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            onPress={() => onFocus(highlight.id)}
          >
            <Text style={styles.actionText}>Focus</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            onPress={() => onUnhighlight(highlight.id)}
          >
            <Text style={[styles.actionText, styles.dangerText]}>Remove</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    maxWidth: 260,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.bgCard,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(2),
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.borderSoft,
  },
  headerText: {
    flex: 1,
    color: theme.color.textMuted,
    fontSize: theme.font.size.sm,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
  },
  actions: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  action: {
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
  },
  pressed: {
    backgroundColor: theme.color.bgRaised,
  },
  actionText: {
    color: theme.color.text,
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.semibold,
  },
  dangerText: {
    color: theme.color.danger,
  },
  divider: {
    width: 1,
    backgroundColor: theme.color.borderSoft,
  },
});
