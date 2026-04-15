import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, Alert,
    ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OrderType, PaymentMethod } from "../../constants/order";
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "../../constants/order";
import { getCurrentUser, getProfile } from "../../lib/firebase";
import { createOrder, getSettings, type AppSettings } from "../../lib/firebase-store";

const CART_KEY = "@lasangpinoy_cart";

interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
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

  useFocusEffect(useCallback(() => { loadCart(); loadSettings(); loadProfile(); }, []));

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

  async function saveCart(items: CartItem[]) {
    setCart(items);
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function updateQty(idx: number, delta: number) {
    const next = [...cart];
    next[idx].quantity = Math.max(1, next[idx].quantity + delta);
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

  async function handleCheckout() {
    const user = getCurrentUser();
    if (!user) return Alert.alert("Sign In", "Please sign in to place an order.");
    if (cart.length === 0) return Alert.alert("Empty Cart", "Add items first.");
    if ((orderType === "delivery_now" || orderType === "delivery_later") && !address.trim())
      return Alert.alert("Address Required", "Please enter your delivery address.");
    if (!phone.trim()) return Alert.alert("Phone Required", "Please enter your contact number.");
    if (orderType === "delivery_later" && (!scheduledDate || !scheduledTime))
      return Alert.alert("Schedule Required", "Please set date and time for later delivery.");

    const profile = await getProfile(user.uid);

    setPlacing(true);
    try {
      const result = await createOrder({
        customer_id: user.uid,
        customer_name: profile?.username || "Customer",
        customer_phone: phone.trim(),
        customer_address: address.trim(),
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
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(idx, 1)}>
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
            <View style={styles.optionsRow}>
              {(["delivery_now", "delivery_later", "dine_in", "pick_up"] as OrderType[]).map((t) => (
                <TouchableOpacity key={t}
                  style={[styles.optionBtn, orderType === t && styles.optionBtnActive]}
                  onPress={() => setOrderType(t)}>
                  <Text style={[styles.optionText, orderType === t && styles.optionTextActive]}>
                    {ORDER_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Scheduled date/time for later delivery */}
            {orderType === "delivery_later" && (
              <View style={styles.scheduleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput style={styles.input} placeholder="2025-01-15" value={scheduledDate}
                    onChangeText={setScheduledDate} placeholderTextColor="#aaa" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Time (HH:MM)</Text>
                  <TextInput style={styles.input} placeholder="14:30" value={scheduledTime}
                    onChangeText={setScheduledTime} placeholderTextColor="#aaa" />
                </View>
              </View>
            )}

            {/* Payment Method */}
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <View style={styles.optionsRow}>
              {(["cod", "gcash"] as PaymentMethod[]).map((m) => (
                <TouchableOpacity key={m}
                  style={[styles.optionBtn, paymentMethod === m && styles.optionBtnActive,
                    m === "gcash" && !settings?.gcash_enabled && { opacity: 0.4 }]}
                  onPress={() => { if (m === "gcash" && !settings?.gcash_enabled) return; setPaymentMethod(m); }}
                  disabled={m === "gcash" && !settings?.gcash_enabled}>
                  <Ionicons name={m === "cod" ? "cash-outline" : "phone-portrait-outline"} size={16}
                    color={paymentMethod === m ? "#fff" : "#666"} />
                  <Text style={[styles.optionText, paymentMethod === m && styles.optionTextActive]}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Address & Phone */}
            {(orderType === "delivery_now" || orderType === "delivery_later") && (
              <>
                <Text style={styles.inputLabel}>Delivery Address</Text>
                <TextInput style={styles.input} placeholder="Enter your full address"
                  value={address} onChangeText={setAddress} placeholderTextColor="#aaa" multiline />
              </>
            )}
            <Text style={styles.inputLabel}>Contact Number</Text>
            <TextInput style={styles.input} placeholder="09XX XXX XXXX"
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#aaa" />

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
  optionsRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8 },
  optionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd",
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
});
