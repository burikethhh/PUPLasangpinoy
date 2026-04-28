import { Ionicons } from "@expo/vector-icons";
import * as ExpoLocation from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Alert, Linking, StyleSheet,
    Text, TouchableOpacity, View,
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
  const webViewRef = useRef<WebView>(null);
  const unsubRef = useRef<(() => void) | null>(null);

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

  // Subscribe to driver location (customer watches staff, staff watches nothing extra)
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

  function getETA(): string {
    if (!driverLoc || !order) return "...";
    const addrCoords = { lat: STORE_LAT, lng: STORE_LNG }; // fallback
    const dist = calcDistance(driverLoc.lat, driverLoc.lng, addrCoords.lat, addrCoords.lng);
    const speedKmh = driverLoc.speed && driverLoc.speed > 2 ? driverLoc.speed : 25;
    const mins = Math.round((dist / speedKmh) * 60);
    return `~${mins} min · ${dist.toFixed(1)} km away`;
  }

  function getMapHtml(customerLat = STORE_LAT, customerLng = STORE_LNG) {
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

var storeIcon = L.divIcon({html:'🏪',className:'',iconSize:[24,24],iconAnchor:[12,12]});
var custIcon  = L.divIcon({html:'📍',className:'',iconSize:[24,24],iconAnchor:[12,24]});
var driverIcon= L.divIcon({html:'🛵',className:'',iconSize:[28,28],iconAnchor:[14,14]});

L.marker([${STORE_LAT},${STORE_LNG}],{icon:storeIcon}).addTo(map).bindPopup('FOODFIX Store');
var custMarker = L.marker([${customerLat},${customerLng}],{icon:custIcon}).addTo(map).bindPopup('Delivery Location');
var driverMarker = ${myOptIn && otherOptIn ? `L.marker([${dLat},${dLng}],{icon:driverIcon}).addTo(map).bindPopup('Driver')` : "null"};

${isCustomer ? `document.getElementById('legend').innerHTML = '<b>🛵 Driver</b> &bull; <b>📍 You</b> &bull; <b>🏪 Store</b>';` :
  `document.getElementById('legend').innerHTML = '<b>📍 Delivery Address</b> &bull; <b>🛵 Your Location</b>';`}

document.addEventListener('message', function(e){ handleMsg(e.data); });
window.addEventListener('message', function(e){ handleMsg(e.data); });
function handleMsg(raw){
  try{
    var d = JSON.parse(raw);
    if(d.type === 'driverUpdate' && driverMarker){
      driverMarker.setLatLng([d.lat, d.lng]);
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
        </View>
      )}

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
});
