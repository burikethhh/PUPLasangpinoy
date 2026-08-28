import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import * as ExpoLocation from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator, Alert, Modal, Platform,
    ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OrderType, PaymentMethod } from "../../constants/order";
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "../../constants/order";
import { getCurrentUser, getProfile } from "../../lib/firebase";
import { createLogger } from "../../lib/logger";
const log = createLogger("Cart");

import { createOrder, deleteSavedAddress, getSavedAddresses, getSettings, notifyGcashPayment, rollbackStock, saveAddress, validateStock, type AppSettings, type SavedAddress } from "../../lib/firebase-store";

const CART_KEY = "@foodfix_cart";

interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  stock_quantity: number;
  image_url?: string;
}

interface NominatimSuggestion {
  display_name: string;
  lat: string;
  lon: string;
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

  // GCash confirmation state
  const [gcashOrder, setGcashOrder] = useState<{ orderId: string; orderNumber: string; amount: number } | null>(null);
  const [notifyingGcash, setNotifyingGcash] = useState(false);
  const [customerName, setCustomerName] = useState("Customer");

  // Location state
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  // Address autocomplete
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save address modal
  const [saveAddressModal, setSaveAddressModal] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

  useFocusEffect(useCallback(() => {
    loadCart();
    loadSettings();
    loadProfile();
    loadSavedAddresses();
    // Always get GPS location for distance calculation
    ExpoLocation.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === "granted") {
        ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }).then((loc) => {
          setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }).catch(() => {});
      }
    }).catch(() => {});
    // Auto-fill scheduled date/time with nearest next hour
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh24 = now.getHours();
    const hh12 = hh24 % 12 || 12;
    const ampm = hh24 >= 12 ? "PM" : "AM";
    setScheduledDate(`${yyyy}-${mm}-${dd}`);
    setScheduledTime(`${hh12}:00 ${ampm}`);
  }, []));

  async function loadCart() {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      const items = raw ? JSON.parse(raw) : [];
      setCart(items);
      log.info("Cart loaded", { itemCount: items.length });
    } catch (e) { log.error("Failed to load cart", e); }
    setLoading(false);
  }

  async function loadSettings() {
    try {
      const s = await getSettings();
      setSettings(s);
      log.info("Settings loaded", { gcash_enabled: s.gcash_enabled, delivery_fee: s.delivery_fee });
    } catch (e) { log.error("Failed to load settings", e); }
  }

  async function loadProfile() {
    const user = getCurrentUser();
    if (user) {
      try {
        const p = await getProfile(user.uid);
        if (p) {
          setCustomerName(p.username || user.email?.split('@')[0] || user.displayName || "Customer");
          if (p.address) setAddress(p.address);
          if (p.phone) setPhone(p.phone);
          log.info("Profile loaded", { username: p.username });
        }
      } catch (e) { log.error("Failed to load profile", e); }
    }
  }

  async function loadSavedAddresses() {
    const user = getCurrentUser();
    if (user) {
      try {
        const addrs = await getSavedAddresses(user.uid);
        setSavedAddresses(addrs);
        log.info("Saved addresses loaded", { count: addrs.length });
      } catch (e) { log.error("Failed to load saved addresses", e); }
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
      let hours = selected.getHours();
      const min = String(selected.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      setScheduledTime(`${hours}:${min} ${ampm}`);
    }
  }

  async function useMyLocation() {
    setLocating(true);
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        log.warn("Location permission denied");
        Alert.alert("Permission Denied", "Enable location access in device settings to use this feature.");
        return;
      }
      const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setCoords({ lat: latitude, lng: longitude });
      log.info("Location obtained", { lat: latitude, lng: longitude });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        { headers: { "User-Agent": "FOODFIX-App/2.3" } }
      );
      const data = await res.json();
      if (data.display_name) {
        setAddress(data.display_name);
        log.info("Reverse geocode success", { address: data.display_name });
      }
    } catch (e: any) {
      log.error("Location error", e);
      Alert.alert("Location Error", e.message || "Could not get location.");
    } finally {
      setLocating(false);
    }
  }

  async function fetchAddressSuggestions(query: string) {
    if (!query.trim() || query.trim().length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
        { headers: { "User-Agent": "FOODFIX-App/2.3" } }
      );
      const data = await res.json();
      const suggestions: NominatimSuggestion[] = (data || []).map((item: any) => ({
        display_name: item.display_name || "",
        lat: item.lat,
        lon: item.lon,
      }));
      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function handleAddressChange(text: string) {
    setAddress(text);
    setShowSuggestions(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchAddressSuggestions(text), 500);
  }

  function handleSelectSuggestion(suggestion: NominatimSuggestion) {
    setAddress(suggestion.display_name);
    setCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setShowSuggestions(false);
    setAddressSuggestions([]);
    log.debug("Address suggestion selected", { address: suggestion.display_name });
  }

  async function handleSaveAddress() {
    if (!saveLabel.trim()) {
      Alert.alert("Label Required", "Please enter a label for this address (e.g. Home, Office).");
      return;
    }
    const user = getCurrentUser();
    if (!user) return;
    setSavingAddress(true);
    try {
      await saveAddress(user.uid, {
        label: saveLabel.trim(),
        address: address.trim(),
        phone: phone.trim(),
        lat: coords?.lat,
        lng: coords?.lng,
      });
      log.info("Address saved", { label: saveLabel.trim() });
      setSaveAddressModal(false);
      setSaveLabel("");
      await loadSavedAddresses();
    } catch (e: any) {
      log.error("Failed to save address", e);
      Alert.alert("Error", e.message || "Failed to save address.");
    }
    setSavingAddress(false);
  }

  async function handleDeleteSavedAddress(addr: SavedAddress) {
    const user = getCurrentUser();
    if (!user) return;
    Alert.alert("Delete Address", `Remove "${addr.label}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteSavedAddress(user.uid, addr.id);
          await loadSavedAddresses();
        } catch (e: any) {
          Alert.alert("Error", e.message || "Failed to delete address.");
        }
      }},
    ]);
  }

  function handleSelectSavedAddress(addr: SavedAddress) {
    setAddress(addr.address);
    setPhone(addr.phone);
    if (addr.lat && addr.lng) {
      setCoords({ lat: addr.lat, lng: addr.lng });
    }
    log.debug("Saved address selected", { label: addr.label });
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
    log.info("Cart cleared");
    Alert.alert("Clear Cart", "Remove all items?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => saveCart([]) },
    ]);
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = (orderType === "delivery_now" || orderType === "delivery_later") ? (settings?.delivery_fee || 50) : 0;
  const total = subtotal + deliveryFee;

  const STORE_LAT = settings?.store_lat || 14.031902;
  const STORE_LNG = settings?.store_lng || 121.206633;

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

    if ((orderType === "delivery_now" || orderType === "delivery_later") && coords) {
      const radiusKm = settings?.delivery_radius_km || 10;
      const distance = calcDistance(STORE_LAT, STORE_LNG, coords.lat, coords.lng);
      if (distance > radiusKm) {
        log.warn("Delivery out of range", { distance, radiusKm });
        return Alert.alert(
          "Out of Delivery Area",
          `Your location is ${distance.toFixed(1)} km away. We currently deliver within ${radiusKm} km of our store. Please choose a closer address or select Pick Up / Dine In.`
        );
      }
    }

    log.info("Checkout started", { itemCount: cart.length, orderType, paymentMethod, total });
    setPlacing(true);
    try {
      const stockCheck = await validateStock(cart.map((c) => ({
        menu_item_id: c.menu_item_id,
        name: c.name,
        quantity: c.quantity,
      })));
      if (!stockCheck.valid) {
        setPlacing(false);
        log.warn("Stock validation failed", { issues: stockCheck.issues });
        return Alert.alert("Stock Issue", stockCheck.issues.join("\n") + "\n\nPlease adjust your cart and try again.");
      }
      log.info("Stock validation passed");
    } catch (e) {
      log.error("Stock validation error", e);
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

      log.info("Order created", { orderId: result.id, orderNumber: result.order_number, total });
      await AsyncStorage.removeItem(CART_KEY);
      setCart([]);
      if (paymentMethod === "gcash") {
        setGcashOrder({ orderId: result.id, orderNumber: result.order_number, amount: total });
      } else {
        Alert.alert("Order Placed!", `Your order number is:\n\n${result.order_number}\n\nTrack it in the Orders tab.`);
      }
    } catch (e: any) {
      log.error("Order creation failed", e);
      // Rollback any stock that was tentatively decremented during validation
      rollbackStock(cart.map((c) => ({ menu_item_id: c.menu_item_id, quantity: c.quantity }))).catch(() => {});
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
            <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace("/(tabs)/menu" as any)}>
              <Ionicons name="fast-food-outline" size={18} color="#fff" />
              <Text style={styles.browseBtnText}>Browse Menu</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Cart Items */}
            {cart.map((item, idx) => (
              <View key={idx} style={styles.cartItem}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.cartImage} />
                ) : (
                  <View style={[styles.cartImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="fast-food" size={24} color="#ccc" />
                  </View>
                )}
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
                display="spinner" is24Hour={false} minuteInterval={15} onChange={onTimeChange} />
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

            {/* GCash QR Code Display */}
            {paymentMethod === "gcash" && (
              <View style={styles.gcashQrSection}>
                <Text style={styles.gcashQrTitle}>Pay via GCash</Text>
                {settings?.gcash_qr_image ? (
                  <Image source={{ uri: settings.gcash_qr_image }} style={styles.gcashQrImage} />
                ) : (
                  <View style={styles.gcashQrPlaceholder}>
                    <Ionicons name="phone-portrait-outline" size={40} color="#F25C05" />
                    <Text style={styles.gcashQrPlaceholderNumber}>{settings?.gcash_number || "No GCash number set"}</Text>
                  </View>
                )}
                <Text style={styles.gcashQrLabel}>GCash Number: <Text style={{ fontWeight: "bold" }}>{settings?.gcash_number || "N/A"}</Text></Text>
                <View style={styles.gcashInstructions}>
                  <Ionicons name="information-circle" size={16} color="#3498DB" />
                  <Text style={styles.gcashInstructionText}>
                    Open your GCash app, send payment to the number above, then tap "I Have Paid" below.
                  </Text>
                </View>
              </View>
            )}

            {/* Saved Addresses */}
            {(orderType === "delivery_now" || orderType === "delivery_later") && savedAddresses.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Saved Addresses</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.savedAddressesRow}>
                  {savedAddresses.map((addr) => (
                    <TouchableOpacity key={addr.id} style={styles.savedAddressCard} onPress={() => handleSelectSavedAddress(addr)}>
                      <View style={styles.savedAddressCardHeader}>
                        <Text style={styles.savedAddressLabel}>{addr.label}</Text>
                        <TouchableOpacity onPress={() => handleDeleteSavedAddress(addr)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={16} color="#E74C3C" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.savedAddressText} numberOfLines={2}>{addr.address}</Text>
                      <Text style={styles.savedAddressPhone}>{addr.phone}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Address & Phone */}
            {(orderType === "delivery_now" || orderType === "delivery_later") && (
              <>
                <Text style={styles.inputLabel}>Delivery Address</Text>
                <View style={styles.addressInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginHorizontal: 0 }]}
                    placeholder="Search for your address..."
                    value={address}
                    onChangeText={handleAddressChange}
                    placeholderTextColor="#aaa"
                    multiline
                  />
                  <TouchableOpacity style={styles.saveAddressBtn} onPress={() => { setSaveLabel(""); setSaveAddressModal(true); }}>
                    <Ionicons name="bookmark-outline" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
                {showSuggestions && addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {addressSuggestions.map((s, i) => (
                      <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => handleSelectSuggestion(s)}>
                        <Ionicons name="location-outline" size={14} color="#F25C05" style={{ marginRight: 6 }} />
                        <Text style={styles.suggestionText} numberOfLines={2}>{s.display_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.locationBtns}>
                  <TouchableOpacity style={styles.locationBtn} onPress={useMyLocation} disabled={locating}>
                    {locating ? <ActivityIndicator size="small" color="#F25C05" /> :
                      <Ionicons name="navigate" size={15} color="#F25C05" />}
                    <Text style={styles.locationBtnText}>{locating ? "Locating..." : "Use My Location"}</Text>
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
              maxLength={11}
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

      {/* Save Address Modal */}
      <Modal visible={saveAddressModal} transparent animationType="fade" onRequestClose={() => setSaveAddressModal(false)}>
        <View style={styles.saveOverlay}>
          <View style={styles.saveCard}>
            <Ionicons name="bookmark" size={36} color="#F25C05" />
            <Text style={styles.saveTitle}>Save Address</Text>
            <TextInput
              style={styles.saveInput}
              placeholder="Label (e.g. Home, Office, Other)"
              value={saveLabel}
              onChangeText={setSaveLabel}
              placeholderTextColor="#aaa"
              autoFocus
            />
            <View style={styles.saveActions}>
              <TouchableOpacity style={styles.saveCancelBtn} onPress={() => setSaveAddressModal(false)}>
                <Text style={styles.saveCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveConfirmBtn, savingAddress && { opacity: 0.6 }]} onPress={handleSaveAddress} disabled={savingAddress}>
                {savingAddress ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveConfirmText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* GCash Payment Confirmation Modal */}
      {gcashOrder && (
        <View style={styles.gcashOverlay}>
          <View style={styles.gcashConfirmCard}>
            <Ionicons name="checkmark-circle" size={48} color="#27AE60" />
            <Text style={styles.gcashConfirmTitle}>Order Placed!</Text>
            <Text style={styles.gcashConfirmOrder}>#{gcashOrder.orderNumber}</Text>
            <Text style={styles.gcashConfirmAmount}>Amount Due: P{gcashOrder.amount.toFixed(2)}</Text>
            <View style={styles.gcashConfirmSep} />
            <Text style={styles.gcashConfirmLabel}>Pay via GCash</Text>
            {settings?.gcash_qr_image ? (
              <Image source={{ uri: settings.gcash_qr_image }} style={styles.gcashConfirmQr} />
            ) : (
              <View style={styles.gcashConfirmQrPlaceholder}>
                <Ionicons name="phone-portrait-outline" size={32} color="#F25C05" />
                <Text style={styles.gcashConfirmQrNumber}>{settings?.gcash_number || "N/A"}</Text>
              </View>
            )}
            <Text style={styles.gcashConfirmNumber}>Send to: {settings?.gcash_number || "N/A"}</Text>
            <TouchableOpacity
              style={[styles.gcashNotifyBtn, notifyingGcash && { opacity: 0.6 }]}
              onPress={async () => {
                setNotifyingGcash(true);
                try {
                  await notifyGcashPayment(gcashOrder.orderId, customerName, phone, gcashOrder.amount);
                  log.info("GCash notification sent", { orderId: gcashOrder.orderId, amount: gcashOrder.amount });
                  Alert.alert("Notification Sent", "The store has been notified of your payment. Track your order in the Orders tab.", [
                    { text: "View Orders", onPress: () => { setGcashOrder(null); router.replace("/(tabs)/collections"); } }
                  ]);
                } catch (e: any) {
                  log.error("GCash notification failed", e);
                  Alert.alert("Error", e.message || "Failed to notify store.");
                }
                setNotifyingGcash(false);
              }}
              disabled={notifyingGcash}
            >
              {notifyingGcash ? <ActivityIndicator color="#fff" /> : <Ionicons name="notifications" size={18} color="#fff" />}
              <Text style={styles.gcashNotifyBtnText}>Notify Store of Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gcashConfirmLater} onPress={() => { setGcashOrder(null); router.replace("/(tabs)/collections"); }}>
              <Text style={styles.gcashConfirmLaterText}>View in Orders</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  cartImage: {
    width: 50, height: 50, borderRadius: 10, marginRight: 12,
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
  phoneError: { color: "#E74C3C", fontSize: 12, marginHorizontal: 16, marginTop: 2 },
  gcashQrSection: {
    marginHorizontal: 16, marginTop: 8, backgroundColor: "#fff",
    borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1.5, borderColor: "#E8D8A0",
  },
  gcashQrTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06", marginBottom: 12 },
  gcashQrImage: { width: 160, height: 160, borderRadius: 12, marginBottom: 12 },
  gcashQrPlaceholder: {
    width: 160, height: 160, borderRadius: 12, backgroundColor: "#FFF5EE",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
    borderWidth: 2, borderColor: "#F25C05", borderStyle: "dashed",
  },
  gcashQrPlaceholderNumber: { fontSize: 18, fontWeight: "bold", color: "#F25C05", marginTop: 8 },
  gcashQrLabel: { fontSize: 13, color: "#555", marginBottom: 8 },
  gcashInstructions: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "#EBF5FB", borderRadius: 10, padding: 10,
  },
  gcashInstructionText: { flex: 1, fontSize: 11, color: "#2E1A06", lineHeight: 16 },
  gcashOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center",
    zIndex: 999,
  },
  gcashConfirmCard: {
    backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "85%",
    alignItems: "center", elevation: 10,
  },
  gcashConfirmTitle: { fontSize: 20, fontWeight: "bold", color: "#2E1A06", marginTop: 8 },
  gcashConfirmOrder: { fontSize: 14, color: "#888", marginTop: 2, fontWeight: "600" },
  gcashConfirmAmount: { fontSize: 16, fontWeight: "bold", color: "#F25C05", marginTop: 6 },
  gcashConfirmSep: { width: "60%", height: 1, backgroundColor: "#eee", marginVertical: 14 },
  gcashConfirmLabel: { fontSize: 13, color: "#888", marginBottom: 8 },
  gcashConfirmQr: { width: 140, height: 140, borderRadius: 10, marginBottom: 8 },
  gcashConfirmQrPlaceholder: {
    width: 140, height: 140, borderRadius: 10, backgroundColor: "#FFF5EE",
    justifyContent: "center", alignItems: "center", marginBottom: 8,
    borderWidth: 2, borderColor: "#F25C05", borderStyle: "dashed",
  },
  gcashConfirmQrNumber: { fontSize: 16, fontWeight: "bold", color: "#F25C05", marginTop: 6 },
  gcashConfirmNumber: { fontSize: 13, color: "#555", marginBottom: 14 },
  gcashNotifyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#F25C05", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, width: "100%",
  },
  gcashNotifyBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  gcashConfirmLater: { marginTop: 12, padding: 8 },
  gcashConfirmLaterText: { color: "#888", fontSize: 13 },
  savedAddressesRow: { paddingHorizontal: 16, gap: 8 },
  savedAddressCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    minWidth: 180, maxWidth: 220, borderWidth: 1, borderColor: "#E8D8A0", elevation: 1,
  },
  savedAddressCardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6,
  },
  savedAddressLabel: { fontSize: 13, fontWeight: "bold", color: "#F25C05" },
  savedAddressText: { fontSize: 12, color: "#333", lineHeight: 16 },
  savedAddressPhone: { fontSize: 11, color: "#888", marginTop: 4 },
  addressInputRow: {
    flexDirection: "row", alignItems: "flex-start", marginHorizontal: 16, gap: 8,
  },
  saveAddressBtn: {
    backgroundColor: "#F25C05", borderRadius: 12, padding: 14,
    justifyContent: "center", alignItems: "center",
  },
  suggestionsContainer: {
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: 2,
    borderRadius: 12, borderWidth: 1, borderColor: "#E8D8A0",
    elevation: 4, zIndex: 10,
  },
  suggestionItem: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  suggestionText: { fontSize: 13, color: "#333", flex: 1, lineHeight: 18 },
  saveOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center",
  },
  saveCard: {
    backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "80%",
    alignItems: "center", elevation: 10,
  },
  saveTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06", marginTop: 8, marginBottom: 16 },
  saveInput: {
    backgroundColor: "#F9F0DC", borderRadius: 12, padding: 14, width: "100%",
    fontSize: 14, color: "#333", borderWidth: 1, borderColor: "#E8D8A0",
  },
  saveActions: {
    flexDirection: "row", gap: 12, marginTop: 16, width: "100%",
  },
  saveCancelBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  saveCancelText: { fontSize: 14, color: "#666", fontWeight: "600" },
  saveConfirmBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center",
    backgroundColor: "#F25C05",
  },
  saveConfirmText: { fontSize: 14, color: "#fff", fontWeight: "bold" },
});
