import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, RefreshControl,
    StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OrderStatus } from "../../constants/order";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from "../../constants/order";
import { getCurrentUser, getProfile } from "../../lib/firebase";
import { getOrders, updateOrderStatus, type Order } from "../../lib/firebase-store";

export default function StaffOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [staffName, setStaffName] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      getProfile(user.uid).then((p) => {
        if (p) setStaffName(p.username);
      });
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchOrders(); }, []));

  async function fetchOrders() {
    setLoading(true);
    try {
      // Staff sees accepted and preparing orders
      const all = await getOrders();
      setOrders(all);
    } catch (e) {
      console.error("Error fetching orders:", e);
    }
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }

  async function handleMarkPrepared(order: Order) {
    Alert.alert("Mark as Prepared", `Mark order ${order.order_number} as prepared?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await updateOrderStatus(order.id, "out_for_delivery", { prepared_by: staffName });
            Alert.alert("Done", "Order marked as prepared and out for delivery!");
            fetchOrders();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const filters: (OrderStatus | "all")[] = ["all", "accepted", "preparing", "out_for_delivery", "delivered"];

  function renderOrder({ item }: { item: Order }) {
    const statusColor = ORDER_STATUS_COLORS[item.status] || "#888";
    const canMarkPrepared = item.status === "accepted" || item.status === "preparing";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.orderNum}>{item.order_number}</Text>
            <Text style={styles.orderType}>{ORDER_TYPE_LABELS[item.order_type] || item.order_type}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {ORDER_STATUS_LABELS[item.status] || item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.customerName}>{item.customer_name}</Text>
        <View style={styles.itemsList}>
          {(item.items || []).map((i, idx) => (
            <Text key={idx} style={styles.itemText}>
              {i.quantity}x {i.name} - P{i.price * i.quantity}
            </Text>
          ))}
        </View>
        <Text style={styles.totalText}>Total: P{item.total?.toFixed(2)}</Text>

        {canMarkPrepared && (
          <TouchableOpacity
            style={styles.preparedBtn}
            onPress={() => handleMarkPrepared(item)}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.preparedBtnText}>Mark as Prepared</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Orders</Text>

      {/* Filter pills */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filters}
        keyExtractor={(i) => i}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "all" ? "All" : ORDER_STATUS_LABELS[f] || f}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#3498DB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 8 },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  filterPill: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd",
  },
  filterPillActive: { backgroundColor: "#3498DB", borderColor: "#3498DB" },
  filterText: { fontSize: 14, color: "#666", fontWeight: "600" },
  filterTextActive: { color: "#fff", fontWeight: "bold" },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  orderNum: { fontSize: 16, fontWeight: "bold", color: "#2E1A06" },
  orderType: { fontSize: 12, color: "#888", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "bold" },
  customerName: { fontSize: 14, color: "#555", marginBottom: 8 },
  itemsList: { marginBottom: 8 },
  itemText: { fontSize: 13, color: "#666", marginBottom: 2 },
  totalText: { fontSize: 15, fontWeight: "bold", color: "#F25C05", marginBottom: 8 },
  preparedBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#27AE60", borderRadius: 12, padding: 12,
  },
  preparedBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#aaa", fontSize: 14, marginTop: 8 },
});
