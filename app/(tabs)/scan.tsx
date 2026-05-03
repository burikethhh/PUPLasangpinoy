import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ExpoLocation from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator, Alert, Modal, Platform,
    ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { OrderType, PaymentMethod } from "../../constants/order";
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "../../constants/order";
import { getCurrentUser, getProfile } from "../../lib/firebase";
import { createOrder, getSettings, validateStock, type AppSettings } from "../../lib/firebase-store";

const CART_KEY = "@foodfix_cart";

interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  stock_quantity: number;
  image_url?: string;
}

export default function CartScreen() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Checkout fields
  const [orderType, setOrderType] = useState<OrderType>("delivery_now");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Date/time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  // Location picker state
  const [mapModal, setMapModal] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const webViewRef = useRef<WebView>(null);

  useFocusEffect(useCallback(() => {
    loadCart();
    loadSettings();
    loadProfile();
    // Auto-fill scheduled date/time with nearest next hour
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    setScheduledDate(`${yyyy}-${mm}-${dd}`);
    setScheduledTime(`${hh}:00`);
  }, []));

  async function loadCart() {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      setCart(raw ? JSON.parse(raw) : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadSettings() {
    try { setSettings(await getSettings()); } catch (e) { console.error(e); }
  }

  async function loadProfile() {
    const user = getCurrentUser();
    if (user) {
      const p = await getProfile(user.uid);
      if (p) {
        if (p.address) setAddress(p.address);
        if (p.phone) setPhone(p.phone);
      }
    }
  }

  function onDateChange(_: any, selected?: Date) {
    setShowDatePicker(Platform.OS === "ios");
    if (selected) {
      setPickerDate(selected);
      const yyyy = selected.getFullYear();
      const mm = String(selected.getMonth() + 1).padStart(2, "0");
      const dd = String(selected.getDate()).padStart(2, "0");
      setScheduledDate(`${yyyy}-${mm}-${dd}`);
    }
  }

  function onTimeChange(_: any, selected?: Date) {
    setShowTimePicker(Platform.OS === "ios");
    if (selected) {
      setPickerDate(selected);
      const hh = String(selected.getHours()).padStart(2, "0");
      const min = String(selected.getMinutes()).padStart(2, "0");
      setScheduledTime(`${hh}:${min}`);
    }
  }

  async function useMyLocation() {
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Enable location access in device settings to use this feature.");
        return;
      }
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setCoords({ lat: latitude, lng: longitude });

      // Reverse geocode with Nominatim (OSM)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        { headers: { "User-Agent": "FOODFIX-App/2.3" } }
      );
      const data = await res.json();
      if (data.display_name) {
        setAddress(data.display_name);
      }
    } catch (e: any) {
      Alert.alert("Location Error", e.message || "Could not get location.");
    } finally {
      setLocating(false);
    }
  }

  function handleMapMessage(event: any) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.lat && data.lng) {
        setCoords({ lat: data.lat, lng: data.lng });
        if (data.address) setAddress(data.address);
        setMapModal(false);
      }
    } catch {}
  }

  function getMapHtml(lat = 14.5995, lng = 120.9842) {
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%}
.info{position:fixed;bottom:10px;left:10px;right:10px;z-index:999;background:#fff;padding:12px 16px;
border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,0.15);font-family:sans-serif;font-size:13px;color:#333}
.info b{color:#F25C05}
.btn{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:999;background:#F25C05;
color:#fff;border:none;padding:14px 32px;border-radius:14px;font-size:15px;font-weight:bold;cursor:pointer;
box-shadow:0 2px 10px rgba(242,92,5,0.4)}
</style></head><body>
<div id="map"></div>
<div class="info" id="addr">Tap the map to pick a location</div>
<button class="btn" id="confirm" style="display:none" onclick="confirmLocation()">Confirm Location</button>
<script>
var map=L.map('map').setView([${lat},${lng}],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; OSM contributors',maxZoom:19}).addTo(map);
var marker=null,selectedLat=null,selectedLng=null,selectedAddr='';
map.on('click',function(e){
  selectedLat=e.latlng.lat;selectedLng=e.latlng.lng;
  if(marker)map.removeLayer(marker);
  marker=L.marker([selectedLat,selectedLng],{draggable:true}).addTo(map);
  marker.on('dragend',function(ev){
    var p=ev.target.getLatLng();selectedLat=p.lat;selectedLng=p.lng;reverseGeocode(p.lat,p.lng);
  });
  reverseGeocode(selectedLat,selectedLng);
});
function reverseGeocode(lat,lng){
  document.getElementById('addr').innerHTML='<b>Loading address...</b>';
  fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json&addressdetails=1',
    {headers:{'User-Agent':'FOODFIX-App/2.3'}})
  .then(r=>r.json()).then(d=>{
    selectedAddr=d.display_name||(''+lat.toFixed(5)+', '+lng.toFixed(5));
    document.getElementById('addr').innerHTML='<b>Location: </b>'+selectedAddr;
    document.getElementById('confirm').style.display='block';
  }).catch(()=>{
    selectedAddr=lat.toFixed(5)+', '+lng.toFixed(5);
    document.getElementById('addr').innerHTML='<b>Location: </b>'+selectedAddr;
    document.getElementById('confirm').style.display='block';
  });
}
function confirmLocation(){
  window.ReactNativeWebView.postMessage(JSON.stringify({lat:selectedLat,lng:selectedLng,address:selectedAddr}));
}
</script></body></html>`;
  }

  async function saveCart(items: CartItem[]) {
    setCart(items);
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function updateQty(idx: number, delta: number) {
    const next = [...cart];
    const maxQty = next[idx].stock_quantity || 999;
    next[idx].quantity = Math.min(maxQty, Math.max(1, next[idx].quantity + delta));
    if (delta > 0 && next[idx].quantity === maxQty && cart[idx].quantity === maxQty) {
      Alert.alert("Stock Limit", `Only ${maxQty} left in stock.`);
    }
    saveCart(next);
  }

  function removeItem(idx: number) {
    const next = cart.filter((_, i) => i !== idx);
    saveCart(next);
  }

  function clearCart() {
    Alert.alert("Clear Cart", "Remove all items?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => saveCart([]) },
    ]);
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = (orderType === "delivery_now" || orderType === "delivery_later") ? (settings?.delivery_fee || 50) : 0;
  const total = subtotal + deliveryFee;

  const STORE_LAT = 14.5995;
  const STORE_LNG = 120.9842;

  function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function handleCheckout() {
    const user = getCurrentUser();
    if (!user) return Alert.alert("Sign In", "Please sign in to place an order.");
    if (cart.length === 0) return Alert.alert("Empty Cart", "Add items first.");
    if ((orderType === "delivery_now" || orderType === "delivery_later") && !address.trim())
      return Alert.alert("Address Required", "Please enter your delivery address.");
    if (!phone.trim()) return Alert.alert("Phone Required", "Please enter your contact number.");
    if (!/^09\d{9}$/.test(phone.replace(/\s/g, ""))) return Alert.alert("Invalid Phone", "Contact number must be exactly 11 digits starting with 09 (e.g. 09XX XXX XXXX).");
    if (orderType === "delivery_later" && (!scheduledDate || !scheduledTime))
      return Alert.alert("Schedule Required", "Please set date and time for later delivery.");

    // Check delivery coverage for delivery orders
    if ((orderType === "delivery_now" || orderType === "delivery_later") && coords) {
      const radiusKm = settings?.delivery_radius_km || 10;
      const distance = calcDistance(STORE_LAT, STORE_LNG, coords.lat, coords.lng);
      if (distance > radiusKm) {
        return Alert.alert(
          "Out of Delivery Area",
          `Your location is ${distance.toFixed(1)} km away. We currently deliver within ${radiusKm} km of our store. Please choose a closer address or select Pick Up / Dine In.`
        );
      }
    }

    // Validate stock availability before placing order
    setPlacing(true);
    try {
      const stockCheck = await validateStock(cart.map((c) => ({
        menu_item_id: c.menu_item_id,
        name: c.name,
        quantity: c.quantity,
      })));
      if (!stockCheck.valid) {
        setPlacing(false);
        return Alert.alert("Stock Issue", stockCheck.issues.join("\n\nPlease adjust your cart and try again."));
      }
    } catch (e) {
      // If stock validation fails, continue with order (graceful degradation)
      console.error("Stock validation error:", e);
    }

    const profile = await getProfile(user.uid);

    try {
      const result = await createOrder({
        customer_id: user.uid,
        customer_name: profile?.username || "Customer",
        customer_phone: phone.trim(),
        customer_address: address.trim(),
        customer_lat: coords?.lat,
        customer_lng: coords?.lng,
        items: cart.map((c) => ({
          menu_item_id: c.menu_item_id,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          image_url: c.image_url,
        })),
        subtotal,
        delivery_fee: deliveryFee,
        total,
        order_type: orderType,
        payment_method: paymentMethod,
        scheduled_date: scheduledDate || undefined,
        scheduled_time: scheduledTime || undefined,
      });

      await AsyncStorage.removeItem(CART_KEY);
      setCart([]);
      Alert.alert("Order Placed!", `Your order number is:\n\n${result.order_number}\n\nTrack it in the Orders tab.`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to place order.");
    }
    setPlacing(false);
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Cart</Text>
          {cart.length > 0 && (
            <TouchableOpacity onPress={clearCart}>
              <Text style={{ color: "#E74C3C", fontSize: 13, fontWeight: "600" }}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {cart.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cart-outline" size={64} color="#ddd" />
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <Text style={styles.emptySubtext}>Browse the menu and add items!</Text>
            <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace("/(tabs)")}>
              <Ionicons name="fast-food-outline" size={18} color="#fff" />
              <Text style={styles.browseBtnText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Cart Items */}
            {cart.map((item, idx) => (
              <View key={idx} style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>P{item.price.toFixed(2)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(idx, -1)}>
                    <Ionicons name="remove" size={16} color="#F25C05" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity style={[styles.qtyBtn, item.quantity >= (item.stock_quantity || 999) && { opacity: 0.4 }]} onPress={() => updateQty(idx, 1)}>
                    <Ionicons name="add" size={16} color="#F25C05" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeItem(idx)} style={{ marginLeft: 8 }}>
                    <Ionicons name="trash-outline" size={18} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Order Type */}
            <Text style={styles.sectionLabel}>Order Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.optionsRow}>
              {(["delivery_now", "delivery_later", "dine_in", "pick_up"] as OrderType[]).map((t) => (
                <TouchableOpacity key={t}
                  style={[styles.optionBtn, orderType === t && styles.optionBtnActive]}
                  onPress={() => setOrderType(t)}>
                  <Text style={[styles.optionText, orderType === t && styles.optionTextActive]} numberOfLines={1}>
                    {ORDER_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Scheduled date/time for later delivery */}
            {orderType === "delivery_later" && (
              <View style={styles.scheduleRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.inputLabel}>Date</Text>
                  <View style={[styles.input, styles.pickerField]}>
                    <Ionicons name="calendar-outline" size={15} color="#F25C05" style={{ marginRight: 6 }} />
                    <Text style={styles.pickerFieldText}>{scheduledDate || "Select date"}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.inputLabel}>Time</Text>
                  <View style={[styles.input, styles.pickerField]}>
                    <Ionicons name="time-outline" size={15} color="#F25C05" style={{ marginRight: 6 }} />
                    <Text style={styles.pickerFieldText}>{scheduledTime || "Select time"}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
            {showDatePicker && (
              <DateTimePicker value={pickerDate} mode="date"
                minimumDate={new Date()} onChange={onDateChange} />
            )}
            {showTimePicker && (
              <DateTimePicker value={pickerDate} mode="time"
                display="spinner" is24Hour minuteInterval={15} onChange={onTimeChange} />
            )}

            {/* Payment Method */}
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.optionsRow}>
              {(["cod", "gcash"] as PaymentMethod[]).map((m) => (
                <TouchableOpacity key={m}
                  style={[styles.optionBtn, paymentMethod === m && styles.optionBtnActive,
                    m === "gcash" && !settings?.gcash_enabled && { opacity: 0.4 }]}
                  onPress={() => { if (m === "gcash" && !settings?.gcash_enabled) return; setPaymentMethod(m); }}
                  disabled={m === "gcash" && !settings?.gcash_enabled}>
                  <Ionicons name={m === "cod" ? "cash-outline" : "phone-portrait-outline"} size={16}
                    color={paymentMethod === m ? "#fff" : "#666"} />
                  <Text style={[styles.optionText, paymentMethod === m && styles.optionTextActive]} numberOfLines={1}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* GCash notice */}
            {paymentMethod === "gcash" && (
              <View style={styles.gcashNotice}>
                <Ionicons name="information-circle" size={18} color="#3498DB" />
                <Text style={styles.gcashNoticeText}>
                  For GCash payments, please use the <Text style={{ fontWeight: "bold" }}>Live Chat</Text> tab to coordinate payment with the store.
                </Text>
              </View>
            )}

            {/* Address & Phone */}
            {(orderType === "delivery_now" || orderType === "delivery_later") && (
              <>
                <Text style={styles.inputLabel}>Delivery Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your delivery address"
                  value={address}
                  onChangeText={setAddress}
                  placeholderTextColor="#aaa"
                  multiline
                />
                <View style={styles.locationBtns}>
                  <TouchableOpacity style={styles.locationBtn} onPress={useMyLocation} disabled={locating}>
                    {locating ? <ActivityIndicator size="small" color="#F25C05" /> :
                      <Ionicons name="navigate" size={15} color="#F25C05" />}
                    <Text style={styles.locationBtnText}>{locating ? "Locating..." : "Use My Location"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.locationBtn} onPress={() => setMapModal(true)}>
                    <Ionicons name="map" size={15} color="#F25C05" />
                    <Text style={styles.locationBtnText}>Pick on Map</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            <Text style={styles.inputLabel}>Contact Number</Text>
            <TextInput
              style={[styles.input, phoneError ? { borderColor: "#E74C3C" } : null]}
              placeholder="09XX XXX XXXX"
              value={phone}
              onChangeText={(v) => { setPhone(v); setPhoneError(""); }}
              keyboardType="phone-pad"
              placeholderTextColor="#aaa"
              maxLength={13}
            />
            {phoneError ? <Text style={styles.phoneError}>{phoneError}</Text> : null}

            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>P{subtotal.toFixed(2)}</Text>
              </View>
              {deliveryFee > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>P{deliveryFee.toFixed(2)}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 8 }]}>
                <Text style={[styles.summaryLabel, { fontWeight: "bold", fontSize: 16 }]}>Total</Text>
                <Text style={[styles.summaryValue, { fontWeight: "bold", fontSize: 18, color: "#F25C05" }]}>
                  P{total.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Checkout Button */}
            <TouchableOpacity style={[styles.checkoutBtn, placing && { opacity: 0.7 }]}
              onPress={handleCheckout} disabled={placing}>
              {placing ? <ActivityIndicator color="#fff" /> :
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.checkoutText}>Place Order</Text>
                </>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Map Picker Modal (OSM + Leaflet) */}
      <Modal visible={mapModal} animationType="slide" onRequestClose={() => setMapModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F9F0DC" }}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapHeaderTitle}>Pick Location</Text>
            <TouchableOpacity onPress={() => setMapModal(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: getMapHtml(coords?.lat ?? 14.5995, coords?.lng ?? 120.9842) }}
            onMessage={handleMapMessage}
            javaScriptEnabled
            domStorageEnabled
            style={{ flex: 1 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#2E1A06" },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "bold", color: "#aaa", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#bbb", marginTop: 4 },
  browseBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F25C05",
    borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 20,
  },
  browseBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  cartItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 14, elevation: 1,
  },
  itemName: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  itemPrice: { fontSize: 13, color: "#F25C05", marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFF5EE",
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#F25C05",
  },
  qtyText: { fontSize: 16, fontWeight: "bold", color: "#2E1A06", minWidth: 24, textAlign: "center" },
  sectionLabel: {
    fontSize: 15, fontWeight: "bold", color: "#2E1A06",
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
  },
  optionsRow: { paddingHorizontal: 16, gap: 8 },
  optionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E8D8A0",
  },
  optionBtnActive: { backgroundColor: "#F25C05", borderColor: "#F25C05" },
  optionText: { fontSize: 12, color: "#666" },
  optionTextActive: { color: "#fff", fontWeight: "bold" },
  scheduleRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12, marginTop: 8 },
  inputLabel: { fontSize: 13, color: "#555", marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginHorizontal: 16,
    fontSize: 14, color: "#333", borderWidth: 1, borderColor: "#eee",
  },
  summaryCard: {
    backgroundColor: "#fff", margin: 16, padding: 16, borderRadius: 16, elevation: 2,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryLabel: { fontSize: 14, color: "#666" },
  summaryValue: { fontSize: 14, color: "#2E1A06" },
  checkoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#F25C05", marginHorizontal: 16, padding: 16, borderRadius: 16,
  },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  pickerField: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderColor: "#F25C05", borderWidth: 1.5,
  },
  pickerFieldText: { fontSize: 14, color: "#2E1A06", fontWeight: "500" },
  locationBtns: {
    flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 8,
  },
  locationBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#FFF5EE", borderRadius: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "#F25C0544",
  },
  locationBtnText: { fontSize: 12, color: "#F25C05", fontWeight: "600" },
  mapHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8D8A0",
  },
  mapHeaderTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06" },
  phoneError: { color: "#E74C3C", fontSize: 12, marginHorizontal: 16, marginTop: 2 },
  gcashNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EBF5FB", borderRadius: 12, padding: 12, marginHorizontal: 16, marginTop: 8,
    borderWidth: 1, borderColor: "#3498DB33",
  },
  gcashNoticeText: { flex: 1, fontSize: 12, color: "#2E1A06", lineHeight: 18 },
});
