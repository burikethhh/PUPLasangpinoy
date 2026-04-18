import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "../../constants/order";
import { getCurrentUser } from "../../lib/firebase";
import { getOrdersByUser, type Order } from "../../lib/firebase-store";

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { fetchOrders(); }, []));

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchOrders(true);
    }, 8000);
    return () => clearInterval(intervalId);
  }, []);

  async function fetchOrders(silent = false) {
    if (!silent) setLoading(true);
    const user = getCurrentUser();
    if (!user) {
      if (!silent) setLoading(false);
      return;
    }
    try {
      setOrders(await getOrdersByUser(user.uid));
    } catch (e) { console.error(e); }
    if (!silent) setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchOrders(true);
    setRefreshing(false);
  }

  function formatDate(ts: any) {
    if (!ts) return "";
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Orders</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const color = ORDER_STATUS_COLORS[item.status] || "#888";
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.orderNum}>{item.order_number}</Text>
                    <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: color + "22" }]}>
                    <Text style={[styles.badgeText, { color }]}>
                      {ORDER_STATUS_LABELS[item.status]}
                    </Text>
                  </View>
                </View>

                <Text style={styles.typeText}>{ORDER_TYPE_LABELS[item.order_type]}</Text>

                {(item.items || []).map((i, idx) => (
                  <Text key={idx} style={styles.itemText}>{i.quantity}x {i.name}</Text>
                ))}

                <View style={styles.bottomRow}>
                  <Text style={styles.paymentText}>{PAYMENT_METHOD_LABELS[item.payment_method]}</Text>
                  <Text style={styles.totalText}>P{item.total?.toFixed(2)}</Text>
                </View>

                {item.reject_reason && (
                  <View style={styles.rejectBox}>
                    <Ionicons name="alert-circle" size={14} color="#E74C3C" />
                    <Text style={styles.rejectText}>Reason: {item.reject_reason}</Text>
                  </View>
                )}

                {/* Order Tracking */}
                {item.status !== "rejected" && item.status !== "cancelled" && (
                  <View style={styles.trackerWrap}>
                    <View style={styles.tracker}>
                      {["pending", "accepted", "preparing", "out_for_delivery", "delivered"].map((s, idx) => {
                        const steps = ["pending", "accepted", "preparing", "out_for_delivery", "delivered"];
                        const currentIdx = steps.indexOf(item.status);
                        const isActive = idx <= currentIdx;
                        return (
                          <View key={s} style={styles.trackStep}>
                            <View style={[styles.trackDot, isActive && { backgroundColor: "#F25C05" }]} />
                            {idx < 4 && <View style={[styles.trackLine, isActive && { backgroundColor: "#F25C05" }]} />}
                          </View>
                        );
                      })}
                    </View>
                    <View style={styles.trackerLabels}>
                      {["Placed", "Accepted", "Preparing", "Delivering", "Done"].map((lbl) => (
                        <Text key={lbl} style={styles.trackerLabel}>{lbl}</Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={64} color="#ddd" />
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySubtext}>Your order history will appear here</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  orderNum: { fontSize: 16, fontWeight: "bold", color: "#2E1A06" },
  dateText: { fontSize: 11, color: "#888", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "bold" },
  typeText: { fontSize: 12, color: "#9B59B6", fontWeight: "600", marginBottom: 8 },
  itemText: { fontSize: 13, color: "#666", marginBottom: 2 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  paymentText: { fontSize: 12, color: "#888" },
  totalText: { fontSize: 16, fontWeight: "bold", color: "#F25C05" },
  rejectBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, padding: 8, backgroundColor: "#FFF5F5", borderRadius: 8 },
  rejectText: { fontSize: 12, color: "#E74C3C" },
  tracker: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 8 },
  trackStep: { flexDirection: "row", alignItems: "center", flex: 1 },
  trackDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ddd" },
  trackLine: { flex: 1, height: 2, backgroundColor: "#ddd" },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: "#aaa", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#bbb", marginTop: 4 },
  trackerWrap: { marginTop: 12, paddingTop: 8 },
  trackerLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  trackerLabel: { fontSize: 9, color: "#aaa", textAlign: "center", flex: 1 },
});
