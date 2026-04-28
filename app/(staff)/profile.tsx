import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    ScrollView, StyleSheet, Text,
    TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, getProfile, logOut } from "../../lib/firebase";
import { type LiveLocation, type Order } from "../../lib/firebase-store";

export default function StaffProfileScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // Ask AI state
  const [aiVisible, setAiVisible] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [aiOrder, setAiOrder] = useState<Order | null>(null);
  const [aiCustomerLoc, setAiCustomerLoc] = useState<LiveLocation | null>(null);
  const [aiDriverLoc, setAiDriverLoc] = useState<LiveLocation | null>(null);
  const aiScrollRef = useRef<ScrollView>(null);
  const aiUnsubRef = useRef<(() => void) | null>(null);

  const STORE_LAT = 14.5995;
  const STORE_LNG = 120.9842;

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setEmail(user.email || "");
      getProfile(user.uid).then((p) => {
        if (p) setUsername(p.username);
      });
    }
  }, []);

  // Cleanup AI subscription on unmount
  useEffect(() => {
    return () => { aiUnsubRef.current?.(); };
  }, []);

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logOut();
          router.replace("/(auth)/welcome");
        },
      },
    ]);
  }

  // AI Delivery Assistant functions
  async function handleAskAiOpen() {
    setAiVisible(true);
    setAiThinking(true);
    
    // Find latest out_for_delivery order
    try {
      const orders = await getOrders();
      const activeOrder = orders.find((o: Order) => o.status === "out_for_delivery" || o.status === "accepted" || o.status === "preparing");
      
      if (!activeOrder) {
        setAiOrder(null);
        setAiMessages([{ role: "ai", text: "No active delivery found. Check the staff dashboard for pending orders." }]);
        setAiThinking(false);
        return;
      }
      
      setAiOrder(activeOrder);
      setAiMessages([{ role: "ai", text: `Hello! I'm your delivery assistant for order ${activeOrder.order_number}. Ask me about your customer's location, distance, or anything about this delivery!` }]);
      
      // Subscribe to customer location
      aiUnsubRef.current?.();
      const unsub = onLocationUpdate(activeOrder.id, "customer", (loc: LiveLocation | null) => {
        setAiCustomerLoc(loc);
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

  function generateStaffAiResponse(question: string): string {
    if (!aiCustomerLoc || !aiOrder) {
      return "I'm waiting for the customer to share their location. Once they opt in, I can give you their live position and distance.";
    }
    
    const q = question.toLowerCase();
    const dist = aiDriverLoc 
      ? calcDistance(aiDriverLoc.lat, aiDriverLoc.lng, aiCustomerLoc.lat, aiCustomerLoc.lng)
      : calcDistance(STORE_LAT, STORE_LNG, aiCustomerLoc.lat, aiCustomerLoc.lng);
    const speedKmh = aiDriverLoc?.speed && aiDriverLoc.speed > 2 ? aiDriverLoc.speed : 25;
    const mins = Math.round((dist / speedKmh) * 60);
    const distStr = dist < 1 ? `${(dist * 1000).toFixed(0)} meters` : `${dist.toFixed(1)} km`;
    
    if (q.includes("where") || q.includes("location") || q.includes("customer")) {
      if (dist < 0.3) return `Your customer is very close — less than 300 meters away! Almost there.`;
      if (dist < 1) return `Your customer is ${distStr} away. Just a short drive remaining!`;
      return `Your customer is currently ${distStr} away from your position.`;
    }
    if (q.includes("how long") || q.includes("when") || q.includes("eta") || q.includes("arrive") || q.includes("time") || q.includes("delivery")) {
      if (mins <= 1) return `You'll reach your customer any moment now!`;
      if (mins <= 5) return `About ${mins} minutes until you reach your customer.`;
      return `Estimated arrival at customer location in ~${mins} minutes (${distStr} remaining).`;
    }
    if (q.includes("route") || q.includes("way") || q.includes("direction") || q.includes("go")) {
      return `Head toward your customer's location. They are ${distStr} away.`;
    }
    if (q.includes("near") || q.includes("close") || q.includes("far")) {
      if (dist < 0.5) return `Very close! Only ${distStr} to go.`;
      if (dist < 2) return `Getting closer — ${distStr} remaining.`;
      return `Still ${distStr} to your customer's location.`;
    }
    if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
      return `Hello! Your customer is ${distStr} away. Estimated arrival in ~${mins} minutes. Ask me about their location or best route!`;
    }
    return `Your customer is ${distStr} away — about ${mins} minutes at current speed. Ask me: "Where is my customer?" or "How long to delivery?"`;
  }

  function handleAiQuery(question: string) {
    if (!question.trim() || aiThinking) return;
    const userMsg = question.trim();
    setAiMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setAiInput("");
    setAiThinking(true);
    setTimeout(() => {
      const response = generateStaffAiResponse(userMsg);
      setAiMessages(prev => [...prev, { role: "ai", text: response }]);
      setAiThinking(false);
      setTimeout(() => aiScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 700);
  }

  function handleCloseAi() {
    setAiVisible(false);
    aiUnsubRef.current?.();
    aiUnsubRef.current = null;
    setAiCustomerLoc(null);
    setAiOrder(null);
    setAiMessages([]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#3498DB" />
          </View>
          <Text style={styles.name}>{username}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Staff</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.aiBtn} onPress={handleAskAiOpen}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#F25C05" />
          <Text style={styles.aiBtnText}>Ask AI About Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* AI Chat Modal */}
      <Modal visible={aiVisible} animationType="slide" transparent onRequestClose={handleCloseAi}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={styles.aiModal}>
            {/* Header */}
            <View style={styles.aiHeader}>
              <View style={styles.aiHeaderLeft}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#F25C05" />
                <View>
                  <Text style={styles.aiTitle}>AI Delivery Assistant</Text>
                  <Text style={styles.aiSub}>Ask about your customer's location</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCloseAi}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Quick question chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.aiChipsScroll} contentContainerStyle={styles.aiChipsRow}>
              {["Where is my customer?", "How long to delivery?", "Best route?"].map((q) => (
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
                  <Text style={styles.aiEmptyText}>Ask me about your customer's location and ETA!</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", marginBottom: 16 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center",
    elevation: 2, marginBottom: 16,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#3498DB22",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: "bold", color: "#2E1A06" },
  email: { fontSize: 14, color: "#888", marginTop: 4 },
  roleBadge: {
    backgroundColor: "#3498DB22", paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 12, marginTop: 12,
  },
  roleText: { color: "#3498DB", fontWeight: "bold", fontSize: 13 },
  aiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#F25C05", marginBottom: 16,
  },
  aiBtnText: { color: "#F25C05", fontWeight: "bold", fontSize: 15 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E74C3C",
  },
  logoutText: { color: "#E74C3C", fontWeight: "bold", fontSize: 15 },
  // AI Chat modal styles
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
