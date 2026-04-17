import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { getProfile, onAuthChange } from "../../lib/firebase";

export default function StaffLayout() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthChange(async (user) => {
      try {
        if (!user) {
          router.replace("/(auth)/welcome");
          return;
        }
        const profile = await getProfile(user.uid);
        if (profile?.role !== "staff" && profile?.role !== "admin") {
          router.replace("/(auth)/welcome");
          return;
        }
        if (mounted) setAuthorized(true);
      } catch (error) {
        console.error("Staff check failed:", error);
        router.replace("/(auth)/welcome");
      } finally {
        if (mounted) setChecking(false);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (checking || !authorized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9F0DC" }}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#3498DB",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#f0e8d0" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <Ionicons name="receipt" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="attendance" options={{ href: null }} />
    </Tabs>
  );
}
