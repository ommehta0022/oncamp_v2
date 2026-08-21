import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeProvider";
import { radius, spacing } from "@/src/theme/colors";
import Header from "@/src/components/Header";
import { campusApi } from "@/src/lib/campusApi";

type Place = {
  id: string;
  name: string;
  category?: string;
  description?: string;
  latitude: number;
  longitude: number;
  floor?: string;
  building?: string;
  metadata?: Record<string, any>;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] || char));
}

function mapHtml(places: Place[], dark: boolean) {
  const valid = places.filter((place) => Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude)));
  const center = valid.length ? [Number(valid[0].latitude), Number(valid[0].longitude)] : [20.5937, 78.9629];
  const pins = JSON.stringify(valid.map((place) => ({
    name: place.name,
    category: place.category || "Campus place",
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    detail: [place.building, place.floor, place.description].filter(Boolean).join(" · "),
  }))).replace(/<\//g, "<\\/");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>html,body,#map{height:100%;margin:0;background:${dark ? "#111515" : "#f4f6f5"}}.leaflet-control-attribution{font-size:9px}.popup-title{font:700 14px system-ui;margin-bottom:3px}.popup-meta{font:12px system-ui;color:#59615f;max-width:220px}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:true}).setView([${center[0]},${center[1]}],${valid.length ? 16 : 4});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap contributors'}).addTo(map);const pins=${pins};const bounds=[];pins.forEach(p=>{const marker=L.marker([p.latitude,p.longitude]).addTo(map);marker.bindPopup('<div class="popup-title">'+String(p.name).replace(/[<>&]/g,'')+'</div><div class="popup-meta">'+String(p.category).replace(/[<>&]/g,'')+(p.detail?' · '+String(p.detail).replace(/[<>&]/g,''):'')+'</div>');bounds.push([p.latitude,p.longitude]);});if(bounds.length>1)map.fitBounds(bounds,{padding:[30,30],maxZoom:18});</script></body></html>`;
}

export default function CampusMap() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [webFailed, setWebFailed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    try { setPlaces(await campusApi.student.places()); }
    catch { setPlaces([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const categories = useMemo(() => ["All", ...Array.from(new Set(places.map((place) => place.category).filter(Boolean) as string[])).sort()], [places]);
  const filtered = useMemo(() => selectedCategory === "All" ? places : places.filter((place) => place.category === selectedCategory), [places, selectedCategory]);
  const html = useMemo(() => mapHtml(filtered, isDark), [filtered, isDark]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <Header title="Campus map" onBack={() => router.back()} />
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View> : (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {categories.map((category) => { const active = selectedCategory === category; return <Pressable key={category} onPress={() => { setSelectedCategory(category); setWebFailed(false); }} style={[styles.filter, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }]}><Text style={{ color: active ? "#fff" : colors.onSurface, fontWeight: active ? "800" : "600", fontSize: 12 }}>{category}</Text></Pressable>; })}
          </ScrollView>

          {!webFailed && filtered.length > 0 ? (
            <View style={[styles.mapCard, { borderColor: colors.border }]}>
              <WebView
                originWhitelist={["*"]}
                source={{ html }}
                style={{ flex: 1, backgroundColor: colors.surface }}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="never"
                setSupportMultipleWindows={false}
                onError={() => setWebFailed(true)}
                onHttpError={() => setWebFailed(true)}
              />
            </View>
          ) : (
            <View style={[styles.fallback, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}><Ionicons name="map-outline" size={30} color={colors.brandPrimary} /><Text style={{ color: colors.onSurface, fontWeight: "800", marginTop: 8 }}>{filtered.length ? "Map tiles unavailable" : "No campus places yet"}</Text><Text style={{ color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 19, marginTop: 4 }}>{filtered.length ? "You can still use the campus directory below." : "Your institution can add buildings, labs, offices and facilities from Campus Platform."}</Text></View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 80 }}>
            <Text style={{ color: colors.onSurface, fontSize: 17, fontWeight: "800", marginBottom: spacing.sm }}>{filtered.length} place{filtered.length === 1 ? "" : "s"}</Text>
            {filtered.map((place) => <View key={place.id} style={[styles.row, { borderBottomColor: colors.border }]}><View style={[styles.icon, { backgroundColor: colors.brandPrimary + "14" }]}><Ionicons name={iconForCategory(place.category)} size={19} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{place.name}</Text><Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }}>{[place.category, place.building, place.floor].filter(Boolean).join(" · ") || "Campus place"}</Text>{place.description ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{place.description}</Text> : null}</View></View>)}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

function iconForCategory(category?: string): keyof typeof Ionicons.glyphMap {
  const value = String(category || "").toLowerCase();
  if (value.includes("library")) return "library-outline";
  if (value.includes("lab")) return "flask-outline";
  if (value.includes("food") || value.includes("canteen")) return "restaurant-outline";
  if (value.includes("sport") || value.includes("ground")) return "football-outline";
  if (value.includes("office")) return "business-outline";
  if (value.includes("medical") || value.includes("clinic")) return "medkit-outline";
  return "location-outline";
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 7 }, filter: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 },
  mapCard: { height: "48%", minHeight: 270, marginHorizontal: spacing.lg, borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  fallback: { marginHorizontal: spacing.lg, minHeight: 220, borderWidth: 1, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
