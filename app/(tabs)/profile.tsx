import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MENU_CATEGORIES } from "../../constants/order";
import {
    deleteMyAccount, getCurrentUser, getProfile as getFirebaseProfile,
    logOut, updateMyProfile, type Profile,
} from "../../lib/firebase";
import { getMenuItems, type MenuItem } from "../../lib/firebase-store";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editFields, setEditFields] = useState({ username: "", phone: "", address: "" });
  const [scanModal, setScanModal] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [ingredientsModal, setIngredientsModal] = useState(false);
  const [ingredientItems, setIngredientItems] = useState<MenuItem[]>([]);
  const [ingredientLoading, setIngredientLoading] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [submitForm, setSubmitForm] = useState({ name: "", description: "", category: MENU_CATEGORIES[0] as string });

  useFocusEffect(useCallback(() => { loadProfile(); }, []));

  async function loadProfile() {
    const user = getCurrentUser();
    if (!user) return;
    const p = await getFirebaseProfile(user.uid);
    if (p) {
      setProfile(p);
      setEditFields({ username: p.username, phone: p.phone || "", address: p.address || "" });
    }
  }

  function openEdit() {
    if (profile) setEditFields({ username: profile.username, phone: profile.phone || "", address: profile.address || "" });
    setEditVisible(true);
  }

  async function saveProfile() {
    if (!editFields.username.trim()) return Alert.alert("Error", "Name cannot be empty.");
    try {
      await updateMyProfile({
        username: editFields.username.trim(),
        phone: editFields.phone.trim(),
        address: editFields.address.trim(),
      });
      await loadProfile();
      setEditVisible(false);
      Alert.alert("Success", "Profile updated!");
    } catch (e: any) { Alert.alert("Error", e.message); }
  }

  function handleLogout() {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => { await logOut(); router.replace("/(auth)/welcome"); } },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert("Delete Account", "This will permanently delete your account and all data. Cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete Forever", style: "destructive",
        onPress: async () => {
          try { await deleteMyAccount(); router.replace("/(auth)/welcome"); }
          catch (e: any) {
            if (e.code === "auth/requires-recent-login")
              Alert.alert("Re-auth Required", "Log out and log back in, then try again.");
            else Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  }

  async function handleScanFood() {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setScanImage(uri);
    setScanResult(null);
    setScanModal(true);
    setScanning(true);
    // Simulate AI scan (placeholder — hook to real AI API if available)
    setTimeout(() => {
      setScanResult("This looks like a delicious Filipino dish! Try browsing our menu to find something similar.");
      setScanning(false);
    }, 2000);
  }

  async function openIngredients() {
    setIngredientsModal(true);
    setIngredientLoading(true);
    try {
      const items = await getMenuItems();
      setIngredientItems(items);
    } catch (e) { console.error(e); }
    setIngredientLoading(false);
  }

  function handleSubmitMenu() {
    setSubmitForm({ name: "", description: "", category: MENU_CATEGORIES[0] as string });
    setSubmitModal(true);
  }

  function submitMenuSuggestion() {
    if (!submitForm.name.trim()) return Alert.alert("Error", "Please enter a dish name.");
    Alert.alert("Submitted!", `Thank you for suggesting "${submitForm.name}"! Our team will review it.`);
    setSubmitModal(false);
  }

  const user = getCurrentUser();
  const initial = (profile?.username || "C").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Profile</Text>

        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile?.username || "Customer"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Customer</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <Ionicons name="pencil" size={14} color="#fff" />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Info</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color="#F25C05" />
            <Text style={styles.infoText}>{profile?.phone || "Not set"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#F25C05" />
            <Text style={styles.infoText}>{profile?.address || "Not set"}</Text>
          </View>
        </View>

        {/* Explore / Engagement */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Explore</Text>
          <TouchableOpacity style={styles.exploreRow} onPress={handleScanFood}>
            <View style={[styles.exploreIcon, { backgroundColor: "#E91E8C22" }]}>
              <Ionicons name="scan" size={20} color="#E91E8C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>AI Food Scan</Text>
              <Text style={styles.exploreSub}>Take a photo of any dish to identify it</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exploreRow} onPress={openIngredients}>
            <View style={[styles.exploreIcon, { backgroundColor: "#27AE6022" }]}>
              <Ionicons name="leaf" size={20} color="#27AE60" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>Ingredients</Text>
              <Text style={styles.exploreSub}>Browse ingredients used in our dishes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exploreRow, { borderBottomWidth: 0 }]} onPress={handleSubmitMenu}>
            <View style={[styles.exploreIcon, { backgroundColor: "#F39C1222" }]}>
              <Ionicons name="add-circle" size={20} color="#F39C12" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>Suggest a Dish</Text>
              <Text style={styles.exploreSub}>Submit a menu item idea to the store</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#D92614" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Ionicons name="warning-outline" size={18} color="#D92614" />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 2.0.0</Text>

        {/* Edit Modal */}
        <Modal visible={editVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setEditVisible(false)}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Display Name</Text>
              <TextInput style={styles.input} value={editFields.username}
                onChangeText={(v) => setEditFields((f) => ({ ...f, username: v }))}
                placeholder="Your name" placeholderTextColor="#aaa" />
              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput style={styles.input} value={editFields.phone}
                onChangeText={(v) => setEditFields((f) => ({ ...f, phone: v }))}
                placeholder="09XX XXX XXXX" keyboardType="phone-pad" placeholderTextColor="#aaa" />
              <Text style={styles.inputLabel}>Delivery Address</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={editFields.address}
                onChangeText={(v) => setEditFields((f) => ({ ...f, address: v }))}
                placeholder="Full address" multiline placeholderTextColor="#aaa" />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}>
                  <Text style={{ color: "#888", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* AI Scan Modal */}
        <Modal visible={scanModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>AI Food Scan</Text>
                <TouchableOpacity onPress={() => { setScanModal(false); setScanImage(null); setScanResult(null); }}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              {scanImage && <Image source={{ uri: scanImage }} style={styles.scanImg} contentFit="cover" />}
              {scanning ? (
                <View style={{ alignItems: "center", padding: 20 }}>
                  <ActivityIndicator size="large" color="#F25C05" />
                  <Text style={{ color: "#888", marginTop: 10 }}>Analyzing image...</Text>
                </View>
              ) : scanResult ? (
                <Text style={styles.scanResultText}>{scanResult}</Text>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Ingredients Modal */}
        <Modal visible={ingredientsModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: "80%" }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ingredients</Text>
                <TouchableOpacity onPress={() => setIngredientsModal(false)}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              {ingredientLoading ? (
                <ActivityIndicator size="large" color="#F25C05" style={{ marginVertical: 30 }} />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {ingredientItems.map((item) => (
                    <View key={item.id} style={styles.ingredientCard}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.ingredientImg} contentFit="cover" />
                      ) : (
                        <View style={[styles.ingredientImgPlaceholder, { backgroundColor: "#F25C0522" }]}>
                          <Text style={{ fontSize: 18 }}>🍽️</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "bold", color: "#2E1A06" }}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: "#888" }}>{item.category}</Text>
                        {item.description ? <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }} numberOfLines={2}>{item.description}</Text> : null}
                      </View>
                    </View>
                  ))}
                  {ingredientItems.length === 0 && <Text style={{ color: "#aaa", textAlign: "center", marginVertical: 20 }}>No menu items found.</Text>}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Submit Menu Modal */}
        <Modal visible={submitModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Suggest a Dish</Text>
                <TouchableOpacity onPress={() => setSubmitModal(false)}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Dish Name *</Text>
              <TextInput style={styles.input} value={submitForm.name}
                onChangeText={(v) => setSubmitForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. Chicken Adobo" placeholderTextColor="#aaa" />
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.chipRow}>
                {MENU_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c}
                    style={[styles.chip, submitForm.category === c && styles.chipActive]}
                    onPress={() => setSubmitForm((f) => ({ ...f, category: c }))}>
                    <Text style={[styles.chipText, submitForm.category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Description / Notes</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={submitForm.description}
                onChangeText={(v) => setSubmitForm((f) => ({ ...f, description: v }))}
                placeholder="What makes this dish special?" multiline placeholderTextColor="#aaa" />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSubmitModal(false)}>
                  <Text style={{ color: "#888", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={submitMenuSuggestion}>
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", padding: 16, paddingBottom: 8 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, marginHorizontal: 16, marginBottom: 14,
    padding: 20, alignItems: "center", elevation: 2,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#F25C05",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 30 },
  name: { fontSize: 20, fontWeight: "bold", color: "#2E1A06", marginBottom: 4 },
  email: { fontSize: 13, color: "#888", marginBottom: 6 },
  roleBadge: { backgroundColor: "#F25C0522", paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  roleText: { color: "#F25C05", fontWeight: "bold", fontSize: 12 },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F25C05",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  editBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06", alignSelf: "flex-start", marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  infoText: { fontSize: 14, color: "#555", flex: 1 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FFE8E5", marginHorizontal: 16, borderRadius: 14, padding: 16,
  },
  logoutText: { color: "#D92614", fontWeight: "bold", fontSize: 15 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FFE8E5", marginHorizontal: 16, borderRadius: 14, padding: 14, marginTop: 8,
  },
  deleteText: { color: "#D92614", fontWeight: "600", fontSize: 13 },
  version: { fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06" },
  inputLabel: { fontSize: 12, color: "#888", marginBottom: 4, marginTop: 10, fontWeight: "600" },
  input: { backgroundColor: "#F9F5EF", borderRadius: 10, padding: 12, fontSize: 14, color: "#333" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: "#eee" },
  saveBtn: { flex: 1, backgroundColor: "#F25C05", borderRadius: 12, padding: 14, alignItems: "center" },
  exploreRow: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  exploreIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  exploreName: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  exploreSub: { fontSize: 11, color: "#888", marginTop: 2 },
  scanImg: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12 },
  scanResultText: { fontSize: 14, color: "#333", lineHeight: 20 },
  ingredientCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  ingredientImg: { width: 44, height: 44, borderRadius: 10 },
  ingredientImgPlaceholder: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
  chipActive: { borderColor: "#F25C05", backgroundColor: "#FEF3EC" },
  chipText: { fontSize: 12, color: "#888" },
  chipTextActive: { color: "#F25C05", fontWeight: "bold" },
});
