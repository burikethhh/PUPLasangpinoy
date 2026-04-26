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
    deleteMyAccount,
    getCategories as getCategoriesDoc,
    getCurrentUser, getProfile as getFirebaseProfile,
    logOut, updateMyProfile, type Category, type Profile,
} from "../../lib/firebase";
import { analyzeImageWithQwen } from "../../lib/qwen-ai";

const FIRESTORE_DATABASE_ID =
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || "default";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editFields, setEditFields] = useState({ username: "", phone: "", address: "" });
  const [scanModal, setScanModal] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedDishName, setScannedDishName] = useState("");
  const [submitModal, setSubmitModal] = useState(false);
  const [suggestionCategories, setSuggestionCategories] = useState<string[]>([...MENU_CATEGORIES]);
  const [submitForm, setSubmitForm] = useState({ name: "", description: "", category: MENU_CATEGORIES[0] as string });
  const [mySuggestions, setMySuggestions] = useState<{ id: string; name: string; category: string; description: string; status: string; created_at: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useFocusEffect(useCallback(() => { loadProfile(); loadMySuggestions(); }, []));

  async function loadProfile() {
    const user = getCurrentUser();
    if (!user) return;
    const [p, categoryDocs] = await Promise.all([
      getFirebaseProfile(user.uid),
      getCategoriesDoc().catch(() => []),
    ]);

    if (p) {
      setProfile(p);
      setEditFields({ username: p.username, phone: p.phone || "", address: p.address || "" });
    }

    const categoryNames = Array.from(
      new Set([
        ...MENU_CATEGORIES,
        ...(categoryDocs as Category[]).map((c) => c.name).filter(Boolean),
      ]),
    );
    if (categoryNames.length > 0) {
      setSuggestionCategories(categoryNames);
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
    // Request camera permission explicitly
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission", "Camera access is required to use the AI Food Scanner. Please enable it in your device settings.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, base64: true });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    const base64 = result.assets[0].base64 || "";
    setScanImage(uri);
    setScanResult(null);
    setScannedDishName("");
    setScanModal(true);
    setScanning(true);

    try {
      // Call AI API to analyze the image
      const analysis = await analyzeImageWithQwen(base64, "dish");

      // Format the result for display
      let resultText = "";
      if (analysis.type === "dish") {
        setScannedDishName(analysis.dishName || "");
        resultText = `🍽️ **${analysis.dishName}**\n\n`;
        if (analysis.isFilipino) {
          resultText += `✅ Filipino Dish\n`;
        } else {
          resultText += `❌ Not a Filipino dish\n`;
        }
        resultText += `\n${analysis.description}\n\n`;
        if (analysis.ingredients && analysis.ingredients.length > 0) {
          resultText += `**Ingredients:** ${analysis.ingredients.join(", ")}\n\n`;
        }
        if (analysis.funFact) {
          resultText += `💡 **Fun Fact:** ${analysis.funFact}\n\n`;
        }
        if (analysis.nutrition) {
          resultText += `**Nutrition (per serving):**\n`;
          resultText += `• Calories: ${analysis.nutrition.calories}\n`;
          resultText += `• Protein: ${analysis.nutrition.protein}\n`;
          resultText += `• Carbs: ${analysis.nutrition.carbs}\n`;
          resultText += `• Fat: ${analysis.nutrition.fat}\n`;
          resultText += `• Fiber: ${analysis.nutrition.fiber}\n`;
          resultText += `• Sodium: ${analysis.nutrition.sodium}\n\n`;
        }
        if (analysis.servingSize) {
          resultText += `**Serving Size:** ${analysis.servingSize}\n\n`;
        }
        if (analysis.cookingTips) {
          resultText += `**Tip:** ${analysis.cookingTips}\n\n`;
        }
        resultText += `Browse our menu to find similar dishes!`;
      } else if (analysis.type === "ingredients") {
        resultText = `🥗 **Ingredients Detected:** ${analysis.ingredients?.join(", ") || "None"}\n\n`;
        if (analysis.suggestedRecipes && analysis.suggestedRecipes.length > 0) {
          resultText += `**Suggested Filipino Recipes:**\n\n`;
          analysis.suggestedRecipes.forEach((recipe: any, idx: number) => {
            resultText += `${idx + 1}. **${recipe.name}**\n`;
            resultText += `   ${recipe.description}\n`;
            if (recipe.mainIngredients) {
              resultText += `   Key: ${recipe.mainIngredients.join(", ")}\n`;
            }
            resultText += "\n";
          });
        }
      } else {
        resultText = "Unable to identify the food. Please try again with a clearer image.";
      }

      setScanResult(resultText);
    } catch (error: any) {
      console.error("AI Scan error:", error);
      setScanResult("AI scan failed: " + (error.message || "Unknown error"));
    } finally {
      setScanning(false);
    }
  }

  function handleSubmitMenu() {
    setSubmitForm({
      name: "",
      description: "",
      category: suggestionCategories[0] || (MENU_CATEGORIES[0] as string),
    });
    setSubmitModal(true);
  }

  async function loadMySuggestions() {
    const user = getCurrentUser();
    if (!user) return;
    setLoadingSuggestions(true);
    try {
      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      if (!projectId) return;
      const token = await user.getIdToken();
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "menu_suggestions" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "user_id" },
                  op: "EQUAL",
                  value: { stringValue: user.uid },
                },
              },
              orderBy: [{ field: { fieldPath: "created_at" }, direction: "DESCENDING" }],
            },
          }),
        }
      );
      const rows = await res.json();
      const parsed = (Array.isArray(rows) ? rows : [])
        .filter((r: any) => r.document)
        .map((r: any) => ({
          id: r.document.name.split("/").pop(),
          name: r.document.fields?.name?.stringValue || "",
          category: r.document.fields?.category?.stringValue || "",
          description: r.document.fields?.description?.stringValue || "",
          status: r.document.fields?.status?.stringValue || "pending",
          created_at: r.document.fields?.created_at?.timestampValue || "",
        }));
      setMySuggestions(parsed);
    } catch (e) { console.error("loadMySuggestions", e); }
    setLoadingSuggestions(false);
  }

  async function submitMenuSuggestion() {
    if (!submitForm.name.trim()) return Alert.alert("Error", "Please enter a dish name.");
    try {
      const user = getCurrentUser();
      if (!user) return Alert.alert("Error", "You must be logged in to submit suggestions.");
      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
      if (!projectId) throw new Error("Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID");
      const token = await user.getIdToken();

      // Save to Firestore menu_suggestions collection
      const suggestionData = {
        name: submitForm.name.trim(),
        description: submitForm.description.trim(),
        category: submitForm.category,
        user_id: user.uid,
        user_email: user.email || "",
        user_name: profile?.username || "Anonymous",
        status: "pending",
        created_at: new Date(),
      };

      // Use REST API to create the suggestion
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${FIRESTORE_DATABASE_ID}/documents/menu_suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fields: {
            name: { stringValue: suggestionData.name },
            description: { stringValue: suggestionData.description },
            category: { stringValue: suggestionData.category },
            user_id: { stringValue: suggestionData.user_id },
            user_email: { stringValue: suggestionData.user_email },
            user_name: { stringValue: suggestionData.user_name },
            status: { stringValue: suggestionData.status },
            created_at: { timestampValue: new Date().toISOString() },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to submit suggestion (${response.status}): ${errorText}`,
        );
      }

      Alert.alert("Submitted!", `Thank you for suggesting "${submitForm.name}"! Our team will review it.`);
      setSubmitModal(false);
      setSubmitForm({
        name: "",
        description: "",
        category: suggestionCategories[0] || (MENU_CATEGORIES[0] as string),
      });
      loadMySuggestions();
    } catch (error: any) {
      console.error("Submit menu suggestion error:", error);
      Alert.alert("Error", "Failed to submit suggestion. Please try again.");
    }
  }

  const user = getCurrentUser();
  const initial = (profile?.username || "C").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Profile</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
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
            <Ionicons name="call-outline" size={16} color="#F25C05" />
            <Text style={styles.infoText}>{profile?.phone || "Not set"}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="location-outline" size={16} color="#F25C05" />
            <Text style={styles.infoText}>{profile?.address || "Not set"}</Text>
          </View>
        </View>

        {/* Explore / Engagement */}
        <View style={styles.card} >
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

        {/* My Submissions */}
        <View style={styles.card}>
          <View style={styles.suggestionHeader}>
            <Text style={styles.sectionTitle}>My Submissions</Text>
            <TouchableOpacity onPress={handleSubmitMenu} style={styles.newSuggestionBtn}>
              <Ionicons name="add" size={14} color="#F39C12" />
              <Text style={styles.newSuggestionText}>New</Text>
            </TouchableOpacity>
          </View>
          {loadingSuggestions ? (
            <ActivityIndicator size="small" color="#F39C12" style={{ marginVertical: 12 }} />
          ) : mySuggestions.length === 0 ? (
            <View style={styles.suggestionEmpty}>
              <Ionicons name="bulb-outline" size={32} color="#ddd" />
              <Text style={styles.suggestionEmptyText}>No submissions yet</Text>
              <Text style={styles.suggestionEmptySub}>Tap "New" to suggest a dish!</Text>
            </View>
          ) : (
            mySuggestions.map((s, idx) => {
              const statusColor = s.status === "approved" ? "#27AE60" : s.status === "rejected" ? "#E74C3C" : "#F39C12";
              const statusLabel = s.status === "approved" ? "Approved" : s.status === "rejected" ? "Rejected" : "Pending";
              const isLast = idx === mySuggestions.length - 1;
              return (
                <View key={s.id} style={[styles.suggestionRow, isLast && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.suggestionCategory}>{s.category}</Text>
                    {s.description ? (
                      <Text style={styles.suggestionDesc} numberOfLines={2}>{s.description}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.suggestionBadge, { backgroundColor: statusColor + "18" }]}>
                    <Text style={[styles.suggestionBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>
              );
            })
          )}
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

        <Text style={styles.version}>Version 2.7.0</Text>

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
                <>
                  <ScrollView style={styles.scanResultScroll} showsVerticalScrollIndicator>
                    <Text style={styles.scanResultText}>{scanResult}</Text>
                  </ScrollView>
                  {scannedDishName ? (
                    <TouchableOpacity
                      style={styles.suggestDishBtn}
                      onPress={() => {
                        setScanModal(false);
                        setSubmitForm({
                          name: scannedDishName,
                          description: scanResult?.replace(/[*#🍽️✅❌💡]/g, "").slice(0, 200) || "",
                          category: suggestionCategories[0] || (MENU_CATEGORIES[0] as string),
                        });
                        setSubmitModal(true);
                      }}>
                      <Ionicons name="bulb" size={16} color="#fff" />
                      <Text style={styles.suggestDishBtnText}>Suggest This Dish</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chipRow}>
                {suggestionCategories.map((c) => (
                  <TouchableOpacity key={c}
                    style={[styles.chip, submitForm.category === c && styles.chipActive]}
                    onPress={() => setSubmitForm((f) => ({ ...f, category: c }))}>
                    <Text style={[styles.chipText, submitForm.category === c && styles.chipTextActive]} numberOfLines={1}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
  profileCard: {
    backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 12,
    padding: 20, alignItems: "center", elevation: 2,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 16, marginBottom: 12,
    padding: 14, elevation: 2,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "#F25C05",
    justifyContent: "center", alignItems: "center", marginBottom: 10,
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
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#2E1A06", marginBottom: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  infoText: { fontSize: 13, color: "#555", flex: 1 },
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
  exploreRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f5f0e5" },
  exploreIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  exploreName: { fontSize: 13, fontWeight: "bold", color: "#2E1A06" },
  exploreSub: { fontSize: 11, color: "#888", marginTop: 2 },
  scanImg: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12 },
  scanResultScroll: { maxHeight: 280 },
  scanResultText: { fontSize: 14, color: "#333", lineHeight: 20 },
  chipRow: { gap: 8, marginBottom: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff" },
  chipActive: { borderColor: "#F25C05", backgroundColor: "#FEF3EC" },
  chipText: { fontSize: 12, color: "#888" },
  chipTextActive: { color: "#F25C05", fontWeight: "bold" },
  suggestionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  newSuggestionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F39C1218", borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  newSuggestionText: { fontSize: 12, color: "#F39C12", fontWeight: "700" },
  suggestionEmpty: { alignItems: "center", paddingVertical: 18 },
  suggestionEmptyText: { fontSize: 13, color: "#bbb", fontWeight: "600", marginTop: 8 },
  suggestionEmptySub: { fontSize: 11, color: "#ccc", marginTop: 3 },
  suggestionRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f5f0e5",
  },
  suggestionName: { fontSize: 13, fontWeight: "bold", color: "#2E1A06" },
  suggestionCategory: { fontSize: 11, color: "#F25C05", fontWeight: "600", marginTop: 2 },
  suggestionDesc: { fontSize: 11, color: "#888", marginTop: 3, lineHeight: 15 },
  suggestionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start", marginTop: 2 },
  suggestionBadgeText: { fontSize: 11, fontWeight: "bold" },
  suggestDishBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#F39C12", borderRadius: 12, paddingVertical: 12, marginTop: 10,
  },
  suggestDishBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
