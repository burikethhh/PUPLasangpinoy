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
        tabBarInactiveTintColor: "#888",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#F0E4CE",
          borderTopWidth: 1,
          height: 60,
          paddingTop: 6,
          paddingBottom: 6,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              width: 36, height: 32, borderRadius: 10,
              backgroundColor: focused ? "#FFF0E6" : "transparent",
              justifyContent: "center", alignItems: "center"
            }}>
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              width: 36, height: 32, borderRadius: 10,
              backgroundColor: focused ? "#FFF0E6" : "transparent",
              justifyContent: "center", alignItems: "center"
            }}>
              <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              width: 36, height: 32, borderRadius: 10,
              backgroundColor: focused ? "#FFF0E6" : "transparent",
              justifyContent: "center", alignItems: "center"
            }}>
              <Ionicons name={focused ? "cart" : "cart-outline"} size={22} color={color} />
              {cartCount > 0 && (
                <View style={{
                  position: "absolute", top: -2, right: -4,
                  backgroundColor: "#F25C05", borderRadius: 8,
                  minWidth: 16, height: 16, justifyContent: "center", alignItems: "center",
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "bold" }}>{cartCount}</Text>
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
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              width: 36, height: 32, borderRadius: 10,
              backgroundColor: focused ? "#FFF0E6" : "transparent",
              justifyContent: "center", alignItems: "center"
            }}>
              <Ionicons name={focused ? "receipt" : "receipt-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              width: 36, height: 32, borderRadius: 10,
              backgroundColor: focused ? "#FFF0E6" : "transparent",
              justifyContent: "center", alignItems: "center"
            }}>
              <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: "Favorites",
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "heart" : "heart-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="submit-dish"
        options={{
          title: "Submit Dish",
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              width: 36, height: 32, borderRadius: 10,
              backgroundColor: focused ? "#FFF0E6" : "transparent",
              justifyContent: "center", alignItems: "center"
            }}>
              <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
