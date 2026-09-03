import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator, Alert, FlatList, Modal, RefreshControl,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MENU_CATEGORIES, MENU_CATEGORY_COLORS } from "../../constants/order";
import {
    addCategory as addCategoryDoc,
    deleteCategory as deleteCategoryDoc,
    getCategories as getCategoriesDoc,
    getCurrentUser,
    updateCategory as updateCategoryDoc,
    type Category,
} from "../../lib/firebase";
import {
    addMenuItem,
    addInventoryAdjustment,
    deleteMenuItem,
    getInventoryAdjustments,
    getMenuItems,
    updateMenuItem,
    type MenuItem,
} from "../../lib/firebase-store";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { friendlyFirestoreError } from "../../lib/firebase-helpers";
import { createLogger } from "../../lib/logger";

const log = createLogger("AdminMenu");

const EMPTY_FORM = {
  name: "", description: "", price: "", category: MENU_CATEGORIES[0] as string,
  image_url: "", stock_quantity: "50", available: true,
  is_made_to_order: false,
  batch_date: "",
  calories: "", protein: "", carbs: "", fat: "", fiber: "", sodium: "",
};

export default function AdminMenuScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", color: "#F25C05" });
  const [savingCategory, setSavingCategory] = useState(false);
  const [assignFromCategory, setAssignFromCategory] = useState("");
  const [assignToCategory, setAssignToCategory] = useState("");
  const [assigningCategory, setAssigningCategory] = useState(false);
  const [adjustItem, setAdjustItem] = useState<MenuItem | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState<"spoilage" | "expired" | "damaged" | "lost" | "returned">("spoilage");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [showAdjustHistory, setShowAdjustHistory] = useState(false);
  const [adjustHistory, setAdjustHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    const intervalId = setInterval(() => {
      load(true);
    }, 8000);
    return () => clearInterval(intervalId);
  }, []);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [menuItems, categoryDocs] = await Promise.all([
        getMenuItems(),
        getCategoriesDoc(),
      ]);
      setItems(menuItems);
      setCategories(categoryDocs);
      log.info("Menu loaded", { itemCount: menuItems.length, categoryCount: categoryDocs.length });
    } catch (e) {
      log.error("Failed to load menu", e);
    }
    if (!silent) setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalVisible(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setForm({
      name: item.name, description: item.description || "",
      price: item.price.toString(), category: item.category,
      image_url: item.image_url || "", stock_quantity: item.stock_quantity.toString(),
      available: item.available,
      is_made_to_order: item.is_made_to_order || false,
      batch_date: item.batch_date || "",
      calories: item.nutrients?.calories?.toString() || "",
      protein: item.nutrients?.protein?.toString() || "",
      carbs: item.nutrients?.carbs?.toString() || "",
      fat: item.nutrients?.fat?.toString() || "",
      fiber: item.nutrients?.fiber?.toString() || "",
      sodium: item.nutrients?.sodium?.toString() || "",
    });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price.trim()) {
      Alert.alert("Error", "Name and price are required."); return;
    }
    setSaving(true);
    const nutrients: Record<string, number | undefined> = {};
    const cal = parseFloat(form.calories);
    const pro = parseFloat(form.protein);
    const carb = parseFloat(form.carbs);
    const ft = parseFloat(form.fat);
    const fib = parseFloat(form.fiber);
    const sod = parseFloat(form.sodium);
    if (!isNaN(cal)) nutrients.calories = cal;
    if (!isNaN(pro)) nutrients.protein = pro;
    if (!isNaN(carb)) nutrients.carbs = carb;
    if (!isNaN(ft)) nutrients.fat = ft;
    if (!isNaN(fib)) nutrients.fiber = fib;
    if (!isNaN(sod)) nutrients.sodium = sod;

    const payload: Omit<MenuItem, "id" | "created_at"> = {
      name: form.name.trim(), description: form.description.trim(),
      price: parseFloat(form.price) || 0, category: form.category,
      image_url: form.image_url.trim(), 
      stock_quantity: (form.is_made_to_order || form.batch_date) ? 999 : (parseInt(form.stock_quantity) || 0),
      available: form.available,
      is_made_to_order: form.is_made_to_order,
      batch_date: form.batch_date.trim() || undefined,
    };
    if (Object.keys(nutrients).length > 0) payload.nutrients = nutrients;
    try {
      // Upload local image to Cloudinary so it's visible on all devices
      if (payload.image_url && !payload.image_url.startsWith("http://") && !payload.image_url.startsWith("https://")) {
        try {
          const cloudUrl = await uploadToCloudinary(payload.image_url, "foodfix/menu");
          payload.image_url = cloudUrl;
        } catch (imgErr: any) {
          log.warn("Cloudinary upload failed, keeping URI", imgErr);
        }
      }
      if (editing) {
        await updateMenuItem(editing.id, payload);
        log.info("Menu item updated", { id: editing.id, name: form.name });
      } else {
        await addMenuItem(payload);
        log.info("Menu item created", { name: form.name });
      }
      setModalVisible(false);
      load();
    } catch (e: any) { log.error("Failed to save menu item", e); Alert.alert("Error", e.message); }
    setSaving(false);
  }

  function handleDelete(item: MenuItem) {
    Alert.alert("Delete", `Remove "${item.name}" from the menu?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { log.info("Menu item deleted", { id: item.id, name: item.name }); await deleteMenuItem(item.id); load(); } },
    ]);
  }

  function openCategoryModal() {
    setCategoryModalVisible(true);
    setEditingCategory(null);
    setCategoryForm({ name: "", color: "#F25C05" });
    const options = Array.from(
      new Set([
        ...MENU_CATEGORIES,
        ...categories.map((c) => c.name).filter(Boolean),
      ]),
    );
    setAssignFromCategory(options[0] || "");
    setAssignToCategory(options[0] || "");
  }

  function startEditCategory(category: Category) {
    setEditingCategory(category);
    setCategoryForm({ name: category.name || "", color: category.color || "#F25C05" });
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) {
      Alert.alert("Error", "Category name is required.");
      return;
    }

    const oldCategoryName = editingCategory?.name?.trim() || "";
    const newCategoryName = categoryForm.name.trim();

    setSavingCategory(true);
    try {
      if (editingCategory) {
        await updateCategoryDoc(editingCategory.id, {
          name: newCategoryName,
          color: categoryForm.color.trim() || "#F25C05",
        });
        log.info("Category updated", { id: editingCategory.id, name: newCategoryName });
      } else {
        await addCategoryDoc(
          newCategoryName,
          categoryForm.color.trim() || "#F25C05",
        );
        log.info("Category created", { name: newCategoryName });
      }
      setEditingCategory(null);
      setCategoryForm({ name: "", color: "#F25C05" });
      await load();

      if (oldCategoryName && oldCategoryName !== newCategoryName) {
        setAssignFromCategory(oldCategoryName);
        setAssignToCategory(newCategoryName);
        Alert.alert(
          "Category Renamed",
          `Assign existing dishes from "${oldCategoryName}" to "${newCategoryName}"?`,
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Assign",
              onPress: () => {
                assignCategoryToItems(oldCategoryName, newCategoryName);
              },
            },
          ],
        );
      }
    } catch (e: any) {
      log.error("Failed to save category", e);
      Alert.alert("Error", e.message || "Failed to save category.");
    }
    setSavingCategory(false);
  }

  function removeCategory(category: Category) {
    Alert.alert(
      "Delete Category",
      `Delete category "${category.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              log.info("Category deleted", { id: category.id, name: category.name });
              await deleteCategoryDoc(category.id);
              await load();
            } catch (e: any) {
              log.error("Failed to delete category", e);
              Alert.alert("Error", e.message || "Failed to delete category.");
            }
          },
        },
      ],
    );
  }

  async function assignCategoryToItems(
    fromCategoryParam?: string,
    toCategoryParam?: string,
  ) {
    const fromCategory = (fromCategoryParam ?? assignFromCategory).trim();
    const toCategory = (toCategoryParam ?? assignToCategory).trim();

    if (!fromCategory || !toCategory) {
      Alert.alert("Error", "Please select both source and target categories.");
      return;
    }

    if (fromCategory === toCategory) {
      Alert.alert("Error", "Source and target categories must be different.");
      return;
    }

    setAssigningCategory(true);
    try {
      const menuItems = await getMenuItems();
      const matched = menuItems.filter((item) => item.category === fromCategory);

      if (matched.length === 0) {
        Alert.alert("Nothing to assign", `No dishes found under "${fromCategory}".`);
        return;
      }

      await Promise.all(
        matched.map((item) =>
          updateMenuItem(item.id, {
            category: toCategory,
          }),
        ),
      );

      Alert.alert(
        "Assigned",
        `Updated ${matched.length} dish(es) from "${fromCategory}" to "${toCategory}".`,
      );
      await load();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to assign category.");
    } finally {
      setAssigningCategory(false);
    }
  }

  const categoryOptions = Array.from(
    new Set([
      ...MENU_CATEGORIES,
      ...categories.map((c) => c.name).filter(Boolean),
    ]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.addBtn, styles.categoryBtn]} onPress={openCategoryModal}>
            <Ionicons name="pricetags" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F25C05" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const color = MENU_CATEGORY_COLORS[item.category] || "#F25C05";
            return (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.cardImg} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[styles.cardImg, { backgroundColor: color + "22", justifyContent: "center", alignItems: "center" }]}>
                      <Ionicons name="restaurant-outline" size={20} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardCat}>{item.category}</Text>
                    <Text style={styles.cardPrice}>P{item.price.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={[styles.stockText, item.stock_quantity <= 10 && { color: "#E74C3C" }]}>
                    Stock: {item.stock_quantity}
                  </Text>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => { setAdjustItem(item); setAdjustQty(""); setAdjustNotes(""); setAdjustReason("spoilage"); }} style={[styles.iconBtn, { backgroundColor: "#E67E2218" }]}>
                      <Ionicons name="create-outline" size={16} color="#E67E22" />
                      <Text style={{ fontSize: 10, color: "#E67E22", fontWeight: "600", marginLeft: 2 }}>Adjust</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => {
                      setLoadingHistory(true);
                      try {
                        const h = await getInventoryAdjustments(item.id);
                        setAdjustHistory(h);
                        log.info("Adjustment history loaded", { itemId: item.id, count: h.length });
                        setShowAdjustHistory(true);
                      } catch (e: any) {
                        log.error("Failed to load adjustment history", e);
                        Alert.alert("Error", friendlyFirestoreError(e, "Failed to load history. Make sure the inventory_adjustments collection exists in Firestore."));
                      }
                      setLoadingHistory(false);
                    }} style={[styles.iconBtn, { backgroundColor: "#3498DB18" }]} disabled={loadingHistory}>
                      {loadingHistory ? <ActivityIndicator size="small" color="#3498DB" /> : <Ionicons name="time-outline" size={16} color="#3498DB" />}
                      <Text style={{ fontSize: 10, color: "#3498DB", fontWeight: "600", marginLeft: 2 }}>{loadingHistory ? "Loading..." : "History"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                      <Ionicons name="pencil" size={16} color="#3498DB" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                      <Ionicons name="trash" size={16} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={48} color="#ddd" />
              <Text style={styles.emptyText}>No menu items yet</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editing ? "Edit Item" : "Add Item"}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Name *</Text>
              <TextInput style={styles.input} value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Item name" placeholderTextColor="#aaa" />
              <Text style={styles.label}>Price *</Text>
              <TextInput style={styles.input} value={form.price} keyboardType="numeric"
                onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
                placeholder="0.00" placeholderTextColor="#aaa" />
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }}>
                {categoryOptions.map((c) => (
                  <TouchableOpacity key={c}
                    style={[styles.chip, form.category === c && styles.chipActive]}
                    onPress={() => { setForm((f) => ({ ...f, category: c })); setShowCustomCat(false); }}>
                    <Text style={[styles.chipText, form.category === c && styles.chipTextActive]} numberOfLines={1}>{c}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.chip, showCustomCat && styles.chipActive]}
                  onPress={() => setShowCustomCat(true)}>
                  <Ionicons name="add" size={14} color={showCustomCat ? "#F25C05" : "#888"} />
                  <Text style={[styles.chipText, showCustomCat && styles.chipTextActive]}>Custom</Text>
                </TouchableOpacity>
              </ScrollView>
              {showCustomCat && (
                <TextInput style={[styles.input, { marginBottom: 8 }]} value={customCategory}
                  onChangeText={(v) => { setCustomCategory(v); setForm((f) => ({ ...f, category: v })); }}
                  placeholder="Enter custom category" placeholderTextColor="#aaa" />
              )}
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { minHeight: 60 }]} value={form.description}
                onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                multiline placeholder="Description" placeholderTextColor="#aaa" />
              <Text style={styles.label}>Image</Text>
              <View style={styles.imagePickRow}>
                <TouchableOpacity style={styles.galleryBtn} onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ["images"],
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.8,
                  });
                  if (!result.canceled && result.assets[0]) {
                    setForm((f) => ({ ...f, image_url: result.assets[0].uri }));
                  }
                }}>
                  <Ionicons name="images" size={18} color="#fff" />
                  <Text style={styles.galleryBtnText}>Gallery</Text>
                </TouchableOpacity>
                <TextInput style={[styles.input, { flex: 1 }]} value={form.image_url}
                  onChangeText={(v) => setForm((f) => ({ ...f, image_url: v }))}
                  placeholder="or paste URL" placeholderTextColor="#aaa" autoCapitalize="none" />
              </View>
              {/* Stock Quantity - only show for regular items, not for Made to Order or Daily Batch */}
              {!form.is_made_to_order && !form.batch_date && (
                <>
                  <Text style={styles.label}>Stock Quantity</Text>
                  <TextInput style={styles.input} value={form.stock_quantity} keyboardType="numeric"
                    onChangeText={(v) => setForm((f) => ({ ...f, stock_quantity: v }))}
                    placeholder="0" placeholderTextColor="#aaa" />
                </>
              )}
              {(form.is_made_to_order || form.batch_date) && (
                <Text style={[styles.label, { color: "#888", fontStyle: "italic" }]}>
                  {form.is_made_to_order ? "Stock: Unlimited (Made to Order)" : "Stock: Unlimited (Daily Batch)"}
                </Text>
              )}
              <TouchableOpacity style={styles.toggleRow}
                onPress={() => setForm((f) => ({ ...f, available: !f.available }))}>
                <Ionicons name={form.available ? "checkbox" : "square-outline"} size={22} color="#F25C05" />
                <Text style={styles.toggleText}>Available for ordering</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.toggleRow}
                onPress={() => setForm((f) => ({ ...f, is_made_to_order: !f.is_made_to_order }))}>
                <Ionicons name={form.is_made_to_order ? "checkbox" : "square-outline"} size={22} color="#8B4513" />
                <Text style={styles.toggleText}>Made to Order (Bilao items)</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Batch Date (daily expiry)</Text>
              <TextInput style={styles.input} value={form.batch_date}
                onChangeText={(v) => setForm((f) => ({ ...f, batch_date: v }))}
                placeholder="YYYY-MM-DD (leave empty for permanent items)" placeholderTextColor="#aaa"
                autoCapitalize="none" />

              <Text style={styles.sectionTitle}>Nutrients (optional)</Text>
              <View style={styles.nutrientGrid}>
                <View style={styles.nutrientField}>
                  <Text style={styles.label}>Calories</Text>
                  <TextInput style={styles.input} value={form.calories} keyboardType="numeric"
                    onChangeText={(v) => setForm((f) => ({ ...f, calories: v }))}
                    placeholder="kcal" placeholderTextColor="#aaa" />
                </View>
                <View style={styles.nutrientField}>
                  <Text style={styles.label}>Protein</Text>
                  <TextInput style={styles.input} value={form.protein} keyboardType="numeric"
                    onChangeText={(v) => setForm((f) => ({ ...f, protein: v }))}
                    placeholder="g" placeholderTextColor="#aaa" />
                </View>
                <View style={styles.nutrientField}>
                  <Text style={styles.label}>Carbs</Text>
                  <TextInput style={styles.input} value={form.carbs} keyboardType="numeric"
                    onChangeText={(v) => setForm((f) => ({ ...f, carbs: v }))}
                    placeholder="g" placeholderTextColor="#aaa" />
                </View>
                <View style={styles.nutrientField}>
                  <Text style={styles.label}>Fat</Text>
                  <TextInput style={styles.input} value={form.fat} keyboardType="numeric"
                    onChangeText={(v) => setForm((f) => ({ ...f, fat: v }))}
                    placeholder="g" placeholderTextColor="#aaa" />
                </View>
                <View style={styles.nutrientField}>
                  <Text style={styles.label}>Fiber</Text>
                  <TextInput style={styles.input} value={form.fiber} keyboardType="numeric"
                    onChangeText={(v) => setForm((f) => ({ ...f, fiber: v }))}
                    placeholder="g" placeholderTextColor="#aaa" />
                </View>
                <View style={styles.nutrientField}>
                  <Text style={styles.label}>Sodium</Text>
                  <TextInput style={styles.input} value={form.sodium} keyboardType="numeric"
                    onChangeText={(v) => setForm((f) => ({ ...f, sodium: v }))}
                    placeholder="mg" placeholderTextColor="#aaa" />
                </View>
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> :
                  <Text style={styles.saveBtnText}>{editing ? "Update" : "Add Item"}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Manager Modal */}
      <Modal visible={categoryModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Category Manager</Text>
                <TouchableOpacity
                  onPress={() => {
                    setCategoryModalVisible(false);
                    setEditingCategory(null);
                    setCategoryForm({ name: "", color: "#F25C05" });
                  }}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{editingCategory ? "Edit Category" : "New Category"}</Text>
              <TextInput
                style={styles.input}
                value={categoryForm.name}
                onChangeText={(v) => setCategoryForm((f) => ({ ...f, name: v }))}
                placeholder="Category name"
                placeholderTextColor="#aaa"
              />

              <Text style={styles.label}>Color (Hex)</Text>
              <TextInput
                style={styles.input}
                value={categoryForm.color}
                onChangeText={(v) => setCategoryForm((f) => ({ ...f, color: v }))}
                placeholder="#F25C05"
                placeholderTextColor="#aaa"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.saveBtn, savingCategory && { opacity: 0.6 }]}
                onPress={saveCategory}
                disabled={savingCategory}>
                {savingCategory ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingCategory ? "Update Category" : "Add Category"}</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.manageSectionTitle}>Assign Category to Dishes</Text>
              <Text style={styles.assignHint}>Move dishes from one category to another in one tap.</Text>

              <Text style={styles.label}>From Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 6 }}>
                {categoryOptions.map((option) => (
                  <TouchableOpacity
                    key={`from-${option}`}
                    style={[styles.chip, assignFromCategory === option && styles.chipActive]}
                    onPress={() => setAssignFromCategory(option)}>
                    <Text style={[styles.chipText, assignFromCategory === option && styles.chipTextActive]} numberOfLines={1}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>To Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 6 }}>
                {categoryOptions.map((option) => (
                  <TouchableOpacity
                    key={`to-${option}`}
                    style={[styles.chip, assignToCategory === option && styles.chipActive]}
                    onPress={() => setAssignToCategory(option)}>
                    <Text style={[styles.chipText, assignToCategory === option && styles.chipTextActive]} numberOfLines={1}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.assignBtn, assigningCategory && { opacity: 0.6 }]}
                onPress={() => assignCategoryToItems()}
                disabled={assigningCategory}>
                {assigningCategory ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.assignBtnText}>Assign Category</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.manageSectionTitle}>Existing Categories</Text>
              {categories.length === 0 ? (
                <Text style={styles.emptyText}>No categories yet</Text>
              ) : (
                categories.map((category) => (
                  <View key={category.id} style={styles.categoryRow}>
                    <View style={[styles.colorDot, { backgroundColor: category.color || "#F25C05" }]} />
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <View style={styles.categoryActions}>
                      <TouchableOpacity onPress={() => startEditCategory(category)} style={styles.iconBtn}>
                        <Ionicons name="pencil" size={16} color="#3498DB" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeCategory(category)} style={styles.iconBtn}>
                        <Ionicons name="trash" size={16} color="#E74C3C" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Inventory Adjustment Modal */}
      <Modal visible={!!adjustItem} transparent animationType="slide" onRequestClose={() => setAdjustItem(null)}>
        {adjustItem && (
          <View style={styles.overlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Adjust Stock: {adjustItem.name}</Text>
                <TouchableOpacity onPress={() => setAdjustItem(null)}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Current Stock: <Text style={{ fontWeight: "bold" }}>{adjustItem.stock_quantity}</Text></Text>
              <Text style={styles.label}>Adjustment Amount (negative to reduce)</Text>
              <TextInput style={styles.input} value={adjustQty} keyboardType="numeric"
                onChangeText={setAdjustQty} placeholder="e.g. -5" placeholderTextColor="#aaa" />
              <Text style={styles.label}>Reason</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }}>
                {(["spoilage", "expired", "damaged", "lost", "returned"] as const).map((r) => (
                  <TouchableOpacity key={r}
                    style={[styles.chip, adjustReason === r && styles.chipActive]}
                    onPress={() => setAdjustReason(r)}>
                    <Text style={[styles.chipText, adjustReason === r && styles.chipTextActive]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput style={styles.input} value={adjustNotes}
                onChangeText={setAdjustNotes} placeholder="e.g. Left in the sun too long" placeholderTextColor="#aaa" />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={{ flex: 1, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: "#eee" }}
                  onPress={() => setAdjustItem(null)}>
                  <Text style={{ color: "#888", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[{
                  flex: 1, borderRadius: 12, padding: 14, alignItems: "center",
                  backgroundColor: "#E67E22",
                }, (!adjustQty.trim() || adjusting) && { opacity: 0.6 }]}
                    onPress={async () => {
                      const qty = parseInt(adjustQty);
                      if (isNaN(qty) || qty >= 0) {
                        Alert.alert("Invalid", "Enter a negative number to reduce stock.");
                        return;
                      }
                      setAdjusting(true);
                      try {
                        const user = getCurrentUser();
                        log.info("Applying inventory adjustment", { itemId: adjustItem.id, itemName: adjustItem.name, adjustment: qty, reason: adjustReason });
                        await addInventoryAdjustment({
                          item_id: adjustItem.id,
                          item_name: adjustItem.name,
                          previous_qty: adjustItem.stock_quantity,
                          adjustment: qty,
                          reason: adjustReason,
                          notes: adjustNotes.trim() || undefined,
                          admin_id: user?.uid || "unknown",
                        });
                        log.info("Inventory adjustment applied", { itemId: adjustItem.id });
                        Alert.alert("Adjusted", `Stock updated: ${adjustItem.stock_quantity} → ${Math.max(0, adjustItem.stock_quantity + qty)}`);
                        setAdjustItem(null);
                        load(true);
                      } catch (e: any) {
                        log.error("Inventory adjustment failed", e);
                        Alert.alert("Error", friendlyFirestoreError(e, "Failed to apply adjustment."));
                      }
                      setAdjusting(false);
                    }} disabled={!adjustQty.trim() || adjusting}>
                    {adjusting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "bold" }}>Apply Adjustment</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
        )}
      </Modal>

      {/* View Adjustment History */}
      <Modal visible={showAdjustHistory} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjustment History</Text>
              <TouchableOpacity onPress={() => setShowAdjustHistory(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            {adjustHistory.length === 0 ? (
              <Text style={styles.emptyText}>No adjustments recorded.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: "#E8D8A0", backgroundColor: "#FEF9F0", paddingHorizontal: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: "#8B4513", width: 70 }}>Date</Text>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: "#8B4513", flex: 1 }}>Item</Text>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: "#8B4513", width: 45, textAlign: "center" }}>Prev</Text>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: "#8B4513", width: 45, textAlign: "center" }}>Adj</Text>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: "#8B4513", width: 70, textAlign: "right" }}>Reason</Text>
                </View>
                {adjustHistory.map((h: any) => (
                  <View key={h.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#f0e8d0" }}>
                    <Text style={{ fontSize: 11, color: "#888", width: 70 }}>
                      {h.created_at?.seconds ? new Date(h.created_at.seconds * 1000).toLocaleDateString() : (h.created_at ? new Date(h.created_at).toLocaleDateString() : "")}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#333", flex: 1 }} numberOfLines={1}>{h.item_name}</Text>
                    <Text style={{ fontSize: 12, color: "#888", width: 45, textAlign: "center" }}>{h.previous_qty}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "bold", width: 45, textAlign: "center", color: h.adjustment < 0 ? "#E74C3C" : "#27AE60" }}>{h.adjustment > 0 ? `+${h.adjustment}` : h.adjustment}</Text>
                    <Text style={{ fontSize: 11, color: "#E67E22", fontWeight: "600", width: 70, textAlign: "right", textTransform: "capitalize" }}>{h.reason}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F0DC" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "bold", color: "#2E1A06" },
  headerActions: { flexDirection: "row", gap: 8 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F25C05", justifyContent: "center", alignItems: "center" },
  categoryBtn: { backgroundColor: "#3498DB" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardImg: { width: 56, height: 56, borderRadius: 12 },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 14, fontWeight: "bold", color: "#2E1A06" },
  cardCat: { fontSize: 11, color: "#888", marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: "bold", color: "#F25C05", marginTop: 2 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f5f0e5" },
  stockText: { fontSize: 12, color: "#555" },
  cardActions: { flexDirection: "row", gap: 12 },
  iconBtn: { padding: 4 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: "#aaa", marginTop: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#2E1A06" },
  label: { fontSize: 12, color: "#888", marginBottom: 4, marginTop: 10, fontWeight: "600" },
  input: { backgroundColor: "#F9F5EF", borderRadius: 10, padding: 12, fontSize: 14, color: "#333" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#ddd", backgroundColor: "#fff", marginRight: 8 },
  chipActive: { borderColor: "#F25C05", backgroundColor: "#FEF3EC" },
  chipText: { fontSize: 12, color: "#888" },
  chipTextActive: { color: "#F25C05", fontWeight: "bold" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  toggleText: { fontSize: 14, color: "#333" },
  saveBtn: { backgroundColor: "#F25C05", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 16 },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  assignHint: { fontSize: 12, color: "#888", marginBottom: 6 },
  assignBtn: { backgroundColor: "#3498DB", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 10 },
  assignBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  manageSectionTitle: { fontSize: 14, fontWeight: "700", color: "#2E1A06", marginTop: 16, marginBottom: 8 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f0e5",
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  categoryName: { flex: 1, fontSize: 13, color: "#2E1A06", fontWeight: "600" },
  categoryActions: { flexDirection: "row", gap: 8 },
  imagePickRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  galleryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#3498DB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  galleryBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  nutrientGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  nutrientField: { width: "30%", minWidth: 90 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#2E1A06", marginTop: 16, marginBottom: 4 },
});
