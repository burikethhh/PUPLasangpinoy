import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, ScrollView, StyleSheet, Switch,
    Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    createStaffAccount,
    deleteUser,
    getAllUsers,
    getCurrentUser,
    logOut,
    updateUserByAdmin,
    type Profile
} from "../../lib/firebase";
import {
    getOrders,
    getSettings,
    updateSettings,
    type Order,
} from "../../lib/firebase-store";

export default function AdminMoreScreen() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [saving, setSaving] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashEnabled, setGcashEnabled] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    username: "",
    phone: "",
    address: "",
    role: "customer" as Profile["role"],
  });

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  async function loadAll() {
    setLoading(true);
    try {
      const [s, u, o] = await Promise.all([
        getSettings(), getAllUsers(), getOrders(),
      ]);
      setDeliveryFee(s.delivery_fee.toString());
      setGcashEnabled(s.gcash_enabled);
      setGcashNumber(s.gcash_number || "");
      const staffUsers = u.filter((x) => x.role === "staff");
      setStaff(staffUsers);
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

  // Order summary
  const delivered = orders.filter((o) => o.status === "delivered");
  const pending = orders.filter((o) => o.status === "pending");
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => {
    const d = o.created_at?.seconds ? new Date(o.created_at.seconds * 1000) : new Date();
    return d.toISOString().slice(0, 10) === today;
  });

  async function handleCreateStaff() {
    if (!staffForm.name.trim() || !staffForm.email.trim() || !staffForm.password.trim()) {
      Alert.alert("Error", "Name, email and password are required."); return;
    }
    if (!/\S+@\S+\.\S+/.test(staffForm.email.trim())) {
      Alert.alert("Error", "Please enter a valid email address."); return;
    }
    if (staffForm.password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters."); return;
    }
    setCreatingStaff(true);
    try {
      await createStaffAccount(staffForm.email.trim(), staffForm.password, staffForm.name.trim(), staffForm.phone.trim());
      Alert.alert(
        "Success",
        `Staff account created for ${staffForm.name.trim()}!\n\nPlease log in again as admin to continue.`,
        [{ text: "OK", onPress: () => router.replace("/(auth)/admin-login") }],
      );
      setStaffModal(false);
      setStaffForm({ name: "", email: "", password: "", phone: "" });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setCreatingStaff(false);
  }

  function openEditUser(user: Profile) {
    setEditingUser(user);
    setUserForm({
      username: user.username || "",
      phone: user.phone || "",
      address: user.address || "",
      role: user.role || "customer",
    });
    setUserModal(true);
  }

  async function handleSaveUser() {
    if (!editingUser) return;
    if (!userForm.username.trim()) {
      Alert.alert("Error", "Name is required.");
      return;
    }

    setSavingUser(true);
    try {
      await updateUserByAdmin(editingUser.id, {
        username: userForm.username.trim(),
        phone: userForm.phone.trim(),
        address: userForm.address.trim(),
        role: userForm.role,
        is_admin: userForm.role === "admin",
      });
      Alert.alert("Saved", "User updated successfully.");
      setUserModal(false);
      setEditingUser(null);
      await loadAll();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update user.");
    }
    setSavingUser(false);
  }

  function handleDeleteUser(user: Profile) {
    const current = getCurrentUser();
    if (current?.uid === user.id) {
      Alert.alert("Not allowed", "You cannot delete your currently logged-in admin account.");
      return;
    }

    Alert.alert(
      "Delete Account",
      `Delete ${user.username || user.email}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUser(user.id);
              await loadAll();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to delete user.");
            }
          },
        },
      ],
    );
  }

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

        {/* Order Summary */}
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.card}>
          <View style={styles.salesRow}>
            <View style={styles.salesItem}>
              <Text style={styles.salesValue}>{todayOrders.length}</Text>
              <Text style={styles.salesLabel}>Today</Text>
            </View>
            <View style={styles.salesDiv} />
            <View style={styles.salesItem}>
              <Text style={styles.salesValue}>{orders.length}</Text>
              <Text style={styles.salesLabel}>Total</Text>
            </View>
            <View style={styles.salesDiv} />
            <View style={styles.salesItem}>
              <Text style={styles.salesValue}>{pending.length}</Text>
              <Text style={styles.salesLabel}>Pending</Text>
            </View>
            <View style={styles.salesDiv} />
            <View style={styles.salesItem}>
              <Text style={styles.salesValue}>{delivered.length}</Text>
              <Text style={styles.salesLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Staff Overview */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>Staff ({staff.length})</Text>
          <TouchableOpacity style={styles.addStaffBtn} onPress={() => setStaffModal(true)}>
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={styles.addStaffText}>Add Staff</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {staff.length === 0 ? (
            <Text style={styles.emptyText}>No staff registered</Text>
          ) : (
            staff.map((s) => (
              <View key={s.id} style={styles.staffRow}>
                <View style={[styles.statusDot, { backgroundColor: "#3498DB" }]} />
                <Text style={styles.staffName}>{s.username || s.email?.split("@")[0]}</Text>
                <Text style={styles.staffInfo}>{s.phone || "staff"}</Text>
              </View>
            ))
          )}
        </View>

        {/* Role Previews */}
        <Text style={styles.sectionTitle}>Role Previews</Text>
        <View style={styles.previewRow}>
          <TouchableOpacity
            style={[styles.previewCard, { borderTopColor: "#F25C05" }]}
            onPress={() => router.push("/(tabs)" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.previewIcon, { backgroundColor: "#F25C0518" }]}>
              <Ionicons name="person" size={22} color="#F25C05" />
            </View>
            <Text style={[styles.previewTitle, { color: "#F25C05" }]}>Customer</Text>
            <Text style={styles.previewSub}>{"Browse menu, cart\n& orders"}</Text>
            <View style={[styles.previewBadge, { backgroundColor: "#F25C0518" }]}>
              <Text style={[styles.previewBadgeText, { color: "#F25C05" }]}>Preview</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.previewCard, { borderTopColor: "#3498DB" }]}
            onPress={() => router.push("/(staff)" as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.previewIcon, { backgroundColor: "#3498DB18" }]}>
              <Ionicons name="construct" size={22} color="#3498DB" />
            </View>
            <Text style={[styles.previewTitle, { color: "#3498DB" }]}>Staff</Text>
            <Text style={styles.previewSub}>{"Order queue\n& fulfillment"}</Text>
            <View style={[styles.previewBadge, { backgroundColor: "#3498DB18" }]}>
              <Text style={[styles.previewBadgeText, { color: "#3498DB" }]}>Preview</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Quick Access</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.quickRow, { borderBottomWidth: 0 }]}
            onPress={() => router.push("/(admin)/submissions" as any)}
          >
            <View style={[styles.quickIcon, { backgroundColor: "#F39C1222" }]}>
              <Ionicons name="bulb" size={18} color="#F39C12" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickTitle}>Review Dish Suggestions</Text>
              <Text style={styles.quickSub}>Approve or reject customer suggested dishes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#bbb" />
          </TouchableOpacity>
        </View>

        {/* Users Management */}
        <Text style={styles.sectionTitle}>Users ({users.length})</Text>
        <View style={styles.card}>
          {users.length === 0 ? (
            <Text style={styles.emptyText}>No users found</Text>
          ) : (
            users.map((u) => (
              <View key={u.id} style={styles.userRow}>
                <View style={[styles.statusDot, { backgroundColor: u.role === "admin" ? "#F25C05" : u.role === "staff" ? "#3498DB" : "#27AE60" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{u.username || u.email?.split("@")[0]}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
                <View style={styles.userMeta}>
                  <Text style={styles.staffInfo}>{u.role}</Text>
                  <View style={styles.userActions}>
                    <TouchableOpacity style={styles.iconActionBtn} onPress={() => openEditUser(u)}>
                      <Ionicons name="create-outline" size={16} color="#3498DB" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconActionBtn} onPress={() => handleDeleteUser(u)}>
                      <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
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

      {/* Create Staff Modal */}
      {staffModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Staff Account</Text>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} value={staffForm.name}
              onChangeText={(v) => setStaffForm((f) => ({ ...f, name: v }))}
              placeholder="Staff name" placeholderTextColor="#aaa" />
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} value={staffForm.email}
              onChangeText={(v) => setStaffForm((f) => ({ ...f, email: v }))}
              placeholder="staff@email.com" placeholderTextColor="#aaa" keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} value={staffForm.password}
              onChangeText={(v) => setStaffForm((f) => ({ ...f, password: v }))}
              placeholder="Min 6 characters" placeholderTextColor="#aaa" secureTextEntry />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={staffForm.phone}
              onChangeText={(v) => setStaffForm((f) => ({ ...f, phone: v }))}
              placeholder="09XX XXX XXXX" placeholderTextColor="#aaa" keyboardType="phone-pad" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setStaffModal(false)}>
                <Text style={{ color: "#888", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, creatingStaff && { opacity: 0.6 }]}
                onPress={handleCreateStaff} disabled={creatingStaff}>
                {creatingStaff ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.saveBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Edit User Modal */}
      {userModal && editingUser && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit User</Text>
            <Text style={styles.label}>Display Name *</Text>
            <TextInput
              style={styles.input}
              value={userForm.username}
              onChangeText={(v) => setUserForm((f) => ({ ...f, username: v }))}
              placeholder="User name"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={userForm.phone}
              onChangeText={(v) => setUserForm((f) => ({ ...f, phone: v }))}
              placeholder="09XX XXX XXXX"
              placeholderTextColor="#aaa"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={userForm.address}
              onChangeText={(v) => setUserForm((f) => ({ ...f, address: v }))}
              placeholder="Address"
              placeholderTextColor="#aaa"
              multiline
            />

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {(["customer", "staff", "admin"] as Profile["role"][]).map((role) => {
                const active = userForm.role === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleBtn, active && styles.roleBtnActive]}
                    onPress={() => setUserForm((f) => ({ ...f, role }))}
                  >
                    <Text style={[styles.roleBtnText, active && styles.roleBtnTextActive]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setUserModal(false)}>
                <Text style={{ color: "#888", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, savingUser && { opacity: 0.6 }]}
                onPress={handleSaveUser} disabled={savingUser}>
                {savingUser ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
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
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#2E1A06", marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, padding: 16, marginBottom: 12, elevation: 2 },
  salesRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  salesItem: { alignItems: "center" },
  salesValue: { fontSize: 20, fontWeight: "bold", color: "#F25C05" },
  salesLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  salesDiv: { width: 1, height: 36, backgroundColor: "#f0e8d0" },
  staffRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  staffName: { flex: 1, fontSize: 13, color: "#2E1A06", fontWeight: "600" },
  staffInfo: { fontSize: 11, color: "#888" },
  userEmail: { fontSize: 11, color: "#999", marginTop: 2 },
  userMeta: { alignItems: "flex-end", gap: 4 },
  userActions: { flexDirection: "row", gap: 6 },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F9F5EF",
    justifyContent: "center",
    alignItems: "center",
  },
  quickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f0e5",
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  quickTitle: { fontSize: 13, fontWeight: "700", color: "#2E1A06" },
  quickSub: { fontSize: 11, color: "#888", marginTop: 2 },
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
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  previewRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 4, gap: 12 },
  previewCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14,
    alignItems: "center", elevation: 2, borderTopWidth: 3,
  },
  previewIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  previewTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  previewSub: { fontSize: 11, color: "#888", textAlign: "center", lineHeight: 16, marginBottom: 10 },
  previewBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  previewBadgeText: { fontSize: 11, fontWeight: "bold" },
  addStaffBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#3498DB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addStaffText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "85%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginBottom: 4 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center", backgroundColor: "#eee" },
  roleRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  roleBtnActive: { borderColor: "#F25C05", backgroundColor: "#FEF3EC" },
  roleBtnText: { fontSize: 12, color: "#888", fontWeight: "600" },
  roleBtnTextActive: { color: "#F25C05", fontWeight: "700" },
});
