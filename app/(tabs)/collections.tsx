import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator, Alert, RefreshControl, SectionList,
    StyleSheet, Text, TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "../../constants/order";
import { getCurrentUser } from "../../lib/firebase";
import { getOrdersByUser, type Order } from "../../lib/firebase-store";

const FINISHED_STATUSES = ["delivered", "rejected", "cancelled"];

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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
  const active = visible.filter((o) => !FINISHED_STATUSES.includes(o.status));
  const finished = visible.filter((o) => FINISHED_STATUSES.includes(o.status));

  const sections = showArchived
    ? (archivedOrders.length > 0 ? [{ title: `Archived (${archivedOrders.length})`, data: archivedOrders }] : [])
    : [
        ...(active.length > 0 ? [{ title: "Active Orders", data: active }] : []),
        ...(finished.length > 0 ? [{ title: "Order History", data: finished }] : []),
      ];

  function renderOrder({ item }: { item: Order }) {
    const color = ORDER_STATUS_COLORS[item.status] || "#888";
    const isFinished = FINISHED_STATUSES.includes(item.status);
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

        {item.reject_reason && (
          <View style={styles.rejectBox}>
            <Ionicons name="alert-circle" size={12} color="#E74C3C" />
            <Text style={styles.rejectText}>{item.reject_reason}</Text>
          </View>
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

        {/* Archive / Unarchive button */}
        {isFinished && !showArchived && (
          <TouchableOpacity style={styles.archiveBtn} onPress={() => handleArchive(item.id)}>
            <Ionicons name="archive-outline" size={14} color="#888" />
            <Text style={styles.archiveBtnText}>Archive</Text>
          </TouchableOpacity>
        )}
        {showArchived && (
          <TouchableOpacity style={styles.archiveBtn} onPress={() => handleUnarchive(item.id)}>
            <Ionicons name="arrow-undo-outline" size={14} color="#F25C05" />
            <Text style={[styles.archiveBtnText, { color: "#F25C05" }]}>Unarchive</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Orders</Text>

      {/* Tab pills */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, !showArchived && styles.tabPillActive]}
          onPress={() => setShowArchived(false)}>
          <Text style={[styles.tabPillText, !showArchived && styles.tabPillTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, showArchived && styles.tabPillActive]}
          onPress={() => setShowArchived(true)}>
          <Text style={[styles.tabPillText, showArchived && styles.tabPillTextActive]}>Archived ({archived.size})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : sections.length === 0 ? (
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
        />
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
    backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8,
    elevation: 2, borderLeftWidth: 3, borderLeftColor: "#F25C05",
  },
  cardFinished: { borderLeftColor: "#ddd", opacity: 0.9 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  customerName: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  orderNum: { fontSize: 11, color: "#888", marginTop: 1 },
  typeChip: { fontSize: 10, color: "#9B59B6", fontWeight: "600", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: "bold" },
  totalInline: { fontSize: 14, fontWeight: "bold", color: "#F25C05", flexShrink: 0 },
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 2, alignItems: "center" },
  dateText: { fontSize: 10, color: "#aaa", flexShrink: 0 },
  itemsSummary: { fontSize: 11, color: "#666", flex: 1 },
  paymentText: { fontSize: 10, color: "#aaa", marginBottom: 4 },
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
});
