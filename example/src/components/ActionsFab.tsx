import Clipboard from "@react-native-clipboard/clipboard";
import { SelectableTextViewRef } from "@majornutcracker/react-native-selectable-text";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastNotification } from "@/context/ToastNotificationProvider";

import { theme } from "@/constants/theme";

const FAB_ITEM_SIZE = 44;
const FAB_ITEM_GAP = 12;
const FAB_BOTTOM = 16;

type ActionsFabProps = {
  selectableTextViewRef: RefObject<SelectableTextViewRef | null>;
  /** Reader accent, so the FAB picks up the current document's colour. */
  accent?: string;
  onClearHighlights: () => void;
};

type ActionFabIconName =
  | "highlights"
  | "highlights-data"
  | "selection"
  | "toggle-highlights"
  | "clear-highlights";

type ActionFabItem = {
  key: string;
  label: string;
  tint: string;
  icon: ActionFabIconName;
  onPress: () => void | Promise<void>;
};

export function ActionsFab(props: ActionsFabProps) {
  const [expanded, setExpanded] = useState(false);
  const [highlightsVisible, setHighlightsVisible] = useState(true);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const { showToast } = useToastNotification();
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + FAB_BOTTOM;

  const actions: ActionFabItem[] = [
    {
      key: "highlights",
      label: "Get Highlights",
      tint: theme.highlight.amber.base,
      icon: "highlights",
      onPress: async () => {
        try {
          const highlights =
            await props.selectableTextViewRef.current?.getHighlights();
          Alert.alert("Highlights", highlights, [
            {
              text: "Copy",
              onPress: () => {
                highlights ? Clipboard.setString(highlights) : undefined;
              },
            },
            { text: "OK", style: "cancel" },
          ]);
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Unknown error");
        }
      },
    },
    {
      key: "all-highlights-data",
      label: "All Highlights Data",
      tint: theme.color.accentSoft,
      icon: "highlights-data",
      onPress: async () => {
        try {
          const data =
            await props.selectableTextViewRef.current?.getAllHighlightsData();
          router.push({
            pathname: "/highlights",
            params: { data: JSON.stringify(data ?? []) },
          });
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Unknown error");
        }
      },
    },
    {
      key: "selected-text",
      label: "Get Selected Text",
      tint: theme.highlight.azure.base,
      icon: "selection",
      onPress: async () => {
        try {
          const selectedText =
            await props.selectableTextViewRef.current?.getSelectedText();
          Alert.alert("Selected Text", JSON.stringify(selectedText));
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Unknown error");
        }
      },
    },
    {
      key: "toggle-highlights-visibility",
      label: highlightsVisible ? "Hide Highlights" : "Show Highlights",
      tint: theme.highlight.mint.base,
      icon: "toggle-highlights",
      onPress: async () => {
        try {
          const visible =
            await props.selectableTextViewRef.current?.toggleHighlightsVisibility();
          if (visible !== undefined) {
            setHighlightsVisible(visible);
          }
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Unknown error");
        }
      },
    },
    {
      key: "visibility-state",
      label: "Visibility State",
      tint: props.accent ?? theme.color.accent,
      icon: "toggle-highlights",
      onPress: async () => {
        try {
          const visible =
            await props.selectableTextViewRef.current?.getHighlightsVisibilityState();
          showToast(
            visible ? "Highlights are visible" : "Highlights are hidden"
          );
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Unknown error");
        }
      },
    },
    {
      key: "clear-highlights",
      label: "Clear Highlights",
      tint: theme.color.danger,
      icon: "clear-highlights",
      onPress: () => {
        props.onClearHighlights();
        props.selectableTextViewRef.current?.clearHighlights();
      },
    },
  ];

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 120,
    }).start();
  }, [expanded, expandAnim]);

  const toggleExpanded = () => {
    setExpanded((value) => !value);
  };

  const runAction = (action: ActionFabItem) => {
    setExpanded(false);
    void action.onPress();
  };

  const mainRotation = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  return (
    <View style={styles.fabRoot} pointerEvents="box-none">
      {expanded ? (
        <Pressable
          style={styles.fabBackdrop}
          onPress={() => setExpanded(false)}
        />
      ) : null}

      <View
        style={[styles.actionsFabStack, { bottom }]}
        pointerEvents="box-none"
      >
        {actions.map((action, index) => {
          const staggerWindow = 0.55;
          const staggerStep =
            actions.length > 1 ? (1 - staggerWindow) / (actions.length - 1) : 0;
          const staggerStart = index * staggerStep;
          const staggerEnd = Math.min(staggerStart + staggerWindow, 1);
          const itemProgress = expandAnim.interpolate({
            inputRange: [0, staggerStart, staggerEnd],
            outputRange: [0, 0, 1],
            extrapolate: "clamp",
          });
          const translateY = itemProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(index + 1) * (FAB_ITEM_SIZE + FAB_ITEM_GAP)],
          });
          const scale = itemProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.2, 1],
          });
          const labelTranslateX = itemProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [-8, 0],
          });

          return (
            <Animated.View
              key={action.key}
              pointerEvents={expanded ? "auto" : "none"}
              style={[
                styles.actionsFabItemSlot,
                {
                  opacity: itemProgress,
                  transform: [{ translateY }, { scale }],
                },
              ]}
            >
              <ActionFabButton
                tint={action.tint}
                icon={action.icon}
                onPress={() => runAction(action)}
              />
              <Animated.Text
                style={[
                  styles.actionsFabLabel,
                  {
                    opacity: itemProgress,
                    transform: [{ translateX: labelTranslateX }],
                  },
                ]}
                numberOfLines={1}
              >
                {action.label}
              </Animated.Text>
            </Animated.View>
          );
        })}

        <View style={styles.fabMainShadow}>
          <Pressable
            onPress={toggleExpanded}
            style={({ pressed }) => [
              styles.fabMain,
              styles.actionsFabMain,
              pressed && styles.fabMainPressed,
            ]}
          >
            <Animated.View
              style={[
                styles.fabMainIcon,
                { transform: [{ rotate: mainRotation }] },
              ]}
            >
              <View
                style={[styles.fabMainIconBarH, styles.fabMainIconBarLight]}
              />
              <View
                style={[styles.fabMainIconBarV, styles.fabMainIconBarLight]}
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ActionFabButton(props: {
  tint: string;
  icon: ActionFabIconName;
  onPress: () => void;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      useNativeDriver: true,
      friction: 5,
      tension: 300,
    }).start();
  };

  return (
    <Pressable
      onPress={props.onPress}
      onPressIn={() => animatePress(0.85)}
      onPressOut={() => animatePress(1)}
    >
      <Animated.View
        style={[
          styles.actionFabButtonOuter,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <View style={[styles.actionFabButton, { borderColor: props.tint }]}>
          <ActionFabIcon tint={props.tint} icon={props.icon} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function ActionFabIcon(props: { tint: string; icon: ActionFabIconName }) {
  if (props.icon === "highlights") {
    return (
      <View style={styles.highlightIcon}>
        <View
          style={[styles.highlightIconBar, { backgroundColor: props.tint }]}
        />
        <View
          style={[
            styles.highlightIconBar,
            styles.highlightIconBarMid,
            { backgroundColor: props.tint },
          ]}
        />
        <View
          style={[
            styles.highlightIconBar,
            styles.highlightIconBarShort,
            { backgroundColor: props.tint },
          ]}
        />
      </View>
    );
  }

  if (props.icon === "highlights-data") {
    return (
      <View style={styles.highlightsDataIcon}>
        <View style={styles.highlightsDataRow}>
          <View
            style={[styles.highlightsDataDot, { backgroundColor: props.tint }]}
          />
          <View
            style={[styles.highlightsDataLine, { backgroundColor: props.tint }]}
          />
        </View>
        <View style={styles.highlightsDataRow}>
          <View
            style={[styles.highlightsDataDot, { backgroundColor: props.tint }]}
          />
          <View
            style={[
              styles.highlightsDataLine,
              styles.highlightsDataLineShort,
              { backgroundColor: props.tint },
            ]}
          />
        </View>
        <View style={styles.highlightsDataRow}>
          <View
            style={[styles.highlightsDataDot, { backgroundColor: props.tint }]}
          />
          <View
            style={[styles.highlightsDataLine, { backgroundColor: props.tint }]}
          />
        </View>
      </View>
    );
  }

  if (props.icon === "toggle-highlights") {
    return (
      <View style={styles.toggleHighlightIcon}>
        <View style={styles.toggleHighlightIconBars}>
          <View
            style={[styles.highlightIconBar, { backgroundColor: props.tint }]}
          />
          <View
            style={[
              styles.highlightIconBar,
              styles.highlightIconBarMid,
              { backgroundColor: props.tint },
            ]}
          />
          <View
            style={[
              styles.highlightIconBar,
              styles.highlightIconBarShort,
              { backgroundColor: props.tint },
            ]}
          />
        </View>
        <View
          style={[
            styles.toggleHighlightStrike,
            { backgroundColor: props.tint },
          ]}
        />
      </View>
    );
  }

  if (props.icon === "clear-highlights") {
    return (
      <View style={styles.clearHighlightIcon}>
        <View style={styles.clearHighlightIconBars}>
          <View
            style={[
              styles.highlightIconBar,
              { backgroundColor: props.tint, opacity: 0.35 },
            ]}
          />
          <View
            style={[
              styles.highlightIconBar,
              styles.highlightIconBarMid,
              { backgroundColor: props.tint, opacity: 0.35 },
            ]}
          />
          <View
            style={[
              styles.highlightIconBar,
              styles.highlightIconBarShort,
              { backgroundColor: props.tint, opacity: 0.35 },
            ]}
          />
        </View>
        <View
          style={[styles.clearHighlightStrike, { backgroundColor: props.tint }]}
        />
        <View
          style={[
            styles.clearHighlightStrike,
            styles.clearHighlightStrikeCross,
            { backgroundColor: props.tint },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={styles.selectionIcon}>
      <View
        style={[styles.selectionIconBracket, { borderColor: props.tint }]}
      />
      <Text style={[styles.selectionIconText, { color: props.tint }]}>T</Text>
      <View
        style={[
          styles.selectionIconBracket,
          styles.selectionIconBracketRight,
          { borderColor: props.tint },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fabRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
  fabBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.color.scrim,
  },
  actionsFabStack: {
    position: "absolute",
    left: 20,
    alignItems: "flex-start",
    minWidth: FAB_ITEM_SIZE,
  },
  actionsFabItemSlot: {
    position: "absolute",
    bottom: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionsFabLabel: {
    minWidth: 160,
    fontSize: 13,
    fontWeight: "600",
    color: theme.color.text,
    textAlign: "center",
    backgroundColor: theme.color.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsFabMain: {
    backgroundColor: theme.color.bgRaised,
  },
  actionFabButtonOuter: {
    padding: 3,
    borderRadius: FAB_ITEM_SIZE / 2,
    backgroundColor: theme.color.bgElevated,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
  },
  actionFabButton: {
    width: FAB_ITEM_SIZE - 6,
    height: FAB_ITEM_SIZE - 6,
    borderRadius: (FAB_ITEM_SIZE - 6) / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.bgCard,
    borderWidth: 2,
  },
  highlightIcon: {
    width: 18,
    height: 14,
    justifyContent: "space-between",
  },
  highlightIconBar: {
    height: 3,
    borderRadius: 2,
    width: "100%",
  },
  highlightIconBarMid: {
    width: "78%",
    alignSelf: "flex-start",
  },
  highlightIconBarShort: {
    width: "55%",
    alignSelf: "flex-end",
  },
  highlightsDataIcon: {
    width: 18,
    height: 14,
    justifyContent: "space-between",
  },
  highlightsDataRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  highlightsDataDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  highlightsDataLine: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
  },
  highlightsDataLineShort: {
    flex: 0.6,
  },
  clearHighlightIcon: {
    width: 18,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleHighlightIcon: {
    width: 18,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleHighlightIconBars: {
    width: 18,
    height: 14,
    justifyContent: "space-between",
  },
  toggleHighlightStrike: {
    position: "absolute",
    width: 17,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: "-45deg" }],
  },
  clearHighlightIconBars: {
    width: 18,
    height: 14,
    justifyContent: "space-between",
  },
  clearHighlightStrike: {
    position: "absolute",
    width: 17,
    height: 2.5,
    borderRadius: 2,
    transform: [{ rotate: "-45deg" }],
  },
  clearHighlightStrikeCross: {
    transform: [{ rotate: "45deg" }],
  },
  selectionIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  selectionIconBracket: {
    width: 5,
    height: 14,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  selectionIconBracketRight: {
    borderLeftWidth: 0,
    borderRightWidth: 2,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  selectionIconText: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
  },
  fabMainShadow: {
    borderRadius: FAB_ITEM_SIZE / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 12,
  },
  fabMain: {
    width: FAB_ITEM_SIZE + 8,
    height: FAB_ITEM_SIZE + 8,
    borderRadius: (FAB_ITEM_SIZE + 8) / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: theme.color.border,
  },
  fabMainPressed: {
    opacity: 0.92,
  },
  fabMainIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  fabMainIconBarH: {
    position: "absolute",
    width: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: theme.color.bgRaised,
  },
  fabMainIconBarV: {
    position: "absolute",
    width: 2.5,
    height: 14,
    borderRadius: 2,
    backgroundColor: theme.color.bgRaised,
  },
  fabMainIconBarLight: {
    backgroundColor: theme.color.text,
  },
});
