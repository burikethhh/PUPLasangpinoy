// Firebase Configuration for LasangPinoy Mobile
// With REST API fallback for web browsers with ad blockers
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
    createUserWithEmailAndPassword,
    FacebookAuthProvider,
    getAuth,
    getReactNativePersistence,
    GoogleAuthProvider,
    initializeAuth,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    User,
} from "firebase/auth";
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    orderBy,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { Platform } from "react-native";
import * as RestApi from "./firestore-rest";
import { createLogger } from "./logger";

const log = createLogger("Firebase");

// Cache keys
const CACHE_KEY_RECIPES = "@lasangpinoy_recipes_cache";
const CACHE_KEY_REGIONS = "@lasangpinoy_regions_cache";

// Types
export interface Profile {
  id: string;
  email: string;
  username: string;
  is_admin: boolean;
  created_at: Timestamp | { seconds: number };
}

export interface Recipe {
  id: string;
  title: string;
  category: string;
  region: string;
  ingredients: string;
  instructions: string;
  nutrition: string;
  health_notes: string;
  history: string;
  fun_fact: string;
  image_url: string;
  user_id: string;
  created_at: Timestamp | { seconds: number };
}

export interface Region {
  id: string;
  name: string;
  description: string;
  created_at: Timestamp | { seconds: number };
}

export interface Bookmark {
  id: string;
  user_id: string;
  recipe_id: string;
  created_at: Timestamp | { seconds: number };
}

export interface Feedback {
  id: string;
  user_id: string;
  recipe_id: string;
  rating: number;
  comment: string;
  created_at: Timestamp | { seconds: number };
}

export interface RecipeBookmarkUser {
  user_id: string;
  username: string;
  email: string;
  created_at?: Timestamp | { seconds: number };
}

export interface RecipeRatingUser {
  user_id: string;
  username: string;
  email: string;
  rating: number;
  comment: string;
  created_at?: Timestamp | { seconds: number };
}

export interface RecipeEngagement {
  recipe_id: string;
  bookmark_users: RecipeBookmarkUser[];
  rating_users: RecipeRatingUser[];
}

// Firebase configuration
const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
};

// Track if SDK is blocked (for automatic REST fallback)
let sdkBlocked = false;
let useRestApi = Platform.OS === "web"; // Always try REST first on web

// Log config on web for debugging
if (Platform.OS === "web" && typeof window !== "undefined") {
  log.info(
    `Initializing with project: ${firebaseConfig.projectId}`,
  );
  log.info("Using REST API fallback for web");
}

// Initialize Firebase
let app: ReturnType<typeof initializeApp>;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  log.info("App initialized successfully");
} catch (error) {
  log.error("App initialization error", error);
  app = getApp();
}

// Initialize Auth with persistence
let auth: ReturnType<typeof getAuth>;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: any) {
    // If auth was already initialized (e.g. hot reload), fall back to getAuth
    auth = getAuth(app);
  }
}

// Initialize Firestore - targeting the 'default' named database (not the standard '(default)')
let db: ReturnType<typeof getFirestore>;
try {
  db = getFirestore(app, 'default');
  log.info("Firestore initialized");
} catch (error) {
  log.error("Firestore initialization error", error);
  db = getFirestore(app, 'default');
}

// Auth providers
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();

// Helper: Mark SDK as blocked and switch to REST
function markSdkBlocked(error: any) {
  const errorMsg = error?.message?.toLowerCase() || "";
  const errorCode = error?.code?.toLowerCase() || "";

  if (
    errorMsg.includes("blocked") ||
    errorMsg.includes("network") ||
    errorMsg.includes("failed to fetch") ||
    (errorMsg.includes("database") && errorMsg.includes("not found")) ||
    errorCode.includes("unavailable")
  ) {
    if (!sdkBlocked) {
      log.warn("SDK appears blocked, switching to REST API", error);
      sdkBlocked = true;
      useRestApi = true;
    }
  }
}

// Helper: Create timestamp
function createTimestamp() {
  return Timestamp.now();
}

// ==================== AUTH FUNCTIONS ====================

// Helper to set REST API token from a user object (for OAuth flows)
export async function setRestTokenFromUser(user: User) {
  if (user) {
    const token = await user.getIdToken();
    RestApi.setAuthToken(token);
  }
}

async function ensureRestAuthToken() {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(true);
    RestApi.setAuthToken(token);
  }
}

export async function signIn(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);

  // Set auth token for REST API
  if (result.user) {
    const token = await result.user.getIdToken();
    RestApi.setAuthToken(token);
  }

  return result;
}

export async function signUp(
  email: string,
  password: string,
  username: string,
) {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  // Set auth token for REST API
  if (userCredential.user) {
    const token = await userCredential.user.getIdToken();
    RestApi.setAuthToken(token);
  }

  // Create user profile
  const profileData = {
    email,
    username,
    is_admin: false,
    created_at: new Date(),
  };

  if (useRestApi) {
    await RestApi.setDocument("profiles", userCredential.user.uid, profileData);
  } else {
    try {
      await setDoc(doc(db, "profiles", userCredential.user.uid), {
        ...profileData,
        created_at: createTimestamp(),
      });
    } catch (error) {
      markSdkBlocked(error);
      await RestApi.setDocument(
        "profiles",
        userCredential.user.uid,
        profileData,
      );
    }
  }

  return userCredential;
}

export async function logOut() {
  RestApi.setAuthToken(null);
  return signOut(auth);
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function verifyEmail() {
  const user = auth.currentUser;
  if (user && !user.emailVerified) {
    return sendEmailVerification(user);
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      RestApi.setAuthToken(token);
    } else {
      RestApi.setAuthToken(null);
    }
    callback(user);
  });
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ==================== PROFILE FUNCTIONS ====================

export async function getProfile(userId: string): Promise<Profile | null> {
  console.log('[getProfile] useRestApi:', useRestApi, 'userId:', userId);
  if (useRestApi) {
    try {
      const data = await RestApi.getDocument("profiles", userId);
      console.log('[getProfile] REST result:', JSON.stringify(data));
      return data as Profile | null;
    } catch (error) {
      console.error('[getProfile] REST error:', error);
      log.error("REST getProfile failed", error);
      return null;
    }
  }

  try {
    const docRef = doc(db, "profiles", userId);
    console.log('[getProfile] SDK path:', docRef.path, 'db name:', (db as any)._databaseId?.database);
    const docSnap = await getDoc(docRef);
    console.log('[getProfile] SDK exists:', docSnap.exists(), 'data:', JSON.stringify(docSnap.exists() ? docSnap.data() : null));
    return docSnap.exists()
      ? ({ id: docSnap.id, ...docSnap.data() } as Profile)
      : null;
  } catch (error) {
    console.error('[getProfile] SDK error:', error);
    markSdkBlocked(error);
    // Fallback to REST
    try {
      const data = await RestApi.getDocument("profiles", userId);
      console.log('[getProfile] REST fallback result:', JSON.stringify(data));
      return data as Profile | null;
    } catch (restError) {
      console.error('[getProfile] REST fallback error:', restError);
      log.error("Both SDK and REST failed", restError);
      return null;
    }
  }
}

export async function updateProfile(userId: string, data: Partial<Profile>) {
  if (useRestApi) {
    return RestApi.updateDocument("profiles", userId, data);
  }

  try {
    const docRef = doc(db, "profiles", userId);
    return updateDoc(docRef, data as any);
  } catch (error) {
    markSdkBlocked(error);
    return RestApi.updateDocument("profiles", userId, data);
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  return profile?.is_admin === true;
}

// ==================== RECIPES FUNCTIONS ====================

export async function getRecipes(filters?: {
  category?: string;
  region?: string;
  search?: string;
}): Promise<Recipe[]> {
  let recipes: Recipe[] = [];
  let fetchedFromNetwork = false;

  if (useRestApi) {
    try {
      const data = await RestApi.getCollection("recipes", "created_at");
      recipes = data as Recipe[];
      fetchedFromNetwork = true;
    } catch (error) {
      log.error("REST getRecipes failed", error);
    }
  } else {
    try {
      const q = query(collection(db, "recipes"), orderBy("created_at", "desc"));
      const snapshot = await getDocs(q);
      recipes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Recipe[];
      fetchedFromNetwork = true;
    } catch (error) {
      markSdkBlocked(error);
      try {
        const data = await RestApi.getCollection("recipes", "created_at");
        recipes = data as Recipe[];
        fetchedFromNetwork = true;
      } catch (restError) {
        log.error("Both SDK and REST failed", restError);
      }
    }
  }

  // Cache recipes if we got fresh data from network
  if (fetchedFromNetwork && recipes.length > 0) {
    try {
      await AsyncStorage.setItem(CACHE_KEY_RECIPES, JSON.stringify(recipes));
    } catch (e) {
      /* ignore cache write failure */
    }
  }

  // If network failed, try loading from cache
  if (!fetchedFromNetwork || recipes.length === 0) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY_RECIPES);
      if (cached) {
        recipes = JSON.parse(cached) as Recipe[];
        log.info("Loaded recipes from offline cache");
      }
    } catch (e) {
      /* ignore cache read failure */
    }
  }

  // Apply filters client-side
  if (filters?.category) {
    recipes = recipes.filter((r) => r.category === filters.category);
  }
  if (filters?.region) {
    recipes = recipes.filter((r) => r.region === filters.region);
  }
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    recipes = recipes.filter(
      (r) =>
        r.title?.toLowerCase().includes(searchLower) ||
        r.ingredients?.toLowerCase().includes(searchLower),
    );
  }

  return recipes;
}

export async function getRecipe(recipeId: string): Promise<Recipe | null> {
  if (useRestApi) {
    try {
      const data = await RestApi.getDocument("recipes", recipeId);
      return data as Recipe | null;
    } catch (error) {
      log.error("REST getRecipe failed", error);
      return null;
    }
  }

  try {
    const docRef = doc(db, "recipes", recipeId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists()
      ? ({ id: docSnap.id, ...docSnap.data() } as Recipe)
      : null;
  } catch (error) {
    markSdkBlocked(error);
    try {
      const data = await RestApi.getDocument("recipes", recipeId);
      return data as Recipe | null;
    } catch (restError) {
      log.error("Both SDK and REST failed", restError);
      return null;
    }
  }
}

export async function addRecipe(data: Partial<Recipe>) {
  const recipeData = {
    ...data,
    created_at: new Date(),
  };

  if (useRestApi) {
    const docId = await RestApi.createDocument("recipes", recipeData);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
    return { id: docId };
  }

  try {
    const result = await addDoc(collection(db, "recipes"), {
      ...data,
      created_at: createTimestamp(),
    });
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
    return result;
  } catch (error) {
    markSdkBlocked(error);
    const docId = await RestApi.createDocument("recipes", recipeData);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
    return { id: docId };
  }
}

export async function updateRecipe(recipeId: string, data: Partial<Recipe>) {
  if (useRestApi) {
    await RestApi.updateDocument("recipes", recipeId, data);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
    return;
  }

  try {
    const docRef = doc(db, "recipes", recipeId);
    await updateDoc(docRef, data as any);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
  } catch (error) {
    markSdkBlocked(error);
    await RestApi.updateDocument("recipes", recipeId, data);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
  }
}

export async function deleteRecipe(recipeId: string) {
  if (useRestApi) {
    await RestApi.deleteDocument("recipes", recipeId);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
    return;
  }

  try {
    const docRef = doc(db, "recipes", recipeId);
    await deleteDoc(docRef);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
  } catch (error) {
    markSdkBlocked(error);
    await RestApi.deleteDocument("recipes", recipeId);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_RECIPES);
    } catch {}
  }
}

// ==================== REGIONS FUNCTIONS ====================

export async function getRegions(): Promise<Region[]> {
  let regions: Region[] = [];
  let fetchedFromNetwork = false;

  if (useRestApi) {
    try {
      const data = await RestApi.getCollection("regions", "name");
      regions = data as Region[];
      fetchedFromNetwork = true;
    } catch (error) {
      log.error("REST getRegions failed", error);
    }
  } else {
    try {
      const q = query(collection(db, "regions"), orderBy("name"));
      const snapshot = await getDocs(q);
      regions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Region[];
      fetchedFromNetwork = true;
    } catch (error) {
      markSdkBlocked(error);
      try {
        const data = await RestApi.getCollection("regions", "name");
        regions = data as Region[];
        fetchedFromNetwork = true;
      } catch (restError) {
        log.error("Both SDK and REST failed", restError);
      }
    }
  }

  // Cache regions if we got fresh data
  if (fetchedFromNetwork && regions.length > 0) {
    try {
      await AsyncStorage.setItem(CACHE_KEY_REGIONS, JSON.stringify(regions));
    } catch (e) {
      /* ignore */
    }
  }

  // Fallback to cache if network failed
  if (!fetchedFromNetwork || regions.length === 0) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY_REGIONS);
      if (cached) {
        regions = JSON.parse(cached) as Region[];
        log.info("Loaded regions from offline cache");
      }
    } catch (e) {
      /* ignore */
    }
  }

  return regions;
}

export async function addRegion(name: string, description?: string) {
  const regionData = {
    name,
    description: description || "",
    created_at: new Date(),
  };

  if (useRestApi) {
    const docId = await RestApi.createDocument("regions", regionData);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
    return { id: docId };
  }

  try {
    const result = await addDoc(collection(db, "regions"), {
      name,
      description: description || "",
      created_at: createTimestamp(),
    });
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
    return result;
  } catch (error) {
    markSdkBlocked(error);
    const docId = await RestApi.createDocument("regions", regionData);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
    return { id: docId };
  }
}

export async function updateRegion(regionId: string, data: Partial<Region>) {
  if (useRestApi) {
    await RestApi.updateDocument("regions", regionId, data);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
    return;
  }

  try {
    const docRef = doc(db, "regions", regionId);
    await updateDoc(docRef, data as any);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
  } catch (error) {
    markSdkBlocked(error);
    await RestApi.updateDocument("regions", regionId, data);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
  }
}

export async function deleteRegion(regionId: string) {
  if (useRestApi) {
    await RestApi.deleteDocument("regions", regionId);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
    return;
  }

  try {
    const docRef = doc(db, "regions", regionId);
    await deleteDoc(docRef);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
  } catch (error) {
    markSdkBlocked(error);
    await RestApi.deleteDocument("regions", regionId);
    try {
      await AsyncStorage.removeItem(CACHE_KEY_REGIONS);
    } catch {}
  }
}

// ==================== BOOKMARKS FUNCTIONS ====================

export async function getBookmarks(userId: string): Promise<Bookmark[]> {
  if (useRestApi) {
    try {
      const data = await RestApi.queryCollection(
        "bookmarks",
        "user_id",
        "==",
        userId,
      );
      return data as Bookmark[];
    } catch (error) {
      log.error("REST getBookmarks failed", error);
      return [];
    }
  }

  try {
    const q = query(
      collection(db, "bookmarks"),
      where("user_id", "==", userId),
      orderBy("created_at", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Bookmark[];
  } catch (error) {
    markSdkBlocked(error);
    try {
      const data = await RestApi.queryCollection(
        "bookmarks",
        "user_id",
        "==",
        userId,
      );
      return data as Bookmark[];
    } catch (restError) {
      log.error("Both SDK and REST failed", restError);
      return [];
    }
  }
}

export async function getBookmarksWithRecipes(
  userId: string,
): Promise<Recipe[]> {
  const bookmarks = await getBookmarks(userId);
  const recipes = await Promise.all(
    bookmarks.map(async (bookmark) => {
      const recipe = await getRecipe(bookmark.recipe_id);
      return recipe;
    }),
  );
  return recipes.filter((r): r is Recipe => r !== null);
}

export async function isBookmarked(
  userId: string,
  recipeId: string,
): Promise<boolean> {
  if (useRestApi) {
    try {
      const data = await RestApi.queryCollection(
        "bookmarks",
        "user_id",
        "==",
        userId,
      );
      return data.some((b) => b.recipe_id === recipeId);
    } catch (error) {
      log.error("REST isBookmarked failed", error);
      return false;
    }
  }

  try {
    const q = query(
      collection(db, "bookmarks"),
      where("user_id", "==", userId),
      where("recipe_id", "==", recipeId),
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    markSdkBlocked(error);
    try {
      const data = await RestApi.queryCollection(
        "bookmarks",
        "user_id",
        "==",
        userId,
      );
      return data.some((b) => b.recipe_id === recipeId);
    } catch (restError) {
      log.error("Both SDK and REST failed", restError);
      return false;
    }
  }
}

export async function addBookmark(userId: string, recipeId: string) {
  const exists = await isBookmarked(userId, recipeId);
  if (exists) return;

  const bookmarkData = {
    user_id: userId,
    recipe_id: recipeId,
    created_at: new Date(),
  };

  if (useRestApi) {
    const docId = await RestApi.createDocument("bookmarks", bookmarkData);
    return { id: docId };
  }

  try {
    return addDoc(collection(db, "bookmarks"), {
      user_id: userId,
      recipe_id: recipeId,
      created_at: createTimestamp(),
    });
  } catch (error) {
    markSdkBlocked(error);
    const docId = await RestApi.createDocument("bookmarks", bookmarkData);
    return { id: docId };
  }
}

export async function removeBookmark(userId: string, recipeId: string) {
  if (useRestApi) {
    try {
      const bookmarks = await RestApi.queryCollection(
        "bookmarks",
        "user_id",
        "==",
        userId,
      );
      const toDelete = bookmarks.filter((b) => b.recipe_id === recipeId);
      await Promise.all(
        toDelete.map((b) => RestApi.deleteDocument("bookmarks", b.id)),
      );
    } catch (error) {
      log.error("REST removeBookmark failed", error);
    }
    return;
  }

  try {
    const q = query(
      collection(db, "bookmarks"),
      where("user_id", "==", userId),
      where("recipe_id", "==", recipeId),
    );
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
    return Promise.all(deletePromises);
  } catch (error) {
    markSdkBlocked(error);
    try {
      const bookmarks = await RestApi.queryCollection(
        "bookmarks",
        "user_id",
        "==",
        userId,
      );
      const toDelete = bookmarks.filter((b) => b.recipe_id === recipeId);
      await Promise.all(
        toDelete.map((b) => RestApi.deleteDocument("bookmarks", b.id)),
      );
    } catch (restError) {
      log.error("Both SDK and REST failed", restError);
    }
  }
}

// ==================== FEEDBACK FUNCTIONS ====================

export async function getFeedback(recipeId: string): Promise<Feedback[]> {
  if (useRestApi) {
    try {
      const data = await RestApi.queryCollection(
        "feedback",
        "recipe_id",
        "==",
        recipeId,
      );
      return data as Feedback[];
    } catch (error) {
      log.error("REST getFeedback failed", error);
      return [];
    }
  }

  try {
    const q = query(
      collection(db, "feedback"),
      where("recipe_id", "==", recipeId),
      orderBy("created_at", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Feedback[];
  } catch (error) {
    markSdkBlocked(error);
    try {
      const data = await RestApi.queryCollection(
        "feedback",
        "recipe_id",
        "==",
        recipeId,
      );
      return data as Feedback[];
    } catch (restError) {
      log.error("Both SDK and REST failed", restError);
      return [];
    }
  }
}

export async function addFeedback(
  userId: string,
  recipeId: string,
  rating: number,
  comment: string,
) {
  const feedbackData = {
    user_id: userId,
    recipe_id: recipeId,
    rating,
    comment,
    created_at: new Date(),
  };

  if (useRestApi) {
    const docId = await RestApi.createDocument("feedback", feedbackData);
    return { id: docId };
  }

  try {
    return addDoc(collection(db, "feedback"), {
      user_id: userId,
      recipe_id: recipeId,
      rating,
      comment,
      created_at: createTimestamp(),
    });
  } catch (error) {
    markSdkBlocked(error);
    const docId = await RestApi.createDocument("feedback", feedbackData);
    return { id: docId };
  }
}

export async function deleteFeedback(feedbackId: string) {
  if (useRestApi) {
    return RestApi.deleteDocument("feedback", feedbackId);
  }

  try {
    const docRef = doc(db, "feedback", feedbackId);
    return deleteDoc(docRef);
  } catch (error) {
    markSdkBlocked(error);
    return RestApi.deleteDocument("feedback", feedbackId);
  }
}

// ==================== ADMIN FUNCTIONS ====================

export async function getAllUsers(): Promise<Profile[]> {
  if (useRestApi) {
    try {
      const data = await RestApi.getCollection("profiles", "created_at");
      return data as Profile[];
    } catch (error) {
      log.error("REST getAllUsers failed", error);
      return [];
    }
  }

  try {
    const q = query(collection(db, "profiles"), orderBy("created_at", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Profile[];
  } catch (error) {
    markSdkBlocked(error);
    try {
      const data = await RestApi.getCollection("profiles", "created_at");
      return data as Profile[];
    } catch (restError) {
      log.error("Both SDK and REST failed", restError);
      return [];
    }
  }
}

export async function setUserAdmin(userId: string, isAdminValue: boolean) {
  if (useRestApi) {
    return RestApi.updateDocument("profiles", userId, {
      is_admin: isAdminValue,
    });
  }

  try {
    const docRef = doc(db, "profiles", userId);
    return updateDoc(docRef, { is_admin: isAdminValue });
  } catch (error) {
    markSdkBlocked(error);
    return RestApi.updateDocument("profiles", userId, {
      is_admin: isAdminValue,
    });
  }
}

export async function deleteUser(userId: string) {
  if (useRestApi) {
    return RestApi.deleteDocument("profiles", userId);
  }

  try {
    const docRef = doc(db, "profiles", userId);
    return deleteDoc(docRef);
  } catch (error) {
    markSdkBlocked(error);
    return RestApi.deleteDocument("profiles", userId);
  }
}

// ==================== CONNECTIVITY FUNCTIONS ====================

export async function testFirestoreConnection(): Promise<boolean> {
  // First try REST API (more reliable on web)
  if (useRestApi) {
    return RestApi.testRestConnectivity();
  }

  try {
    const testDoc = await getDoc(doc(db, "_connectivity_test", "test"));
    return true;
  } catch (error: any) {
    markSdkBlocked(error);
    // Try REST as fallback
    return RestApi.testRestConnectivity();
  }
}

// ==================== STORAGE FUNCTIONS ====================

/**
 * Upload a recipe image and return the CDN URL to store in Firestore.
 * Uses Cloudinary (free tier: 25 GB storage, no credit card required).
 * The returned URL is stored as `image_url` in the recipes collection —
 * no Firestore schema changes needed.
 */
export async function uploadRecipeImage(
  uri: string,
  _recipeId?: string,
): Promise<string> {
  const { uploadToCloudinary } = await import("./cloudinary");
  return uploadToCloudinary(uri, "lasangpinoy/recipes");
}

// ==================== ALL FEEDBACK (ADMIN) ====================

export async function getAllFeedback(): Promise<
  (Feedback & { recipe_title?: string; username?: string })[]
> {
  let feedbacks: Feedback[] = [];

  if (useRestApi) {
    try {
      const data = await RestApi.getCollection("feedback", "created_at");
      feedbacks = data as Feedback[];
    } catch (error) {
      log.error("REST getAllFeedback failed", error);
      return [];
    }
  } else {
    try {
      const q = query(
        collection(db, "feedback"),
        orderBy("created_at", "desc"),
      );
      const snapshot = await getDocs(q);
      feedbacks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Feedback[];
    } catch (error) {
      markSdkBlocked(error);
      try {
        const data = await RestApi.getCollection("feedback", "created_at");
        feedbacks = data as Feedback[];
      } catch (restError) {
        log.error("Both SDK and REST failed", restError);
        return [];
      }
    }
  }

  // Enrich with recipe titles and usernames
  const enriched = await Promise.all(
    feedbacks.map(async (fb) => {
      const [recipe, profile] = await Promise.all([
        getRecipe(fb.recipe_id).catch(() => null),
        getProfile(fb.user_id).catch(() => null),
      ]);
      return {
        ...fb,
        recipe_title: recipe?.title || "Unknown Recipe",
        username:
          profile?.username || profile?.email?.split("@")[0] || "Anonymous",
      };
    }),
  );

  return enriched;
}

// ==================== RECIPE ENGAGEMENT (ADMIN) ====================

export async function getRecipeEngagement(
  recipeId: string,
): Promise<RecipeEngagement> {
  let bookmarks: Bookmark[] = [];
  let ratings: Feedback[] = [];

  if (useRestApi) {
    try {
      const allBookmarks = await RestApi.getCollection("bookmarks", "created_at");
      const allRatings = await RestApi.getCollection("feedback", "created_at");
      bookmarks = (allBookmarks as Bookmark[]).filter((b) => b.recipe_id === recipeId);
      ratings = (allRatings as Feedback[]).filter((f) => f.recipe_id === recipeId);
    } catch (error) {
      log.error("REST getRecipeEngagement failed", error);
      return { recipe_id: recipeId, bookmark_users: [], rating_users: [] };
    }
  } else {
    try {
      const [bookmarksSnap, ratingsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "bookmarks"),
            where("recipe_id", "==", recipeId),
            orderBy("created_at", "desc"),
          ),
        ),
        getDocs(
          query(
            collection(db, "feedback"),
            where("recipe_id", "==", recipeId),
            orderBy("created_at", "desc"),
          ),
        ),
      ]);

      bookmarks = bookmarksSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Bookmark[];

      ratings = ratingsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Feedback[];
    } catch (error) {
      markSdkBlocked(error);
      try {
        const allBookmarks = await RestApi.getCollection("bookmarks", "created_at");
        const allRatings = await RestApi.getCollection("feedback", "created_at");
        bookmarks = (allBookmarks as Bookmark[]).filter((b) => b.recipe_id === recipeId);
        ratings = (allRatings as Feedback[]).filter((f) => f.recipe_id === recipeId);
      } catch (restError) {
        log.error("Both SDK and REST getRecipeEngagement failed", restError);
        return { recipe_id: recipeId, bookmark_users: [], rating_users: [] };
      }
    }
  }

  const uniqueUserIds = Array.from(
    new Set([...bookmarks.map((b) => b.user_id), ...ratings.map((f) => f.user_id)]),
  );

  const profileEntries = await Promise.all(
    uniqueUserIds.map(async (uid) => {
      const profile = await getProfile(uid).catch(() => null);
      return [uid, profile] as const;
    }),
  );

  const profileMap = new Map<string, Profile | null>(profileEntries);

  const bookmark_users: RecipeBookmarkUser[] = bookmarks.map((b) => {
    const profile = profileMap.get(b.user_id);
    return {
      user_id: b.user_id,
      username: profile?.username || profile?.email?.split("@")[0] || "Unknown",
      email: profile?.email || "Unknown",
      created_at: b.created_at,
    };
  });

  const rating_users: RecipeRatingUser[] = ratings.map((f) => {
    const profile = profileMap.get(f.user_id);
    return {
      user_id: f.user_id,
      username: profile?.username || profile?.email?.split("@")[0] || "Unknown",
      email: profile?.email || "Unknown",
      rating: f.rating,
      comment: f.comment,
      created_at: f.created_at,
    };
  });

  return {
    recipe_id: recipeId,
    bookmark_users,
    rating_users,
  };
}

// ==================== USER PROFILE SELF-EDIT ====================

export async function updateMyProfile(data: { username?: string }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return updateProfile(user.uid, data);
}

export async function deleteMyAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const uid = user.uid;

  // Step 1: Delete user's feedback/reviews
  try {
    if (useRestApi) {
      const userFeedback = await RestApi.queryCollection(
        "feedback",
        "user_id",
        "==",
        uid,
      );
      await Promise.all(userFeedback.map((f: any) => deleteFeedback(f.id)));
    } else {
      try {
        const q = query(
          collection(db, "feedback"),
          where("user_id", "==", uid),
        );
        const snapshot = await getDocs(q);
        await Promise.all(snapshot.docs.map((d) => deleteFeedback(d.id)));
      } catch (sdkErr) {
        // SDK failed, try REST fallback
        markSdkBlocked(sdkErr);
        const userFeedback = await RestApi.queryCollection(
          "feedback",
          "user_id",
          "==",
          uid,
        );
        await Promise.all(userFeedback.map((f: any) => deleteFeedback(f.id)));
      }
    }
  } catch (e) {
    log.warn("Could not delete user feedback", e);
  }

  // Step 2: Delete user's bookmarks
  try {
    const bookmarks = await getBookmarks(uid);
    await Promise.all(bookmarks.map((b) => removeBookmark(uid, b.recipe_id)));
  } catch (e) {
    log.warn("Could not delete user bookmarks", e);
  }

  // Step 3: Delete user profile from Firestore
  try {
    await deleteUser(uid);
  } catch (e) {
    log.warn("Could not delete user profile", e);
  }

  // Step 4: Delete the Firebase Auth account (must be last — this invalidates the session)
  await user.delete();
}

// ==================== RECIPE SUBMISSIONS ====================

export interface RecipeSubmission {
  id: string;
  user_id: string;
  username: string;
  title: string;
  category: string;
  region: string;
  ingredients: string;
  instructions: string;
  nutrition: string;
  health_notes: string;
  history: string;
  fun_fact: string;
  image_url: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string;
  created_at: Timestamp | { seconds: number };
  reviewed_at?: Timestamp | { seconds: number };
}

export async function submitRecipe(
  data: Omit<RecipeSubmission, "id" | "status" | "created_at">,
) {
  const submissionData = { ...data, status: "pending", created_at: new Date() };

  if (useRestApi) {
    const docId = await RestApi.createDocument(
      "recipe_submissions",
      submissionData,
    );
    return { id: docId };
  }

  try {
    return addDoc(collection(db, "recipe_submissions"), {
      ...submissionData,
      created_at: createTimestamp(),
    });
  } catch (error) {
    markSdkBlocked(error);
    const docId = await RestApi.createDocument(
      "recipe_submissions",
      submissionData,
    );
    return { id: docId };
  }
}

export async function getSubmissions(
  status?: "pending" | "approved" | "rejected",
): Promise<RecipeSubmission[]> {
  let submissions: RecipeSubmission[] = [];

  if (useRestApi) {
    try {
      if (status) {
        const data = await RestApi.queryCollection(
          "recipe_submissions",
          "status",
          "==",
          status,
        );
        submissions = data as RecipeSubmission[];
      } else {
        const data = await RestApi.getCollection(
          "recipe_submissions",
          "created_at",
        );
        submissions = data as RecipeSubmission[];
      }
    } catch (error) {
      log.error("REST getSubmissions failed", error);
    }
  } else {
    try {
      const constraints = status
        ? [where("status", "==", status), orderBy("created_at", "desc")]
        : [orderBy("created_at", "desc")];
      const q = query(collection(db, "recipe_submissions"), ...constraints);
      const snapshot = await getDocs(q);
      submissions = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as RecipeSubmission[];
    } catch (error) {
      markSdkBlocked(error);
      try {
        if (status) {
          const data = await RestApi.queryCollection(
            "recipe_submissions",
            "status",
            "==",
            status,
          );
          submissions = data as RecipeSubmission[];
        } else {
          const data = await RestApi.getCollection(
            "recipe_submissions",
            "created_at",
          );
          submissions = data as RecipeSubmission[];
        }
      } catch (restError) {
        log.error("Both SDK and REST failed", restError);
      }
    }
  }

  return submissions;
}

export async function getUserSubmissions(
  userId: string,
): Promise<RecipeSubmission[]> {
  if (useRestApi) {
    try {
      const data = await RestApi.queryCollection(
        "recipe_submissions",
        "user_id",
        "==",
        userId,
      );
      return data as RecipeSubmission[];
    } catch (error) {
      log.error("REST getUserSubmissions failed", error);
      return [];
    }
  }

  try {
    const q = query(
      collection(db, "recipe_submissions"),
      where("user_id", "==", userId),
      orderBy("created_at", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as RecipeSubmission[];
  } catch (error) {
    markSdkBlocked(error);
    try {
      const data = await RestApi.queryCollection(
        "recipe_submissions",
        "user_id",
        "==",
        userId,
      );
      return data as RecipeSubmission[];
    } catch (restError) {
      log.error("Both SDK and REST failed", restError);
      return [];
    }
  }
}

export async function approveSubmission(submissionId: string): Promise<string> {
  // Load the submission
  let submission: RecipeSubmission | null = null;

  if (useRestApi) {
    submission = (await RestApi.getDocument(
      "recipe_submissions",
      submissionId,
    )) as RecipeSubmission | null;
  } else {
    try {
      const snap = await getDoc(
        doc(db, "recipe_submissions", submissionId),
      );
      if (snap.exists()) submission = { id: snap.id, ...snap.data() } as RecipeSubmission;
    } catch (error) {
      markSdkBlocked(error);
      submission = (await RestApi.getDocument(
        "recipe_submissions",
        submissionId,
      )) as RecipeSubmission | null;
    }
  }

  if (!submission) throw new Error("Submission not found");

  // Create the recipe from submission data
  const { id: _id, status: _s, rejection_reason: _r, reviewed_at: _rv, ...recipeFields } = submission;
  const newRecipe = await addRecipe(recipeFields);

  // Mark submission approved
  const reviewUpdate = { status: "approved", reviewed_at: new Date() };
  if (useRestApi) {
    await RestApi.updateDocument("recipe_submissions", submissionId, reviewUpdate);
  } else {
    try {
      await updateDoc(doc(db, "recipe_submissions", submissionId), reviewUpdate);
    } catch (error) {
      markSdkBlocked(error);
      await RestApi.updateDocument("recipe_submissions", submissionId, reviewUpdate);
    }
  }

  return (newRecipe as any).id;
}

export async function rejectSubmission(
  submissionId: string,
  reason?: string,
): Promise<void> {
  const update = {
    status: "rejected",
    rejection_reason: reason || "",
    reviewed_at: new Date(),
  };

  if (useRestApi) {
    await RestApi.updateDocument("recipe_submissions", submissionId, update);
    return;
  }

  try {
    await updateDoc(doc(db, "recipe_submissions", submissionId), update);
  } catch (error) {
    markSdkBlocked(error);
    await RestApi.updateDocument("recipe_submissions", submissionId, update);
  }
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  if (useRestApi) {
    await RestApi.deleteDocument("recipe_submissions", submissionId);
    return;
  }

  try {
    await deleteDoc(doc(db, "recipe_submissions", submissionId));
  } catch (error) {
    markSdkBlocked(error);
    await RestApi.deleteDocument("recipe_submissions", submissionId);
  }
}

// ==================== MEAL PLANS ====================

export interface MealPlan {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  recipe_id: string;
  recipe_title: string;
  recipe_image: string;
  created_at: Timestamp | { seconds: number };
}

export async function getMealPlans(
  userId: string,
  dateStart: string,
  dateEnd: string,
): Promise<MealPlan[]> {
  let plans: MealPlan[] = [];

  if (useRestApi) {
    try {
      const data = await RestApi.queryCollection("meal_plans", "user_id", "==", userId);
      plans = data as MealPlan[];
    } catch (error) {
      log.error("REST getMealPlans failed", error);
    }
  } else {
    try {
      const q = query(
        collection(db, "meal_plans"),
        where("user_id", "==", userId),
        orderBy("date"),
      );
      const snapshot = await getDocs(q);
      plans = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MealPlan[];
    } catch (error) {
      markSdkBlocked(error);
      try {
        const data = await RestApi.queryCollection("meal_plans", "user_id", "==", userId);
        plans = data as MealPlan[];
      } catch (restError) {
        log.error("Both SDK and REST getMealPlans failed", restError);
      }
    }
  }

  return plans.filter((p) => p.date >= dateStart && p.date <= dateEnd);
}

export async function addMealPlan(
  userId: string,
  data: Omit<MealPlan, "id" | "user_id" | "created_at">,
): Promise<{ id: string }> {
  const planData = { ...data, user_id: userId, created_at: new Date() };

  if (useRestApi) {
    const docId = await RestApi.createDocument("meal_plans", planData);
    return { id: docId };
  }

  try {
    const result = await addDoc(collection(db, "meal_plans"), {
      ...planData,
      created_at: createTimestamp(),
    });
    return { id: result.id };
  } catch (error) {
    markSdkBlocked(error);
    const docId = await RestApi.createDocument("meal_plans", planData);
    return { id: docId };
  }
}

export async function removeMealPlan(planId: string): Promise<void> {
  if (useRestApi) {
    return RestApi.deleteDocument("meal_plans", planId);
  }
  try {
    await deleteDoc(doc(db, "meal_plans", planId));
  } catch (error) {
    markSdkBlocked(error);
    return RestApi.deleteDocument("meal_plans", planId);
  }
}

// ==================== RECIPE COLLECTIONS ====================

export interface RecipeCollection {
  id: string;
  user_id: string;
  name: string;
  description: string;
  recipe_ids: string[];
  created_at: Timestamp | { seconds: number };
  updated_at: Timestamp | { seconds: number };
}

export async function getCollections(userId: string): Promise<RecipeCollection[]> {
  if (useRestApi) {
    try {
      await ensureRestAuthToken();
      const data = await RestApi.queryCollection("collections", "user_id", "==", userId);
      return data as RecipeCollection[];
    } catch (error) {
      log.error("REST getCollections failed", error);
      return [];
    }
  }

  try {
    const q = query(
      collection(db, "collections"),
      where("user_id", "==", userId),
      orderBy("created_at", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as RecipeCollection[];
  } catch (error) {
    markSdkBlocked(error);
    try {
      await ensureRestAuthToken();
      const data = await RestApi.queryCollection("collections", "user_id", "==", userId);
      return data as RecipeCollection[];
    } catch (restError) {
      log.error("Both SDK and REST getCollections failed", restError);
      return [];
    }
  }
}

export async function createCollection(
  userId: string,
  name: string,
  description?: string,
): Promise<{ id: string }> {
  const collData = {
    user_id: userId,
    name,
    description: description || "",
    recipe_ids: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  if (useRestApi) {
    await ensureRestAuthToken();
    const docId = await RestApi.createDocument("collections", collData);
    return { id: docId };
  }

  try {
    const result = await addDoc(collection(db, "collections"), {
      ...collData,
      created_at: createTimestamp(),
      updated_at: createTimestamp(),
    });
    return { id: result.id };
  } catch (error) {
    markSdkBlocked(error);
    await ensureRestAuthToken();
    const docId = await RestApi.createDocument("collections", collData);
    return { id: docId };
  }
}

export async function deleteCollection(collectionId: string): Promise<void> {
  if (useRestApi) {
    await ensureRestAuthToken();
    return RestApi.deleteDocument("collections", collectionId);
  }
  try {
    await deleteDoc(doc(db, "collections", collectionId));
  } catch (error) {
    markSdkBlocked(error);
    await ensureRestAuthToken();
    return RestApi.deleteDocument("collections", collectionId);
  }
}

export async function addRecipeToCollection(
  collectionId: string,
  recipeId: string,
): Promise<void> {
  if (useRestApi) {
    try {
      await ensureRestAuthToken();
      const data = (await RestApi.getDocument("collections", collectionId)) as RecipeCollection | null;
      const current = data?.recipe_ids || [];
      if (current.includes(recipeId)) return;
      await RestApi.updateDocument("collections", collectionId, {
        recipe_ids: [...current, recipeId],
        updated_at: new Date(),
      });
    } catch (error) {
      log.error("REST addRecipeToCollection failed", error);
    }
    return;
  }

  try {
    await updateDoc(doc(db, "collections", collectionId), {
      recipe_ids: arrayUnion(recipeId),
      updated_at: createTimestamp(),
    });
  } catch (error) {
    markSdkBlocked(error);
    try {
      await ensureRestAuthToken();
      const data = (await RestApi.getDocument("collections", collectionId)) as RecipeCollection | null;
      const current = data?.recipe_ids || [];
      if (!current.includes(recipeId)) {
        await RestApi.updateDocument("collections", collectionId, {
          recipe_ids: [...current, recipeId],
          updated_at: new Date(),
        });
      }
    } catch (restError) {
      log.error("Both SDK and REST addRecipeToCollection failed", restError);
    }
  }
}

export async function removeRecipeFromCollection(
  collectionId: string,
  recipeId: string,
): Promise<void> {
  if (useRestApi) {
    try {
      await ensureRestAuthToken();
      const data = (await RestApi.getDocument("collections", collectionId)) as RecipeCollection | null;
      const current = data?.recipe_ids || [];
      await RestApi.updateDocument("collections", collectionId, {
        recipe_ids: current.filter((id) => id !== recipeId),
        updated_at: new Date(),
      });
    } catch (error) {
      log.error("REST removeRecipeFromCollection failed", error);
    }
    return;
  }

  try {
    await updateDoc(doc(db, "collections", collectionId), {
      recipe_ids: arrayRemove(recipeId),
      updated_at: createTimestamp(),
    });
  } catch (error) {
    markSdkBlocked(error);
    try {
      await ensureRestAuthToken();
      const data = (await RestApi.getDocument("collections", collectionId)) as RecipeCollection | null;
      const current = data?.recipe_ids || [];
      await RestApi.updateDocument("collections", collectionId, {
        recipe_ids: current.filter((id) => id !== recipeId),
        updated_at: new Date(),
      });
    } catch (restError) {
      log.error("Both SDK and REST removeRecipeFromCollection failed", restError);
    }
  }
}

// Export instances
export { auth, db, facebookProvider, googleProvider };

