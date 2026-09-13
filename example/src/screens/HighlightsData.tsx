import { HighlightData } from "@majornutcracker/react-native-selectable-text";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { SectionList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  assetForClassName,
  highlighterLabel,
  type HighlighterAsset,
} from "@/constants/highlighters";
import { documents } from "@/constants/documents";
import { theme } from "@/constants/theme";
import { useHighlights } from "@/context/HighlightsProvider";

type Section = { title: string; accent: string; data: HighlightData[] };

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

/** Everything highlighted this session, grouped by document. */
function sectionsFrom(
  states: ReturnType<typeof useHighlights>["states"]
): Section[] {
  return documents
    .map((doc) => ({
      title: doc.title,
      accent: doc.accent,
      data: states[doc.id]?.items ?? [],
    }))
    .filter((section) => section.data.length > 0);
}

function formatHighlightText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function HighlightAssetSwatch(props: { asset: HighlighterAsset }) {
  const isImage = props.asset.type === "background-image" && props.asset.image;

  if (isImage) {
    return (
      <Image
        source={{ uri: props.asset.image }}
        style={styles.assetSwatch}
        contentFit="cover"
      />
    );
  }

  // Every highlighter reports a colour now, gradients included.
  const color = props.asset.color ?? theme.color.textFaint;

  return <View style={[styles.assetSwatch, { backgroundColor: color }]} />;
}

export default function HighlightsData() {
  const router = useRouter();
  // `data` is passed by the reader's "All Highlights Data" action for a
  // snapshot of the current document. Opened from the library there is no
  // param, so fall back to every document in the session store.
  const { data } = useLocalSearchParams<{ data?: string }>();
  const { states } = useHighlights();

  const sections = useMemo<Section[]>(() => {
    if (!data) {
      return sectionsFrom(states);
    }
    const live = parseHighlightsData(data);
    return [
      { title: "Current document", accent: theme.color.accent, data: live },
    ];
  }, [data, states]);

  const total = sections.reduce((sum, s) => sum + s.data.length, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Highlights</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{total}</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View
              style={[styles.sectionDot, { backgroundColor: section.accent }]}
            />
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing highlighted yet</Text>
            <Text style={styles.emptySubtext}>
              Open a document, select some text, and pick a highlighter.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const asset = assetForClassName(item.name);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                {asset && <HighlightAssetSwatch asset={asset} />}
                <Text style={styles.className} numberOfLines={1}>
                  {highlighterLabel(item.name)}
                </Text>
                <Text style={styles.idText}>#{item.id}</Text>
              </View>
              <Text style={styles.text}>{formatHighlightText(item.text)}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.bgElevated,
  },
  backButtonPressed: { opacity: 0.6 },
  backButtonText: { color: theme.color.text, fontSize: 18, lineHeight: 20 },
  title: {
    flex: 1,
    color: theme.color.text,
    fontSize: 17,
    fontWeight: "700",
  },
  countBadge: {
    minWidth: 30,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    color: theme.color.accentSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    flex: 1,
    color: theme.color.textMuted,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  sectionCount: { color: theme.color.textFaint, fontSize: 12 },
  card: {
    backgroundColor: theme.color.bgCard,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  assetSwatch: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  className: {
    flex: 1,
    color: theme.color.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  idText: { color: theme.color.textFaint, fontSize: 11 },
  text: {
    color: theme.color.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 },
  emptyText: { color: theme.color.text, fontSize: 16, fontWeight: "600" },
  emptySubtext: {
    color: theme.color.textFaint,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
});
