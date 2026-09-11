import { ToastNotificationProvider } from "@/context/ToastNotificationProvider";
import { HighlightsProvider } from "@/context/HighlightsProvider";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";

import { theme } from "@/constants/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <HighlightsProvider>
        <ToastNotificationProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.color.bg },
              animation: "slide_from_right",
            }}
          />
        </ToastNotificationProvider>
      </HighlightsProvider>
    </SafeAreaProvider>
  );
}
