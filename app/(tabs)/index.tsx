import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser } from "../../lib/firebase";
import { getBanners, type Banner } from "../../lib/firebase-store";

const { width } = Dimensions.get("window");

export default function Homepage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Welcome to FoodFix!");

  useFocusEffect(
    useCallback(() => {
      const user = getCurrentUser();
      setGreeting(user?.displayName ? `Hello, ${user.displayName}!` : "Welcome to FoodFix!");
      
      const fetchBanners = async () => {
        try {
          const fetched = await getBanners();
          setBanners(fetched.filter(b => b.active));
        } catch (error) {
          console.error("Error fetching banners:", error);
        } finally {
          setLoading(false);
        }
      };
      
      // Fallback local banners if DB is empty or fails
      const fallbackBanners: Banner[] = [
        { id: "1", name: "Summer Deals!", imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1", active: true, createdAt: new Date() },
        { id: "2", name: "Try our new Specials", imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38", active: true, createdAt: new Date() }
      ];

      fetchBanners().then(() => {
        setBanners(prev => prev.length ? prev : fallbackBanners);
      });
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header / Intro */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subGreeting}>What are you craving today?</Text>
        </View>

        {/* Banners */}
        <View style={styles.bannerSection}>
          <Text style={styles.sectionTitle}>Featured Offers</Text>
          {loading ? (
             <ActivityIndicator size="large" color="#F25C05" style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={width * 0.85 + 16} decelerationRate="fast" style={styles.bannerScroll}>
              {banners.map((banner) => (
                <View key={banner.id} style={styles.bannerCard}>
                  <Image source={{ uri: banner.imageUrl }} style={styles.bannerImage} contentFit="cover" />
                  <View style={styles.bannerOverlay}>
                    <Text style={styles.bannerTitle}>{banner.name}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Explore</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/(tabs)/menu" as any)}>
              <View style={[styles.actionIcon, { backgroundColor: "#FFF0E6" }]}>
                <Ionicons name="fast-food" size={28} color="#F25C05" />
              </View>
              <Text style={styles.actionLabel}>View Menu</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/submit")}>
              <View style={[styles.actionIcon, { backgroundColor: "#FFF0E6" }]}>
                <Ionicons name="heart" size={28} color="#E91E8C" />
              </View>
              <Text style={styles.actionLabel}>Favorites</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push("/collections")}>
              <View style={[styles.actionIcon, { backgroundColor: "#FFF0E6" }]}>
                <Ionicons name="receipt" size={28} color="#34B36A" />
              </View>
              <Text style={styles.actionLabel}>My Orders</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { paddingBottom: 40 },
  header: { padding: 20, paddingTop: 10 },
  greeting: { fontSize: 26, fontWeight: "900", color: "#2E1A06", marginBottom: 4 },
  subGreeting: { fontSize: 16, color: "#666" },
  bannerSection: { marginBottom: 25 },
  sectionTitle: { fontSize: 20, fontWeight: "bold", color: "#2E1A06", paddingHorizontal: 20, marginBottom: 15 },
  bannerScroll: { paddingHorizontal: 12 },
  bannerCard: { 
    width: width * 0.85, 
    height: 180, 
    marginHorizontal: 8, 
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#eee"
  },
  bannerImage: { width: "100%", height: "100%" },
  bannerOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 15,
  },
  bannerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  quickActions: { paddingHorizontal: 20 },
  actionGrid: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 15 },
  actionBtn: { width: "30%", alignItems: "center" },
  actionIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  actionLabel: { fontSize: 14, fontWeight: "600", color: "#2E1A06", textAlign: "center" }
});
