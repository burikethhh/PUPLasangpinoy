import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { isAdmin, onAuthChange } from "../../lib/firebase";

export default function AdminLayout() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      try {
        if (!user) { router.replace("/(auth)/welcome"); return; }
        const ok = await isAdmin(user.uid);
        if (!ok) { router.replace("/(tabs)"); return; }
        setAuthorized(true);
      } catch { router.replace("/(auth)/welcome"); }
      finally { setChecking(false); unsubscribe(); }
    });
    return () => unsubscribe();
  }, []);

  if (checking || !authorized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1A1A2E" }}>
        <ActivityIndicator size="large" color="#F25C05" />
      </View>
    );
  }

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#F25C05",
      tabBarInactiveTintColor: "#888",
      tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#eee" },
    }}>
      <Tabs.Screen name="index" options={{
        title: "Dashboard",
        tabBarIcon: ({ color }) => <Ionicons name="grid" size={22} color={color} />,
      }} />
      <Tabs.Screen name="recipes" options={{
        title: "Orders",
        tabBarIcon: ({ color }) => <Ionicons name="receipt" size={22} color={color} />,
      }} />
      <Tabs.Screen name="categories" options={{
        title: "Menu",
        tabBarIcon: ({ color }) => <Ionicons name="restaurant" size={22} color={color} />,
      }} />
      <Tabs.Screen name="feedback" options={{
        title: "Messages",
        tabBarIcon: ({ color }) => <Ionicons name="chatbubbles" size={22} color={color} />,
      }} />
      <Tabs.Screen name="users" options={{
        title: "More",
        tabBarIcon: ({ color }) => <Ionicons name="ellipsis-horizontal" size={22} color={color} />,
      }} />
      {/* Hide old screens from tab bar */}
      <Tabs.Screen name="regions" options={{ href: null }} />
      <Tabs.Screen name="submissions" options={{ href: null }} />
      <Tabs.Screen name="nutrition" options={{ href: null }} />
    </Tabs>
  );
}
