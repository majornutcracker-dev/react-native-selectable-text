import { Image, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

export function Header({ count, topInset }) {
  return (
    <View style={[styles.header, { paddingTop: topInset + theme.space(3) }]}>
      <Image
        source={require("../assets/snack-icon.png")}
        style={styles.icon}
        resizeMode="contain"
      />
      <View style={styles.titles}>
        <Text style={styles.title}>Selectable Text</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          Select the text, pick an action from the menu
        </Text>
      </View>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingBottom: theme.space(3),
    backgroundColor: theme.color.bgElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  icon: { width: 34, height: 34, borderRadius: theme.radius.sm },
  titles: { flex: 1 },
  title: {
    color: theme.color.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: { color: theme.color.textMuted, fontSize: 12, marginTop: 1 },
  chip: {
    minWidth: 30,
    paddingHorizontal: theme.space(2),
    paddingVertical: theme.space(1),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
    alignItems: "center",
  },
  chipText: {
    color: theme.color.onAccent,
    fontWeight: "700",
    fontSize: 13,
  },
});
