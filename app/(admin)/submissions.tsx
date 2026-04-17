import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../lib/firebase";

interface MenuSuggestion {
  id: string;
  name: string;
  description: string;
  category: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: "pending" | "approved" | "rejected";
  created_at: { seconds: number } | string;
}

const FIRESTORE_DATABASE_ID =
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || "default";

export default function SubmissionsScreen() {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<MenuSuggestion[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      if (!projectId) throw new Error("Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID");

      const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents/menu_suggestions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch suggestions (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();
      if (data.documents) {
        const parsed = data.documents.map((doc: any) => ({
          id: doc.name.split("/").pop(),
          name: doc.fields?.name?.stringValue || "",
          description: doc.fields?.description?.stringValue || "",
          category: doc.fields?.category?.stringValue || "",
          user_id: doc.fields?.user_id?.stringValue || "",
          user_email: doc.fields?.user_email?.stringValue || "",
          user_name: doc.fields?.user_name?.stringValue || "",
          status: doc.fields?.status?.stringValue || "pending",
          created_at: doc.fields?.created_at?.timestampValue || "",
        }));
        setSuggestions(parsed);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Fetch suggestions error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchSuggestions(); }, [fetchSuggestions]));

  const updateSuggestionStatus = async (suggestionId: string, status: "approved" | "rejected") => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      if (!projectId) throw new Error("Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID");

      const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents/menu_suggestions/${suggestionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fields: { status: { stringValue: status } },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to update suggestion (${response.status}): ${errorText}`,
        );
      }

      Alert.alert("Success", `Suggestion ${status}`);
      fetchSuggestions();
    } catch (error) {
      console.error("Update suggestion status error:", error);
      Alert.alert("Error", "Failed to update suggestion");
    }
  };

  const filtered = filter === "all" ? suggestions : suggestions.filter((s) => s.status === filter);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Menu Suggestions</Text>

        <View style={styles.filterRow}>
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No suggestions found</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === "pending" ? "#FFA500" : item.status === "approved" ? "#4CAF50" : "#F44336" }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardCategory}>{item.category}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
                <Text style={styles.cardMeta}>By {item.user_name} ({item.user_email})</Text>
                {item.status === "pending" && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => updateSuggestionStatus(item.id, "approved")}
                    >
                      <Ionicons name="checkmark" size={20} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => updateSuggestionStatus(item.id, "rejected")}
                    >
                      <Ionicons name="close" size={20} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A1A2E" },
  title: { fontSize: 28, fontWeight: "bold", color: "#fff", margin: 20 },
  filterRow: { flexDirection: "row", marginHorizontal: 20, marginBottom: 20, gap: 8 },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#2A2A4E",
  },
  filterBtnActive: { backgroundColor: "#F25C05" },
  filterBtnText: { color: "#888", fontSize: 12, fontWeight: "600", textAlign: "center" },
  filterBtnTextActive: { color: "#fff" },
  emptyText: { color: "#888", textAlign: "center", marginTop: 40 },
  card: { backgroundColor: "#2A2A4E", marginHorizontal: 20, marginBottom: 16, borderRadius: 12, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#fff", flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  cardCategory: { color: "#F25C05", fontSize: 12, marginBottom: 8 },
  cardDescription: { color: "#ccc", fontSize: 14, marginBottom: 12, lineHeight: 20 },
  cardMeta: { color: "#888", fontSize: 11 },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, flex: 1, justifyContent: "center" },
  approveBtn: { backgroundColor: "#4CAF50" },
  rejectBtn: { backgroundColor: "#F44336" },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
