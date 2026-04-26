import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

const CART_KEY = "@foodfix_cart";

export default function TabLayout() {
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      const cart = raw ? JSON.parse(raw) : [];
      setCartCount(cart.reduce((s: number, i: any) => s + (i.quantity || 1), 0));
    } catch { setCartCount(0); }
  }, []);

  useEffect(() => {
    refreshCartCount();
    const interval = setInterval(refreshCartCount, 3000);
    return () => clearInterval(interval);
  }, [refreshCartCount]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F25C05",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#f0e8d0",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Menu",
          tabBarIcon: ({ color }) => (
            <Ionicons name="fast-food" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Cart",
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="cart" size={22} color={color} />
              {cartCount > 0 && (
                <View style={{
                  position: "absolute", top: -4, right: -10,
                  backgroundColor: "#F25C05", borderRadius: 9,
                  minWidth: 18, height: 18, justifyContent: "center", alignItems: "center",
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>{cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => (
            <Ionicons name="receipt" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color }) => (
            <Ionicons name="heart" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
