import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OrderStatus } from "../../constants/order";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ORDER_STATUSES } from "../../constants/order";
import { getOrders, updateOrderStatus, type Order } from "../../lib/firebase-store";

const FILTER_OPTIONS: (OrderStatus | "all")[] = ["all", ...ORDER_STATUSES];
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "accepted", accepted: "preparing", preparing: "out_for_delivery", out_for_delivery: "delivered",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useFocusEffect(useCallback(() => { fetchOrders(); }, []));

  async function fetchOrders() {
    setLoading(true);
    try {
      const data = await getOrders(filter === "all" ? undefined : { status: filter });
      setOrders(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }

  async function advanceStatus(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    Alert.alert("Update Status", `Move order ${order.order_number} to "${ORDER_STATUS_LABELS[next]}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm", onPress: async () => {
          await updateOrderStatus(order.id, next);
          fetchOrders();
        },
      },
    ]);
  }

  function promptReject(orderId: string) {
    setRejectId(orderId);
    setRejectReason("");
  }

  async function confirmReject() {
    if (!rejectId) return;
    await updateOrderStatus(rejectId, "rejected", { reject_reason: rejectReason || "Rejected by admin" });
    setRejectId(null);
    fetchOrders();
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Order Management</Text>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {FILTER_OPTIONS.map((f) => {
          const active = filter === f;
          const color = f === "all" ? "#2E1A06" : ORDER_STATUS_COLORS[f];
          return (
            <TouchableOpacity key={f}
              style={[styles.filterChip, active && { backgroundColor: color + "22", borderColor: color }]}
              onPress={() => { setFilter(f); }}>
              <Text style={[styles.filterText, active && { color, fontWeight: "bold" }]}>
                {f === "all" ? "All" : ORDER_STATUS_LABELS[f]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const color = ORDER_STATUS_COLORS[item.status] || "#888";
            const next = NEXT_STATUS[item.status];
            const date = item.created_at?.seconds
              ? new Date(item.created_at.seconds * 1000).toLocaleString()
              : "";
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderNum}>{item.order_number}</Text>
                    <Text style={styles.orderDate}>{date}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: color + "22" }]}>
                    <Text style={[styles.badgeText, { color }]}>{ORDER_STATUS_LABELS[item.status]}</Text>
                  </View>
                </View>
                <Text style={styles.customerName}>{item.customer_name} - {item.customer_phone}</Text>
                {item.customer_address ? (
                  <Text style={styles.address}>{item.customer_address}</Text>
                ) : null}
                <View style={styles.itemsList}>
                  {item.items?.map((it, idx) => (
                    <Text key={idx} style={styles.itemText}>
                      {it.quantity}x {it.name} - P{(it.price * it.quantity).toFixed(2)}
                    </Text>
                  ))}
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>P{item.total?.toFixed(2)}</Text>
                </View>
                {item.payment_method && (
                  <Text style={styles.paymentText}>Payment: {item.payment_method.toUpperCase()}</Text>
                )}
                {item.reject_reason && (
                  <Text style={styles.rejectText}>Rejected: {item.reject_reason}</Text>
                )}
                {/* Action Buttons */}
                {next && (
                  <View style={styles.actions}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ORDER_STATUS_COLORS[next] }]}
                      onPress={() => advanceStatus(item)}>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                      <Text style={styles.actionText}>{ORDER_STATUS_LABELS[next]}</Text>
                    </TouchableOpacity>
                    {item.status === "pending" && (
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#E74C3C" }]}
                        onPress={() => promptReject(item.id)}>
                        <Ionicons name="close" size={16} color="#fff" />
                        <Text style={styles.actionText}>Reject</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#ddd" />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          }
        />
      )}

      {/* Reject Reason Modal */}
      {rejectId && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Reject Order</Text>
            <TextInput style={styles.modalInput} placeholder="Reason (optional)"
              placeholderTextColor="#aaa" value={rejectReason} onChangeText={setRejectReason} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectId(null)}>
                <Text style={{ color: "#888" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmReject}>
                <Text style={{ color: "#fff", fontWeight: "bold" }}>Reject</Text>
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
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 8 },
  filterRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff",
  },
  filterText: { fontSize: 12, color: "#888" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderNum: { fontSize: 16, fontWeight: "bold", color: "#2E1A06" },
  orderDate: { fontSize: 11, color: "#888", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "bold" },
  customerName: { fontSize: 13, color: "#555", marginTop: 8 },
  address: { fontSize: 12, color: "#888", marginTop: 2 },
  itemsList: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#f5f0e5", paddingTop: 8 },
  itemText: { fontSize: 13, color: "#333", marginBottom: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f5f0e5" },
  totalLabel: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  totalValue: { fontSize: 16, fontWeight: "bold", color: "#F25C05" },
  paymentText: { fontSize: 11, color: "#888", marginTop: 4 },
  rejectText: { fontSize: 12, color: "#E74C3C", marginTop: 4, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 10, paddingVertical: 10,
  },
  actionText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: "#aaa", marginTop: 10 },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center",
  },
  modal: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginBottom: 12 },
  modalInput: { backgroundColor: "#F9F5EF", borderRadius: 10, padding: 12, fontSize: 14, color: "#333" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#eee" },
  modalConfirm: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#E74C3C" },
});
