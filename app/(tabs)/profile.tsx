import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert,
    Modal,
    ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View
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

  // Ask AI state
  const [aiVisible, setAiVisible] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [aiOrder, setAiOrder] = useState<Order | null>(null);
  const [aiDriverLoc, setAiDriverLoc] = useState<LiveLocation | null>(null);
  const aiScrollRef = useRef<ScrollView>(null);
  const aiUnsubRef = useRef<(() => void) | null>(null);

  const STORE_LAT_AI = 14.5995;
  const STORE_LNG_AI = 120.9842;

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

  // Delivery AI functions
  async function handleAskAiOpen() {
    const user = getCurrentUser();
    if (!user) return;
    
    setAiVisible(true);
    setAiThinking(true);
    
    // Find latest out_for_delivery order
    try {
      const orders = await getOrdersByUser(user.uid);
      const activeOrder = orders.find(o => o.status === "out_for_delivery" || o.status === "accepted" || o.status === "preparing");
      
      if (!activeOrder) {
        setAiOrder(null);
        setAiMessages([{ role: "ai", text: "No active delivery found. Your order may still be preparing or already delivered. Check your orders list for details." }]);
        setAiThinking(false);
        return;
      }
      
      setAiOrder(activeOrder);
      setAiMessages([{ role: "ai", text: `Hello! I'm your delivery assistant for order ${activeOrder.order_number}. Ask me about your driver's location, ETA, or anything about your delivery!` }]);
      
      // Subscribe to driver location
      aiUnsubRef.current?.();
      const unsub = onLocationUpdate(activeOrder.id, "staff", (loc) => {
        setAiDriverLoc(loc);
      });
      aiUnsubRef.current = unsub;
    } catch (e) {
      setAiMessages([{ role: "ai", text: "Could not fetch delivery info. Please try again." }]);
    }
    setAiThinking(false);
  }

  function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function generateDeliveryAiResponse(question: string): string {
    if (!aiDriverLoc || !aiOrder) {
      return "I'm waiting for the driver to start sharing their location. Once they begin tracking, I can give you live updates!";
    }
    
    const q = question.toLowerCase();
    const destLat = aiOrder.customer_lat ?? STORE_LAT_AI;
    const destLng = aiOrder.customer_lng ?? STORE_LNG_AI;
    const dist = calcDistance(aiDriverLoc.lat, aiDriverLoc.lng, destLat, destLng);
    const speedKmh = aiDriverLoc.speed && aiDriverLoc.speed > 2 ? aiDriverLoc.speed : 25;
    const mins = Math.round((dist / speedKmh) * 60);
    const distStr = dist < 1 ? `${(dist * 1000).toFixed(0)} meters` : `${dist.toFixed(1)} km`;

    if (q.includes("where") || q.includes("location") || q.includes("driver") || q.includes("rider")) {
      if (dist < 0.3) return `Your driver is almost at your door — less than 300 meters away! Get ready!`;
      if (dist < 1) return `Your driver is very close, only ${distStr} away. Should arrive in ~${mins} minute${mins === 1 ? "" : "s"}!`;
      return `Your driver is currently ${distStr} away, moving at ~${speedKmh} km/h.`;
    }
    if (q.includes("how long") || q.includes("when") || q.includes("eta") || q.includes("arrive") || q.includes("time")) {
      if (mins <= 1) return `Your order should arrive any moment now!`;
      if (mins <= 5) return `Almost there — estimated arrival in about ${mins} minutes!`;
      return `Estimated arrival in ~${mins} minutes based on current speed and distance (${distStr}).`;
    }
    if (q.includes("near") || q.includes("close")) {
      if (dist < 0.5) return `Very close! The driver is only ${distStr} away — ~${mins} min.`;
      if (dist < 2) return `Getting there! Driver is ${distStr} away, ~${mins} minutes to go.`;
      return `The driver is still ${distStr} out. Estimated ~${mins} minutes.`;
    }
    if (q.includes("order") || q.includes("status")) {
      return `Your order ${aiOrder.order_number} is ${aiOrder.status}. Driver is ${distStr} away, ETA ~${mins} min.`;
    }
    if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
      return `Hi! I'm your delivery assistant. Your driver is ${distStr} away with an ETA of ~${mins} minutes. Ask me anything about your delivery!`;
    }
    return `Your driver is currently ${distStr} away at ~${speedKmh} km/h — estimated arrival in ~${mins} minutes.\n\nAsk me: "Where is my driver?", "How long until delivery?", or "Is my order nearby?"`;
  }

  function handleAiQuery(question: string) {
    if (!question.trim() || aiThinking) return;
    const userMsg = question.trim();
    setAiMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setAiInput("");
    setAiThinking(true);
    setTimeout(() => {
      const response = generateDeliveryAiResponse(userMsg);
      setAiMessages(prev => [...prev, { role: "ai", text: response }]);
      setAiThinking(false);
      setTimeout(() => aiScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 700);
  }

  function handleCloseAi() {
    setAiVisible(false);
    aiUnsubRef.current?.();
    aiUnsubRef.current = null;
    setAiDriverLoc(null);
    setAiOrder(null);
    setAiMessages([]);
  }

  useEffect(() => {
    return () => { aiUnsubRef.current?.(); };
  }, []);

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
        resultText = `**${analysis.dishName}**\n\n`;
        if (analysis.isFilipino) {
          resultText += `Filipino Dish\n`;
        } else {
          resultText += `Not a Filipino dish\n`;
        }
        resultText += `\n${analysis.description}\n\n`;
        if (analysis.ingredients && analysis.ingredients.length > 0) {
          resultText += `**Ingredients:** ${analysis.ingredients.join(", ")}\n\n`;
        }
        if (analysis.funFact) {
          resultText += `**Fun Fact:** ${analysis.funFact}\n\n`;
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
          <TouchableOpacity style={styles.exploreRow} onPress={() => router.push("/(tabs)/collections")}>
            <View style={[styles.exploreIcon, { backgroundColor: "#3498DB22" }]}>
              <Ionicons name="navigate" size={20} color="#3498DB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>Live Delivery Tracker</Text>
              <Text style={styles.exploreSub}>Track your order's real-time location</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exploreRow} onPress={handleAskAiOpen}>
            <View style={[styles.exploreIcon, { backgroundColor: "#F25C0522" }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#F25C05" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>Ask AI About Delivery</Text>
              <Text style={styles.exploreSub}>Chat with AI about your driver's location & ETA</Text>
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

        <Text style={styles.version}>Version 2.9.3</Text>

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
              <View style={styles.aiDisclaimer}>
                <Ionicons name="warning-outline" size={13} color="#B07820" />
                <Text style={styles.aiDisclaimerText}>AI results are estimates and may not be 100% accurate. Nutritional values are approximate.</Text>
              </View>
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
                          description: scanResult?.replace(/[*#]/g, "").slice(0, 200) || "",
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

        {/* AI Delivery Chat Modal */}
        <Modal visible={aiVisible} animationType="slide" transparent onRequestClose={handleCloseAi}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={styles.aiModal}>
              {/* Header */}
              <View style={styles.aiHeader}>
                <View style={styles.aiHeaderLeft}>
                  <Ionicons name="chatbubble-ellipses" size={22} color="#F25C05" />
                  <View>
                    <Text style={styles.aiTitle}>AI Delivery Assistant</Text>
                    <Text style={styles.aiSub}>Ask about your driver's location</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleCloseAi}>
                  <Ionicons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Quick question chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiChipsScroll} contentContainerStyle={styles.aiChipsRow}>
                {["Where is my driver?", "How long until delivery?", "Is my order close?"].map((q) => (
                  <TouchableOpacity key={q} style={styles.aiChip} onPress={() => handleAiQuery(q)}>
                    <Text style={styles.aiChipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Messages */}
              <ScrollView ref={aiScrollRef} style={styles.aiMessages} contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false}>
                {aiMessages.length === 0 && (
                  <View style={styles.aiEmpty}>
                    <Ionicons name="navigate-outline" size={36} color="#ddd" />
                    <Text style={styles.aiEmptyText}>Ask me about your driver's location and ETA!</Text>
                  </View>
                )}
                {aiMessages.map((msg, i) => (
                  <View key={i} style={[styles.aiBubble, msg.role === "user" ? styles.aiBubbleUser : styles.aiBubbleAi]}>
                    <Text style={[styles.aiBubbleText, msg.role === "user" ? styles.aiBubbleTextUser : styles.aiBubbleTextAi]}>{msg.text}</Text>
                  </View>
                ))}
                {aiThinking && (
                  <View style={styles.aiBubbleAi}>
                    <ActivityIndicator size="small" color="#F25C05" />
                  </View>
                )}
              </ScrollView>

              {/* Input */}
              <View style={styles.aiInputRow}>
                <TextInput
                  style={styles.aiInput}
                  value={aiInput}
                  onChangeText={setAiInput}
                  placeholder="Ask about your delivery..."
                  placeholderTextColor="#aaa"
                  onSubmitEditing={() => handleAiQuery(aiInput)}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.aiSendBtn, (!aiInput.trim() || aiThinking) && { opacity: 0.4 }]}
                  onPress={() => handleAiQuery(aiInput)}
                  disabled={!aiInput.trim() || aiThinking}>
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
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
  aiDisclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#FFF8E1", borderRadius: 8, padding: 8, marginBottom: 10 },
  aiDisclaimerText: { flex: 1, fontSize: 11, color: "#B07820", lineHeight: 15 },
  // AI Chat styles
  aiModal: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "80%", minHeight: 360,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10,
  },
  aiHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#f0e8d8" },
  aiHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06" },
  aiSub: { fontSize: 11, color: "#aaa" },
  aiChipsScroll: { flexGrow: 0 },
  aiChipsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  aiChip: { backgroundColor: "#FEF3EC", borderWidth: 1, borderColor: "#F25C0540", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  aiChipText: { fontSize: 12, color: "#F25C05", fontWeight: "600" },
  aiMessages: { flex: 1, maxHeight: 260 },
  aiEmpty: { alignItems: "center", marginTop: 30 },
  aiEmptyText: { fontSize: 13, color: "#aaa", marginTop: 8 },
  aiBubble: { padding: 10, borderRadius: 16, marginHorizontal: 4, maxWidth: "85%" },
  aiBubbleUser: { backgroundColor: "#F25C05", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubbleAi: { backgroundColor: "#F5F0E6", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  aiBubbleText: { fontSize: 14, lineHeight: 19 },
  aiBubbleTextUser: { color: "#fff" },
  aiBubbleTextAi: { color: "#2E1A06" },
  aiInputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: "#f0e8d8" },
  aiInput: { flex: 1, borderWidth: 1, borderColor: "#E8D8A0", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#2E1A06" },
  aiSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F25C05", justifyContent: "center", alignItems: "center" },
});
