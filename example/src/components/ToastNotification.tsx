import { useCallback, useEffect, useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

const ENTER_OFFSET = -72;
const DISMISS_SWIPE_THRESHOLD = -48;
const ENTER_DURATION_MS = 280;
const EXIT_DURATION_MS = 220;

export type ToastNotificationProps = {
  message: string;
  duration?: number;
  topInset?: number;
  onDismiss: () => void;
};

export function ToastNotification({
  message,
  duration = 5000,
  topInset = 0,
  onDismiss,
}: ToastNotificationProps) {
  const slideY = useRef(new Animated.Value(ENTER_OFFSET)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDismissingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    if (isDismissingRef.current) {
      return;
    }

    isDismissingRef.current = true;
    clearTimer();

    Animated.parallel([
      Animated.timing(slideY, {
        toValue: ENTER_OFFSET,
        duration: EXIT_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(panY, {
        toValue: 0,
        duration: EXIT_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onDismiss();
      }
    });
  }, [clearTimer, onDismiss, opacity, panY, slideY]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: 0,
        duration: ENTER_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        timerRef.current = setTimeout(dismiss, duration);
      }
    });

    return () => {
      clearTimer();
    };
  }, [clearTimer, dismiss, duration, opacity, slideY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy < -4 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          panY.setValue(gestureState.dy);
          const progress = Math.min(Math.abs(gestureState.dy) / 72, 1);
          opacity.setValue(1 - progress * 0.45);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy <= DISMISS_SWIPE_THRESHOLD) {
          dismiss();
          return;
        }

        Animated.parallel([
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 120,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 120,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  const translateY = Animated.add(slideY, panY);

  return (
    <View
      style={[styles.container, { top: topInset + 12 }]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10000,
    alignItems: "center",
  },
  toast: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.color.bgCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: theme.color.text,
  },
});
