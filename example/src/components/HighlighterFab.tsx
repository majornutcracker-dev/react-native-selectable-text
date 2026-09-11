import {
  Highlighter,
  HighlighterName,
  HighlighterType,
} from "@majornutcracker/react-native-selectable-text";
import { Image } from "expo-image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  assetForClassName,
  isColorHighlighterType,
  type HighlighterAsset,
} from "@/constants/highlighters";

import { theme } from "@/constants/theme";

const FAB_ITEM_SIZE = 44;
const FAB_ITEM_GAP = 12;
const FAB_BOTTOM = 16;
const FAB_SWATCH_SIZE = FAB_ITEM_SIZE - 6;

type HighlighterFabProps = {
  highlighters: Highlighter[];
  currentHighlighterName: HighlighterName;
  setCurrentHighlighterName: Dispatch<SetStateAction<HighlighterName>>;
};

export function HighlighterFab(props: HighlighterFabProps) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + FAB_BOTTOM;

  const currentHighlighterAsset = useMemo(
    () => assetForClassName(props.currentHighlighterName ?? ""),
    [props.currentHighlighterName]
  );

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

  const selectHighlighter = (highlighterName: HighlighterName) => {
    props.setCurrentHighlighterName(highlighterName);
    setExpanded(false);
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

      <View style={[styles.colorFabStack, { bottom }]} pointerEvents="box-none">
        {props.highlighters.map((highlighter, index) => {
          const isCurrent = highlighter.name === props.currentHighlighterName;
          const staggerWindow = 0.55;
          const staggerStep =
            props.highlighters.length > 1
              ? (1 - staggerWindow) / (props.highlighters.length - 1)
              : 0;
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
          const opacity = itemProgress;
          const asset = assetForClassName(highlighter.name);

          return (
            <Animated.View
              key={highlighter.name}
              pointerEvents={expanded ? "auto" : "none"}
              style={[
                styles.fabItemSlot,
                {
                  opacity,
                  transform: [{ translateY }, { scale }],
                },
              ]}
            >
              <HighlighterSwatch
                asset={asset}
                selected={isCurrent}
                onPress={() => selectHighlighter(highlighter.name)}
              />
            </Animated.View>
          );
        })}

        <View style={styles.fabMainShadow}>
          <Pressable
            onPress={toggleExpanded}
            style={({ pressed }) => [
              styles.fabMain,
              getFabMainStyle(currentHighlighterAsset),
              pressed && styles.fabMainPressed,
            ]}
          >
            {currentHighlighterAsset?.type === "background-image" &&
            currentHighlighterAsset.image ? (
              <Image
                source={{ uri: currentHighlighterAsset.image }}
                style={styles.fabMainImage}
                contentFit="cover"
              />
            ) : null}
            <Animated.View
              style={[
                styles.fabMainIcon,
                { transform: [{ rotate: mainRotation }] },
              ]}
            >
              <View style={styles.fabMainIconBarH} />
              <View style={styles.fabMainIconBarV} />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function getFabMainStyle(asset: HighlighterAsset | undefined) {
  if (asset && isColorHighlighterType(asset.type) && asset.color) {
    return { backgroundColor: asset.color };
  }
  return { backgroundColor: theme.color.bgCard };
}

function HighlighterSwatch(props: {
  asset: HighlighterAsset | undefined;
  selected: boolean;
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

  const showImage =
    props.asset?.type === "background-image" && props.asset.image;
  const color =
    props.asset && isColorHighlighterType(props.asset.type)
      ? props.asset.color
      : undefined;

  return (
    <Pressable
      onPress={props.onPress}
      onPressIn={() => animatePress(0.85)}
      onPressOut={() => animatePress(1)}
    >
      <Animated.View
        style={[
          styles.fabSwatchOuter,
          props.selected && styles.fabSwatchOuterSelected,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        {showImage ? (
          <View style={styles.fabSwatch}>
            <Image
              source={{ uri: props.asset?.image }}
              style={styles.fabSwatchImage}
              contentFit="cover"
            />
          </View>
        ) : (
          <View
            style={[
              styles.fabSwatch,
              { backgroundColor: color ?? theme.color.textFaint },
            ]}
          >
            <SwatchTypeIndicator type={props.asset?.type} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

function SwatchTypeIndicator(props: { type: HighlighterType | undefined }) {
  if (props.type === "text-decoration-color") {
    return <View style={styles.swatchUnderline} />;
  }

  if (props.type === "outline-color") {
    return <View style={styles.swatchOutlineSquare} />;
  }

  return null;
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
  colorFabStack: {
    position: "absolute",
    right: 20,
    alignItems: "center",
    width: FAB_ITEM_SIZE,
  },
  fabItemSlot: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
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
    overflow: "hidden",
  },
  fabMainImage: {
    ...StyleSheet.absoluteFill,
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
  fabSwatchOuter: {
    padding: 3,
    borderRadius: FAB_ITEM_SIZE / 2,
    backgroundColor: theme.color.bgElevated,
  },
  fabSwatchOuterSelected: {
    padding: 4,
    borderWidth: 2,
    borderColor: theme.color.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabSwatch: {
    width: FAB_SWATCH_SIZE,
    height: FAB_SWATCH_SIZE,
    borderRadius: FAB_SWATCH_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.color.hairline,
    overflow: "hidden",
  },
  fabSwatchImage: {
    width: FAB_SWATCH_SIZE,
    height: FAB_SWATCH_SIZE,
  },
  swatchUnderline: {
    position: "absolute",
    bottom: 7,
    width: 18,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: theme.color.bgRaised,
  },
  swatchOutlineSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: theme.color.border,
    backgroundColor: "transparent",
  },
});
