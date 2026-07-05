import { ToastNotificationProvider } from "@/context/ToastNotificationProvider";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ToastNotificationProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </ToastNotificationProvider>
    </SafeAreaProvider>
  );
}
