import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal,
    Platform, ScrollView, StyleSheet,
    Text,
    TextInput,
    TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { getCurrentUser } from "../lib/firebase";
import {
    getOrders, getOrdersByUser, onLocationUpdate, setLocationOptIn, updateOrderStatus, upsertLocation,
    type LiveLocation, type Order
} from "../lib/firebase-store";
import { startDeliveryTracking, stopDeliveryTracking } from "../lib/location-task";
import { notifyBothOptedIn } from "../lib/notifications";

const STORE_LAT = 14.5995;
const STORE_LNG = 120.9842;

export default function TrackDeliveryScreen() {
  const { orderId, role } = useLocalSearchParams<{ orderId: string; role: "customer" | "staff" }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [driverLoc, setDriverLoc] = useState<LiveLocation | null>(null);
  const [myOptIn, setMyOptIn] = useState(false);
  const [otherOptIn, setOtherOptIn] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [customerLoc, setCustomerLoc] = useState<LiveLocation | null>(null);
  const webViewRef = useRef<WebView>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  const isCustomer = role === "customer";
  const user = getCurrentUser();

  // Load order
  useEffect(() => {
    if (!orderId || !user) return;
    (async () => {
      const rawOrders = isCustomer
        ? await getOrdersByUser(user.uid).catch(() => [] as Order[])
        : await getOrders().catch(() => [] as Order[]);
      const found = rawOrders.find((o: Order) => o.id === orderId);
      setOrder(found ?? null);
      if (found) {
        setMyOptIn(isCustomer ? (found.customer_location_opt_in ?? false) : (found.staff_location_opt_in ?? false));
        setOtherOptIn(isCustomer ? (found.staff_location_opt_in ?? false) : (found.customer_location_opt_in ?? false));
      }
      setLoading(false);
    })();
  }, [orderId, user, isCustomer]);

  // Subscribe to driver location (customer watches staff)
  useEffect(() => {
    if (!orderId || !myOptIn || !otherOptIn) return;
    const unsub = onLocationUpdate(orderId, "staff", (loc) => {
      setDriverLoc(loc);
      if (loc && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type: "driverUpdate", lat: loc.lat, lng: loc.lng }));
      }
    });
    unsubRef.current = unsub;
    return () => unsub?.();
  }, [orderId, myOptIn, otherOptIn]);

  // Staff subscribes to customer location
  useEffect(() => {
    if (!orderId || isCustomer || !myOptIn) return;
    const unsub = onLocationUpdate(orderId, "customer", (loc) => {
      setCustomerLoc(loc);
      if (loc && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type: "customerUpdate", lat: loc.lat, lng: loc.lng }));
      }
    });
    return () => unsub?.();
  }, [orderId, isCustomer, myOptIn]);

  // Customer shares their foreground location when both opted in
  useEffect(() => {
    if (!isCustomer || !(myOptIn && otherOptIn) || !orderId || !user) return;
    let interval: ReturnType<typeof setInterval>;
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const push = async () => {
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }).catch(() => null);
        if (loc) {
          await upsertLocation(orderId, user.uid, "customer", {
            lat: loc.coords.latitude, lng: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
          }).catch(() => {});
        }
      };
      await push();
      interval = setInterval(push, 20000);
    })();
    return () => clearInterval(interval);
  }, [isCustomer, myOptIn, otherOptIn, orderId, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { unsubRef.current?.(); };
  }, []);

  async function handleOptIn() {
    if (!orderId || !user) return;
    const field = isCustomer ? "customer_location_opt_in" : "staff_location_opt_in";
    await setLocationOptIn(orderId, field, true);
    setMyOptIn(true);
    // Check if both opted in now
    if (otherOptIn) {
      await setLocationOptIn(orderId, "location_sharing_enabled", true);
      notifyBothOptedIn();
    }
  }

  async function handleStartDelivery() {
    if (!orderId) return;
    const started = await startDeliveryTracking(orderId);
    if (started) {
      setTracking(true);
      // Also push own current location immediately
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        await upsertLocation(orderId, user!.uid, "staff", {
          lat: loc.coords.latitude, lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? undefined,
        });
      }
    } else {
      Alert.alert("Permission Required", "Background location permission is needed to track delivery.");
    }
  }

  async function handleStopDelivery() {
    await stopDeliveryTracking();
    setTracking(false);
  }

  async function handleMarkDelivered() {
    if (!orderId) return;
    Alert.alert("Confirm Delivery", "Mark this order as delivered?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delivered",
        onPress: async () => {
          await updateOrderStatus(orderId, "delivered");
          await stopDeliveryTracking();
          Alert.alert("Done!", "Order marked as delivered.", [
            { text: "OK", onPress: () => router.back() },
          ]);
        },
      },
    ]);
  }

  function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Use customer's live location for ETA if available, else fall back to store
  function getDestCoords() {
    if (customerLoc) return { lat: customerLoc.lat, lng: customerLoc.lng };
    return { lat: STORE_LAT, lng: STORE_LNG };
  }

  function getETA(): string {
    if (!driverLoc || !order) return "...";
    const dest = getDestCoords();
    const dist = calcDistance(driverLoc.lat, driverLoc.lng, dest.lat, dest.lng);
    const speedKmh = driverLoc.speed && driverLoc.speed > 2 ? driverLoc.speed : 25;
    const mins = Math.round((dist / speedKmh) * 60);
    return `~${mins} min · ${dist.toFixed(1)} km away`;
  }

  function generateAiResponse(question: string): string {
    const q = question.toLowerCase();
    if (!driverLoc) {
      return "I'm waiting for the driver to start sharing their location. Once they begin tracking, I can give you live updates!";
    }
    const dest = getDestCoords();
    const dist = calcDistance(driverLoc.lat, driverLoc.lng, dest.lat, dest.lng);
    const speedKmh = driverLoc.speed && driverLoc.speed > 2 ? driverLoc.speed : 25;
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
    if (q.includes("speed") || q.includes("fast") || q.includes("slow") || q.includes("moving")) {
      if (driverLoc.speed != null && driverLoc.speed > 0)
        return `The driver is moving at ${driverLoc.speed} km/h. ${driverLoc.speed < 5 ? "They may be in traffic or at a stop." : "They're on the way!"}`;
      return `Speed data isn't available right now, but the driver is ${distStr} away.`;
    }
    if (q.includes("near") || q.includes("close") || q.includes("far")) {
      if (dist < 0.5) return `Very close! The driver is only ${distStr} away — ~${mins} min.`;
      if (dist < 2) return `Getting there! Driver is ${distStr} away, ~${mins} minutes to go.`;
      return `The driver is still ${distStr} out. Estimated ~${mins} minutes.`;
    }
    if (q.includes("order") || q.includes("status") || q.includes("update")) {
      return `Your order ${order?.order_number} is out for delivery. Driver is ${distStr} away, ETA ~${mins} min. Live tracking is ${sharingActive ? "active" : "waiting"}.`;
    }
    if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
      return `Hi! I'm your live delivery assistant. Your driver is ${distStr} away with an ETA of ~${mins} minutes. Ask me anything about your delivery!`;
    }
    return `Your driver is currently ${distStr} away at ~${speedKmh} km/h — estimated arrival in ~${mins} minutes. ${sharingActive ? "Live tracking is active." : ""}\n\nAsk me: "Where is my driver?", "How long until delivery?", or "Is my order nearby?"`;
  }

  function handleAiQuery(question: string) {
    if (!question.trim() || aiThinking) return;
    const userMsg = question.trim();
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setChatInput("");
    setAiThinking(true);
    setTimeout(() => {
      const response = generateAiResponse(userMsg);
      setChatMessages(prev => [...prev, { role: "ai", text: response }]);
      setAiThinking(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 700);
  }

  function getMapHtml(customerLat = customerLoc?.lat ?? STORE_LAT, customerLng = customerLoc?.lng ?? STORE_LNG) {
    const dLat = driverLoc?.lat ?? STORE_LAT;
    const dLng = driverLoc?.lng ?? STORE_LNG;
    const centerLat = isCustomer ? (customerLat + dLat) / 2 : dLat;
    const centerLng = isCustomer ? (customerLng + dLng) / 2 : dLng;

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%}
.legend{position:fixed;bottom:10px;left:10px;z-index:999;background:#fff;padding:8px 12px;
  border-radius:12px;font-family:sans-serif;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
</style></head><body>
<div id="map"></div>
<div class="legend" id="legend">Loading map...</div>
<script>
var map = L.map('map').setView([${centerLat},${centerLng}], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; OSM contributors', maxZoom:19}).addTo(map);

var storeIcon = L.divIcon({html:'<div style="background:#F25C05;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">S</div>',className:'',iconSize:[26,26],iconAnchor:[13,13]});
var custIcon  = L.divIcon({html:'<div style="background:#E74C3C;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">C</div>',className:'',iconSize:[26,26],iconAnchor:[13,26]});
var driverIcon= L.divIcon({html:'<div style="background:#3498DB;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">D</div>',className:'',iconSize:[30,30],iconAnchor:[15,15]});

L.marker([${STORE_LAT},${STORE_LNG}],{icon:storeIcon}).addTo(map).bindPopup('FOODFIX Store');
var custMarker = L.marker([${customerLat},${customerLng}],{icon:custIcon}).addTo(map).bindPopup('Delivery Location');
var driverMarker = ${myOptIn && otherOptIn ? `L.marker([${dLat},${dLng}],{icon:driverIcon}).addTo(map).bindPopup('Driver')` : "null"};

${isCustomer ? `document.getElementById('legend').innerHTML = '<span style="color:#3498DB">&#9679;</span> Driver &bull; <span style="color:#E74C3C">&#9679;</span> You &bull; <span style="color:#F25C05">&#9679;</span> Store';` :
  `document.getElementById('legend').innerHTML = '<span style="color:#E74C3C">&#9679;</span> Delivery Address &bull; <span style="color:#3498DB">&#9679;</span> Your Location';`}

document.addEventListener('message', function(e){ handleMsg(e.data); });
window.addEventListener('message', function(e){ handleMsg(e.data); });
var custMarkerLive = null;
function handleMsg(raw){
  try{
    var d = JSON.parse(raw);
    if(d.type === 'driverUpdate' && driverMarker){
      driverMarker.setLatLng([d.lat, d.lng]);
    }
    if(d.type === 'customerUpdate'){
      if(!custMarkerLive) custMarkerLive = L.marker([d.lat,d.lng],{icon:custIcon}).addTo(map).bindPopup('Customer');
      else custMarkerLive.setLatLng([d.lat,d.lng]);
    }
  }catch(err){}
}
</script></body></html>`;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#2E1A06" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ alignItems: "center", marginTop: 80 }}>
          <Ionicons name="location-outline" size={48} color="#ccc" />
          <Text style={{ color: "#aaa", marginTop: 12 }}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sharingActive = myOptIn && otherOptIn;
  const QUICK_QUESTIONS = ["Where is my driver?", "How long until delivery?", "Is my order close?"];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#2E1A06" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Order Info Bar */}
      <View style={styles.orderBar}>
        <Ionicons name="receipt-outline" size={15} color="#F25C05" />
        <Text style={styles.orderBarText}>{order.order_number}</Text>
        <View style={[styles.statusDot, { backgroundColor: sharingActive ? "#27AE60" : "#F39C12" }]} />
        <Text style={styles.statusLabel}>{sharingActive ? "Live" : "Waiting"}</Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: getMapHtml() }}
          javaScriptEnabled
          domStorageEnabled
          style={{ flex: 1 }}
        />
      </View>

      {/* Permission Banner — show until both opted in */}
      {!myOptIn && (
        <View style={styles.permissionBanner}>
          <Ionicons name="location-outline" size={18} color="#F25C05" />
          <Text style={styles.permissionText}>Share your live location to enable real-time tracking</Text>
          <TouchableOpacity style={styles.allowBtn} onPress={handleOptIn}>
            <Text style={styles.allowBtnText}>Allow</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ETA bar — customer view when sharing is active */}
      {isCustomer && sharingActive && driverLoc && (
        <View style={styles.etaBar}>
          <Ionicons name="time-outline" size={16} color="#2E1A06" />
          <Text style={styles.etaText}>{getETA()}</Text>
          <TouchableOpacity style={styles.aiChatBtn} onPress={() => setChatVisible(true)}>
            <Text style={styles.aiChatBtnText}>Ask AI</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI floating button when sharing active but no driverLoc yet */}
      {isCustomer && sharingActive && !driverLoc && (
        <TouchableOpacity style={styles.aiFloatingBtn} onPress={() => setChatVisible(true)}>
          <Ionicons name="chatbubble-ellipses" size={22} color="#F25C05" />
        </TouchableOpacity>
      )}

      {/* AI Chat Modal */}
      <Modal visible={chatVisible} animationType="slide" transparent onRequestClose={() => setChatVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={styles.chatModal}>
            {/* Header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#F25C05" />
                <View>
                  <Text style={styles.chatTitle}>AI Delivery Assistant</Text>
                  <Text style={styles.chatSub}>Powered by live location data</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatVisible(false)}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Quick question chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
              {QUICK_QUESTIONS.map((q) => (
                <TouchableOpacity key={q} style={styles.chip} onPress={() => handleAiQuery(q)}>
                  <Text style={styles.chipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Messages */}
            <ScrollView ref={chatScrollRef} style={styles.chatMessages} contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false}>
              {chatMessages.length === 0 && (
                <View style={styles.chatEmpty}>
                  <Ionicons name="navigate-outline" size={36} color="#ddd" />
                  <Text style={styles.chatEmptyText}>Ask me anything about your delivery!</Text>
                </View>
              )}
              {chatMessages.map((msg, i) => (
                <View key={i} style={[styles.bubble, msg.role === "user" ? styles.bubbleUser : styles.bubbleAi]}>
                  <Text style={[styles.bubbleText, msg.role === "user" ? styles.bubbleTextUser : styles.bubbleTextAi]}>{msg.text}</Text>
                </View>
              ))}
              {aiThinking && (
                <View style={styles.bubbleAi}>
                  <ActivityIndicator size="small" color="#F25C05" />
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask about your delivery..."
                placeholderTextColor="#aaa"
                onSubmitEditing={() => handleAiQuery(chatInput)}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!chatInput.trim() || aiThinking) && { opacity: 0.4 }]}
                onPress={() => handleAiQuery(chatInput)}
                disabled={!chatInput.trim() || aiThinking}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Customer waiting for driver */}
      {isCustomer && myOptIn && !otherOptIn && (
        <View style={styles.waitingBar}>
          <ActivityIndicator size="small" color="#F39C12" />
          <Text style={styles.waitingText}>Waiting for driver to start tracking...</Text>
        </View>
      )}

      {/* Staff controls */}
      {!isCustomer && (
        <View style={styles.staffControls}>
          {/* Customer info */}
          <View style={styles.custInfo}>
            <Ionicons name="person-outline" size={14} color="#888" />
            <Text style={styles.custInfoText} numberOfLines={1}>{order.customer_name}</Text>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}>
              <Ionicons name="call-outline" size={18} color="#27AE60" />
            </TouchableOpacity>
          </View>
          <Text style={styles.custAddress} numberOfLines={2}>{order.customer_address}</Text>

          <View style={styles.staffBtnRow}>
            {!tracking ? (
              <TouchableOpacity style={styles.startBtn} onPress={handleStartDelivery}>
                <Ionicons name="navigate" size={16} color="#fff" />
                <Text style={styles.startBtnText}>Start Delivery Tracking</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopBtn} onPress={handleStopDelivery}>
                <Ionicons name="stop-circle-outline" size={16} color="#fff" />
                <Text style={styles.startBtnText}>Stop Tracking</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.deliveredBtn} onPress={handleMarkDelivered}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.startBtnText}>Mark Delivered</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8D8A0" },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: "#2E1A06" },
  orderBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#FFF5EE" },
  orderBarText: { fontSize: 13, fontWeight: "600", color: "#2E1A06", flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, color: "#666" },
  mapContainer: { flex: 1 },
  permissionBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#E8D8A0",
  },
  permissionText: { flex: 1, fontSize: 13, color: "#555" },
  allowBtn: { backgroundColor: "#F25C05", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  allowBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  etaBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#E8F8F0", paddingHorizontal: 16, paddingVertical: 12 },
  etaText: { fontSize: 14, fontWeight: "600", color: "#2E1A06" },
  waitingBar: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFF9E6", paddingHorizontal: 16, paddingVertical: 12 },
  waitingText: { fontSize: 13, color: "#B07820" },
  staffControls: { backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#E8D8A0" },
  custInfo: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  custInfoText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#2E1A06" },
  custAddress: { fontSize: 12, color: "#888", marginBottom: 12 },
  staffBtnRow: { flexDirection: "row", gap: 10 },
  startBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F25C05", borderRadius: 12, paddingVertical: 12 },
  stopBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#888", borderRadius: 12, paddingVertical: 12 },
  deliveredBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#27AE60", borderRadius: 12, paddingVertical: 12 },
  startBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  // AI Chat
  aiChatBtn: { backgroundColor: "#F25C0520", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  aiChatBtnText: { fontSize: 12, fontWeight: "700", color: "#F25C05" },
  aiFloatingBtn: {
    position: "absolute", bottom: 80, right: 16, width: 48, height: 48,
    borderRadius: 24, backgroundColor: "#fff", elevation: 4,
    justifyContent: "center", alignItems: "center", shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  chatModal: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "80%", minHeight: 360,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10,
  },
  chatHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#f0e8d8" },
  chatHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  chatTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06" },
  chatSub: { fontSize: 11, color: "#aaa" },
  chipsScroll: { flexGrow: 0 },
  chipsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { backgroundColor: "#FEF3EC", borderWidth: 1, borderColor: "#F25C0540", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, color: "#F25C05", fontWeight: "600" },
  chatMessages: { flex: 1, maxHeight: 260 },
  chatEmpty: { alignItems: "center", paddingVertical: 24, gap: 8 },
  chatEmptyText: { fontSize: 13, color: "#bbb", textAlign: "center" },
  bubble: { maxWidth: "82%", borderRadius: 16, padding: 10 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: "#F25C05" },
  bubbleAi: { alignSelf: "flex-start", backgroundColor: "#F5F0E8", borderWidth: 1, borderColor: "#E8D8A0", padding: 10, borderRadius: 16, maxWidth: "82%" },
  bubbleText: { fontSize: 13, lineHeight: 18 },
  bubbleTextUser: { color: "#fff" },
  bubbleTextAi: { color: "#2E1A06" },
  chatInputRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: "#f0e8d8" },
  chatInput: { flex: 1, backgroundColor: "#F9F5EF", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, color: "#333" },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F25C05", justifyContent: "center", alignItems: "center" },
});
