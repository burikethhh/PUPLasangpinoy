import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    deleteMyAccount,
    getCurrentUser, getProfile as getFirebaseProfile,
    logOut, updateMyProfile, type Profile,
} from "../../lib/firebase";
import { getOrdersByUser, onLocationUpdate, type LiveLocation, type Order } from "../../lib/firebase-store";
import { analyzeImageWithQwen, chatWithLamionAI } from "../../lib/qwen-ai";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editFields, setEditFields] = useState({ username: "", phone: "", address: "" });
  const [scanModal, setScanModal] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanBase64, setScanBase64] = useState<string>("");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Ask AI state (FOFI Delivery)
  const [aiVisible, setAiVisible] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [aiOrder, setAiOrder] = useState<Order | null>(null);
  const [aiDriverLoc, setAiDriverLoc] = useState<LiveLocation | null>(null);
  const aiScrollRef = useRef<ScrollView>(null);
  const aiUnsubRef = useRef<(() => void) | null>(null);

  // Lamion AI state (Filipino Food Expert)
  const [lamionVisible, setLamionVisible] = useState(false);
  const [lamionMessages, setLamionMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Mabuhay! I am Lamion AI, your dedicated Filipino culinary expert. Ask me anything about Filipino foods, traditional cooking techniques, authentic recipes, or regional specialties!" }
  ]);
  const [lamionInput, setLamionInput] = useState("");
  const [lamionThinking, setLamionThinking] = useState(false);
  const lamionScrollRef = useRef<ScrollView>(null);

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
    if (editFields.phone.trim() && !/^09\d{9}$/.test(editFields.phone.replace(/\s/g, ""))) {
      return Alert.alert("Invalid Phone", "Contact number must be exactly 11 digits starting with 09 (e.g. 09XXXXXXXXX).");
    }
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
    } catch {
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

  function toMillis(ts: any): number {
    if (!ts) return 0;
    if (typeof ts?.seconds === "number") return ts.seconds * 1000;
    if (typeof ts === "string") {
      const ms = Date.parse(ts);
      return Number.isNaN(ms) ? 0 : ms;
    }
    const ms = new Date(ts).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }

  function generateDeliveryAiResponse(question: string): string {
    if (!aiDriverLoc || !aiOrder) {
      return "I'm waiting for the driver to start sharing their location. Once they begin tracking, I can give you live updates!";
    }
    
    const q = question.toLowerCase();
    const destLat = aiOrder.customer_lat;
    const destLng = aiOrder.customer_lng;
    if (typeof destLat !== "number" || typeof destLng !== "number") {
      return "I can see your driver location, but your delivery pin is missing. Please update your address location for more accurate ETA.";
    }

    const dist = calcDistance(aiDriverLoc.lat, aiDriverLoc.lng, destLat, destLng);
    const speedKmh = aiDriverLoc.speed && aiDriverLoc.speed > 2 ? aiDriverLoc.speed : 25;
    const mins = Math.round((dist / speedKmh) * 60);
    const distStr = dist < 1 ? `${(dist * 1000).toFixed(0)} meters` : `${dist.toFixed(1)} km`;
    const ageMs = Date.now() - toMillis(aiDriverLoc.updated_at);
    const isStale = ageMs > 5 * 60 * 1000;
    const staleNote = isStale ? `\n\nNote: driver's location update is ${Math.floor(ageMs / 60000)} min old.` : "";

    if (q.includes("where") || q.includes("location") || q.includes("driver") || q.includes("rider")) {
      if (dist < 0.3) return `Your driver is almost at your door — less than 300 meters away! Get ready!${staleNote}`;
      if (dist < 1) return `Your driver is very close, only ${distStr} away. Should arrive in ~${mins} minute${mins === 1 ? "" : "s"}!${staleNote}`;
      return `Your driver is currently ${distStr} away, moving at ~${speedKmh} km/h.${staleNote}`;
    }
    if (q.includes("how long") || q.includes("when") || q.includes("eta") || q.includes("arrive") || q.includes("time")) {
      if (mins <= 1) return `Your order should arrive any moment now!${staleNote}`;
      if (mins <= 5) return `Almost there — estimated arrival in about ${mins} minutes!${staleNote}`;
      return `Estimated arrival in ~${mins} minutes based on current speed and distance (${distStr}).${staleNote}`;
    }
    if (q.includes("near") || q.includes("close")) {
      if (dist < 0.5) return `Very close! The driver is only ${distStr} away — ~${mins} min.${staleNote}`;
      if (dist < 2) return `Getting there! Driver is ${distStr} away, ~${mins} minutes to go.${staleNote}`;
      return `The driver is still ${distStr} out. Estimated ~${mins} minutes.${staleNote}`;
    }
    if (q.includes("order") || q.includes("status")) {
      return `Your order ${aiOrder.order_number} is ${aiOrder.status}. Mode: ${aiOrder.order_type}. Payment: ${aiOrder.payment_method}. Driver is ${distStr} away, ETA ~${mins} min.${staleNote}`;
    }
    if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
      return `Hi! I'm your delivery assistant. Your driver is ${distStr} away with an ETA of ~${mins} minutes. Ask me anything about your delivery!${staleNote}`;
    }
    return `Your driver is currently ${distStr} away at ~${speedKmh} km/h — estimated arrival in ~${mins} minutes.${staleNote}\n\nAsk me: "Where is my driver?", "How long until delivery?", or "Is my order nearby?"`;
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

  async function handleLamionQuery(question: string) {
    if (!question.trim() || lamionThinking) return;
    const userMsg = question.trim();
    setLamionMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLamionInput("");
    setLamionThinking(true);
    setTimeout(() => lamionScrollRef.current?.scrollToEnd({ animated: true }), 60);

    try {
      const history = lamionMessages.map(m => ({
        role: (m.role === "ai" ? "assistant" : "user") as "assistant" | "user",
        content: m.text,
      }));
      const response = await chatWithLamionAI(userMsg, history);
      setLamionMessages(prev => [...prev, { role: "ai", text: response }]);
    } catch (e: any) {
      setLamionMessages(prev => [...prev, { role: "ai", text: "Pasensya na, I encountered an error connecting to Lamion AI. Please try again in a moment." }]);
    } finally {
      setLamionThinking(false);
      setTimeout(() => lamionScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
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

  useEffect(() => {
    if (!aiVisible) return;
    const t = setTimeout(() => aiScrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [aiMessages, aiThinking, aiVisible]);

  useEffect(() => {
    if (!lamionVisible) return;
    const t = setTimeout(() => lamionScrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [lamionMessages, lamionThinking, lamionVisible]);

  async function scanWithCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission", "Camera access is required to use the AI Food Scanner. Please enable it in your device settings.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, base64: true });
    if (result.canceled) return;
    processScanResult(result.assets[0]);
  }

  async function scanWithGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, base64: true });
    if (result.canceled) return;
    processScanResult(result.assets[0]);
  }

  async function processScanResult(asset: ImagePicker.ImagePickerAsset) {
    const uri = asset.uri;
    const base64 = asset.base64 || "";
    setScanImage(uri);
    setScanBase64(base64);
    setScanResult(null);
    setScanModal(true);
    setScanning(true);

    try {
      const analysis = await analyzeImageWithQwen(base64, "dish");
      let resultText = "";
      if (analysis.type === "dish") {
        resultText = `${analysis.dishName}\n\n`;
        if (analysis.isFilipino) {
          resultText += `Filipino Dish\n`;
        } else {
          resultText += `Not a Filipino dish\n`;
        }
        resultText += `\n${analysis.description}\n\n`;
        if (analysis.ingredients && analysis.ingredients.length > 0) {
          resultText += `Ingredients: ${analysis.ingredients.join(", ")}\n\n`;
        }
        if (analysis.funFact) {
          resultText += `Fun Fact: ${analysis.funFact}\n\n`;
        }
        if (analysis.nutrition) {
          resultText += `Nutrition (per serving):\n`;
          resultText += `Calories: ${analysis.nutrition.calories}\n`;
          resultText += `Protein: ${analysis.nutrition.protein}\n`;
          resultText += `Carbs: ${analysis.nutrition.carbs}\n`;
          resultText += `Fat: ${analysis.nutrition.fat}\n`;
          resultText += `Fiber: ${analysis.nutrition.fiber}\n`;
          resultText += `Sodium: ${analysis.nutrition.sodium}\n\n`;
        }
        if (analysis.servingSize) {
          resultText += `Serving Size: ${analysis.servingSize}\n\n`;
        }
        if (analysis.cookingTips) {
          resultText += `Tip: ${analysis.cookingTips}\n\n`;
        }
        resultText += `Browse our menu to find similar dishes!`;
      } else if (analysis.type === "ingredients") {
        resultText = `Ingredients Detected: ${analysis.ingredients?.join(", ") || "None"}\n\n`;
        if (analysis.suggestedRecipes && analysis.suggestedRecipes.length > 0) {
          resultText += `Suggested Filipino Recipes:\n\n`;
          analysis.suggestedRecipes.forEach((recipe: any, idx: number) => {
            resultText += `${idx + 1}. ${recipe.name}\n`;
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
          <TouchableOpacity style={styles.exploreRow} onPress={() => router.push("/(tabs)/menu" as any)}>
            <View style={[styles.exploreIcon, { backgroundColor: "#FF408122" }]}>
              <Ionicons name="heart" size={20} color="#FF4081" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>My Favorites</Text>
              <Text style={styles.exploreSub}>View and manage your favorite dishes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exploreRow} onPress={scanWithCamera}>
            <View style={[styles.exploreIcon, { backgroundColor: "#E91E8C22" }]}>
              <Ionicons name="scan" size={20} color="#E91E8C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>AI Food Scan</Text>
              <Text style={styles.exploreSub}>Take a photo of any dish to identify it</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exploreRow} onPress={() => router.push("/(tabs)/submit-dish" as any)}>
            <View style={[styles.exploreIcon, { backgroundColor: "#F25C0522" }]}>
              <Ionicons name="restaurant" size={20} color="#F25C05" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>Submit a Dish</Text>
              <Text style={styles.exploreSub}>Suggest a dish to Derick Food House</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exploreRow} onPress={() => router.push("/(tabs)/collections")}>
            <View style={[styles.exploreIcon, { backgroundColor: "#3498DB22" }]}>
              <Ionicons name="navigate" size={20} color="#3498DB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>Live Delivery Tracker</Text>
              <Text style={styles.exploreSub}>Track your order&apos;s real-time location</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exploreRow} onPress={() => setLamionVisible(true)}>
            <View style={[styles.exploreIcon, { backgroundColor: "#FF980022" }]}>
              <Ionicons name="sparkles" size={20} color="#FF9800" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>Ask Lamion AI</Text>
              <Text style={styles.exploreSub}>Filipino food expert • Recipes, tips & cuisine guide</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exploreRow, { borderBottomWidth: 0 }]} onPress={handleAskAiOpen}>
            <View style={[styles.exploreIcon, { backgroundColor: "#F25C0522" }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#F25C05" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exploreName}>Ask FOFI About Delivery</Text>
              <Text style={styles.exploreSub}>Chat with FOFI about your driver&apos;s location & ETA</Text>
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

        <Text style={styles.version}>Version {Constants.expoConfig?.version || "4.1.5"}</Text>

        {/* Edit Modal */}
        <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Profile</Text>
                  <TouchableOpacity onPress={() => setEditVisible(false)}>
                    <Ionicons name="close" size={24} color="#888" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <Text style={styles.inputLabel}>Display Name</Text>
                  <TextInput style={styles.input} value={editFields.username}
                    onChangeText={(v) => setEditFields((f) => ({ ...f, username: v }))}
                    placeholder="Your name" placeholderTextColor="#aaa" />
                  <Text style={styles.inputLabel}>Phone</Text>
                  <TextInput style={styles.input} value={editFields.phone}
                    onChangeText={(v) => setEditFields((f) => ({ ...f, phone: v }))}
                    placeholder="09XX XXX XXXX" keyboardType="phone-pad" placeholderTextColor="#aaa"
                    maxLength={11} />
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
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* AI Scan Modal - Redesigned */}
        <Modal visible={scanModal} animationType="slide" transparent onRequestClose={() => { setScanModal(false); setScanImage(null); setScanResult(null); }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={styles.scanModalOuter}>
              <View style={styles.scanHandle} />
              <View style={styles.scanModalHeader}>
                <View>
                  <Text style={styles.scanModalTitle}>AI Food Scanner</Text>
                  <Text style={styles.scanModalSub}>Identify any dish instantly</Text>
                </View>
                <TouchableOpacity style={styles.scanCloseBtn} onPress={() => { setScanModal(false); setScanImage(null); setScanResult(null); }}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              {!scanImage ? (
                <View style={styles.scanEmpty}>
                  <Ionicons name="camera-outline" size={48} color="#ddd" />
                  <Text style={styles.scanEmptyTitle}>Take a photo or upload</Text>
                  <Text style={styles.scanEmptySub}>Snap a picture of your food to analyze it</Text>
                  <View style={styles.scanEmptyRow}>
                    <TouchableOpacity style={styles.scanCameraBtn} onPress={scanWithCamera}>
                      <Ionicons name="camera" size={20} color="#fff" />
                      <Text style={styles.scanBtnLabel}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.scanGalleryBtn} onPress={scanWithGallery}>
                      <Ionicons name="images" size={20} color="#fff" />
                      <Text style={styles.scanBtnLabel}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : scanning ? (
                <View style={styles.scanLoading}>
                  <ActivityIndicator size="large" color="#F25C05" />
                  <Text style={styles.scanLoadingText}>Analyzing your food...</Text>
                  <Text style={styles.scanLoadingSub}>This takes a few seconds</Text>
                </View>
              ) : scanResult ? (
                <View style={styles.scanResultContainer}>
                  <View style={styles.scanImageWrapper}>
                    <Image source={{ uri: scanImage }} style={styles.scanResultImg} contentFit="cover" />
                    <View style={styles.scanImageBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#fff" />
                      <Text style={styles.scanImageBadgeText}>Scanned</Text>
                    </View>
                  </View>
                  <View style={styles.scanResultContent}>
                    <Text style={styles.scanResultTitle}>Analysis Result</Text>
                    <ScrollView style={styles.scanResultScroll} showsVerticalScrollIndicator>
                      <Text style={styles.scanResultText}>{scanResult}</Text>
                    </ScrollView>
                  </View>
                  <View style={styles.scanResultActions}>
                    <TouchableOpacity style={styles.scanRetakeBtn} onPress={() => { setScanImage(null); setScanResult(null); }}>
                      <Ionicons name="camera-outline" size={16} color="#666" />
                      <Text style={styles.scanRetakeText}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.submitSuggestionBtn} onPress={async () => {
                      await AsyncStorage.setItem("@foodfix_scan_result", JSON.stringify({
                        imageUri: scanImage,
                        base64: scanBase64,
                      }));
                      setScanModal(false);
                      setScanImage(null);
                      setScanBase64("");
                      setScanResult(null);
                      router.push("/(tabs)/submit-dish" as any);
                    }}>
                      <Ionicons name="restaurant" size={16} color="#fff" />
                      <Text style={styles.submitSuggestionBtnText}>Suggest Dish</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.scanDisclaimer}>
                    <Ionicons name="information-circle" size={13} color="#B07820" />
                    <Text style={styles.scanDisclaimerText}>AI results are estimates. Nutritional values are approximate.</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Lamion AI Filipino Food Chat Modal */}
        <Modal visible={lamionVisible} animationType="slide" transparent onRequestClose={() => setLamionVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={[styles.aiModal, { maxHeight: "88%" }]}>
              <View style={styles.aiHeader}>
                <View style={styles.aiHeaderLeft}>
                  <Ionicons name="sparkles" size={22} color="#FF9800" />
                  <View>
                    <Text style={styles.aiTitle}>Lamion AI - Filipino Food Expert</Text>
                    <Text style={styles.aiSub}>Customized AI by Research Team • Authentic Filipino Cuisine</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setLamionVisible(false)}>
                  <Ionicons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiChipsScroll} contentContainerStyle={styles.aiChipsRow}>
                {[
                  "How to cook Chicken Adobo?",
                  "What makes Sinigang sour?",
                  "Origin of Pork Sisig",
                  "Crispy Lechon Kawali tips",
                  "Substitute for Calamansi?",
                  "Popular Filipino street foods",
                ].map((q) => (
                  <TouchableOpacity key={q} style={[styles.aiChip, { borderColor: "#FF980040", backgroundColor: "#FFF8E1" }]} onPress={() => handleLamionQuery(q)}>
                    <Text style={[styles.aiChipText, { color: "#E67E22" }]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView ref={lamionScrollRef} style={styles.aiMessages} contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false}>
                {lamionMessages.map((msg, i) => (
                  <View key={i} style={[styles.aiBubble, msg.role === "user" ? styles.aiBubbleUser : styles.aiBubbleAi]}>
                    <Text style={[styles.aiBubbleText, msg.role === "user" ? styles.aiBubbleTextUser : styles.aiBubbleTextAi]}>{msg.text}</Text>
                  </View>
                ))}
                {lamionThinking && (
                  <View style={styles.aiBubbleAi}>
                    <ActivityIndicator size="small" color="#FF9800" />
                  </View>
                )}
              </ScrollView>

              <View style={styles.aiInputRow}>
                <TextInput
                  style={styles.aiInput}
                  value={lamionInput}
                  onChangeText={setLamionInput}
                  placeholder="Ask about Filipino foods, recipes, tips..."
                  placeholderTextColor="#aaa"
                  onSubmitEditing={() => handleLamionQuery(lamionInput)}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.aiSendBtn, { backgroundColor: "#FF9800" }, (!lamionInput.trim() || lamionThinking) && { opacity: 0.4 }]}
                  onPress={() => handleLamionQuery(lamionInput)}
                  disabled={!lamionInput.trim() || lamionThinking}>
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* AI Delivery Chat Modal */}
        <Modal visible={aiVisible} animationType="slide" transparent onRequestClose={handleCloseAi}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={styles.aiModal}>
              <View style={styles.aiHeader}>
                <View style={styles.aiHeaderLeft}>
                  <Ionicons name="chatbubble-ellipses" size={22} color="#F25C05" />
                  <View>
                    <Text style={styles.aiTitle}>FOFI - Delivery Assistant</Text>
                    <Text style={styles.aiSub}>Ask about your driver&apos;s location</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleCloseAi}>
                  <Ionicons name="close" size={22} color="#888" />
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiChipsScroll} contentContainerStyle={styles.aiChipsRow}>
                {["Where is my driver?", "How long until delivery?", "Is my order close?", "Order status update"].map((q) => (
                  <TouchableOpacity key={q} style={styles.aiChip} onPress={() => handleAiQuery(q)}>
                    <Text style={styles.aiChipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView ref={aiScrollRef} style={styles.aiMessages} contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false}>
                {aiMessages.length === 0 && (
                  <View style={styles.aiEmpty}>
                    <Ionicons name="navigate-outline" size={36} color="#ddd" />
                    <Text style={styles.aiEmptyText}>Ask me about your driver&apos;s location and ETA!</Text>
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
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", padding: 12, paddingBottom: 8 },
  profileCard: {
    backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 12, marginBottom: 10,
    padding: 16, alignItems: "center", elevation: 2,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 16, marginHorizontal: 12, marginBottom: 10,
    padding: 12, elevation: 2,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: "#F25C05",
    justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 26 },
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
  // AI Scan styles
  scanModalOuter: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  scanHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  scanModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8d8",
  },
  scanModalTitle: { fontSize: 18, fontWeight: "800", color: "#2E1A06" },
  scanModalSub: { fontSize: 12, color: "#999", marginTop: 2 },
  scanCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F0E8", justifyContent: "center", alignItems: "center" },
  scanEmpty: { alignItems: "center", padding: 40, paddingBottom: 32 },
  scanEmptyTitle: { fontSize: 17, fontWeight: "700", color: "#2E1A06", marginTop: 16, marginBottom: 6 },
  scanEmptySub: { fontSize: 13, color: "#999", marginBottom: 24, textAlign: "center" },
  scanEmptyRow: { flexDirection: "row", gap: 12 },
  scanCameraBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F25C05", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
  },
  scanGalleryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#3498DB", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
  },
  scanBtnLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },
  scanLoading: { alignItems: "center", padding: 48 },
  scanLoadingText: { fontSize: 16, fontWeight: "600", color: "#2E1A06", marginTop: 16 },
  scanLoadingSub: { fontSize: 12, color: "#999", marginTop: 4 },
  scanResultContainer: { paddingHorizontal: 16 },
  scanImageWrapper: { position: "relative", marginBottom: 12 },
  scanResultImg: { width: "100%", height: 180, borderRadius: 14 },
  scanImageBadge: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(52, 179, 106, 0.9)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  scanImageBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  scanResultContent: { marginBottom: 12 },
  scanResultTitle: { fontSize: 14, fontWeight: "700", color: "#2E1A06", marginBottom: 8 },
  scanResultScroll: { maxHeight: 200 },
  scanResultText: { fontSize: 13, color: "#444", lineHeight: 20 },
  scanResultActions: { flexDirection: "row", gap: 10, marginBottom: 10 },
  scanRetakeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    flex: 1, backgroundColor: "#F5F0E8", borderRadius: 12, padding: 12,
  },
  scanRetakeText: { color: "#666", fontWeight: "600", fontSize: 13 },
  submitSuggestionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    flex: 2, backgroundColor: "#F25C05", borderRadius: 12, padding: 12,
  },
  submitSuggestionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  scanDisclaimer: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#FFF8E1", borderRadius: 10, padding: 10, marginBottom: 8,
  },
  scanDisclaimerText: { flex: 1, fontSize: 11, color: "#B07820", lineHeight: 15 },
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
