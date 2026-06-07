import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator, Alert, ScrollView, StyleSheet, Text,
    TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OrderStatus } from "../../constants/order";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "../../constants/order";
import { db, logOut, RestApi, shouldUseRest } from "../../lib/firebase";
import {
    cleanupArchivedMessages,
    cleanupArchivedOrders,
    getConversations,
    getMenuItems,
    getOrders,
    markGcashPaid,
    processRefund,
    type Order,
} from "../../lib/firebase-store";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0, pendingOrders: 0, todayOrders: 0,
    menuItems: 0, unreadMessages: 0,
  });
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<Order[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<Record<string, number>>({});
  const [gcashPayments, setGcashPayments] = useState<any[]>([]);
  const [refundRequests, setRefundRequests] = useState<Order[]>([]);

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData(true);
    }, 8000);
    return () => clearInterval(intervalId);
  }, []);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    try {
      // Run 30-day auto-cleanup in background (non-blocking)
      if (!silent) {
        cleanupArchivedMessages().catch(() => {});
        cleanupArchivedOrders().catch(() => {});
      }

      const [orders, menu, convos] = await Promise.all([
        getOrders(), getMenuItems(), getConversations(),
      ]);

      // Fetch GCash notifications
      try {
        let notifs: any[] = [];
        if (shouldUseRest()) {
          const data = await RestApi.queryCollection("notifications", "type", "==", "gcash_payment");
          notifs = (data as any[]).filter((n: any) => n.paid === false || n.paid === undefined);
        } else {
          try {
            const q = query(collection(db, "notifications"), where("type", "==", "gcash_payment"));
            const snap = await getDocs(q);
            notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((n: any) => n.paid === false || n.paid === undefined);
          } catch {
            const data = await RestApi.queryCollection("notifications", "type", "==", "gcash_payment");
            notifs = (data as any[]).filter((n: any) => n.paid === false || n.paid === undefined);
          }
        }
        setGcashPayments(notifs);
      } catch { setGcashPayments([]); }

      const today = new Date().toISOString().slice(0, 10);
      const todayOrderCount = orders.filter((o) => {
        const d = o.created_at?.seconds ? new Date(o.created_at.seconds * 1000) : new Date();
        return d.toISOString().slice(0, 10) === today;
      }).length;

      const statusCounts: Record<string, number> = {};
      orders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

      const unread = convos.reduce((s, c) => s + (c.unread || 0), 0);

      setStats({
        totalOrders: orders.length,
        pendingOrders: statusCounts["pending"] || 0,
        todayOrders: todayOrderCount,
        menuItems: menu.length,
        unreadMessages: unread,
      });
      setOrdersByStatus(statusCounts);
      setRefundRequests(orders.filter((o) => o.refund_status === "pending"));
      const ACTIVE = ["pending", "accepted", "preparing", "out_for_delivery"];
      setActiveOrders(orders.filter((o) => ACTIVE.includes(o.status)).slice(0, 8));
      setFinishedOrders(orders.filter((o) => !["pending", "accepted", "preparing", "out_for_delivery"].includes(o.status)).slice(0, 5));
    } catch (e) { console.error(e); }
    if (!silent) setLoading(false);
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
            <Text style={styles.headerTitle}>FOODFIX</Text>
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
                { label: "Total Orders", value: stats.totalOrders, color: "#F25C05", icon: "receipt", route: "/(admin)/recipes" },
                { label: "Pending", value: stats.pendingOrders, color: "#F39C12", icon: "time", route: "/(admin)/recipes" },
                { label: "Today", value: stats.todayOrders, color: "#27AE60", icon: "today", route: "/(admin)/recipes" },
                { label: "Menu Items", value: stats.menuItems, color: "#9B59B6", icon: "restaurant", route: "/(admin)/categories" },
              ].map((s) => (
                <TouchableOpacity key={s.label} style={styles.statCard} activeOpacity={0.7}
                  onPress={() => router.push(s.route as any)}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + "22" }]}>
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLbl}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick Info */}
            <View style={styles.quickGrid}>
              <View style={styles.quickGridRow}>
                <TouchableOpacity style={styles.quickCard} activeOpacity={0.7}
                  onPress={() => router.push("/(admin)/feedback" as any)}>
                  <Ionicons name="chatbubbles" size={18} color="#3498DB" />
                  <Text style={styles.quickText}>{stats.unreadMessages} unread messages</Text>
                  <Ionicons name="chevron-forward" size={16} color="#bbb" />
                </TouchableOpacity>
              {gcashPayments.length > 0 && (
                <View style={[styles.quickCard, { flexDirection: "column", alignItems: "stretch", borderColor: "#F25C05", borderWidth: 1 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="phone-portrait-outline" size={18} color="#F25C05" />
                    <Text style={[styles.quickText, { flex: 1, fontWeight: "bold", color: "#F25C05" }]}>GCash: {gcashPayments.length} pending</Text>
                  </View>
                  {gcashPayments.slice(0, 3).map((n: any) => (
                    <View key={n.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f0e8d0" }}>
                      <Text style={{ flex: 1, fontSize: 11, color: "#555" }} numberOfLines={1}>
                        {n.customer_name} — P{n.amount?.toFixed(0)}
                      </Text>
                      <TouchableOpacity
                        style={{ backgroundColor: "#27AE60", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}
                        onPress={async () => {
                          try {
                            await markGcashPaid(n.id);
                            fetchData(true);
                          } catch (e) { console.error(e); }
                        }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>Paid</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              </View>
              <View style={styles.quickGridRow}>
                <TouchableOpacity style={styles.quickCard} activeOpacity={0.7}
                  onPress={() => router.push("/(admin)/banners" as any)}>
                  <Ionicons name="images" size={18} color="#9B59B6" />
                  <Text style={styles.quickText}>Manage Banners</Text>
                  <Ionicons name="chevron-forward" size={16} color="#bbb" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickCard} activeOpacity={0.7}
                  onPress={() => router.push("/(admin)/reviews" as any)}>
                  <Ionicons name="star" size={18} color="#FFD700" />
                  <Text style={styles.quickText}>Customer Reviews</Text>
                  <Ionicons name="chevron-forward" size={16} color="#bbb" />
                </TouchableOpacity>
              </View>
              {refundRequests.length > 0 && (
                <View style={[styles.quickCard, { flexDirection: "column", alignItems: "stretch", borderColor: "#E74C3C", borderWidth: 1, marginTop: 10 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="refresh-circle" size={18} color="#E74C3C" />
                    <Text style={[styles.quickText, { flex: 1, fontWeight: "bold", color: "#E74C3C" }]}>Refund: {refundRequests.length} pending</Text>
                  </View>
                  {refundRequests.slice(0, 3).map((o) => (
                    <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f0e8d0" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: "#555" }} numberOfLines={1}>
                          {o.order_number} — {o.customer_name} — P{o.total?.toFixed(0)}
                        </Text>
                        <Text style={{ fontSize: 10, color: "#888", fontStyle: "italic" }} numberOfLines={1}>
                          {o.refund_reason}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{ backgroundColor: "#27AE60", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}
                        onPress={async () => {
                          Alert.alert("Approve Refund", `Approve refund for order ${o.order_number}?`, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Approve", onPress: async () => { await processRefund(o.id, "approved"); fetchData(true); } },
                          ]);
                        }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ backgroundColor: "#E74C3C", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}
                        onPress={async () => {
                          Alert.alert("Reject Refund", `Reject refund for order ${o.order_number}?`, [
                            { text: "Cancel", style: "cancel" },
                            { text: "Reject", onPress: async () => { await processRefund(o.id, "rejected"); fetchData(true); } },
                          ]);
                        }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
            {/* Orders by Status */}
            <TouchableOpacity onPress={() => router.push("/(admin)/recipes" as any)} activeOpacity={0.7}>
              <Text style={styles.sectionTitle}>Orders by Status <Ionicons name="chevron-forward" size={13} color="#888" /></Text>
            </TouchableOpacity>
            <View style={styles.card}>
              {(["pending", "accepted", "preparing", "out_for_delivery", "delivered", "unable_to_fulfill", "cancelled"] as OrderStatus[]).map((s) => {
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

            {/* Active / In-progress Orders */}
            <TouchableOpacity onPress={() => router.push("/(admin)/recipes" as any)} activeOpacity={0.7}>
              <Text style={styles.sectionTitle}>Active Orders <Ionicons name="chevron-forward" size={13} color="#888" /></Text>
            </TouchableOpacity>
            <View style={styles.card}>
              {activeOrders.length === 0 ? (
                <Text style={styles.emptyText}>No active orders.</Text>
              ) : (
                activeOrders.map((o: Order) => {
                  const color = ORDER_STATUS_COLORS[o.status as keyof typeof ORDER_STATUS_COLORS] || "#888";
                  return (
                    <View key={o.id} style={styles.orderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderNum}>{o.order_number}</Text>
                        <Text style={styles.orderCustomer}>{o.customer_name}</Text>
                      </View>
                      <View style={[styles.orderBadge, { backgroundColor: color + "22" }]}>
                        <Text style={[styles.orderBadgeText, { color }]}>{ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS]}</Text>
                      </View>
                      <Text style={styles.orderTotal}>P{o.total?.toFixed(0)}</Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Finished Orders */}
            {finishedOrders.length > 0 && (
              <>
                <TouchableOpacity onPress={() => router.push("/(admin)/recipes" as any)} activeOpacity={0.7}>
                  <Text style={styles.sectionTitle}>Completed / Cancelled <Ionicons name="chevron-forward" size={13} color="#888" /></Text>
                </TouchableOpacity>
                <View style={[styles.card, { opacity: 0.85 }]}>
                  {finishedOrders.map((o: Order) => {
                    const color = ORDER_STATUS_COLORS[o.status as keyof typeof ORDER_STATUS_COLORS] || "#888";
                    return (
                      <View key={o.id} style={styles.orderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.orderNum}>{o.order_number}</Text>
                          <Text style={styles.orderCustomer}>{o.customer_name}</Text>
                        </View>
                        <View style={[styles.orderBadge, { backgroundColor: color + "22" }]}>
                          <Text style={[styles.orderBadgeText, { color }]}>{ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS]}</Text>
                        </View>
                        <Text style={styles.orderTotal}>P{o.total?.toFixed(0)}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
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
  statNum: { fontSize: 20, fontWeight: "bold" },
  statLbl: { fontSize: 12, color: "#888", marginTop: 2 },
  quickGrid: { marginHorizontal: 16, marginBottom: 12, gap: 10 },
  quickGridRow: { flexDirection: "row", gap: 10 },
  quickCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 12, padding: 12, elevation: 1,
  },
  quickText: { fontSize: 12, color: "#555", flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06", marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 12, padding: 16, elevation: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { flex: 1, fontSize: 13, color: "#555" },
  statusCount: { fontSize: 15, fontWeight: "bold" },
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  orderNum: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  orderCustomer: { fontSize: 12, color: "#888" },
  orderBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  orderBadgeText: { fontSize: 11, fontWeight: "bold" },
  orderTotal: { fontSize: 14, fontWeight: "bold", color: "#F25C05" },
  emptyText: { textAlign: "center", color: "#aaa", fontSize: 13 },
  gcashBadge: {
    backgroundColor: "#F25C05", borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 6,
  },
  gcashBadgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
});