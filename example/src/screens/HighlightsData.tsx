import { HighlightData } from "@majornutcracker/react-native-selectable-text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colorForClassName } from "@/constants/colorClasses";

function parseHighlightsData(raw: unknown): HighlightData[] {
  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HighlightData[]) : [];
  } catch {
    return [];
  }
}

function formatHighlightText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export default function HighlightsData() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data?: string }>();
  const highlights = useMemo(() => parseHighlightsData(data), [data]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>All Highlights Data</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{highlights.length}</Text>
        </View>
      </View>

      <FlatList
        data={highlights}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No highlights yet</Text>
            <Text style={styles.emptySubtext}>
              Add highlights in the content and reopen this screen.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: colorForClassName(item.colorClassName) },
                ]}
              />
              <Text style={styles.className}>{item.colorClassName}</Text>
              <Text style={styles.idText}>#{item.id}</Text>
            </View>
            <Text style={styles.text}>{formatHighlightText(item.text)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eee",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)",
  },
  className: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  idText: {
    fontSize: 13,
    color: "#64748B",
    fontVariant: ["tabular-nums"],
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1E293B",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
