import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { theme } from "@/constants/theme";

/** A magnifier drawn with views, so it needs no icon font. */
export function SearchGlyph(props: { color: string }) {
  return (
    <View style={styles.glyph}>
      <View style={[styles.glyphLens, { borderColor: props.color }]} />
      <View style={[styles.glyphHandle, { backgroundColor: props.color }]} />
    </View>
  );
}

export function SearchBar(props: {
  query: string;
  onChangeQuery: (query: string) => void;
  /** Whether the query is long enough to have been searched. */
  searching: boolean;
  total: number;
  index: number;
  accent: string;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}) {
  const hasMatches = props.total > 0;

  return (
    <View style={styles.bar}>
      <View style={styles.field}>
        <SearchGlyph color={theme.color.textFaint} />
        <TextInput
          value={props.query}
          onChangeText={props.onChangeQuery}
          placeholder="Search in this document"
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          // Return steps to the next match and keeps the keyboard up.
          submitBehavior="submit"
          onSubmitEditing={props.onNext}
          selectionColor={props.accent}
        />
        {props.searching && (
          <Text
            style={[
              styles.count,
              { color: hasMatches ? props.accent : theme.color.textFaint },
            ]}
          >
            {hasMatches ? `${props.index + 1}/${props.total}` : "0"}
          </Text>
        )}
      </View>

      <StepButton
        label="↑"
        accessibilityLabel="Previous match"
        disabled={!hasMatches}
        onPress={props.onPrevious}
      />
      <StepButton
        label="↓"
        accessibilityLabel="Next match"
        disabled={!hasMatches}
        onPress={props.onNext}
      />
      <Pressable
        onPress={props.onClose}
        hitSlop={8}
        accessibilityLabel="Close search"
        style={styles.close}
      >
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );
}

function StepButton(props: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      hitSlop={6}
      accessibilityLabel={props.accessibilityLabel}
      style={({ pressed }) => [
        styles.step,
        pressed && styles.stepPressed,
        props.disabled && styles.stepDisabled,
      ]}
    >
      <Text style={styles.stepText}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(2),
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space(2),
    height: 36,
    paddingHorizontal: theme.space(3),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.bgElevated,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  input: {
    flex: 1,
    color: theme.color.text,
    fontSize: theme.font.size.base,
    paddingVertical: 0,
  },
  count: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    fontVariant: ["tabular-nums"],
  },
  step: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.bgElevated,
  },
  stepPressed: { opacity: 0.6 },
  stepDisabled: { opacity: 0.35 },
  stepText: { color: theme.color.text, fontSize: 15, lineHeight: 18 },
  close: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: theme.color.textMuted, fontSize: 15 },
  glyph: { width: 14, height: 14 },
  glyphLens: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.6,
  },
  glyphHandle: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 5,
    height: 1.6,
    borderRadius: 1,
    transform: [{ rotate: "45deg" }],
  },
});
