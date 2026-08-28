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
  const [greeting, setGreeting] = useState("Welcome!");

  useFocusEffect(
    useCallback(() => {
      const user = getCurrentUser();
      const firstName = user?.displayName?.split(" ")[0] || "there";
      setGreeting(`Hello, ${firstName}! Welcome to FoodFix`);
      
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
        { id: "1", name: "Fresh Daily Specials!", imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1", active: true, createdAt: new Date() },
        { id: "2", name: "Try our Made-to-Order Dishes", imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38", active: true, createdAt: new Date() }
      ];

      fetchBanners().then(() => {
        setBanners(prev => prev.length ? prev : fallbackBanners);
      });
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Curved Header with Gradient */}
        <View style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <Text style={styles.greeting}>{greeting}</Text>
            <View style={styles.subGreetingBadge}>
              <Ionicons name="flame" size={14} color="#F25C05" />
              <Text style={styles.subGreeting}>Fresh Daily Filipino Favorites</Text>
            </View>
          </View>
          <View style={styles.headerCurve} />
        </View>

        {/* Featured Offers Banner */}
        <View style={styles.bannerSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="sparkles" size={16} color="#F25C05" />
            </View>
            <Text style={styles.sectionTitle}>Featured Offers</Text>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color="#F25C05" style={{ marginVertical: 40 }} />
          ) : banners.length === 0 ? (
            <View style={styles.emptyBannerPlaceholder}>
              <Ionicons name="image-outline" size={36} color="#ccc" />
              <Text style={styles.emptyText}>No offers available</Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              snapToInterval={width * 0.85 + 20} 
              decelerationRate="fast" 
              style={styles.bannerScroll}
            >
              {banners.map((banner, idx) => (
                <View key={banner.id} style={[styles.bannerCard, { marginLeft: idx === 0 ? 12 : 0 }]}>
                  <Image 
                    source={{ uri: banner.imageUrl }} 
                    style={styles.bannerImage} 
                    contentFit="cover"
                    cachePolicy="none"
                  />
                  <View style={styles.bannerOverlay}>
                    <Text style={styles.bannerTitle}>{banner.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={styles.bannerCta}>Tap to explore</Text>
                      <Ionicons name="arrow-forward" size={12} color="#FFE6CC" />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="grid" size={16} color="#F25C05" />
            </View>
            <Text style={styles.sectionTitle}>Quick Access</Text>
          </View>
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/menu" as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#FFF0E6" }]}>
                <Ionicons name="restaurant" size={26} color="#F25C05" />
              </View>
              <Text style={styles.actionLabel}>Menu</Text>
              <Text style={styles.actionSub}>Browse all items</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/scan" as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#E8F8F5" }]}>
                <Ionicons name="cart" size={26} color="#34B36A" />
              </View>
              <Text style={styles.actionLabel}>Cart</Text>
              <Text style={styles.actionSub}>View order</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/collections" as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#FDF2E9" }]}>
                <Ionicons name="receipt" size={26} color="#E67E22" />
              </View>
              <Text style={styles.actionLabel}>Orders</Text>
              <Text style={styles.actionSub}>Track delivery</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/profile" as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#FFF8E1" }]}>
                <Ionicons name="sparkles" size={26} color="#FF9800" />
              </View>
              <Text style={styles.actionLabel}>Lamion AI</Text>
              <Text style={styles.actionSub}>Filipino Food AI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Promo Section */}
        <View style={styles.promoCard}>
          <Ionicons name="star" size={24} color="#FFD700" style={{ marginBottom: 8 }} />
          <Text style={styles.promoTitle}>Enjoy the taste of home!</Text>
          <Text style={styles.promoSubtitle}>Fresh-cooked Filipino cuisine, delivered to your door</Text>
          <TouchableOpacity style={styles.promoBtn} onPress={() => router.push("/(tabs)/menu" as any)}>
            <Text style={styles.promoBtnText}>Order Now</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  scrollContent: { paddingBottom: 40 },

  // Header with Curve
  headerGradient: { 
    backgroundColor: "#F25C05",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 20,
    elevation: 4,
  },
  headerContent: { 
    zIndex: 1,
  },
  greeting: { 
    fontSize: 28, 
    fontWeight: "900", 
    color: "#fff", 
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subGreetingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  subGreeting: { 
    fontSize: 13, 
    color: "#FFF5EA",
    fontWeight: "600",
  },
  headerCurve: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "#F9F0DC",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },

  // Banners
  bannerSection: { marginBottom: 28, paddingHorizontal: 12 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FFF0E6",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: "800", 
    color: "#2E1A06", 
    letterSpacing: -0.3,
  },
  emptyBannerPlaceholder: {
    height: 140,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
    gap: 8,
  },
  emptyText: { fontSize: 13, color: "#999" },
  bannerScroll: { paddingHorizontal: 0 },
  bannerCard: { 
    width: width * 0.85,
    height: 160,
    marginHorizontal: 8,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#eee",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  bannerImage: { width: "100%", height: "100%" },
  bannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 14,
    paddingBottom: 16,
  },
  bannerTitle: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "bold",
    marginBottom: 4,
  },
  bannerCta: {
    color: "#FFE6CC",
    fontSize: 12,
    fontWeight: "600",
  },

  // Quick Actions
  quickActions: { paddingHorizontal: 12, marginBottom: 24 },
  actionGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  actionBtn: { 
    width: "48%",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  actionIcon: { 
    width: 52, 
    height: 52, 
    borderRadius: 14, // Squircle shape
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: 10,
    elevation: 1,
  },
  actionLabel: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#2E1A06",
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
  },

  // Promo Card
  promoCard: {
    marginHorizontal: 12,
    backgroundColor: "#2E1A06",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
    textAlign: "center",
  },
  promoSubtitle: {
    fontSize: 13,
    color: "#E8D5C4",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 18,
  },
  promoBtn: {
    backgroundColor: "#F25C05",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promoBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});

