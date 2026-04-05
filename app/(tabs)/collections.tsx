import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    createCollection,
    deleteCollection,
    getCollections,
    getCurrentUser,
    getRecipe,
    Recipe,
    RecipeCollection,
    removeRecipeFromCollection,
} from "../../lib/firebase";

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [createVisible, setCreateVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Detail sheet
  const [selectedColl, setSelectedColl] = useState<RecipeCollection | null>(
    null,
  );
  const [collRecipes, setCollRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchCollections();
    }, []),
  );

  async function fetchCollections() {
    setLoading(true);
    const user = getCurrentUser();
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await getCollections(user.uid);
      setCollections(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) {
      Alert.alert("Error", "Collection name is required.");
      return;
    }
    setCreating(true);
    const user = getCurrentUser();
    if (!user) {
      setCreating(false);
      return;
    }
    try {
      const result = await createCollection(
        user.uid,
        newName.trim(),
        newDesc.trim(),
      );
      setCollections((prev) => [
        {
          id: (result as { id: string }).id,
          user_id: user.uid,
          name: newName.trim(),
          description: newDesc.trim(),
          recipe_ids: [],
          created_at: { seconds: Date.now() / 1000 },
          updated_at: { seconds: Date.now() / 1000 },
        },
        ...prev,
      ]);
      setNewName("");
      setNewDesc("");
      setCreateVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(coll: RecipeCollection) {
    Alert.alert(
      "Delete Collection",
      `Delete "${coll.name}"? The recipes themselves won't be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCollection(coll.id);
              setCollections((prev) => prev.filter((c) => c.id !== coll.id));
              if (selectedColl?.id === coll.id) setDetailVisible(false);
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ],
    );
  }

  async function openDetail(coll: RecipeCollection) {
    setSelectedColl(coll);
    setDetailVisible(true);
    setLoadingRecipes(true);
    try {
      const recipes = await Promise.all(coll.recipe_ids.map((id) => getRecipe(id)));
      setCollRecipes(recipes.filter((r): r is Recipe => r !== null));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecipes(false);
    }
  }

  async function handleRemoveFromColl(recipeId: string) {
    if (!selectedColl) return;
    Alert.alert("Remove Recipe", "Remove from this collection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeRecipeFromCollection(selectedColl.id, recipeId);
            setCollRecipes((prev) => prev.filter((r) => r.id !== recipeId));
            const updated = {
              ...selectedColl,
              recipe_ids: selectedColl.recipe_ids.filter(
                (id) => id !== recipeId,
              ),
            };
            setSelectedColl(updated);
            setCollections((prev) =>
              prev.map((c) => (c.id === selectedColl.id ? updated : c)),
            );
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  }

  const orange = "#F25C05";

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Collections</Text>
          <Text style={styles.headerSub}>Your recipe folders</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateVisible(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={orange}
          style={{ marginTop: 40 }}
        />
      ) : collections.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Collections Yet</Text>
          <Text style={styles.emptyDesc}>
            Create folders to organize your favorite recipes.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setCreateVisible(true)}
          >
            <Text style={styles.emptyBtnText}>Create Collection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.collCard}
              onPress={() => openDetail(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.collIcon, { backgroundColor: orange + "22" }]}>
                <Ionicons name="folder" size={28} color={orange} />
              </View>
              <View style={styles.collInfo}>
                <Text style={styles.collName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.collDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={styles.collCount}>
                  {item.recipe_ids.length} recipe
                  {item.recipe_ids.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.collDeleteBtn}
                onPress={() => handleDelete(item)}
              >
                <Ionicons name="trash-outline" size={18} color="#ccc" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* ── Create Modal ── */}
      <Modal visible={createVisible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.createModal}>
            <Text style={styles.modalTitle}>New Collection</Text>

            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Weeknight Dinners"
              value={newName}
              onChangeText={setNewName}
              placeholderTextColor="#bbb"
              maxLength={64}
            />

            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="What's this collection for?"
              value={newDesc}
              onChangeText={setNewDesc}
              placeholderTextColor="#bbb"
              multiline
              maxLength={160}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setCreateVisible(false);
                  setNewName("");
                  setNewDesc("");
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { opacity: creating ? 0.7 : 1 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.detailHeader}>
            <TouchableOpacity
              onPress={() => setDetailVisible(false)}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-down" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.detailTitleBlock}>
              <Text style={styles.detailName}>{selectedColl?.name}</Text>
              {selectedColl?.description ? (
                <Text style={styles.detailDesc}>
                  {selectedColl.description}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => selectedColl && handleDelete(selectedColl)}
            >
              <Ionicons name="trash-outline" size={20} color="#E74C3C" />
            </TouchableOpacity>
          </View>

          {loadingRecipes ? (
            <ActivityIndicator
              size="large"
              color={orange}
              style={{ marginTop: 40 }}
            />
          ) : collRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={52} color="#ccc" />
              <Text style={styles.emptyTitle}>No Recipes</Text>
              <Text style={styles.emptyDesc}>
                Add recipes from the recipe detail page.
              </Text>
            </View>
          ) : (
            <FlatList
              data={collRecipes}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={{ padding: 12 }}
              columnWrapperStyle={{ gap: 10 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => (
                <View style={styles.recipeCard}>
                  <TouchableOpacity
                    onPress={() => router.push(`/recipe/${item.id}`)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{
                        uri:
                          item.image_url ||
                          "https://via.placeholder.com/160x110",
                      }}
                      style={styles.recipeCardImage}
                    />
                    <View style={styles.recipeCardBody}>
                      <Text
                        style={styles.recipeCardTitle}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={styles.recipeCardSub}
                        numberOfLines={1}
                      >
                        {item.category}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.recipeCardRemove}
                    onPress={() => handleRemoveFromColl(item.id)}
                  >
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                </View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#2E1A06" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F25C05",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 4,
  },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2E1A06",
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: 8,
  },
  emptyBtn: {
    backgroundColor: "#F25C05",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 20,
  },
  emptyBtnText: { color: "#fff", fontWeight: "600" },
  collCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  collIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  collInfo: { flex: 1 },
  collName: { fontSize: 16, fontWeight: "700", color: "#2E1A06" },
  collDesc: { fontSize: 12, color: "#888", marginTop: 2 },
  collCount: { fontSize: 12, color: "#F25C05", marginTop: 4 },
  collDeleteBtn: { padding: 8 },
  // Create modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  createModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2E1A06",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: "#888",
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0D8C8",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    marginBottom: 14,
  },
  inputMulti: { height: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E0D8C8",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: { color: "#888", fontWeight: "600" },
  saveBtn: {
    flex: 1,
    backgroundColor: "#F25C05",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 12,
  },
  saveText: { color: "#fff", fontWeight: "700" },
  // Detail sheet
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  backBtn: { padding: 4, marginRight: 12, marginTop: 2 },
  detailTitleBlock: { flex: 1 },
  detailName: { fontSize: 20, fontWeight: "700", color: "#2E1A06" },
  detailDesc: { fontSize: 13, color: "#888", marginTop: 2 },
  recipeCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  recipeCardImage: { width: "100%", height: 110 },
  recipeCardBody: { padding: 10 },
  recipeCardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2E1A06",
  },
  recipeCardSub: { fontSize: 11, color: "#888", marginTop: 2 },
  recipeCardRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
  },
});
