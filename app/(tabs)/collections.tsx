import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator, Alert, RefreshControl, SectionList, Image,
    StyleSheet, Text, TextInput, TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "../../constants/order";
import { getCurrentUser } from "../../lib/firebase";
import { getOrdersByUser, requestRefund, addReview, type Order } from "../../lib/firebase-store";
import { uploadToCloudinary } from "../../lib/cloudinary";

const ACTIVE_STATUSES = ["accepted", "preparing", "out_for_delivery"];
const PENDING_STATUS = "pending";
const DONE_STATUSES = ["delivered", "rejected", "cancelled"];

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tabState, setTabState] = useState<"active" | "pending" | "done">("active");
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [reviewItem, setReviewItem] = useState<{ id: string; name: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImage, setReviewImage] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useFocusEffect(useCallback(() => { fetchOrders(); }, []));

  useEffect(() => {
    const intervalId = setInterval(() => { fetchOrders(true); }, 8000);
    return () => clearInterval(intervalId);
  }, []);

  async function fetchOrders(silent = false) {
    if (!silent) setLoading(true);
    const user = getCurrentUser();
    if (!user) { if (!silent) setLoading(false); return; }
    try { setOrders(await getOrdersByUser(user.uid)); } catch (e) { console.error(e); }
    if (!silent) setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await fetchOrders(true); setRefreshing(false); }

  function formatDate(ts: any) {
    if (!ts) return "";
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function handleArchive(orderId: string) {
    Alert.alert("Archive Order", "Remove this order from your history?", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", style: "destructive",
        onPress: () => setArchived((prev) => new Set([...prev, orderId])) },
    ]);
  }

  function handleUnarchive(orderId: string) {
    Alert.alert("Unarchive Order", "Move this order back to your history?", [
      { text: "Cancel", style: "cancel" },
      { text: "Unarchive",
        onPress: () => setArchived((prev) => { const next = new Set(prev); next.delete(orderId); return next; }) },
    ]);
  }

  const archivedOrders = orders.filter((o) => archived.has(o.id));
  const visible = orders.filter((o) => !archived.has(o.id));

  function sortNewest(arr: Order[]) {
    return [...arr].sort((a, b) => {
      const ta = a.created_at?.seconds ? a.created_at.seconds * 1000 : 0;
      const tb = b.created_at?.seconds ? b.created_at.seconds * 1000 : 0;
      return tb - ta;
    });
  }

  const activeOrders = sortNewest(visible.filter((o) => ACTIVE_STATUSES.includes(o.status)));
  const pendingOrders = sortNewest(visible.filter((o) => o.status === PENDING_STATUS));
  const doneOrders = sortNewest(visible.filter((o) => DONE_STATUSES.includes(o.status)));

  const sections = tabState === "active"
    ? (activeOrders.length > 0 ? [{ title: `Active (${activeOrders.length})`, data: activeOrders }] : [])
    : tabState === "pending"
    ? (pendingOrders.length > 0 ? [{ title: `Pending (${pendingOrders.length})`, data: pendingOrders }] : [])
    : (doneOrders.length > 0 ? [{ title: `Done (${doneOrders.length})`, data: doneOrders }] : []);

  function renderOrder({ item }: { item: Order }) {
    const color = ORDER_STATUS_COLORS[item.status] || "#888";
    const isFinished = DONE_STATUSES.includes(item.status);
    const steps = ["pending", "accepted", "preparing", "out_for_delivery", "delivered"];
    const currentIdx = steps.indexOf(item.status);

    return (
      <View style={[styles.card, isFinished && styles.cardFinished]}>
        {/* Header: name on top, order number below */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName} numberOfLines={1}>{item.customer_name || "Customer"}</Text>
            <Text style={styles.orderNum} numberOfLines={1}>{item.order_number}</Text>
          </View>
          <Text style={styles.typeChip} numberOfLines={1}>{ORDER_TYPE_LABELS[item.order_type]}</Text>
          <View style={[styles.badge, { backgroundColor: color + "22" }]}>
            <Text style={[styles.badgeText, { color }]}>{ORDER_STATUS_LABELS[item.status]}</Text>
          </View>
          <Text style={styles.totalInline}>P{item.total?.toFixed(0)}</Text>
        </View>

        {/* Items + date on one line */}
        <View style={styles.infoRow}>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          <Text style={styles.itemsSummary} numberOfLines={1}>
            {(item.items || []).map((i) => `${i.quantity}× ${i.name}`).join("  •  ")}
          </Text>
        </View>

        {/* Payment row */}
        <Text style={styles.paymentText}>{PAYMENT_METHOD_LABELS[item.payment_method]}</Text>

        {/* Rider info */}
        {item.driver_name && (item.status === "out_for_delivery" || item.status === "delivered") && (
          <View style={styles.riderInfo}>
            <Ionicons name="bicycle" size={14} color="#3498DB" />
            <Text style={styles.riderText}>Rider: {item.driver_name}</Text>
            {item.driver_phone ? <Text style={styles.riderPhone}>{item.driver_phone}</Text> : null}
          </View>
        )}

        {item.reject_reason && (
          <View style={styles.rejectBox}>
            <Ionicons name="alert-circle" size={12} color="#E74C3C" />
            <Text style={styles.rejectText}>{item.reject_reason}</Text>
          </View>
        )}

        {/* Refund Status / Request Refund */}
        {item.refund_status && item.refund_status !== "none" && (
          <View style={[styles.refundBox, item.refund_status === "rejected" && { backgroundColor: "#FFF5F5" }]}>
            <Ionicons
              name={item.refund_status === "rejected" ? "close-circle" : "refresh-circle"}
              size={14} color={item.refund_status === "approved" || item.refund_status === "completed" ? "#27AE60" : item.refund_status === "rejected" ? "#E74C3C" : "#F39C12"}
            />
            <Text style={[
              styles.refundText,
              item.refund_status === "approved" || item.refund_status === "completed" ? { color: "#27AE60" } : item.refund_status === "rejected" ? { color: "#E74C3C" } : { color: "#F39C12" },
            ]}>
              Refund: {item.refund_status.toUpperCase()}
            </Text>
          </View>
        )}
        {isFinished && item.payment_method === "gcash" && (!item.refund_status || item.refund_status === "none") && (
          <TouchableOpacity style={styles.refundBtn} onPress={() => { setRefundOrderId(item.id); setRefundReason(""); }}>
            <Ionicons name="cash-outline" size={14} color="#fff" />
            <Text style={styles.refundBtnText}>Request Refund</Text>
          </TouchableOpacity>
        )}

        {/* Live tracking button */}
        {(item.status === "out_for_delivery" || item.status === "accepted" || item.status === "preparing") && (
          <TouchableOpacity
            style={styles.trackLiveBtn}
            onPress={() => (router as any).push({ pathname: "/track-delivery", params: { orderId: item.id, role: "customer" } })}>
            <Ionicons name="navigate" size={14} color="#fff" />
            <Text style={styles.trackLiveBtnText}>Track Live Delivery</Text>
          </TouchableOpacity>
        )}

        {/* Compact tracker for active orders */}
        {!isFinished && (
          <View style={styles.trackerWrap}>
            <View style={styles.tracker}>
              {steps.map((s, idx) => (
                <View key={s} style={styles.trackStep}>
                  <View style={[styles.trackDot, idx <= currentIdx && { backgroundColor: "#F25C05" }]} />
                  {idx < 4 && <View style={[styles.trackLine, idx < currentIdx && { backgroundColor: "#F25C05" }]} />}
                </View>
              ))}
            </View>
            <View style={styles.trackerLabels}>
              {["Placed", "Processing", "Preparing", "Delivering", "Done"].map((lbl) => (
                <Text key={lbl} style={styles.trackerLabel}>{lbl}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Archive button (on done tab only) */}
        {isFinished && tabState === "done" && (
          <TouchableOpacity style={styles.archiveBtn} onPress={() => handleArchive(item.id)}>
            <Ionicons name="archive-outline" size={14} color="#888" />
            <Text style={styles.archiveBtnText}>Archive</Text>
          </TouchableOpacity>
        )}

        {/* Leave Feedback button (on delivered orders only) */}
        {item.status === "delivered" && (
          <TouchableOpacity style={styles.feedbackBtn} onPress={() => {
            setReviewOrder(item);
            setReviewItem(null);
            setReviewRating(5);
            setReviewComment("");
            setReviewImage("");
            setReviewModalVisible(true);
          }}>
            <Ionicons name="star-outline" size={14} color="#fff" />
            <Text style={styles.feedbackBtnText}>Leave Feedback</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Orders</Text>

      {/* Tab pills: Active / Pending / Done */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, tabState === "active" && styles.tabPillActive]}
          onPress={() => setTabState("active")}>
          <Text style={[styles.tabPillText, tabState === "active" && styles.tabPillTextActive]}>Active ({activeOrders.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, tabState === "pending" && styles.tabPillActive]}
          onPress={() => setTabState("pending")}>
          <Text style={[styles.tabPillText, tabState === "pending" && styles.tabPillTextActive]}>Pending ({pendingOrders.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, tabState === "done" && styles.tabPillActive]}
          onPress={() => setTabState("done")}>
          <Text style={[styles.tabPillText, tabState === "done" && styles.tabPillTextActive]}>Done ({doneOrders.length})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : sections.length === 0 && archivedOrders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={64} color="#ddd" />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySubtext}>Your order history will appear here</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={renderOrder}
          ListFooterComponent={tabState === "done" && archivedOrders.length > 0 ? (
            <View>
              <Text style={styles.sectionHeader}>Archived ({archivedOrders.length})</Text>
              {archivedOrders.map((item) => (
                <View key={item.id} style={[styles.card, styles.cardFinished]}>
                  <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerName} numberOfLines={1}>{item.customer_name || "Customer"}</Text>
                      <Text style={styles.orderNum} numberOfLines={1}>{item.order_number}</Text>
                    </View>
                    <Text style={styles.typeChip} numberOfLines={1}>{ORDER_TYPE_LABELS[item.order_type]}</Text>
                    <View style={[styles.badge, { backgroundColor: "#88822" }]}>
                      <Text style={[styles.badgeText, { color: "#888" }]}>{ORDER_STATUS_LABELS[item.status]}</Text>
                    </View>
                    <Text style={styles.totalInline}>P{item.total?.toFixed(0)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                    <Text style={styles.itemsSummary} numberOfLines={1}>
                      {(item.items || []).map((i) => `${i.quantity}× ${i.name}`).join("  •  ")}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.archiveBtn} onPress={() => handleUnarchive(item.id)}>
                    <Ionicons name="arrow-undo-outline" size={14} color="#F25C05" />
                    <Text style={[styles.archiveBtnText, { color: "#F25C05" }]}>Unarchive</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
        />
      )}
      {/* Refund Request Modal */}
      {refundOrderId && (
        <View style={styles.overlay}>
          <View style={styles.refundModal}>
            <Text style={styles.refundModalTitle}>Request Refund</Text>
            <Text style={styles.refundModalSub}>Please provide a reason for your refund request.</Text>
            <TextInput
              style={styles.refundModalInput}
              placeholder="Reason for refund..."
              placeholderTextColor="#aaa"
              value={refundReason}
              onChangeText={setRefundReason}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRefundOrderId(null)}>
                <Text style={{ color: "#888", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmRefund, (!refundReason.trim() || refunding) && { opacity: 0.6 }]}
                onPress={async () => {
                  if (!refundReason.trim()) return;
                  setRefunding(true);
                  try {
                    await requestRefund(refundOrderId, refundReason.trim());
                    Alert.alert("Refund Requested", "Your refund request has been submitted. The store will review it shortly.");
                    setRefundOrderId(null);
                    setRefundReason("");
                    fetchOrders(true);
                  } catch (e: any) {
                    Alert.alert("Error", e.message || "Failed to submit refund request.");
                  }
                  setRefunding(false);
                }}
                disabled={!refundReason.trim() || refunding}
              >
                {refunding ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "bold" }}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {/* Feedback Modal */}
      {reviewModalVisible && reviewOrder && (
        <View style={styles.overlay}>
          <View style={styles.feedbackModal}>
            <Text style={styles.feedbackModalTitle}>Leave Feedback</Text>
            <Text style={styles.feedbackModalSub}>{reviewOrder.order_number}</Text>

            {/* Star rating */}
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                  <Ionicons
                    name={star <= reviewRating ? "star" : "star-outline"}
                    size={32} color={star <= reviewRating ? "#F39C12" : "#ccc"}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment */}
            <TextInput
              style={styles.feedbackInput}
              placeholder="Share your experience..."
              placeholderTextColor="#aaa"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
            />

            {/* Image picker */}
            <TouchableOpacity style={styles.feedbackImageBtn} onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                quality: 0.8,
              });
              if (!result.canceled && result.assets.length > 0) {
                setReviewImage(result.assets[0].uri);
              }
            }}>
              <Ionicons name={reviewImage ? "image" : "camera-outline"} size={18} color="#F25C05" />
              <Text style={styles.feedbackImageBtnText}>{reviewImage ? "Change Photo" : "Add Photo"}</Text>
            </TouchableOpacity>
            {reviewImage ? (
              <Image source={{ uri: reviewImage }} style={styles.feedbackPreviewImage} />
            ) : null}

            {/* Buttons */}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setReviewModalVisible(false)}>
                <Text style={{ color: "#888", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedbackSubmitBtn, submittingReview && { opacity: 0.6 }]}
                disabled={submittingReview}
                onPress={async () => {
                  if (!reviewComment.trim()) {
                    Alert.alert("Comment Required", "Please write a brief comment.");
                    return;
                  }
                  setSubmittingReview(true);
                  try {
                    const user = getCurrentUser();
                    if (!user) throw new Error("Not authenticated");
                    let imageUrl = "";
                    if (reviewImage) {
                      imageUrl = await uploadToCloudinary(reviewImage, "foodfix/reviews");
                    }
                    // Submit a review for each item in the order
                    for (const item of reviewOrder.items) {
                      await addReview({
                        user_id: user.uid,
                        username: reviewOrder.customer_name,
                        order_id: reviewOrder.id,
                        menu_item_id: item.menu_item_id,
                        menu_item_name: item.name,
                        rating: reviewRating,
                        comment: reviewComment.trim(),
                        image_url: imageUrl || undefined,
                      });
                    }
                    Alert.alert("Thank You!", "Your feedback has been submitted.");
                    setReviewModalVisible(false);
                    fetchOrders(true);
                  } catch (e: any) {
                    Alert.alert("Error", e.message || "Failed to submit feedback.");
                  }
                  setSubmittingReview(false);
                }}
              >
                {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "bold" }}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 4 },
  sectionHeader: {
    fontSize: 13, fontWeight: "bold", color: "#888", backgroundColor: "#F9F0DC",
    paddingVertical: 6, paddingHorizontal: 2, textTransform: "uppercase", letterSpacing: 0.6,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E8D8A0",
    elevation: 3,
  },
  cardFinished: { borderLeftWidth: 3, opacity: 0.9, borderColor: "#eeeeee", borderLeftColor: "#ddd" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  customerName: { fontSize: 16, fontWeight: "900", color: "#2E1A06" },
  orderNum: { fontSize: 12, fontWeight: "bold", color: "#888", marginTop: 1 },
  typeChip: { fontSize: 11, color: "#9B59B6", fontWeight: "bold", flex: 1, textTransform: "uppercase" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  totalInline: { fontSize: 16, fontWeight: "900", color: "#F25C05", flexShrink: 0 },
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "center" },
  dateText: { fontSize: 12, fontWeight: "bold", color: "#666", flexShrink: 0 },
  itemsSummary: { fontSize: 13, fontWeight: "600", color: "#444", flex: 1 },
  paymentText: { fontSize: 11, fontWeight: "bold", color: "#888", marginBottom: 6, textTransform: "uppercase" },
  riderInfo: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EBF5FB", borderRadius: 8, padding: 8, marginBottom: 4 },
  riderText: { fontSize: 12, fontWeight: "600", color: "#2E1A06" },
  riderPhone: { fontSize: 11, color: "#3498DB", marginLeft: "auto" },
  rejectBox: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, padding: 6, backgroundColor: "#FFF5F5", borderRadius: 6 },
  rejectText: { fontSize: 11, color: "#E74C3C", flex: 1 },
  trackerWrap: { marginTop: 8, paddingTop: 6 },
  tracker: { flexDirection: "row", alignItems: "center" },
  trackStep: { flexDirection: "row", alignItems: "center", flex: 1 },
  trackDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ddd" },
  trackLine: { flex: 1, height: 2, backgroundColor: "#ddd" },
  trackerLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
  trackerLabel: { fontSize: 8, color: "#aaa", textAlign: "center", flex: 1 },
  archiveBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 6, padding: 4 },
  archiveBtnText: { fontSize: 11, color: "#888" },
  trackLiveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#3498DB", borderRadius: 10, paddingVertical: 10, marginTop: 8 },
  trackLiveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tabPill: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E8D8A0",
  },
  tabPillActive: { backgroundColor: "#F25C05", borderColor: "#F25C05" },
  tabPillText: { fontSize: 13, color: "#888", fontWeight: "600" },
  tabPillTextActive: { color: "#fff", fontWeight: "bold" },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: "#aaa", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#bbb", marginTop: 4 },
  refundBox: {
    flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4,
    padding: 6, backgroundColor: "#FFF8E1", borderRadius: 6,
  },
  refundText: { fontSize: 11, flex: 1 },
  refundBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#F25C05", borderRadius: 10, paddingVertical: 10, marginTop: 8,
  },
  refundBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center",
    zIndex: 999,
  },
  refundModal: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "85%" },
  refundModalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginBottom: 4 },
  refundModalSub: { fontSize: 12, color: "#888", marginBottom: 12 },
  refundModalInput: {
    backgroundColor: "#F9F5EF", borderRadius: 12, padding: 12, fontSize: 14,
    color: "#333", minHeight: 80, textAlignVertical: "top",
  },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#eee" },
  modalConfirmRefund: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#F25C05" },
  feedbackBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#F39C12", borderRadius: 10, paddingVertical: 10, marginTop: 8,
  },
  feedbackBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  feedbackModal: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "85%" },
  feedbackModalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginBottom: 2 },
  feedbackModalSub: { fontSize: 12, color: "#888", marginBottom: 12 },
  starRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 },
  feedbackInput: {
    backgroundColor: "#F9F5EF", borderRadius: 12, padding: 12, fontSize: 14,
    color: "#333", minHeight: 80, textAlignVertical: "top", marginBottom: 12,
  },
  feedbackImageBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#FFF5EE", borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: "#F25C05", borderStyle: "dashed",
  },
  feedbackImageBtnText: { color: "#F25C05", fontWeight: "600", fontSize: 13 },
  feedbackPreviewImage: { width: "100%", height: 160, borderRadius: 12, marginBottom: 8 },
  feedbackSubmitBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#F39C12" },
});
