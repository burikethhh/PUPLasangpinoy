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
  getSettings, onLocationUpdate, onOrderUpdate,
  setLocationOptIn, updateOrderStatus, upsertLocation,
  type AppSettings, type LiveLocation, type Order
} from "../lib/firebase-store";
import { startDeliveryTracking, stopDeliveryTracking } from "../lib/location-task";
import { notifyBothOptedIn } from "../lib/notifications";

export default function TrackDeliveryScreen() {
  const { orderId, role } = useLocalSearchParams<{ orderId: string; role: "customer" | "staff" }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [driverLoc, setDriverLoc] = useState<LiveLocation | null>(null);
  const [myOptIn, setMyOptIn] = useState(false);
  const [otherOptIn, setOtherOptIn] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const storeLatRef = useRef(14.031902);
  const storeLngRef = useRef(121.206633);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [customerLoc, setCustomerLoc] = useState<LiveLocation | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const orderUnsubRef = useRef<(() => void) | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);
  const customerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staffIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCustomer = role === "customer";
  const user = getCurrentUser();

  // Real-time order subscription - keeps opt-in status live
  useEffect(() => {
    if (!orderId || !user) return;
    setLoading(true);
    
    // Subscribe to real-time order updates
    const unsub = onOrderUpdate(orderId, (updatedOrder) => {
      setOrder(updatedOrder);
      if (updatedOrder) {
        setMyOptIn(isCustomer ? (updatedOrder.customer_location_opt_in ?? false) : (updatedOrder.staff_location_opt_in ?? false));
        setOtherOptIn(isCustomer ? (updatedOrder.staff_location_opt_in ?? false) : (updatedOrder.customer_location_opt_in ?? false));
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    
    orderUnsubRef.current = unsub;
    return () => unsub?.();
  }, [orderId, user, isCustomer]);

  // Load settings for store coordinates
  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      storeLatRef.current = s.store_lat;
      storeLngRef.current = s.store_lng;
    }).catch(() => {});
  }, []);

  // Subscribe to driver location (customer watches staff) - NO opt-in gate, always subscribe
  useEffect(() => {
    if (!orderId) return;
    const unsub = onLocationUpdate(orderId, "staff", (loc) => {
      setDriverLoc(loc);
      if (loc && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type: "driverUpdate", lat: loc.lat, lng: loc.lng }));
      }
    });
    unsubRef.current = unsub;
    return () => unsub?.();
  }, [orderId]);

  // Staff subscribes to customer location for AI calculations, but does NOT send to WebView
  // Rider should see the placed delivery address, not the customer's real-time GPS
  useEffect(() => {
    if (!orderId || isCustomer) return;
    const unsub = onLocationUpdate(orderId, "customer", (loc) => {
      setCustomerLoc(loc);
    });
    return () => unsub?.();
  }, [orderId, isCustomer]);

  // Auto-opt-in on screen open (runs once per orderId/user/isCustomer)
  useEffect(() => {
    if (!orderId || !user) return;
    (async () => {
      const field = isCustomer ? "customer_location_opt_in" : "staff_location_opt_in";
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status === "granted") {
        await setLocationOptIn(orderId, field, true).catch(() => {});
        setMyOptIn(true);
      }
    })();
  }, [orderId, user, isCustomer]); // intentionally excludes myOptIn — runs once on mount

  // Ensure the pinned delivery location is registered as the customer destination
  useEffect(() => {
    if (!orderId || !order?.customer_lat || !order?.customer_lng) return;
    upsertLocation(orderId, order.customer_id || user?.uid || "customer", "customer", {
      lat: order.customer_lat,
      lng: order.customer_lng,
    }).catch(() => {});
  }, [orderId, order?.customer_lat, order?.customer_lng]);

  // Staff foreground location push every 5s — stable interval, never restarts
  useEffect(() => {
    if (isCustomer || !orderId || !user) return;
    if (staffIntervalRef.current) clearInterval(staffIntervalRef.current);

    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const push = async () => {
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }).catch(() => null);
        if (loc) {
          await upsertLocation(orderId, user.uid, "staff", {
            lat: loc.coords.latitude, lng: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? undefined,
            speed: loc.coords.speed != null ? Math.round(loc.coords.speed * 3.6) : undefined,
          }).catch(() => {});
        }
      };
      await push(); // push immediately on mount
      staffIntervalRef.current = setInterval(push, 5000);
    })();

    return () => {
      if (staffIntervalRef.current) { clearInterval(staffIntervalRef.current); staffIntervalRef.current = null; }
    };
  }, [isCustomer, orderId, user]); // stable

  // Re-send location data when WebView finishes loading (fixes race condition)
  // Also re-sends whenever driverLoc/customerLoc updates arrive after WebView is already ready
  useEffect(() => {
    if (!webViewReady || !webViewRef.current) return;
    if (driverLoc) {
      webViewRef.current.postMessage(JSON.stringify({ type: "driverUpdate", lat: driverLoc.lat, lng: driverLoc.lng }));
    }
    if (customerLoc) {
      webViewRef.current.postMessage(JSON.stringify({ type: "customerUpdate", lat: customerLoc.lat, lng: customerLoc.lng }));
    }
  }, [webViewReady, driverLoc, customerLoc]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      orderUnsubRef.current?.();
      if (customerIntervalRef.current) clearInterval(customerIntervalRef.current);
      if (staffIntervalRef.current) clearInterval(staffIntervalRef.current);
    };
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

  // Use saved order pinned delivery address for destination across all sides
  function getDestCoords() {
    if (order?.customer_lat && order?.customer_lng) {
      return { lat: order.customer_lat, lng: order.customer_lng };
    }
    if (customerLoc?.lat && customerLoc?.lng) {
      return { lat: customerLoc.lat, lng: customerLoc.lng };
    }
    return { lat: storeLatRef.current, lng: storeLngRef.current };
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
    
    // Staff context - asking about customer delivery location
    if (!isCustomer) {
      const destLat = order?.customer_lat ?? storeLatRef.current;
      const destLng = order?.customer_lng ?? storeLngRef.current;
      // Calculate distance from driver (staff) to order delivery address
      const dist = driverLoc 
        ? calcDistance(driverLoc.lat, driverLoc.lng, destLat, destLng)
        : calcDistance(storeLatRef.current, storeLngRef.current, destLat, destLng);
      const speedKmh = driverLoc?.speed && driverLoc.speed > 2 ? driverLoc.speed : 25;
      const mins = Math.round((dist / speedKmh) * 60);
      const distStr = dist < 1 ? `${(dist * 1000).toFixed(0)} meters` : `${dist.toFixed(1)} km`;
      
      if (q.includes("where") || q.includes("location") || q.includes("customer") || q.includes("address")) {
        if (dist < 0.3) return `You are almost at the delivery address (${order?.customer_address || "Customer location"}) — less than 300 meters away!`;
        if (dist < 1) return `The delivery destination is ${distStr} away at ${order?.customer_address || "pinned address"}.`;
        return `The customer's delivery destination (${order?.customer_address || "address"}) is ${distStr} away from your position.`;
      }
      if (q.includes("how long") || q.includes("when") || q.includes("eta") || q.includes("arrive") || q.includes("time") || q.includes("delivery")) {
        if (mins <= 1) return `You'll reach the delivery location any moment now!`;
        if (mins <= 5) return `About ${mins} minutes until you reach the delivery address.`;
        return `Estimated arrival at delivery address in ~${mins} minutes (${distStr} remaining).`;
      }
      if (q.includes("route") || q.includes("way") || q.includes("direction") || q.includes("go")) {
        return `Head toward the delivery address: ${order?.customer_address || "pinned location"}. Destination is ${distStr} away. The map shows the destination with the red (C) marker.`;
      }
      if (q.includes("near") || q.includes("close") || q.includes("far")) {
        if (dist < 0.5) return `Very close! Only ${distStr} to the delivery address.`;
        if (dist < 2) return `Getting closer — ${distStr} remaining to delivery address.`;
        return `Still ${distStr} to the delivery location.`;
      }
      if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
        return `Hello! The delivery address is ${distStr} away. Estimated arrival in ~${mins} minutes. Ask me about the destination or route!`;
      }
      return `Delivery destination (${order?.customer_address || "address"}) is ${distStr} away — about ${mins} minutes at current speed. Ask me: "Where is the delivery address?" or "How long to delivery?"`;
    }
    
    // Customer context - asking about driver
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

  function getMapHtml(
    customerLat = order?.customer_lat ?? customerLoc?.lat ?? storeLatRef.current,
    customerLng = order?.customer_lng ?? customerLoc?.lng ?? storeLngRef.current
  ) {
    const dLat = driverLoc?.lat ?? storeLatRef.current;
    const dLng = driverLoc?.lng ?? storeLngRef.current;
    const centerLat = (customerLat + dLat) / 2;
    const centerLng = (customerLng + dLng) / 2;

    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%}
.legend{position:fixed;bottom:6px;left:6px;z-index:999;background:#fff;padding:4px 8px;
  border-radius:8px;font-family:sans-serif;font-size:10px;box-shadow:0 1px 4px rgba(0,0,0,.12)}
</style></head><body>
<div id="map"></div>
<div class="legend" id="legend">Loading map...</div>
<script>
var map = L.map('map').setView([${centerLat},${centerLng}], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; OSM contributors', maxZoom:19}).addTo(map);

var storeIcon = L.divIcon({html:'<div style="background:#F25C05;color:#fff;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)">S</div>',className:'',iconSize:[18,18],iconAnchor:[9,9]});
var custIcon  = L.divIcon({html:'<div style="background:#E74C3C;color:#fff;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)">C</div>',className:'',iconSize:[18,18],iconAnchor:[9,18]});
var driverIcon= L.divIcon({html:'<div style="background:#3498DB;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)">D</div>',className:'',iconSize:[22,22],iconAnchor:[11,11]});

L.marker([${storeLatRef.current},${storeLngRef.current}],{icon:storeIcon}).addTo(map).bindPopup('FOODFIX Store');
var custMarker = L.marker([${customerLat},${customerLng}],{icon:custIcon}).addTo(map).bindPopup('Pinned Delivery Location');

var driverMarker = null;

${isCustomer ? `document.getElementById('legend').innerHTML = '<span style="color:#3498DB">&#9679;</span> Driver &bull; <span style="color:#E74C3C">&#9679;</span> Delivery Location &bull; <span style="color:#F25C05">&#9679;</span> Store';` :
  `document.getElementById('legend').innerHTML = '<span style="color:#E74C3C">&#9679;</span> Delivery Destination &bull; <span style="color:#3498DB">&#9679;</span> You (Driver) &bull; <span style="color:#F25C05">&#9679;</span> Store';`}

document.addEventListener('message', function(e){ handleMsg(e.data); });
window.addEventListener('message', function(e){ handleMsg(e.data); });
function fitBoundsIfBoth(){
  if(driverMarker && custMarker){
    var group = new L.featureGroup([driverMarker, custMarker]);
    map.fitBounds(group.getBounds().pad(0.25));
  }
}
function handleMsg(raw){
  try{
    var d = JSON.parse(raw);
    if(d.type === 'driverUpdate'){
      if(!driverMarker) {
        driverMarker = L.marker([d.lat,d.lng],{icon:driverIcon}).addTo(map).bindPopup('Driver');
      } else {
        driverMarker.setLatLng([d.lat, d.lng]);
      }
      fitBoundsIfBoth();
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
  const CUSTOMER_QUESTIONS = ["Where is my driver?", "How long until delivery?", "Is my order close?"];
  const STAFF_QUESTIONS = ["Where is my customer?", "How long to delivery?", "Best route?"];
  const QUICK_QUESTIONS = isCustomer ? CUSTOMER_QUESTIONS : STAFF_QUESTIONS;

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
          onLoadEnd={() => setWebViewReady(true)}
        />
      </View>

      {/* Location sharing status bar — always visible for customer */}
      {isCustomer && (
        <View style={[styles.permissionBanner, myOptIn && { backgroundColor: "#E8F8F0" }]}>
          <Ionicons
            name={myOptIn ? "location" : "location-outline"}
            size={18}
            color={myOptIn ? "#27AE60" : "#F25C05"}
          />
          <Text style={[styles.permissionText, myOptIn && { color: "#27AE60" }]}>
            {myOptIn ? "Sharing your location with driver" : "Enable location sharing for real-time tracking"}
          </Text>
          {!myOptIn && (
            <TouchableOpacity style={styles.allowBtn} onPress={handleOptIn}>
              <Text style={styles.allowBtnText}>Enable</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {/* Staff: show banner only when not yet opted in */}
      {!isCustomer && !myOptIn && (
        <View style={styles.permissionBanner}>
          <Ionicons name="location-outline" size={18} color="#F25C05" />
          <Text style={styles.permissionText}>Enable location sharing for real-time tracking</Text>
          <TouchableOpacity style={styles.allowBtn} onPress={handleOptIn}>
            <Text style={styles.allowBtnText}>Enable</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ETA bar — shows when we have location data */}
      {(driverLoc || customerLoc) && (
        <View style={styles.etaBar}>
          <Ionicons name="time-outline" size={16} color="#2E1A06" />
          <Text style={styles.etaText}>{getETA()}</Text>
          <TouchableOpacity style={styles.aiChatBtn} onPress={() => setChatVisible(true)}>
            <Text style={styles.aiChatBtnText}>Ask FOFI</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI floating button — always visible when not in chat */}
      {!chatVisible && (
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
                  <Text style={styles.chatTitle}>FOFI - Delivery Assistant</Text>
                  <Text style={styles.chatSub}>{isCustomer ? "Track your driver's location" : "Track your customer's location"}</Text>
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
                  <Text style={styles.chatEmptyText}>
                    {isCustomer 
                      ? "Ask me about your driver's location and ETA!"
                      : "Ask me about your customer's location and distance!"}
                  </Text>
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

      {/* Rider info for customer */}
      {isCustomer && order.driver_name && (
        <View style={styles.riderInfoBar}>
          <Ionicons name="bicycle" size={16} color="#3498DB" />
          <Text style={styles.riderInfoText}>Rider: {order.driver_name}</Text>
          {order.driver_phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${order.driver_phone}`)}>
              <Ionicons name="call-outline" size={18} color="#27AE60" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Waiting for other party to share location */}
      {myOptIn && !otherOptIn && (
        <View style={styles.waitingBar}>
          <ActivityIndicator size="small" color="#F39C12" />
          <Text style={styles.waitingText}>
            {isCustomer ? "Waiting for driver to start tracking..." : "Waiting for customer to share location..."}
          </Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8D8A0" },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: "#2E1A06" },
  orderBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#FFF5EE" },
  orderBarText: { fontSize: 13, fontWeight: "600", color: "#2E1A06", flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, color: "#666" },
  mapContainer: { flex: 1 },
  permissionBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff",
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#E8D8A0",
  },
  permissionText: { flex: 1, fontSize: 12, color: "#555" },
  allowBtn: { backgroundColor: "#F25C05", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  allowBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  etaBar: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E8F8F0", paddingHorizontal: 12, paddingVertical: 8 },
  etaText: { fontSize: 13, fontWeight: "600", color: "#2E1A06" },
  waitingBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF9E6", paddingHorizontal: 12, paddingVertical: 8 },
  waitingText: { fontSize: 12, color: "#B07820" },
  riderInfoBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EBF5FB", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#D6EAF8" },
  riderInfoText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#2E1A06" },
  staffControls: { backgroundColor: "#fff", padding: 12, borderTopWidth: 1, borderTopColor: "#E8D8A0" },
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
    position: "absolute", bottom: 60, right: 12, width: 40, height: 40,
    borderRadius: 20, backgroundColor: "#fff", elevation: 3,
    justifyContent: "center", alignItems: "center", shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3,
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
