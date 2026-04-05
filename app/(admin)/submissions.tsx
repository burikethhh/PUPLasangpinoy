import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    approveSubmission,
    deleteSubmission,
    getSubmissions,
    RecipeSubmission,
    rejectSubmission,
} from "../../lib/firebase";
import {
    notifyRecipeApproved,
    notifyRecipeRejected,
} from "../../lib/notifications";

const STATUS_COLOR: Record<RecipeSubmission["status"], string> = {
  pending: "#F59E0B",
  approved: "#10B981",
  rejected: "#EF4444",
};

export default function AdminSubmissions() {
  const [filter, setFilter] = useState<"all" | RecipeSubmission["status"]>("pending");
  const [submissions, setSubmissions] = useState<RecipeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Rejection reason modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RecipeSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [detailItem, setDetailItem] = useState<RecipeSubmission | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  async function fetchSubmissions() {
    setLoading(true);
    try {
      const status =
        filter === "all" ? undefined : (filter as RecipeSubmission["status"]);
      const data = await getSubmissions(status);
      // Sort: pending first, then by date desc
      data.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        const ta = (a.created_at as any)?.seconds ?? 0;
        const tb = (b.created_at as any)?.seconds ?? 0;
        return tb - ta;
      });
      setSubmissions(data);
    } catch (err) {
      console.error("Error fetching submissions:", err);
    }
    setLoading(false);
  }

  async function handleApprove(sub: RecipeSubmission) {
    Alert.alert(
      "Approve Recipe",
      `Approve "${sub.title}" and publish it to the app?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setProcessing(sub.id);
            try {
              await approveSubmission(sub.id);
              await notifyRecipeApproved(sub.title);
              await fetchSubmissions();
              Alert.alert("Approved!", `"${sub.title}" is now live.`);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to approve.");
            }
            setProcessing(null);
          },
        },
      ],
    );
  }

  function openRejectModal(sub: RecipeSubmission) {
    setRejectTarget(sub);
    setRejectReason("");
    setRejectModal(true);
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setRejectModal(false);
    setProcessing(rejectTarget.id);
    try {
      await rejectSubmission(rejectTarget.id, rejectReason.trim() || undefined);
      await notifyRecipeRejected(rejectTarget.title, rejectReason.trim() || undefined);
      await fetchSubmissions();
      Alert.alert("Rejected", `"${rejectTarget.title}" has been rejected.`);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reject.");
    }
    setProcessing(null);
    setRejectTarget(null);
  }

  async function handleDelete(sub: RecipeSubmission) {
    Alert.alert(
      "Delete Submission",
      `Permanently delete "${sub.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setProcessing(sub.id);
            try {
              await deleteSubmission(sub.id);
              await fetchSubmissions();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete.");
            }
            setProcessing(null);
          },
        },
      ],
    );
  }

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Recipe Submissions</Text>
          {pendingCount > 0 && (
            <Text style={styles.headerSub}>
              {pendingCount} pending review
            </Text>
          )}
        </View>
      </View>

      {/* FILTER TABS */}
      <View style={styles.filterRow}>
        {(["pending", "all", "approved", "rejected"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : submissions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={60} color="#ccc" />
          <Text style={styles.emptyTitle}>No submissions</Text>
          <Text style={styles.emptyText}>
            {filter === "pending"
              ? "No recipes are waiting for review."
              : `No ${filter} submissions found.`}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {submissions.map((sub) => (
            <View key={sub.id} style={styles.card}>
              {/* Card header */}
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => {
                  setDetailItem(sub);
                  setDetailModal(true);
                }}
              >
                {sub.image_url ? (
                  <Image
                    source={{ uri: sub.image_url }}
                    style={styles.cardImage}
                  />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Ionicons name="restaurant-outline" size={24} color="#ccc" />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {sub.title}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {sub.category} • {sub.region}
                  </Text>
                  <Text style={styles.cardBy}>by {sub.username}</Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: STATUS_COLOR[sub.status] + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: STATUS_COLOR[sub.status] },
                      ]}
                    >
                      {sub.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {sub.status === "rejected" && sub.rejection_reason ? (
                <Text style={styles.rejectionReason}>
                  Reason: {sub.rejection_reason}
                </Text>
              ) : null}

              {/* Action buttons — only for pending */}
              {sub.status === "pending" && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(sub)}
                    disabled={processing === sub.id}
                  >
                    {processing === sub.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="checkmark-outline"
                          size={16}
                          color="#fff"
                        />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => openRejectModal(sub)}
                    disabled={processing === sub.id}
                  >
                    <Ionicons name="close-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(sub)}
                    disabled={processing === sub.id}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}

              {sub.status !== "pending" && (
                <TouchableOpacity
                  style={styles.deleteBtnFull}
                  onPress={() => handleDelete(sub)}
                >
                  <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  <Text style={styles.deleteBtnFullText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* REJECT REASON MODAL */}
      <Modal visible={rejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reject Recipe</Text>
            <Text style={styles.modalSub}>
              Optionally add a reason for {rejectTarget?.username}:
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Missing instructions, duplicate recipe..."
              placeholderTextColor="#aaa"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRejectModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalReject} onPress={handleReject}>
                <Text style={styles.modalRejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal visible={detailModal} transparent animationType="slide">
        <View style={styles.detailOverlay}>
          <View style={styles.detailBox}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {detailItem && (
                <>
                  {detailItem.image_url ? (
                    <Image
                      source={{ uri: detailItem.image_url }}
                      style={styles.detailImage}
                    />
                  ) : null}
                  <View style={styles.detailContent}>
                    <Text style={styles.detailTitle}>{detailItem.title}</Text>
                    <Text style={styles.detailMeta}>
                      {detailItem.category} • {detailItem.region}
                    </Text>
                    <Text style={styles.detailBy}>
                      Submitted by {detailItem.username}
                    </Text>

                    {[
                      { label: "Ingredients", value: detailItem.ingredients },
                      { label: "Instructions", value: detailItem.instructions },
                      { label: "Nutrition", value: detailItem.nutrition },
                      { label: "Health Notes", value: detailItem.health_notes },
                      { label: "History", value: detailItem.history },
                      { label: "Fun Fact", value: detailItem.fun_fact },
                    ].map(({ label, value }) =>
                      value ? (
                        <View key={label} style={styles.detailSection}>
                          <Text style={styles.detailSectionLabel}>{label}</Text>
                          <Text style={styles.detailSectionText}>{value}</Text>
                        </View>
                      ) : null,
                    )}
                  </View>
                </>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.detailClose}
              onPress={() => setDetailModal(false)}
            >
              <Text style={styles.detailCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: {
    backgroundColor: "#F25C05",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "#fff", opacity: 0.85 },

  filterRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8d0",
  },
  filterBtn: { flex: 1, paddingVertical: 11, alignItems: "center" },
  filterBtnActive: { borderBottomWidth: 3, borderBottomColor: "#F25C05" },
  filterText: { fontSize: 12, color: "#888" },
  filterTextActive: { color: "#F25C05", fontWeight: "700" },

  list: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
  },
  cardImage: { width: 80, height: 80, borderRadius: 8 },
  cardImagePlaceholder: {
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  cardMeta: { fontSize: 12, color: "#888", marginTop: 2 },
  cardBy: { fontSize: 12, color: "#aaa", marginTop: 1 },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  rejectionReason: {
    fontSize: 12,
    color: "#EF4444",
    fontStyle: "italic",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },

  actionRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f5f5f5",
    padding: 10,
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    borderRadius: 8,
    paddingVertical: 9,
    gap: 5,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingVertical: 9,
    gap: 5,
  },
  deleteBtn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  deleteBtnFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#f5f5f5",
    padding: 10,
    gap: 4,
  },
  deleteBtnFullText: { color: "#EF4444", fontSize: 13 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    marginTop: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#555", marginTop: 14 },
  emptyText: { fontSize: 14, color: "#888", textAlign: "center", marginTop: 6 },

  // Reject modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a2e" },
  modalSub: { fontSize: 13, color: "#666", marginTop: 6, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    textAlignVertical: "top",
    minHeight: 80,
  },
  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalCancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modalCancelText: { color: "#666", fontWeight: "600" },
  modalReject: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#EF4444",
  },
  modalRejectText: { color: "#fff", fontWeight: "700" },

  // Detail modal
  detailOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  detailBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  detailImage: { width: "100%", height: 200 },
  detailContent: { padding: 16 },
  detailTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a2e" },
  detailMeta: { fontSize: 13, color: "#888", marginTop: 2 },
  detailBy: { fontSize: 12, color: "#aaa", marginTop: 2, marginBottom: 12 },
  detailSection: { marginBottom: 12 },
  detailSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F25C05",
    marginBottom: 4,
  },
  detailSectionText: { fontSize: 14, color: "#333", lineHeight: 20 },
  detailClose: {
    backgroundColor: "#F25C05",
    padding: 16,
    alignItems: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  detailCloseText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
