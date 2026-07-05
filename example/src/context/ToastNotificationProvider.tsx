import { ToastNotification } from "@/components/ToastNotification";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DEFAULT_DURATION_MS = 5000;

type ToastOptions = {
  duration?: number;
};

type ToastItem = {
  id: string;
  message: string;
  duration: number;
};

type ToastNotificationContextValue = {
  showToast: (_message: string, _options?: ToastOptions) => void;
};

const ToastNotificationContext =
  createContext<ToastNotificationContextValue | null>(null);

function createToastId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ToastNotificationProviderProps = {
  children: ReactNode;
};

export function ToastNotificationProvider({
  children,
}: ToastNotificationProviderProps) {
  const insets = useSafeAreaInsets();
  const queueRef = useRef<ToastItem[]>([]);
  const isShowingRef = useRef(false);
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null);

  const processQueue = useCallback(() => {
    if (isShowingRef.current || queueRef.current.length === 0) {
      return;
    }

    const nextToast = queueRef.current.shift();
    if (!nextToast) {
      return;
    }

    isShowingRef.current = true;
    setCurrentToast(nextToast);
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return;
      }

      queueRef.current.push({
        id: createToastId(),
        message: trimmedMessage,
        duration: options?.duration ?? DEFAULT_DURATION_MS,
      });

      processQueue();
    },
    [processQueue]
  );

  const handleDismiss = useCallback(() => {
    isShowingRef.current = false;
    setCurrentToast(null);
    requestAnimationFrame(() => {
      processQueue();
    });
  }, [processQueue]);

  const value = useMemo(
    () => ({
      showToast,
    }),
    [showToast]
  );

  return (
    <ToastNotificationContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {currentToast ? (
          <ToastNotification
            key={currentToast.id}
            message={currentToast.message}
            duration={currentToast.duration}
            topInset={insets.top}
            onDismiss={handleDismiss}
          />
        ) : null}
      </View>
    </ToastNotificationContext.Provider>
  );
}

export function useToastNotification(): ToastNotificationContextValue {
  const context = useContext(ToastNotificationContext);

  if (!context) {
    throw new Error(
      "useToastNotification must be used within ToastNotificationProvider"
    );
  }

  return context;
}
