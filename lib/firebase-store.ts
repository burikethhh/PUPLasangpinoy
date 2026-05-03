// Firebase Store - Food Ordering System CRUD Operations
import type { Timestamp } from "firebase/firestore";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import type { OrderStatus, OrderType, PaymentMethod } from "../constants/order";
import {
    db,
    handleSdkBlocked,
    RestApi,
    shouldUseRest,
    type Profile
} from "./firebase";
import { createLogger } from "./logger";

const log = createLogger("Store");

// ==================== TYPES ====================

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  stock_quantity: number;
  available: boolean;
  created_at: Timestamp | { seconds: number };
}

export interface OrderItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_lat?: number;
  customer_lng?: number;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  order_type: OrderType;
  payment_method: PaymentMethod;
  scheduled_date?: string;
  scheduled_time?: string;
  reject_reason?: string;
  prepared_by?: string;
  driver_name?: string;
  driver_phone?: string;
  location_sharing_enabled?: boolean;
  customer_location_opt_in?: boolean;
  staff_location_opt_in?: boolean;
  driver_id?: string;
  created_at: Timestamp | { seconds: number };
  updated_at?: Timestamp | { seconds: number };
}

export interface LiveLocation {
  user_id: string;
  role: "customer" | "staff";
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  updated_at: Timestamp | { seconds: number };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  read: boolean;
  created_at: Timestamp | { seconds: number };
}

export interface Review {
  id: string;
  user_id: string;
  username: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  rating: number;
  comment: string;
  created_at: Timestamp | { seconds: number };
}

export interface Favorite {
  id: string;
  user_id: string;
  menu_item_id: string;
  collection_id?: string;
  created_at: Timestamp | { seconds: number };
}

export interface AppSettings {
  delivery_fee: number;
  delivery_radius_km: number;
  gcash_enabled: boolean;
  gcash_number?: string;
  store_name: string;
  store_address: string;
  store_phone: string;
}

// ==================== HELPERS ====================

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LP-${date}-${rand}`;
}

async function firestoreOp<T>(
  sdkFn: () => Promise<T>,
  restFn: () => Promise<T>,
): Promise<T> {
  if (shouldUseRest()) {
    return restFn();
  }
  try {
    return await sdkFn();
  } catch (error) {
    handleSdkBlocked(error);
    return restFn();
  }
}

// ==================== MENU ITEMS ====================

export async function getMenuItems(filters?: {
  category?: string;
  search?: string;
  availableOnly?: boolean;
}): Promise<MenuItem[]> {
  let items: MenuItem[] = [];

  items = await firestoreOp(
    async () => {
      const q = query(collection(db, "menu_items"), orderBy("name"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[];
    },
    async () => {
      const data = await RestApi.getCollection("menu_items", "name");
      return data as MenuItem[];
    },
  );

  if (filters?.availableOnly) {
    items = items.filter((i) => i.available && i.stock_quantity > 0);
  }
  if (filters?.category) {
    items = items.filter((i) => i.category === filters.category);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    items = items.filter(
      (i) => i.name.toLowerCase().includes(s) || i.description?.toLowerCase().includes(s),
    );
  }

  return items;
}

export async function getMenuItem(id: string): Promise<MenuItem | null> {
  return firestoreOp(
    async () => {
      const snap = await getDoc(doc(db, "menu_items", id));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as MenuItem) : null;
    },
    async () => (await RestApi.getDocument("menu_items", id)) as MenuItem | null,
  );
}

export async function addMenuItem(data: Omit<MenuItem, "id" | "created_at">): Promise<{ id: string }> {
  const payload = { ...data, created_at: new Date() };
  return firestoreOp(
    async () => {
      const ref = await addDoc(collection(db, "menu_items"), payload);
      return { id: ref.id };
    },
    async () => {
      const id = await RestApi.createDocument("menu_items", payload);
      return { id };
    },
  );
}

export async function updateMenuItem(id: string, data: Partial<MenuItem>): Promise<void> {
  return firestoreOp(
    async () => { await updateDoc(doc(db, "menu_items", id), data as any); },
    async () => { await RestApi.updateDocument("menu_items", id, data); },
  );
}

export async function deleteMenuItem(id: string): Promise<void> {
  return firestoreOp(
    async () => { await deleteDoc(doc(db, "menu_items", id)); },
    async () => { await RestApi.deleteDocument("menu_items", id); },
  );
}

// ==================== ORDERS ====================

export async function createOrder(data: {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_lat?: number;
  customer_lng?: number;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  order_type: OrderType;
  payment_method: PaymentMethod;
  scheduled_date?: string;
  scheduled_time?: string;
}): Promise<{ id: string; order_number: string }> {
  const order_number = generateOrderNumber();
  const payload = {
    ...data,
    order_number,
    status: "pending" as OrderStatus,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const result = await firestoreOp(
    async () => {
      const ref = await addDoc(collection(db, "orders"), payload);
      return { id: ref.id };
    },
    async () => {
      const id = await RestApi.createDocument("orders", payload);
      return { id };
    },
  );

  // Deduct stock for each item
  for (const item of data.items) {
    try {
      const menuItem = await getMenuItem(item.menu_item_id);
      if (menuItem) {
        const newQty = Math.max(0, menuItem.stock_quantity - item.quantity);
        await updateMenuItem(item.menu_item_id, { stock_quantity: newQty });
      }
    } catch (e) {
      log.warn("Could not deduct stock for " + item.menu_item_id, e);
    }
  }

  return { id: result.id, order_number };
}

export async function getOrders(filters?: {
  status?: OrderStatus;
  customer_id?: string;
}): Promise<Order[]> {
  let orders: Order[] = [];

  orders = await firestoreOp(
    async () => {
      const q = query(collection(db, "orders"), orderBy("created_at", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];
    },
    async () => {
      const data = await RestApi.getCollection("orders", "created_at");
      return data as Order[];
    },
  );

  if (filters?.status) {
    orders = orders.filter((o) => o.status === filters.status);
  }
  if (filters?.customer_id) {
    orders = orders.filter((o) => o.customer_id === filters.customer_id);
  }

  return orders;
}

export async function getOrder(id: string): Promise<Order | null> {
  return firestoreOp(
    async () => {
      const snap = await getDoc(doc(db, "orders", id));
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null;
    },
    async () => (await RestApi.getDocument("orders", id)) as Order | null,
  );
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  extra?: { reject_reason?: string; prepared_by?: string; driver_name?: string; driver_phone?: string },
): Promise<void> {
  const data: any = { status, updated_at: new Date(), ...extra };
  return firestoreOp(
    async () => { await updateDoc(doc(db, "orders", orderId), data); },
    async () => { await RestApi.updateDocument("orders", orderId, data); },
  );
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  const toSeconds = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.seconds === "number") return value.seconds;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
  };

  const sortNewestFirst = (rows: Order[]) => {
    return [...rows].sort((a, b) => toSeconds(b.created_at) - toSeconds(a.created_at));
  };

  return firestoreOp(
    async () => {
      const q = query(
        collection(db, "orders"),
        where("customer_id", "==", userId),
      );
      const snapshot = await getDocs(q);
      return sortNewestFirst(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]);
    },
    async () => {
      const data = await RestApi.queryCollection("orders", "customer_id", "==", userId);
      return sortNewestFirst(data as Order[]);
    },
  );
}

// ==================== MESSAGES ====================

export async function sendMessage(data: {
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
}): Promise<{ id: string }> {
  const payload = { ...data, read: false, created_at: new Date() };
  return firestoreOp(
    async () => {
      const ref = await addDoc(collection(db, "messages"), payload);
      return { id: ref.id };
    },
    async () => {
      const id = await RestApi.createDocument("messages", payload);
      return { id };
    },
  );
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return firestoreOp(
    async () => {
      const q = query(
        collection(db, "messages"),
        where("conversation_id", "==", conversationId),
        orderBy("created_at", "asc"),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
    },
    async () => {
      const data = await RestApi.queryCollection("messages", "conversation_id", "==", conversationId);
      return (data as Message[]).sort((a: any, b: any) => {
        const aTime = a.created_at?.seconds || 0;
        const bTime = b.created_at?.seconds || 0;
        return aTime - bTime;
      });
    },
  );
}

export async function getConversations(): Promise<{ customer_id: string; customer_name: string; last_message: string; unread: number }[]> {
  const allMessages = await firestoreOp(
    async () => {
      const q = query(collection(db, "messages"), orderBy("created_at", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
    },
    async () => {
      const data = await RestApi.getCollection("messages", "created_at");
      return data as Message[];
    },
  );

  const convMap = new Map<string, { customer_id: string; customer_name: string; last_message: string; unread: number }>();
  for (const msg of allMessages) {
    const cid = msg.conversation_id;
    if (!convMap.has(cid)) {
      convMap.set(cid, {
        customer_id: cid,
        customer_name: msg.sender_role === "customer" ? msg.sender_name : "Customer",
        last_message: msg.content,
        unread: 0,
      });
    }
    const conv = convMap.get(cid)!;
    if (!msg.read && msg.sender_role === "customer") {
      conv.unread++;
    }
    if (msg.sender_role === "customer") {
      conv.customer_name = msg.sender_name;
    }
  }

  return Array.from(convMap.values());
}

export async function deleteMessage(messageId: string): Promise<void> {
  return firestoreOp(
    async () => { await deleteDoc(doc(db, "messages", messageId)); },
    async () => { await RestApi.deleteDocument("messages", messageId); },
  );
}

export async function markMessagesRead(conversationId: string, readerRole: string): Promise<void> {
  const messages = await getMessages(conversationId);
  for (const msg of messages) {
    if (!msg.read && msg.sender_role !== readerRole) {
      await firestoreOp(
        async () => { await updateDoc(doc(db, "messages", msg.id), { read: true }); },
        async () => { await RestApi.updateDocument("messages", msg.id, { read: true }); },
      );
    }
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const messages = await getMessages(conversationId);
  for (const msg of messages) {
    await firestoreOp(
      async () => { await deleteDoc(doc(db, "messages", msg.id)); },
      async () => { await RestApi.deleteDocument("messages", msg.id); },
    );
  }
}

export async function validateStock(items: { menu_item_id: string; name: string; quantity: number }[]): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  for (const item of items) {
    try {
      const menuItem = await getMenuItem(item.menu_item_id);
      if (!menuItem) {
        issues.push(`${item.name} is no longer available.`);
      } else if (!menuItem.available) {
        issues.push(`${item.name} is currently unavailable.`);
      } else if (menuItem.stock_quantity < item.quantity) {
        if (menuItem.stock_quantity === 0) {
          issues.push(`${item.name} is out of stock.`);
        } else {
          issues.push(`${item.name}: only ${menuItem.stock_quantity} left (you have ${item.quantity}).`);
        }
      }
    } catch {
      issues.push(`Could not verify stock for ${item.name}.`);
    }
  }
  return { valid: issues.length === 0, issues };
}

// ==================== REVIEWS ====================

export async function addReview(data: Omit<Review, "id" | "created_at">): Promise<{ id: string }> {
  const payload = { ...data, created_at: new Date() };
  return firestoreOp(
    async () => {
      const ref = await addDoc(collection(db, "reviews"), payload);
      return { id: ref.id };
    },
    async () => {
      const id = await RestApi.createDocument("reviews", payload);
      return { id };
    },
  );
}

export async function getReviews(menuItemId?: string): Promise<Review[]> {
  if (menuItemId) {
    return firestoreOp(
      async () => {
        const q = query(
          collection(db, "reviews"),
          where("menu_item_id", "==", menuItemId),
          orderBy("created_at", "desc"),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Review[];
      },
      async () => {
        const data = await RestApi.queryCollection("reviews", "menu_item_id", "==", menuItemId);
        return data as Review[];
      },
    );
  }

  return firestoreOp(
    async () => {
      const q = query(collection(db, "reviews"), orderBy("created_at", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Review[];
    },
    async () => {
      const data = await RestApi.getCollection("reviews", "created_at");
      return data as Review[];
    },
  );
}

export async function deleteReview(id: string): Promise<void> {
  return firestoreOp(
    async () => { await deleteDoc(doc(db, "reviews", id)); },
    async () => { await RestApi.deleteDocument("reviews", id); },
  );
}

// ==================== FAVORITES ====================

export async function getFavorites(userId: string): Promise<Favorite[]> {
  return firestoreOp(
    async () => {
      const q = query(
        collection(db, "favorites"),
        where("user_id", "==", userId),
        orderBy("created_at", "desc"),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Favorite[];
    },
    async () => {
      const data = await RestApi.queryCollection("favorites", "user_id", "==", userId);
      return data as Favorite[];
    },
  );
}

export async function addFavorite(userId: string, menuItemId: string): Promise<void> {
  const existing = await getFavorites(userId);
  if (existing.some((f) => f.menu_item_id === menuItemId)) return;

  const payload = { user_id: userId, menu_item_id: menuItemId, created_at: new Date() };
  await firestoreOp(
    async () => { await addDoc(collection(db, "favorites"), payload); },
    async () => { await RestApi.createDocument("favorites", payload); },
  );
}

export async function removeFavorite(userId: string, menuItemId: string): Promise<void> {
  const favs = await getFavorites(userId);
  const toDelete = favs.filter((f) => f.menu_item_id === menuItemId);
  for (const f of toDelete) {
    await firestoreOp(
      async () => { await deleteDoc(doc(db, "favorites", f.id)); },
      async () => { await RestApi.deleteDocument("favorites", f.id); },
    );
  }
}

export async function isFavorited(userId: string, menuItemId: string): Promise<boolean> {
  const favs = await getFavorites(userId);
  return favs.some((f) => f.menu_item_id === menuItemId);
}

export async function getFavoritesWithItems(userId: string): Promise<MenuItem[]> {
  const favs = await getFavorites(userId);
  const items = await Promise.all(
    favs.map(async (f) => {
      const item = await getMenuItem(f.menu_item_id);
      return item;
    }),
  );
  return items.filter((i): i is MenuItem => i !== null);
}

// ==================== FAVORITE COLLECTIONS ====================

export async function getFavoriteCollections(userId: string): Promise<{ id: string; name: string; count: number }[]> {
  return firestoreOp(
    async () => {
      const q = query(collection(db, "favorite_collections"), where("user_id", "==", userId));
      const snapshot = await getDocs(q);
      const cols = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      const favs = await getFavorites(userId);
      return cols.map((c) => ({
        id: c.id,
        name: c.name,
        count: favs.filter((f) => f.collection_id === c.id).length,
      }));
    },
    async () => {
      const data = await RestApi.queryCollection("favorite_collections", "user_id", "==", userId);
      const favs = await getFavorites(userId);
      return (data as any[]).map((c) => ({
        id: c.id,
        name: c.name,
        count: favs.filter((f: any) => f.collection_id === c.id).length,
      }));
    },
  );
}

export async function createFavoriteCollection(userId: string, name: string): Promise<{ id: string }> {
  const payload = { user_id: userId, name, created_at: new Date() };
  return firestoreOp(
    async () => {
      const ref = await addDoc(collection(db, "favorite_collections"), payload);
      return { id: ref.id };
    },
    async () => {
      const result = await RestApi.createDocument("favorite_collections", payload);
      return { id: typeof result === "string" ? result : (result as any).id || "" };
    },
  );
}

export async function moveFavoriteToCollection(userId: string, menuItemId: string, collectionId: string): Promise<void> {
  const favs = await getFavorites(userId);
  const fav = favs.find((f) => f.menu_item_id === menuItemId);
  if (!fav) return;
  await firestoreOp(
    async () => { await updateDoc(doc(db, "favorites", fav.id), { collection_id: collectionId || null }); },
    async () => { await RestApi.updateDocument("favorites", fav.id, { collection_id: collectionId || null }); },
  );
}

// ==================== SETTINGS ====================

const SETTINGS_DOC = "app_settings";

export async function getSettings(): Promise<AppSettings> {
  const defaults: AppSettings = {
    delivery_fee: 50,
    delivery_radius_km: 10,
    gcash_enabled: false,
    gcash_number: "",
    store_name: "FOODFIX",
    store_address: "",
    store_phone: "",
  };

  try {
    const data = await firestoreOp(
      async () => {
        const snap = await getDoc(doc(db, "settings", SETTINGS_DOC));
        return snap.exists() ? snap.data() : null;
      },
      async () => await RestApi.getDocument("settings", SETTINGS_DOC),
    );
    return data ? { ...defaults, ...data } as AppSettings : defaults;
  } catch {
    return defaults;
  }
}

export async function updateSettings(data: Partial<AppSettings>): Promise<void> {
  return firestoreOp(
    async () => { await setDoc(doc(db, "settings", SETTINGS_DOC), data, { merge: true }); },
    async () => { await RestApi.updateDocument("settings", SETTINGS_DOC, data); },
  );
}

// ==================== SALES REPORT ====================

export async function getSalesReport(dateFrom?: string, dateTo?: string): Promise<{
  total_orders: number;
  total_revenue: number;
  items_sold: { name: string; quantity: number; revenue: number }[];
  orders_by_status: Record<string, number>;
  orders_by_type: Record<string, number>;
}> {
  const orders = await getOrders();

  let filtered = orders.filter((o) => o.status === "delivered");
  if (dateFrom) {
    filtered = filtered.filter((o) => {
      const d = o.created_at && "seconds" in o.created_at
        ? new Date(o.created_at.seconds * 1000).toISOString().slice(0, 10)
        : "";
      return d >= dateFrom;
    });
  }
  if (dateTo) {
    filtered = filtered.filter((o) => {
      const d = o.created_at && "seconds" in o.created_at
        ? new Date(o.created_at.seconds * 1000).toISOString().slice(0, 10)
        : "";
      return d <= dateTo;
    });
  }

  const itemsMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of filtered) {
    for (const item of order.items || []) {
      const existing = itemsMap.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.price * item.quantity;
      itemsMap.set(item.name, existing);
    }
  }

  const statusCount: Record<string, number> = {};
  const typeCount: Record<string, number> = {};
  for (const o of orders) {
    statusCount[o.status] = (statusCount[o.status] || 0) + 1;
    typeCount[o.order_type] = (typeCount[o.order_type] || 0) + 1;
  }

  return {
    total_orders: filtered.length,
    total_revenue: filtered.reduce((sum, o) => sum + (o.total || 0), 0),
    items_sold: Array.from(itemsMap.values()).sort((a, b) => b.quantity - a.quantity),
    orders_by_status: statusCount,
    orders_by_type: typeCount,
  };
}

// ==================== INVENTORY ALERTS ====================

export async function getLowStockItems(threshold = 10): Promise<MenuItem[]> {
  const items = await getMenuItems();
  return items.filter((i) => i.stock_quantity <= threshold);
}

// ==================== STAFF HELPERS ====================

export async function getStaffProfiles(): Promise<Profile[]> {
  return firestoreOp(
    async () => {
      const q = query(collection(db, "profiles"), where("role", "==", "staff"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Profile[];
    },
    async () => {
      const data = await RestApi.getCollection("profiles", "created_at");
      return (data as Profile[]).filter((p) => p.role === "staff");
    },
  );
}

// ==================== LIVE LOCATION ====================

export async function upsertLocation(
  orderId: string,
  userId: string,
  role: "customer" | "staff",
  coords: { lat: number; lng: number; heading?: number; speed?: number; accuracy?: number },
): Promise<void> {
  return firestoreOp(
    async () => {
      const { serverTimestamp } = await import("firebase/firestore");
      await setDoc(
        doc(db, "orders", orderId, "locations", role),
        { user_id: userId, role, ...coords, updated_at: serverTimestamp() },
        { merge: true },
      );
    },
    async () => {
      await RestApi.updateDocument(`orders/${orderId}/locations`, role, {
        user_id: userId, role, ...coords, updated_at: new Date().toISOString(),
      });
    },
  );
}

export function onLocationUpdate(
  orderId: string,
  role: "customer" | "staff",
  callback: (loc: LiveLocation | null) => void,
): () => void {
  try {
    const { onSnapshot: firestoreOnSnapshot } = require("firebase/firestore");
    const locRef = doc(db, "orders", orderId, "locations", role === "staff" ? "staff" : "customer");
    const unsub = firestoreOnSnapshot(locRef, (snap: any) => {
      if (snap.exists()) callback({ ...snap.data() } as LiveLocation);
      else callback(null);
    });
    return unsub;
  } catch {
    return () => {};
  }
}

export function onOrderUpdate(
  orderId: string,
  callback: (order: Order | null) => void,
): () => void {
  try {
    const { onSnapshot: firestoreOnSnapshot } = require("firebase/firestore");
    const orderRef = doc(db, "orders", orderId);
    const unsub = firestoreOnSnapshot(orderRef, (snap: any) => {
      if (snap.exists()) {
        const data = snap.data();
        const order: Order = {
          id: snap.id,
          ...data,
          created_at: data.created_at,
          updated_at: data.updated_at,
          items: data.items || [],
        };
        callback(order);
      } else {
        callback(null);
      }
    });
    return unsub;
  } catch {
    return () => {};
  }
}

export async function setLocationOptIn(
  orderId: string,
  field: "customer_location_opt_in" | "staff_location_opt_in" | "location_sharing_enabled" | "driver_id",
  value: boolean | string,
): Promise<void> {
  return firestoreOp(
    async () => { await updateDoc(doc(db, "orders", orderId), { [field]: value }); },
    async () => { await RestApi.updateDocument("orders", orderId, { [field]: value }); },
  );
}
