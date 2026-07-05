import { ColorClass } from "@majornutcracker/react-native-selectable-text";

export const colorClasses: ColorClass[] = [
  { name: "highlight-amber", color: "#FDE8A0" },
  { name: "highlight-coral", color: "#FCAAB8" },
  { name: "highlight-mint", color: "#A7F0D5" },
  { name: "highlight-sky", color: "#93C5FD" },
  { name: "highlight-violet", color: "#C4B5FD" },
];

export function colorForClassName(name: string): string {
  return colorClasses.find((c) => c.name === name)?.color ?? "#CBD5E1";
}
