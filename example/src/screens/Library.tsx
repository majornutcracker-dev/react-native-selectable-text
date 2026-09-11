import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { documents, type ReaderDocument } from "@/constants/documents";
import { theme } from "@/constants/theme";
import { useHighlights } from "@/context/HighlightsProvider";

export default function Library() {
  const router = useRouter();
  // Counts come from the in-memory session store, so they update the moment a
  // highlight changes in the reader — no reload pass on focus.
  const { countFor, total } = useHighlights();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>react-native-selectable-text</Text>
          <Text style={styles.title}>
            Real HTML.{"\n"}
            <Text style={styles.titleAccent}>Native selection.</Text>
          </Text>
          <Text style={styles.lede}>
            Three documents, three completely different designs — each one is
            just an HTML string and a stylesheet. Select any text to watch a
            highlight animate in, and tap one to animate it back out.
          </Text>

          <View style={styles.statRow}>
            <Stat value={String(documents.length)} label="Documents" />
            <Stat value={String(total)} label="Highlights" />
            <Stat value="0" label="Extra deps" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Library</Text>

        {documents.map((doc, index) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            index={index}
            count={countFor(doc.id)}
            onPress={() =>
              router.push({ pathname: "/reader/[id]", params: { id: doc.id } })
            }
          />
        ))}

        <Pressable
          style={styles.ghostButton}
          onPress={() => router.push("/highlights")}
        >
          <Text style={styles.ghostButtonText}>Browse all highlights →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat(props: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{props.value}</Text>
      <Text style={styles.statLabel}>{props.label}</Text>
    </View>
  );
}

function DocumentCard(props: {
  document: ReaderDocument;
  index: number;
  count: number;
  onPress: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      delay: props.index * 90,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [enter, props.index]);

  const scale = press.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.97],
  });

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [24, 0],
            }),
          },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={props.onPress}
        onPressIn={() =>
          Animated.spring(press, {
            toValue: 1,
            useNativeDriver: true,
            speed: 40,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(press, {
            toValue: 0,
            useNativeDriver: true,
            speed: 40,
          }).start()
        }
        style={[styles.card, { borderColor: props.document.accentDim }]}
      >
        <Image
          source={{
            uri: `https://picsum.photos/seed/${props.document.id}-cover/400/300`,
          }}
          style={styles.cover}
          contentFit="cover"
          transition={320}
        />
        <View
          style={[styles.coverWash, { backgroundColor: props.document.accent }]}
        />

        <View style={styles.cardBody}>
          <Text style={[styles.kicker, { color: props.document.accent }]}>
            {props.document.kicker}
          </Text>
          <Text style={styles.cardTitle}>{props.document.title}</Text>
          <Text style={styles.cardBlurb} numberOfLines={2}>
            {props.document.blurb}
          </Text>

          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>{props.document.readingTime}</Text>
            {props.count > 0 && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: props.document.accentDim },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: props.document.accent },
                  ]}
                />
                <Text
                  style={[styles.badgeText, { color: props.document.accent }]}
                >
                  {props.count} highlight{props.count === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  scroll: { padding: 20, paddingBottom: 48 },
  hero: { paddingTop: 12, paddingBottom: 28 },
  eyebrow: {
    color: theme.color.accentSoft,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    color: theme.color.text,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  titleAccent: { color: theme.color.accentSoft },
  lede: {
    color: theme.color.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
  },
  statRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  stat: {
    flex: 1,
    backgroundColor: theme.color.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { color: theme.color.text, fontSize: 20, fontWeight: "700" },
  statLabel: {
    color: theme.color.textFaint,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  sectionLabel: {
    color: theme.color.textFaint,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  card: {
    backgroundColor: theme.color.bgCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  cover: { width: "100%", height: 132 },
  coverWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 132,
    opacity: 0.22,
  },
  cardBody: { padding: 16 },
  kicker: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  cardTitle: {
    color: theme.color.text,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  cardBlurb: {
    color: theme.color.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  metaText: { color: theme.color.textFaint, fontSize: 12 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  ghostButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
  },
  ghostButtonText: {
    color: theme.color.accentSoft,
    fontSize: 14,
    fontWeight: "600",
  },
});
