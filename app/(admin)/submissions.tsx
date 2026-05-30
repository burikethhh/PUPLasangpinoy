import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, Modal,
    ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View
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
  reject_reason?: string;
  created_at: { seconds: number } | string;
}

const FIRESTORE_DATABASE_ID =
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || "default";

export default function SubmissionsScreen() {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<MenuSuggestion[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "archived">("pending");
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
          reject_reason: doc.fields?.reject_reason?.stringValue || "",
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

  const updateSuggestionStatus = async (suggestionId: string, status: "approved" | "rejected", reason?: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      if (!projectId) throw new Error("Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID");

      const fields: Record<string, any> = { status: { stringValue: status } };
      if (reason) fields.reject_reason = { stringValue: reason };

      const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents/menu_suggestions/${suggestionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fields }),
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

  function openRejectModal(id: string) {
    setRejectTargetId(id);
    setRejectReason("");
    setRejectModal(true);
  }

  async function confirmReject() {
    if (!rejectReason.trim()) { Alert.alert("Required", "Please enter a reason for rejection."); return; }
    if (!rejectTargetId) return;
    setRejectModal(false);
    await updateSuggestionStatus(rejectTargetId, "rejected", rejectReason.trim());
    setRejectTargetId(null);
    setRejectReason("");
  }

  function handleArchive(id: string) {
    Alert.alert("Archive Suggestion", "Hide this from the main list?", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", style: "destructive",
        onPress: () => setArchived((prev) => new Set([...prev, id])) },
    ]);
  }

  function handleUnarchive(id: string) {
    Alert.alert("Unarchive Suggestion", "Move this back to the main list?", [
      { text: "Cancel", style: "cancel" },
      { text: "Unarchive",
        onPress: () => setArchived((prev) => { const next = new Set(prev); next.delete(id); return next; }) },
    ]);
  }

  const visible = filter === "archived"
    ? suggestions.filter((s) => archived.has(s.id))
    : suggestions.filter((s) => !archived.has(s.id));
  const filtered = filter === "all" ? visible : filter === "archived" ? visible : visible.filter((s) => s.status === filter);

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filterRow}>
          {(["all", "pending", "approved", "rejected", "archived"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]} numberOfLines={1}>
                {f === "archived" ? `Archived (${archived.size})` : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>No suggestions found</Text>
        ) : (
          <View style={{ paddingHorizontal: 0 }}>
            {filtered.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === "pending" ? "#FFA500" : item.status === "approved" ? "#4CAF50" : "#F44336" }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardCategory}>{item.category}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
                <Text style={styles.cardMeta}>By {item.user_name} ({item.user_email})</Text>
                {item.status === "rejected" && item.reject_reason ? (
                  <View style={styles.rejectReasonBox}>
                    <Ionicons name="alert-circle" size={13} color="#E74C3C" />
                    <Text style={styles.rejectReasonText}>Reason: {item.reject_reason}</Text>
                  </View>
                ) : null}
                {item.status === "pending" && filter !== "archived" && (
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
                      onPress={() => openRejectModal(item.id)}
                    >
                      <Ionicons name="close" size={20} color="#fff" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {filter !== "archived" && (
                  <TouchableOpacity style={styles.archiveBtn} onPress={() => handleArchive(item.id)}>
                    <Ionicons name="archive-outline" size={14} color="#888" />
                    <Text style={styles.archiveBtnText}>Archive</Text>
                  </TouchableOpacity>
                )}
                {filter === "archived" && (
                  <TouchableOpacity style={styles.archiveBtn} onPress={() => handleUnarchive(item.id)}>
                    <Ionicons name="arrow-undo-outline" size={14} color="#F25C05" />
                    <Text style={[styles.archiveBtnText, { color: "#F25C05" }]}>Unarchive</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Reject Reason Modal */}
      <Modal visible={rejectModal} transparent animationType="fade" onRequestClose={() => setRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reason for Rejection</Text>
            <Text style={styles.modalSubtitle}>Please provide a reason so the customer understands the decision.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Already on the menu, Missing details..."
              placeholderTextColor="#aaa"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmReject}>
                <Text style={styles.modalConfirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A1A2E" },
  title: { fontSize: 28, fontWeight: "bold", color: "#fff", margin: 20 },
  filterRow: { paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  filterPill: {
    paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: "#2A2A4E", borderWidth: 1, borderColor: "#3A3A5E",
  },
  filterPillActive: { backgroundColor: "#F25C05", borderColor: "#F25C05" },
  filterPillText: { color: "#888", fontSize: 13, fontWeight: "600" },
  filterPillTextActive: { color: "#fff", fontWeight: "bold" },
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
  archiveBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 10, padding: 4 },
  archiveBtnText: { fontSize: 11, color: "#888" },
  rejectReasonBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#3A1A1A", borderRadius: 8, padding: 8, marginTop: 8 },
  rejectReasonText: { color: "#E74C3C", fontSize: 12, flex: 1, lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "85%", elevation: 8 },
  modalTitle: { fontSize: 17, fontWeight: "bold", color: "#2E1A06", marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: "#666", marginBottom: 12, lineHeight: 18 },
  modalInput: { backgroundColor: "#F9F0DC", borderRadius: 10, borderWidth: 1, borderColor: "#E8D8A0", padding: 12, fontSize: 14, color: "#333", minHeight: 80, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#eee", alignItems: "center" },
  modalCancelText: { color: "#666", fontWeight: "600" },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#E74C3C", alignItems: "center" },
  modalConfirmText: { color: "#fff", fontWeight: "bold" },
});
