import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    deleteMyAccount,
    removeBookmark as firebaseRemoveBookmark,
    getBookmarksWithRecipes,
    getCurrentUser,
    getProfile as getFirebaseProfile,
    logOut,
    updateMyProfile,
} from "../../lib/firebase";

interface BookmarkedRecipe {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  region: string | null;
}

export default function ProfileScreen() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [favorites, setFavorites] = useState<BookmarkedRecipe[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [savedCount, setSavedCount] = useState(0);

  // Load dark mode preference on mount
  useEffect(() => {
    loadProfile();
    loadDarkModePreference();
  }, []);

  async function loadDarkModePreference() {
    try {
      const value = await AsyncStorage.getItem("darkMode");
      if (value !== null) setIsDarkMode(value === "true");
    } catch {
      /* ignore */
    }
  }

  async function toggleDarkMode(value: boolean) {
    setIsDarkMode(value);
    try {
      await AsyncStorage.setItem("darkMode", value.toString());
    } catch {
      /* ignore */
    }
  }

  // Refresh favorites when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, []),
  );

  async function fetchFavorites() {
    try {
      setLoadingFavorites(true);
      const user = getCurrentUser();
      if (!user) return;

      const recipes = await getBookmarksWithRecipes(user.uid);
      const bookmarkedRecipes: BookmarkedRecipe[] = recipes.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        image_url: r.image_url,
        region: r.region,
      }));

      setFavorites(bookmarkedRecipes);
      setSavedCount(bookmarkedRecipes.length);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setLoadingFavorites(false);
    }
  }

  async function removeFromFavorites(recipeId: string) {
    Alert.alert("Remove Favorite", "Remove this recipe from your favorites?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const user = getCurrentUser();
            if (!user) return;

            await firebaseRemoveBookmark(user.uid, recipeId);

            setFavorites((prev) => prev.filter((r) => r.id !== recipeId));
            setSavedCount((prev) => prev - 1);
          } catch (error) {
            console.error("Error removing favorite:", error);
          }
        },
      },
    ]);
  }

  async function loadProfile() {
    const user = getCurrentUser();
    if (user) {
      setEmail(user.email || "");
      const profile = await getFirebaseProfile(user.uid);
      setUsername(profile?.username || user.email?.split("@")[0] || "Chef");
    }
  }

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logOut();
          router.replace("/(auth)/welcome");
        },
      },
    ]);
  }

  function openEditProfile() {
    setEditUsername(username);
    setEditModalVisible(true);
  }

  async function saveProfile() {
    if (!editUsername.trim()) {
      Alert.alert("Error", "Display name cannot be empty.");
      return;
    }
    try {
      await updateMyProfile({ username: editUsername.trim() });
      setUsername(editUsername.trim());
      setEditModalVisible(false);
      Alert.alert("Success", "Profile updated!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account, bookmarks, and all data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMyAccount();
              router.replace("/(auth)/welcome");
            } catch (error: any) {
              if (error.code === "auth/requires-recent-login") {
                Alert.alert(
                  "Re-authentication Required",
                  "For security, please log out and log back in, then try deleting your account again.",
                );
              } else {
                Alert.alert("Error", error.message);
              }
            }
          },
        },
      ],
    );
  }

  const bg = isDarkMode ? "#1A1A2E" : "#F9F0DC";
  const cardBg = isDarkMode ? "#2A2A3E" : "#FFFFFF";
  const textColor = isDarkMode ? "#FFFFFF" : "#2E1A06";
  const subColor = isDarkMode ? "#AAAACC" : "#888888";
  const orange = "#F25C05";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            Profile
          </Text>
        </View>

        {/* PROFILE CARD */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.name, { color: textColor }]}>
            {username.charAt(0).toUpperCase() + username.slice(1)}
          </Text>
          <Text style={[styles.email, { color: subColor }]}>{email}</Text>
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={openEditProfile}
          >
            <Ionicons name="pencil" size={14} color="#fff" />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
          <View
            style={[
              styles.divider,
              { backgroundColor: isDarkMode ? "#3A3A5E" : "#F0EAE0" },
            ]}
          />
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: textColor }]}>
                {savedCount}
              </Text>
              <Text style={[styles.statLbl, { color: orange }]}>Saved</Text>
            </View>
            <View
              style={[
                styles.statDiv,
                { backgroundColor: isDarkMode ? "#3A3A5E" : "#E0D8C8" },
              ]}
            />
            <View style={styles.stat}>
              <Ionicons name="time-outline" size={20} color={subColor} />
              <Text style={[styles.statLbl, { color: subColor, fontSize: 10 }]}>
                Coming Soon
              </Text>
            </View>
          </View>
        </View>

        {/* MY FAVORITES CARD */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, alignItems: "flex-start" },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              My Favorites
            </Text>
            <View style={[styles.badge, { backgroundColor: orange + "22" }]}>
              <Text style={[styles.badgeText, { color: orange }]}>
                {savedCount}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.divider,
              { backgroundColor: isDarkMode ? "#3A3A5E" : "#F0EAE0" },
            ]}
          />

          {loadingFavorites ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={orange} />
              <Text style={[styles.loadingText, { color: subColor }]}>
                Loading favorites...
              </Text>
            </View>
          ) : favorites.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={40} color={subColor} />
              <Text style={[styles.emptyText, { color: subColor }]}>
                No favorites yet
              </Text>
              <Text style={[styles.emptySubtext, { color: subColor }]}>
                Save recipes you love by tapping the heart icon
              </Text>
            </View>
          ) : (
            <View style={styles.favoritesGrid}>
              {favorites.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  style={[
                    styles.favoriteCard,
                    { backgroundColor: isDarkMode ? "#3A3A5E" : "#F9F5EF" },
                  ]}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{
                      uri:
                        recipe.image_url ||
                        "https://via.placeholder.com/100x80?text=No+Image",
                    }}
                    style={styles.favoriteImage}
                  />
                  <View style={styles.favoriteInfo}>
                    <Text
                      style={[styles.favoriteTitle, { color: textColor }]}
                      numberOfLines={1}
                    >
                      {recipe.title}
                    </Text>
                    <Text
                      style={[styles.favoriteCategory, { color: subColor }]}
                      numberOfLines={1}
                    >
                      {recipe.category}{" "}
                      {recipe.region ? `• ${recipe.region}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeFromFavorites(recipe.id)}
                  >
                    <Ionicons name="heart" size={18} color="#E74C3C" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* SETTINGS CARD */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, alignItems: "flex-start" },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Settings
          </Text>
          <View
            style={[
              styles.divider,
              { backgroundColor: isDarkMode ? "#3A3A5E" : "#F0EAE0" },
            ]}
          />

          {/* DARK MODE - ENABLED */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View
                style={[
                  styles.settingIcon,
                  { backgroundColor: "#4A8FE7" + "22" },
                ]}
              >
                <Ionicons
                  name={isDarkMode ? "moon" : "sunny"}
                  size={18}
                  color="#4A8FE7"
                />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>
                {isDarkMode ? "Dark Mode" : "Light Mode"}
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ false: "#ddd", true: orange }}
              thumbColor="#fff"
            />
          </View>

          {/* NOTIFICATIONS - DISABLED */}
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingLeft}>
              <View
                style={[styles.settingIcon, { backgroundColor: "#34B36A22" }]}
              >
                <Ionicons name="notifications" size={18} color="#34B36A" />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>
                Notifications
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: subColor }}>Coming Soon</Text>
          </View>
        </View>

        {/* ABOUT CARD */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, alignItems: "flex-start" },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            About App
          </Text>
          <View
            style={[
              styles.divider,
              { backgroundColor: isDarkMode ? "#3A3A5E" : "#F0EAE0" },
            ]}
          />

          {/* ABOUT - DISABLED */}
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingLeft}>
              <View
                style={[styles.settingIcon, { backgroundColor: orange + "22" }]}
              >
                <Ionicons name="information-circle" size={18} color={orange} />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>
                About Lasang Pinoy
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: subColor }}>Coming Soon</Text>
          </View>

          {/* RATE APP - DISABLED */}
          <View style={[styles.settingRow, { opacity: 0.4 }]}>
            <View style={styles.settingLeft}>
              <View
                style={[styles.settingIcon, { backgroundColor: orange + "22" }]}
              >
                <Ionicons name="star" size={18} color={orange} />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>
                Rate the App
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: subColor }}>Coming Soon</Text>
          </View>

          {/* POLICIES & PROCEDURES */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/policies' as any)}
          >
            <View style={styles.settingLeft}>
              <View
                style={[styles.settingIcon, { backgroundColor: "#88888822" }]}
              >
                <Ionicons name="document-text" size={18} color="#888" />
              </View>
              <Text style={[styles.settingText, { color: textColor }]}>
                Policies & Procedures
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={subColor} />
          </TouchableOpacity>

          <Text style={[styles.version, { color: subColor }]}>
            Version 1.0.0
          </Text>
        </View>

        {/* LOG OUT */}
        <TouchableOpacity
          style={[
            styles.logoutBtn,
            { backgroundColor: isDarkMode ? "#3A1A1A" : "#FFE8E5" },
          ]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color="#D92614" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* DELETE ACCOUNT */}
        <TouchableOpacity
          style={[
            styles.deleteAccountBtn,
            { backgroundColor: isDarkMode ? "#3A1A1A" : "#FFE8E5" },
          ]}
          onPress={handleDeleteAccount}
        >
          <Ionicons name="warning-outline" size={18} color="#D92614" />
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>

        {/* EDIT PROFILE MODAL */}
        <Modal visible={editModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: isDarkMode ? "#2A2A3E" : "#fff" },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: textColor }]}>
                  Edit Profile
                </Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={24} color={subColor} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalInputLabel, { color: subColor }]}>
                  Display Name
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDarkMode ? "#3A3A5E" : "#FDF5E0",
                      color: textColor,
                    },
                  ]}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder="Your display name"
                  placeholderTextColor={subColor}
                />
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[
                    styles.modalCancelBtn,
                    { backgroundColor: isDarkMode ? "#3A3A5E" : "#eee" },
                  ]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={[styles.modalCancelText, { color: subColor }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={saveProfile}
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 8 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  card: {
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 20,
    alignItems: "center",
    elevation: 2,
    // @ts-ignore - web shadow
    boxShadow: "0px 1px 8px rgba(0, 0, 0, 0.06)",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F25C05",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#fff", fontWeight: "bold", fontSize: 32 },
  name: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  email: { fontSize: 12, marginBottom: 4 },
  role: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  divider: { width: "100%", height: 1, marginVertical: 12 },
  statsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
  },
  stat: { alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "bold" },
  statLbl: { fontSize: 12, marginTop: 2 },
  statDiv: { width: 1, height: "100%" },
  sectionTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontWeight: "bold" },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    width: "100%",
  },
  loadingText: { fontSize: 12, marginTop: 8 },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    width: "100%",
  },
  emptyText: { fontSize: 14, fontWeight: "600", marginTop: 10 },
  emptySubtext: { fontSize: 12, textAlign: "center", marginTop: 4 },
  favoritesGrid: { width: "100%", gap: 10 },
  favoriteCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 10,
    gap: 12,
  },
  favoriteImage: {
    width: 60,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#E0D8C8",
  },
  favoriteInfo: { flex: 1 },
  favoriteTitle: { fontSize: 14, fontWeight: "600" },
  favoriteCategory: { fontSize: 11, marginTop: 2 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingVertical: 10,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  settingText: { fontSize: 14 },
  version: { fontSize: 11, marginTop: 8, alignSelf: "center" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  logoutText: { color: "#D92614", fontWeight: "bold", fontSize: 15 },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F25C05",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  editProfileText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  deleteAccountText: { color: "#D92614", fontWeight: "600", fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  modalInputGroup: { marginBottom: 12 },
  modalInputLabel: { fontSize: 12, marginBottom: 4, fontWeight: "600" },
  modalInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    height: 46,
  },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  modalCancelText: { fontWeight: "600" },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: "#F25C05",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  modalSaveText: { color: "#fff", fontWeight: "bold" },
});
