import { useLocalSearchParams } from "expo-router";

import Reader from "@/screens/Reader";

export default function ReaderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Reader documentId={id} />;
}
