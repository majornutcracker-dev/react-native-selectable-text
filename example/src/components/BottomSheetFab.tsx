import { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FAB_BOTTOM = 16;

type BottomSheetFabProps = {
  onPress: () => void;
};

export function BottomSheetFab(props: BottomSheetFabProps) {
  const insets = useSafeAreaInsets();
  const pressScale = useRef(new Animated.Value(1)).current;
  const bottom = insets.bottom + FAB_BOTTOM;

  const animatePress = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      useNativeDriver: true,
      friction: 5,
      tension: 300,
    }).start();
  };

  return (
    <View style={styles.fabRoot} pointerEvents="box-none">
      <View
        style={[styles.bottomSheetFabStack, { bottom }]}
        pointerEvents="box-none"
      >
        <View style={styles.fabMainShadow}>
          <Pressable
            onPress={props.onPress}
            onPressIn={() => animatePress(0.92)}
            onPressOut={() => animatePress(1)}
            style={({ pressed }) => [
              styles.fabMain,
              pressed && styles.fabMainPressed,
            ]}
          >
            <Animated.View
              style={[
                styles.fabMainInner,
                { transform: [{ scale: pressScale }] },
              ]}
            >
              <ChevronUpIcon />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ChevronUpIcon() {
  return (
    <View style={styles.chevronIcon}>
      <View style={[styles.chevronArm, styles.chevronArmLeft]} />
      <View style={[styles.chevronArm, styles.chevronArmRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fabRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
  bottomSheetFabStack: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fabMainShadow: {
    borderRadius: 15,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 12,
  },
  fabMain: {
    width: 50,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
  },
  fabMainPressed: {
    opacity: 0.92,
  },
  fabMainInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  chevronIcon: {
    width: 18,
    height: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronArm: {
    position: "absolute",
    width: 10,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#334155",
    top: 4,
  },
  chevronArmLeft: {
    left: 1,
    transform: [{ rotate: "-45deg" }],
  },
  chevronArmRight: {
    right: 1,
    transform: [{ rotate: "45deg" }],
  },
});
