import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet } from "react-native";

import { theme } from "@/constants/theme";

export function LoadingOverlay(props: {
  visible: boolean;
  background: string;
  color: string;
}) {
  const opacity = useRef(new Animated.Value(props.visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(props.visible);

  useEffect(() => {
    if (props.visible) {
      setMounted(true);
      opacity.setValue(1);
      return;
    }
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: theme.motion.base,
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
    return () => fade.stop();
  }, [props.visible, opacity]);

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={props.visible ? "auto" : "none"}
      style={[styles.overlay, { backgroundColor: props.background, opacity }]}
    >
      <ActivityIndicator size="large" color={props.color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
