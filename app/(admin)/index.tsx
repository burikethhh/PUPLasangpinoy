import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, ScrollView, StyleSheet, Text,
    TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OrderStatus } from "../../constants/order";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "../../constants/order";
import { logOut } from "../../lib/firebase";
import {
    getAllAttendance,
    getConversations,
    getMenuItems,
    getOrders,
    type Order,
} from "../../lib/firebase-store";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0, pendingOrders: 0, todayRevenue: 0,
    menuItems: 0, unreadMessages: 0, staffOnDuty: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<Record<string, number>>({});

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  async function fetchData() {
    setLoading(true);
    try {
      const [orders, menu, convos, attendance] = await Promise.all([
        getOrders(), getMenuItems(), getConversations(), getAllAttendance(),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const todayOrders = orders.filter((o) => {
        const d = o.created_at?.seconds ? new Date(o.created_at.seconds * 1000) : new Date();
        return d.toISOString().slice(0, 10) === today;
      });
      const todayRevenue = todayOrders
        .filter((o) => o.status === "delivered")
        .reduce((s, o) => s + (o.total || 0), 0);

      const statusCounts: Record<string, number> = {};
      orders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

      const unread = convos.reduce((s, c) => s + (c.unread || 0), 0);
      const onDuty = attendance.filter((a) => a.status === "on_duty").length;

      setStats({
        totalOrders: orders.length,
        pendingOrders: statusCounts["pending"] || 0,
        todayRevenue,
        menuItems: menu.length,
        unreadMessages: unread,
        staffOnDuty: onDuty,
      });
      setOrdersByStatus(statusCounts);
      setRecentOrders(orders.slice(0, 5));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => { await logOut(); router.replace("/(auth)/welcome"); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Owner Dashboard</Text>
            <Text style={styles.headerTitle}>Lasang Pinoy</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#F25C05" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#F25C05" size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              {[
                { label: "Total Orders", value: stats.totalOrders, color: "#F25C05", icon: "receipt" },
                { label: "Pending", value: stats.pendingOrders, color: "#F39C12", icon: "time" },
                { label: "Revenue Today", value: `P${stats.todayRevenue.toFixed(0)}`, color: "#27AE60", icon: "cash" },
                { label: "Menu Items", value: stats.menuItems, color: "#9B59B6", icon: "restaurant" },
              ].map((s) => (
                <View key={s.label} style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + "22" }]}>
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLbl}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Quick Info */}
            <View style={styles.quickRow}>
              <View style={styles.quickCard}>
                <Ionicons name="chatbubbles" size={18} color="#3498DB" />
                <Text style={styles.quickText}>{stats.unreadMessages} unread messages</Text>
              </View>
              <View style={styles.quickCard}>
                <Ionicons name="people" size={18} color="#27AE60" />
                <Text style={styles.quickText}>{stats.staffOnDuty} staff on duty</Text>
              </View>
            </View>

            {/* Orders by Status */}
            <Text style={styles.sectionTitle}>Orders by Status</Text>
            <View style={styles.card}>
              {(["pending", "accepted", "preparing", "out_for_delivery", "delivered", "rejected", "cancelled"] as OrderStatus[]).map((s) => {
                const count = ordersByStatus[s] || 0;
                if (count === 0) return null;
                const color = ORDER_STATUS_COLORS[s];
                return (
                  <View key={s} style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: color }]} />
                    <Text style={styles.statusLabel}>{ORDER_STATUS_LABELS[s]}</Text>
                    <Text style={[styles.statusCount, { color }]}>{count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Recent Orders */}
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <View style={styles.card}>
              {recentOrders.length === 0 ? (
                <Text style={styles.emptyText}>No orders yet.</Text>
              ) : (
                recentOrders.map((o) => {
                  const color = ORDER_STATUS_COLORS[o.status] || "#888";
                  return (
                    <View key={o.id} style={styles.orderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderNum}>{o.order_number}</Text>
                        <Text style={styles.orderCustomer}>{o.customer_name}</Text>
                      </View>
                      <View style={[styles.orderBadge, { backgroundColor: color + "22" }]}>
                        <Text style={[styles.orderBadgeText, { color }]}>{ORDER_STATUS_LABELS[o.status]}</Text>
                      </View>
                      <Text style={styles.orderTotal}>P{o.total?.toFixed(0)}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 16, paddingTop: 8,
  },
  headerSub: { fontSize: 12, color: "#888" },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#2E1A06" },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFE8E5",
    justifyContent: "center", alignItems: "center",
  },
  statsRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, gap: 8 },
  statCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 12, alignItems: "center", elevation: 2,
  },
  statIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 6 },
  statNum: { fontSize: 18, fontWeight: "bold" },
  statLbl: { fontSize: 10, color: "#888", marginTop: 2 },
  quickRow: { flexDirection: "row", marginHorizontal: 16, gap: 10, marginBottom: 12 },
  quickCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 12, padding: 12, elevation: 1,
  },
  quickText: { fontSize: 12, color: "#555" },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06", marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, elevation: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { flex: 1, fontSize: 13, color: "#555" },
  statusCount: { fontSize: 15, fontWeight: "bold" },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  orderNum: { fontSize: 13, fontWeight: "bold", color: "#2E1A06" },
  orderCustomer: { fontSize: 11, color: "#888" },
  orderBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  orderBadgeText: { fontSize: 10, fontWeight: "bold" },
  orderTotal: { fontSize: 14, fontWeight: "bold", color: "#F25C05" },
  emptyText: { textAlign: "center", color: "#aaa", fontSize: 13 },
});