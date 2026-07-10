import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { api } from "../../../../lib/api";

export default function MyRequestsScreen() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users.myPostRequests().then(data => {
      setRequests(data as any);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Post Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text>Status: {item.status.toUpperCase()}</Text>
            <Text>Sent on: {new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>No requests sent yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  card: { padding: 16, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 12 }
});
