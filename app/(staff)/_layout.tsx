import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { onAuthChange, getProfile } from "../../lib/firebase";

export default function StaffLayout() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      try {
        if (!user) {
          router.replace("/(auth)/welcome");
          return;
        }
        const profile = await getProfile(user.uid);
        if (profile?.role !== "staff") {
          router.replace("/(auth)/welcome");
          return;
        }
        setAuthorized(true);
      } catch (error) {
        console.error("Staff check failed:", error);
        router.replace("/(auth)/welcome");
      } finally {
        setChecking(false);
        unsubscribe();
      }
    });
    return () => unsubscribe();
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
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
