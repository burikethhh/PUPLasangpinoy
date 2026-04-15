import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAllUsers, logOut, type Profile } from "../../lib/firebase";
import { router } from "expo-router";
import {
  getSettings, updateSettings, getStaffAttendanceSummary,
  getOrders, type AppSettings, type Order,
} from "../../lib/firebase-store";

export default function AdminMoreScreen() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [staff, setStaff] = useState<{ staff_id: string; staff_name: string; present: number; status: string }[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [saving, setSaving] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashEnabled, setGcashEnabled] = useState(false);

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  async function loadAll() {
    setLoading(true);
    try {
      const [s, st, u, o] = await Promise.all([
        getSettings(), getStaffAttendanceSummary(), getAllUsers(), getOrders(),
      ]);
      setSettings(s);
      setDeliveryFee(s.delivery_fee.toString());
      setGcashEnabled(s.gcash_enabled);
      setGcashNumber(s.gcash_number || "");
      setStaff(st);
      setUsers(u);
      setOrders(o);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await updateSettings({
        delivery_fee: parseFloat(deliveryFee) || 50,
        gcash_enabled: gcashEnabled,
        gcash_number: gcashNumber.trim(),
      });
      Alert.alert("Saved", "Settings updated!");
    } catch (e: any) { Alert.alert("Error", e.message); }
    setSaving(false);
  }

  // Sales summary
  const delivered = orders.filter((o) => o.status === "delivered");
  const totalRevenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = delivered.filter((o) => {
    const d = o.created_at?.seconds ? new Date(o.created_at.seconds * 1000) : new Date();
    return d.toISOString().slice(0, 10) === today;
  });
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>More</Text>

        {/* Sales Summary */}
        <Text style={styles.sectionTitle}>Sales Summary</Text>
        <View style={styles.card}>
          <View style={styles.salesRow}>
            <View style={styles.salesItem}>
              <Text style={styles.salesValue}>P{todayRevenue.toFixed(0)}</Text>
              <Text style={styles.salesLabel}>Today</Text>
            </View>
            <View style={styles.salesDiv} />
            <View style={styles.salesItem}>
              <Text style={styles.salesValue}>P{totalRevenue.toFixed(0)}</Text>
              <Text style={styles.salesLabel}>All Time</Text>
            </View>
            <View style={styles.salesDiv} />
            <View style={styles.salesItem}>
              <Text style={styles.salesValue}>{delivered.length}</Text>
              <Text style={styles.salesLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Staff Overview */}
        <Text style={styles.sectionTitle}>Staff ({staff.length})</Text>
        <View style={styles.card}>
          {staff.length === 0 ? (
            <Text style={styles.emptyText}>No staff registered</Text>
          ) : (
            staff.map((s) => (
              <View key={s.staff_id} style={styles.staffRow}>
                <View style={[styles.statusDot, { backgroundColor: s.status === "on_duty" ? "#27AE60" : "#95A5A6" }]} />
                <Text style={styles.staffName}>{s.staff_name}</Text>
                <Text style={styles.staffInfo}>{s.present} days present</Text>
              </View>
            ))
          )}
        </View>

        {/* Users Overview */}
        <Text style={styles.sectionTitle}>Users ({users.length})</Text>
        <View style={styles.card}>
          {users.slice(0, 10).map((u) => (
            <View key={u.id} style={styles.staffRow}>
              <View style={[styles.statusDot, { backgroundColor: u.role === "admin" ? "#F25C05" : u.role === "staff" ? "#3498DB" : "#27AE60" }]} />
              <Text style={styles.staffName}>{u.username || u.email?.split("@")[0]}</Text>
              <Text style={styles.staffInfo}>{u.role}</Text>
            </View>
          ))}
          {users.length > 10 && <Text style={styles.moreText}>+{users.length - 10} more</Text>}
        </View>

        {/* App Settings */}
        <Text style={styles.sectionTitle}>App Settings</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Delivery Fee (PHP)</Text>
          <TextInput style={styles.input} value={deliveryFee} keyboardType="numeric"
            onChangeText={setDeliveryFee} placeholder="50" placeholderTextColor="#aaa" />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>GCash Payment</Text>
            <Switch value={gcashEnabled} onValueChange={setGcashEnabled}
              trackColor={{ false: "#ddd", true: "#F25C05" }} thumbColor="#fff" />
          </View>
          {gcashEnabled && (
            <>
              <Text style={styles.label}>GCash Number</Text>
              <TextInput style={styles.input} value={gcashNumber} keyboardType="phone-pad"
                onChangeText={setGcashNumber} placeholder="09XX XXX XXXX" placeholderTextColor="#aaa" />
            </>
          )}
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveSettings} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> :
              <Text style={styles.saveBtnText}>Save Settings</Text>}
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn}
          onPress={() => Alert.alert("Log Out", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Log Out", style: "destructive", onPress: async () => { await logOut(); router.replace("/(auth)/welcome"); } },
          ])}>
          <Ionicons name="log-out-outline" size={20} color="#D92614" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06", marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  card: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, padding: 16, marginBottom: 4, elevation: 2 },
  salesRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  salesItem: { alignItems: "center" },
  salesValue: { fontSize: 20, fontWeight: "bold", color: "#F25C05" },
  salesLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  salesDiv: { width: 1, height: 36, backgroundColor: "#f0e8d0" },
  staffRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  staffName: { flex: 1, fontSize: 13, color: "#2E1A06", fontWeight: "600" },
  staffInfo: { fontSize: 11, color: "#888" },
  moreText: { textAlign: "center", color: "#F25C05", fontSize: 12, marginTop: 8, fontWeight: "600" },
  emptyText: { textAlign: "center", color: "#aaa", fontSize: 13 },
  label: { fontSize: 12, color: "#888", marginBottom: 4, marginTop: 10, fontWeight: "600" },
  input: { backgroundColor: "#F9F5EF", borderRadius: 10, padding: 12, fontSize: 14, color: "#333" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  toggleLabel: { fontSize: 14, color: "#333" },
  saveBtn: { backgroundColor: "#F25C05", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FFE8E5", marginHorizontal: 16, borderRadius: 14, padding: 16, marginTop: 16,
  },
  logoutText: { color: "#D92614", fontWeight: "bold", fontSize: 15 },
});
