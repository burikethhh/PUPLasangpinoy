import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, getProfile, logOut } from "../../lib/firebase";

export default function StaffProfileScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setEmail(user.email || "");
      getProfile(user.uid).then((p) => {
        if (p) setUsername(p.username);
      });
    }
  }, []);

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logOut();
          router.replace("/(auth)/welcome");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#3498DB" />
          </View>
          <Text style={styles.name}>{username}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Staff</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  title: { fontSize: 24, fontWeight: "bold", color: "#2E1A06", marginBottom: 16 },
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center",
    elevation: 2, marginBottom: 16,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#3498DB22",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: "bold", color: "#2E1A06" },
  email: { fontSize: 14, color: "#888", marginTop: 4 },
  roleBadge: {
    backgroundColor: "#3498DB22", paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 12, marginTop: 12,
  },
  roleText: { color: "#3498DB", fontWeight: "bold", fontSize: 13 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E74C3C",
  },
  logoutText: { color: "#E74C3C", fontWeight: "bold", fontSize: 15 },
});
