import { Stack, useLocalSearchParams } from "expo-router";
import InstitutionProfileV2 from "@/src/screens/InstitutionProfileV2";

export default function InstitutionProfileScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id || "");
  return <><Stack.Screen options={{ headerShown: false }} /><InstitutionProfileV2 institutionId={id} /></>;
}
