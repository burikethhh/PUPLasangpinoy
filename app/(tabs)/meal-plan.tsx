import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    addMealPlan,
    getCurrentUser,
    getMealPlans,
    getRecipes,
    MealPlan,
    Recipe,
    removeMealPlan,
} from "../../lib/firebase";

// ── Helpers ──────────────────────────────────────────────
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES: MealPlan["meal_type"][] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];
const MEAL_ICONS: Record<MealPlan["meal_type"], keyof typeof Ionicons.glyphMap> =
  {
    breakfast: "sunny-outline",
    lunch: "restaurant-outline",
    dinner: "moon-outline",
    snack: "cafe-outline",
  };
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ── Component ─────────────────────────────────────────────
export default function MealPlanScreen() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Recipe picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState("");
  const [pickerMealType, setPickerMealType] =
    useState<MealPlan["meal_type"]>("breakfast");
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  useFocusEffect(
    useCallback(() => {
      fetchPlans();
    }, [weekStart]),
  );

  async function fetchPlans() {
    setLoading(true);
    const user = getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await getMealPlans(
        user.uid,
        toDateStr(weekDates[0]),
        toDateStr(weekDates[6]),
      );
      setPlans(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function prevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function nextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  function openPicker(date: string, mealType: MealPlan["meal_type"]) {
    setPickerDate(date);
    setPickerMealType(mealType);
    setPickerVisible(true);
    if (allRecipes.length === 0) loadAllRecipes();
  }

  async function loadAllRecipes() {
    setLoadingRecipes(true);
    try {
      const data = await getRecipes();
      setAllRecipes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecipes(false);
    }
  }

  async function handleAddMeal(recipe: Recipe) {
    const user = getCurrentUser();
    if (!user) return;
    try {
      const result = await addMealPlan(user.uid, {
        date: pickerDate,
        meal_type: pickerMealType,
        recipe_id: recipe.id,
        recipe_title: recipe.title,
        recipe_image: recipe.image_url || "",
      });
      setPlans((prev) => [
        ...prev,
        {
          id: (result as { id: string }).id,
          user_id: user.uid,
          date: pickerDate,
          meal_type: pickerMealType,
          recipe_id: recipe.id,
          recipe_title: recipe.title,
          recipe_image: recipe.image_url || "",
          created_at: { seconds: Date.now() / 1000 },
        },
      ]);
      setPickerVisible(false);
      setRecipeSearch("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  }

  async function handleRemoveMeal(planId: string) {
    Alert.alert("Remove Meal", "Remove this meal from your plan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeMealPlan(planId);
            setPlans((prev) => prev.filter((p) => p.id !== planId));
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  }

  function formatWeekRange() {
    const s = weekDates[0];
    const e = weekDates[6];
    if (s.getMonth() === e.getMonth()) {
      return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }

  const todayStr = toDateStr(new Date());
  const filtered = allRecipes.filter((r) =>
    r.title.toLowerCase().includes(recipeSearch.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meal Planner</Text>
        <Text style={styles.headerSub}>Plan your week</Text>
      </View>

      {/* Week navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={prevWeek} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color="#F25C05" />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{formatWeekRange()}</Text>
        <TouchableOpacity onPress={nextWeek} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color="#F25C05" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#F25C05"
          style={{ marginTop: 40 }}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {weekDates.map((date, idx) => {
            const dateStr = toDateStr(date);
            const isToday = dateStr === todayStr;
            const dayPlans = plans.filter((p) => p.date === dateStr);

            return (
              <View
                key={dateStr}
                style={[styles.dayCard, isToday && styles.todayCard]}
              >
                <View style={styles.dayHeader}>
                  <View
                    style={[
                      styles.dayBadge,
                      isToday && { backgroundColor: "#F25C05" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayName,
                        isToday && { color: "#fff" },
                      ]}
                    >
                      {DAYS[idx]}
                    </Text>
                    <Text
                      style={[
                        styles.dayNum,
                        isToday && { color: "#fff" },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                  {isToday && (
                    <Text style={styles.todayLabel}>Today</Text>
                  )}
                </View>

                {MEAL_TYPES.map((mealType) => {
                  const meal = dayPlans.find(
                    (p) => p.meal_type === mealType,
                  );
                  return (
                    <View key={mealType} style={styles.mealRow}>
                      <View style={styles.mealTypeLabel}>
                        <Ionicons
                          name={MEAL_ICONS[mealType]}
                          size={13}
                          color="#aaa"
                        />
                        <Text style={styles.mealTypeName}>{mealType}</Text>
                      </View>

                      {meal ? (
                        <View style={styles.mealItem}>
                          <Image
                            source={{
                              uri:
                                meal.recipe_image ||
                                "https://via.placeholder.com/32",
                            }}
                            style={styles.mealImage}
                          />
                          <TouchableOpacity
                            style={styles.mealTitleWrap}
                            onPress={() =>
                              router.push(`/recipe/${meal.recipe_id}`)
                            }
                          >
                            <Text
                              style={styles.mealTitleText}
                              numberOfLines={1}
                            >
                              {meal.recipe_title}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemoveMeal(meal.id)}
                            style={styles.removeBtn}
                          >
                            <Ionicons
                              name="close-circle"
                              size={18}
                              color="#ccc"
                            />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addMealBtn}
                          onPress={() => openPicker(dateStr, mealType)}
                        >
                          <Ionicons name="add" size={14} color="#F25C05" />
                          <Text style={styles.addMealText}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Recipe Picker Modal */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Pick a Recipe</Text>
            <TouchableOpacity
              onPress={() => {
                setPickerVisible(false);
                setRecipeSearch("");
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>
            {pickerMealType.charAt(0).toUpperCase() +
              pickerMealType.slice(1)}{" "}
            · {pickerDate}
          </Text>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes…"
              value={recipeSearch}
              onChangeText={setRecipeSearch}
              placeholderTextColor="#bbb"
            />
          </View>

          {loadingRecipes ? (
            <ActivityIndicator
              size="large"
              color="#F25C05"
              style={{ marginTop: 40 }}
            />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.recipeRow}
                  onPress={() => handleAddMeal(item)}
                >
                  <Image
                    source={{
                      uri:
                        item.image_url ||
                        "https://via.placeholder.com/48",
                    }}
                    style={styles.recipeRowImage}
                  />
                  <View style={styles.recipeRowInfo}>
                    <Text style={styles.recipeRowTitle}>{item.title}</Text>
                    <Text style={styles.recipeRowSub}>
                      {item.category}
                      {item.region ? ` · ${item.region}` : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name="add-circle-outline"
                    size={22}
                    color="#F25C05"
                  />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={styles.separator} />
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No recipes found</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#2E1A06" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  navBtn: { padding: 4 },
  weekLabel: { fontSize: 13, fontWeight: "600", color: "#2E1A06" },
  dayCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  todayCard: { borderWidth: 1.5, borderColor: "#F25C05" },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  dayBadge: {
    alignItems: "center",
    backgroundColor: "#F5F0E8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  dayName: {
    fontSize: 10,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
  },
  dayNum: { fontSize: 18, fontWeight: "700", color: "#2E1A06" },
  todayLabel: { fontSize: 12, fontWeight: "600", color: "#F25C05" },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#F0EAE0",
  },
  mealTypeLabel: {
    flexDirection: "row",
    alignItems: "center",
    width: 80,
  },
  mealTypeName: {
    fontSize: 11,
    color: "#aaa",
    marginLeft: 4,
    textTransform: "capitalize",
  },
  mealItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  mealImage: { width: 32, height: 32, borderRadius: 6, marginRight: 8 },
  mealTitleWrap: { flex: 1 },
  mealTitleText: { fontSize: 13, fontWeight: "500", color: "#2E1A06" },
  removeBtn: { padding: 4 },
  addMealBtn: { flex: 1, flexDirection: "row", alignItems: "center" },
  addMealText: { fontSize: 12, color: "#F25C05", marginLeft: 4 },
  // Modal
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#2E1A06" },
  modalSub: {
    fontSize: 13,
    color: "#888",
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    textTransform: "capitalize",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#333" },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recipeRowImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  recipeRowInfo: { flex: 1 },
  recipeRowTitle: { fontSize: 14, fontWeight: "600", color: "#2E1A06" },
  recipeRowSub: { fontSize: 12, color: "#888", marginTop: 2 },
  separator: {
    height: 1,
    backgroundColor: "#F0EAE0",
    marginLeft: 76,
  },
  emptyContainer: { alignItems: "center", paddingTop: 40 },
  emptyText: { color: "#888", fontSize: 15 },
});
