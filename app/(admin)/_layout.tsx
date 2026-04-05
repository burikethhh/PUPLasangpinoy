import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { onAuthChange, isAdmin } from "../../lib/firebase";

export default function AdminLayout() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Use onAuthChange so we wait for Firebase to restore the persisted session
    const unsubscribe = onAuthChange(async (user) => {
      try {
        if (!user) {
          router.replace("/(auth)/welcome");
          return;
        }
        const adminStatus = await isAdmin(user.uid);
        if (!adminStatus) {
          router.replace("/(tabs)");
          return;
        }
        setAuthorized(true);
      } catch (error) {
        console.error("Admin check failed:", error);
        router.replace("/(auth)/welcome");
      } finally {
        setChecking(false);
        unsubscribe(); // Only need the first auth state resolution
      }
    });
    return () => unsubscribe();
  }, []);

  if (checking || !authorized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F9F0DC",
        }}
      >
        <ActivityIndicator size="large" color="#F25C05" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
