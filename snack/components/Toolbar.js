import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { swatches } from "../highlighters";
import { theme } from "../theme";

export function Toolbar({
  current,
  onPick,
  onClear,
  onRestore,
  onToggle,
  canRestore,
  status,
  bottomInset,
}) {
  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + theme.space(3) }]}>
      <Text style={styles.status} numberOfLines={1}>
        {status}
      </Text>

      <View style={styles.row}>
        <View style={styles.swatches}>
          {swatches.map((swatch) => {
            const active = swatch.name === current;
            return (
              <Pressable
                key={swatch.name}
                onPress={() => onPick(swatch.name)}
                accessibilityRole="button"
                accessibilityLabel={`Use the ${swatch.name} highlighter`}
                style={[
                  styles.swatch,
                  { backgroundColor: swatch.color },
                  active && styles.swatchActive,
                ]}
              >
                {active ? (
                  <Ionicons name="checkmark" size={15} color="#0B0713" />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Action icon="eye-outline" label="Hide or show" onPress={onToggle} />
          <Action
            icon="arrow-undo-outline"
            label="Restore the saved highlights"
            onPress={onRestore}
            disabled={!canRestore}
          />
          <Action icon="trash-outline" label="Clear all" onPress={onClear} />
        </View>
      </View>
    </View>
  );
}

function Action({ icon, label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        pressed && styles.actionPressed,
        disabled && styles.actionDisabled,
      ]}
    >
      <Ionicons name={icon} size={19} color={theme.color.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingTop: theme.space(3),
    backgroundColor: theme.color.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
  status: { color: theme.color.textMuted, fontSize: 12.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space(3),
  },
  swatches: { flexDirection: "row", gap: theme.space(2) },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: { borderColor: theme.color.text },
  actions: { flexDirection: "row", gap: theme.space(2) },
  action: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },
  actionPressed: { backgroundColor: theme.color.border },
  actionDisabled: { opacity: 0.4 },
});
