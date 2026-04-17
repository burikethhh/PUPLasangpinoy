import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { FOOD_CATEGORY_COLORS } from "../../constants/food-categories";
import {
    addBookmark,
    addFeedback,
    addRecipeToCollection,
    isBookmarked as checkIsBookmarked,
    createCollection,
    Recipe as FirebaseRecipe,
    getCollections,
    getCurrentUser,
    getFeedback,
    getProfile,
    getRecipe,
    RecipeCollection,
    removeBookmark,
} from "../../lib/firebase";

type Recipe = FirebaseRecipe;

type Feedback = {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: any;
  username?: string;
};

export default function RecipeDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const recipeId = String(id);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  // Bookmark
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Feedback
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [hasUserReviewed, setHasUserReviewed] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    history: false,
    funFact: false,
    ingredients: true,
    instructions: false,
    nutrition: false,
    healthNotes: false,
  });

  function toggleSection(key: string) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Collections
  const [collModalVisible, setCollModalVisible] = useState(false);
  const [userCollections, setUserCollections] = useState<RecipeCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [newCollName, setNewCollName] = useState("");
  const [creatingColl, setCreatingColl] = useState(false);

  useEffect(() => {
    fetchRecipeData();
    fetchFeedbackData(); // load reviews for everyone, auth or not
    checkUser();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkUser() {
    const user = getCurrentUser();
    if (user) {
      setUserId(user.uid);
      checkBookmarkStatus(user.uid);
      fetchFeedbackData();
    }
  }

  async function fetchRecipeData() {
    try {
      const data = await getRecipe(recipeId);
      setRecipe(data);
    } catch (error) {
      console.error("Error fetching recipe:", error);
    }
    setLoading(false);
  }

  async function checkBookmarkStatus(uid: string) {
    try {
      const bookmarked = await checkIsBookmarked(uid, recipeId);
      setIsBookmarked(bookmarked);
    } catch (error) {
      console.error("Error checking bookmark:", error);
    }
  }

  async function toggleBookmark() {
    if (!userId) {
      Alert.alert("Sign In Required", "Please sign in to save recipes.");
      return;
    }
    setBookmarkLoading(true);
    try {
      if (isBookmarked) {
        await removeBookmark(userId, recipeId);
        setIsBookmarked(false);
      } else {
        await addBookmark(userId, recipeId);
        setIsBookmarked(true);
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
    }
    setBookmarkLoading(false);
  }

  async function fetchFeedbackData() {
    try {
      const data = await getFeedback(recipeId);
      const feedbackWithUsernames = await Promise.all(
        data.map(async (fb) => {
          const profile = await getProfile(fb.user_id);
          return { ...fb, username: profile?.username || "Anonymous" };
        }),
      );
      setFeedbackList(feedbackWithUsernames);
      const user = getCurrentUser();
      if (user) {
        setHasUserReviewed(data.some((fb) => fb.user_id === user.uid));
      }
    } catch (error) {
      console.error("Error fetching feedback:", error);
    }
  }

  async function openCollectionModal() {
    if (!userId) {
      Alert.alert("Sign In Required", "Please sign in to save to a collection.");
      return;
    }
    setCollModalVisible(true);
    setLoadingCollections(true);
    try {
      const data = await getCollections(userId);
      setUserCollections(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCollections(false);
    }
  }

  async function handleSaveToCollection(coll: RecipeCollection) {
    try {
      await addRecipeToCollection(coll.id, recipeId);
      setCollModalVisible(false);
      Alert.alert("Saved!", `"${recipe?.title}" added to "${coll.name}".`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  }

  async function handleCreateAndSave() {
    if (!newCollName.trim() || !userId) return;
    setCreatingColl(true);
    try {
      const result = await createCollection(userId, newCollName.trim());
      const newColl: RecipeCollection = {
        id: (result as { id: string }).id,
        user_id: userId,
        name: newCollName.trim(),
        description: "",
        recipe_ids: [],
        created_at: { seconds: Date.now() / 1000 },
        updated_at: { seconds: Date.now() / 1000 },
      };
      await addRecipeToCollection(newColl.id, recipeId);
      setCollModalVisible(false);
      setNewCollName("");
      Alert.alert("Saved!", `"${recipe?.title}" added to "${newColl.name}".`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreatingColl(false);
    }
  }

  async function submitFeedback() {
    if (!userId) {
      Alert.alert("Sign In Required", "Please sign in to leave feedback.");
      return;
    }
    if (userRating === 0) {
      Alert.alert("Rating Required", "Please select a star rating.");
      return;
    }
    setSubmittingFeedback(true);
    try {
      await addFeedback(userId, recipeId, userRating, userComment);
      Alert.alert("Thank You!", "Your feedback has been submitted.");
      setUserRating(0);
      setUserComment("");
      setShowFeedbackForm(false);
      fetchFeedbackData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit feedback");
    }
    setSubmittingFeedback(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#F25C05"
          style={{ marginTop: 100 }}
        />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: "center", marginTop: 100 }}>
          Recipe not found.
        </Text>
      </SafeAreaView>
    );
  }

  const color = FOOD_CATEGORY_COLORS[recipe.category] || "#F25C05";
  const ingList =
    recipe.ingredients?.split(",").map((i: string) => i.trim()) || [];
  const avgRating =
    feedbackList.length > 0
      ? (
          feedbackList.reduce((sum, f) => sum + f.rating, 0) /
          feedbackList.length
        ).toFixed(1)
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── TOP ACTION BAR ── */}
        <View style={[styles.topRow, { top: insets.top + 8 }]}>
          {/* Back */}
          <TouchableOpacity style={styles.topBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#2E1A06" />
          </TouchableOpacity>

          {/* Right cluster */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Share */}
            <TouchableOpacity
              style={styles.topBtn}
              onPress={async () => {
                try {
                  await Share.share({
                    title: recipe.title,
                    message: `🍽️ ${recipe.title}\n\n📍 ${recipe.region || "Filipino Cuisine"}\n📂 ${recipe.category}\n\n🧾 Ingredients:\n${recipe.ingredients}\n\nShared from FOODFIX 🇵🇭`,
                  });
                } catch {
                  /* user cancelled */
                }
              }}
            >
              <Ionicons name="share-social-outline" size={20} color="#F25C05" />
            </TouchableOpacity>

            {/* Save to Collection */}
            <TouchableOpacity
              style={styles.topBtn}
              onPress={openCollectionModal}
            >
              <Ionicons name="folder-outline" size={20} color="#9B59B6" />
            </TouchableOpacity>

            {/* Bookmark toggle */}
            <TouchableOpacity
              style={[styles.topBtn, isBookmarked && styles.bookmarkedBtn]}
              onPress={toggleBookmark}
              disabled={bookmarkLoading}
            >
              {bookmarkLoading ? (
                <ActivityIndicator size="small" color="#F25C05" />
              ) : (
                <Ionicons
                  name={isBookmarked ? "bookmark" : "bookmark-outline"}
                  size={20}
                  color={isBookmarked ? "#fff" : "#F25C05"}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── RECIPE IMAGE ── */}
        {recipe.image_url ? (
          <Image
            source={{ uri: recipe.image_url }}
            style={styles.recipeImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.recipeImagePlaceholder}>
            <Text style={{ fontSize: 70 }}>🍽️</Text>
          </View>
        )}

        {/* ── TITLE & META ── */}
        <View style={styles.titleBox}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>

          {avgRating && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color="#FFB800" />
              <Text style={styles.ratingText}>{avgRating}</Text>
              <Text style={styles.ratingCount}>
                ({feedbackList.length} reviews)
              </Text>
            </View>
          )}

          <View style={styles.tagsRow}>
            {recipe.category ? (
              <View style={[styles.tag, { backgroundColor: color + "22" }]}>
                <Text style={[styles.tagText, { color }]}>
                  {recipe.category}
                </Text>
              </View>
            ) : null}
            {recipe.region ? (
              <View style={[styles.tag, { backgroundColor: "#9B59B622" }]}>
                <Ionicons name="map-outline" size={12} color="#9B59B6" />
                <Text style={[styles.tagText, { color: "#9B59B6" }]}>
                  {recipe.region}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── HISTORY / BACKGROUND ── */}
        {recipe.history ? (
          <View style={[styles.card, { backgroundColor: "#FFF8E7" }]}>
            <TouchableOpacity activeOpacity={0.7} style={styles.cardHeaderBtn} onPress={() => toggleSection("history")}>
              <View style={[styles.cardIcon, { backgroundColor: "#C07A2022" }]}>
                <Ionicons name="book-outline" size={20} color="#C07A20" />
              </View>
              <Text style={[styles.cardTitle, { flex: 1 }]}>History & Background</Text>
              <Ionicons name={expandedSections.history ? "chevron-up" : "chevron-down"} size={18} color="#aaa" />
            </TouchableOpacity>
            {expandedSections.history && (
              <><View style={styles.divider} /><Text style={styles.bodyText}>{recipe.history}</Text></>
            )}
          </View>
        ) : null}

        {/* ── FUN FACT ── */}
        {recipe.fun_fact ? (
          <View style={[styles.card, { backgroundColor: "#F0F8FF" }]}>
            <TouchableOpacity activeOpacity={0.7} style={styles.cardHeaderBtn} onPress={() => toggleSection("funFact")}>
              <View style={[styles.cardIcon, { backgroundColor: "#4A8FE722" }]}>
                <Ionicons name="bulb-outline" size={20} color="#4A8FE7" />
              </View>
              <Text style={[styles.cardTitle, { flex: 1 }]}>Fun Fact</Text>
              <Ionicons name={expandedSections.funFact ? "chevron-up" : "chevron-down"} size={18} color="#aaa" />
            </TouchableOpacity>
            {expandedSections.funFact && (
              <><View style={styles.divider} /><Text style={styles.bodyText}>{recipe.fun_fact}</Text></>
            )}
          </View>
        ) : null}

        {/* ── INGREDIENTS ── */}
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.7} style={styles.cardHeaderBtn} onPress={() => toggleSection("ingredients")}>
            <View style={[styles.cardIcon, { backgroundColor: color + "22" }]}>
              <Ionicons name="basket-outline" size={20} color={color} />
            </View>
            <Text style={[styles.cardTitle, { flex: 1 }]}>Ingredients</Text>
            <Ionicons name={expandedSections.ingredients ? "chevron-up" : "chevron-down"} size={18} color="#aaa" />
          </TouchableOpacity>
          {expandedSections.ingredients && (
            <><View style={styles.divider} />
            {ingList.map((ing: string, i: number) => (
              <View key={i} style={styles.ingRow}>
                <View style={[styles.ingDot, { backgroundColor: color }]} />
                <Text style={styles.ingText}>{ing}</Text>
              </View>
            ))}</>
          )}
        </View>

        {/* ── INSTRUCTIONS ── */}
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.7} style={styles.cardHeaderBtn} onPress={() => toggleSection("instructions")}>
            <View style={[styles.cardIcon, { backgroundColor: "#4A8FE722" }]}>
              <Ionicons name="list-outline" size={20} color="#4A8FE7" />
            </View>
            <Text style={[styles.cardTitle, { flex: 1 }]}>Instructions</Text>
            <Ionicons name={expandedSections.instructions ? "chevron-up" : "chevron-down"} size={18} color="#aaa" />
          </TouchableOpacity>
          {expandedSections.instructions && (
            <><View style={styles.divider} /><Text style={styles.bodyText}>{recipe.instructions}</Text></>
          )}
        </View>

        {/* ── NUTRITION ── */}
        {recipe.nutrition ? (
          <View style={styles.card}>
            <TouchableOpacity activeOpacity={0.7} style={styles.cardHeaderBtn} onPress={() => toggleSection("nutrition")}>
              <View style={[styles.cardIcon, { backgroundColor: "#34B36A22" }]}>
                <Ionicons name="nutrition-outline" size={20} color="#34B36A" />
              </View>
              <Text style={[styles.cardTitle, { flex: 1 }]}>Nutrition Info</Text>
              <Ionicons name={expandedSections.nutrition ? "chevron-up" : "chevron-down"} size={18} color="#aaa" />
            </TouchableOpacity>
            {expandedSections.nutrition && (
              <><View style={styles.divider} />
              {recipe.nutrition.split(",").map((n: string, i: number) => (
                <View key={i} style={styles.nutritionRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34B36A" />
                  <Text style={styles.nutritionText}>{n.trim()}</Text>
                </View>
              ))}</>
            )}
          </View>
        ) : null}

        {/* ── HEALTH NOTES ── */}
        {recipe.health_notes ? (
          <View style={[styles.card, { backgroundColor: "#F0FFF4" }]}>
            <TouchableOpacity activeOpacity={0.7} style={styles.cardHeaderBtn} onPress={() => toggleSection("healthNotes")}>
              <View style={[styles.cardIcon, { backgroundColor: "#34B36A22" }]}>
                <Ionicons name="heart-outline" size={20} color="#34B36A" />
              </View>
              <Text style={[styles.cardTitle, { flex: 1 }]}>Health Notes</Text>
              <Ionicons name={expandedSections.healthNotes ? "chevron-up" : "chevron-down"} size={18} color="#aaa" />
            </TouchableOpacity>
            {expandedSections.healthNotes && (
              <><View style={styles.divider} /><Text style={styles.bodyText}>{recipe.health_notes}</Text></>
            )}
          </View>
        ) : null}

        {/* ── REVIEWS & FEEDBACK ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: "#FFB80022" }]}>
              <Ionicons name="chatbubbles-outline" size={20} color="#FFB800" />
            </View>
            <Text style={styles.cardTitle}>Reviews & Feedback</Text>
          </View>
          <View style={styles.divider} />

          {/* Write-a-review button */}
          {!showFeedbackForm && !hasUserReviewed ? (
            <TouchableOpacity
              style={styles.addFeedbackBtn}
              onPress={() => setShowFeedbackForm(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#F25C05" />
              <Text style={styles.addFeedbackText}>Write a Review</Text>
            </TouchableOpacity>
          ) : showFeedbackForm ? (
            /* Feedback form */
            <View style={styles.feedbackForm}>
              <Text style={styles.feedbackLabel}>Your Rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setUserRating(star)}
                  >
                    <Ionicons
                      name={star <= userRating ? "star" : "star-outline"}
                      size={32}
                      color="#FFB800"
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.feedbackLabel}>Your Comment (Optional)</Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Share your experience..."
                placeholderTextColor="#aaa"
                value={userComment}
                onChangeText={setUserComment}
                multiline
                numberOfLines={3}
              />

              <View style={styles.feedbackBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowFeedbackForm(false);
                    setUserRating(0);
                    setUserComment("");
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={submitFeedback}
                  disabled={submittingFeedback}
                >
                  {submittingFeedback ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Feedback list */}
          {feedbackList.length === 0 ? (
            <Text style={styles.noFeedback}>No reviews yet. Be the first!</Text>
          ) : (
            feedbackList.map((fb) => (
              <View key={fb.id} style={styles.feedbackItem}>
                <View style={styles.feedbackHeader}>
                  <View style={styles.feedbackAvatar}>
                    <Text style={styles.feedbackAvatarText}>
                      {(fb.username || "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feedbackUser}>
                      {fb.username || "User"}
                    </Text>
                    <View style={styles.feedbackStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= fb.rating ? "star" : "star-outline"}
                          size={12}
                          color="#FFB800"
                        />
                      ))}
                    </View>
                  </View>
                </View>
                {fb.comment ? (
                  <Text style={styles.feedbackComment}>{fb.comment}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── SAVE TO COLLECTION MODAL ── */}
      <Modal
        visible={collModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.collModal}>
          <View style={styles.collModalHeader}>
            <Text style={styles.collModalTitle}>Save to Collection</Text>
            <TouchableOpacity
              onPress={() => {
                setCollModalVisible(false);
                setNewCollName("");
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Create new inline */}
          <View style={styles.collNewRow}>
            <TextInput
              style={styles.collNewInput}
              placeholder="New collection name…"
              value={newCollName}
              onChangeText={setNewCollName}
              placeholderTextColor="#bbb"
              maxLength={64}
            />
            <TouchableOpacity
              style={[
                styles.collNewBtn,
                { opacity: newCollName.trim() && !creatingColl ? 1 : 0.4 },
              ]}
              onPress={handleCreateAndSave}
              disabled={!newCollName.trim() || creatingColl}
            >
              {creatingColl ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.collNewBtnText}>Create & Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {loadingCollections ? (
            <ActivityIndicator
              size="large"
              color="#F25C05"
              style={{ marginTop: 32 }}
            />
          ) : userCollections.length === 0 ? (
            <View style={styles.collEmpty}>
              <Ionicons name="folder-open-outline" size={40} color="#ccc" />
              <Text style={styles.collEmptyText}>
                No collections yet. Create one above.
              </Text>
            </View>
          ) : (
            <FlatList
              data={userCollections}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.collItem}
                  onPress={() => handleSaveToCollection(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.collItemIcon}>
                    <Ionicons name="folder" size={22} color="#F25C05" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.collItemName}>{item.name}</Text>
                    <Text style={styles.collItemCount}>
                      {item.recipe_ids.length} recipe
                      {item.recipe_ids.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name={
                      item.recipe_ids.includes(recipeId)
                        ? "checkmark-circle"
                        : "add-circle-outline"
                    }
                    size={22}
                    color={
                      item.recipe_ids.includes(recipeId) ? "#34B36A" : "#F25C05"
                    }
                  />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: "#F0EAE0" }} />
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },

  // ── TOP ROW ──────────────────────────────
  topRow: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    // @ts-ignore
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
  },
  bookmarkedBtn: {
    backgroundColor: "#F25C05",
  },
  // ── IMAGE ────────────────────────────────
  recipeImage: {
    width: "100%",
    height: 250,
    backgroundColor: "#f0f0f0",
  },
  recipeImagePlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#FDF5E0",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── TITLE BOX ────────────────────────────
  titleBox: {
    padding: 16,
    paddingTop: 12,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2E1A06",
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  ratingText: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  ratingCount: { fontSize: 12, color: "#888" },
  tagsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: { fontSize: 11, fontWeight: "600" },

  // ── CARD ─────────────────────────────────
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    elevation: 2,
    // @ts-ignore
    boxShadow: "0px 1px 8px rgba(0, 0, 0, 0.06)",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardHeaderBtn: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: "#2E1A06" },
  divider: { height: 1, backgroundColor: "#F0EAE0", marginVertical: 12 },

  // ── INGREDIENTS ──────────────────────────
  ingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  ingDot: { width: 8, height: 8, borderRadius: 4 },
  ingText: { fontSize: 13, color: "#4A3010", flex: 1 },

  // ── BODY / NUTRITION ─────────────────────
  bodyText: { fontSize: 13, color: "#4A3010", lineHeight: 22 },
  nutritionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  nutritionText: { fontSize: 13, color: "#4A3010" },

  // ── FEEDBACK ─────────────────────────────
  addFeedbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#F25C05",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  addFeedbackText: { color: "#F25C05", fontWeight: "600", fontSize: 14 },
  feedbackForm: { marginBottom: 16 },
  feedbackLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2E1A06",
    marginBottom: 8,
  },
  starsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  feedbackInput: {
    backgroundColor: "#FDF5E0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#333",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  feedbackBtns: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelBtnText: { color: "#888", fontWeight: "600" },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F25C05",
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "600" },
  noFeedback: {
    textAlign: "center",
    color: "#aaa",
    fontSize: 13,
    marginVertical: 12,
  },
  feedbackItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0EAE0",
  },
  feedbackHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  feedbackAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4A8FE7",
    justifyContent: "center",
    alignItems: "center",
  },
  feedbackAvatarText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  feedbackUser: { fontSize: 13, fontWeight: "600", color: "#2E1A06" },
  feedbackStars: { flexDirection: "row", gap: 2, marginTop: 2 },
  feedbackComment: {
    fontSize: 13,
    color: "#555",
    marginTop: 8,
    marginLeft: 46,
    lineHeight: 20,
  },
  // Collection modal
  collModal: { flex: 1, backgroundColor: "#F9F0DC" },
  collModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  collModalTitle: { fontSize: 20, fontWeight: "700", color: "#2E1A06" },
  collNewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EAE0",
  },
  collNewInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E0D8C8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#333",
  },
  collNewBtn: {
    backgroundColor: "#F25C05",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  collNewBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  collEmpty: { alignItems: "center", paddingTop: 40, gap: 10 },
  collEmptyText: { color: "#888", fontSize: 14, textAlign: "center" },
  collItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 0,
    borderRadius: 12,
  },
  collItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F25C0522",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  collItemName: { fontSize: 15, fontWeight: "600", color: "#2E1A06" },
  collItemCount: { fontSize: 12, color: "#888", marginTop: 2 },
});

