/**
 * Tests for lib/firebase.ts (REST API path)
 *
 * Key pattern: jest.mock() factories must be self-contained (no outer-scope vars).
 * Babel hoists jest.mock() to the top of the file, before const/let assignments run,
 * so any outer-scope variable referenced in a factory is in TDZ => undefined.
 * Solution: define jest.fn() inline in the factory, then import the module to get refs.
 */

jest.mock("../../lib/firestore-rest", () => ({
  getCollection: jest.fn(),
  getDocument: jest.fn(),
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  queryCollection: jest.fn(),
  setDocument: jest.fn(),
  setAuthToken: jest.fn(),
  testRestConnectivity: jest.fn().mockResolvedValue(true),
  shouldUseRestApi: jest.fn().mockReturnValue(true),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "web", select: (obj: any) => obj.web ?? obj.default },
}));

jest.mock("../../lib/logger", () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import * as RestApi from "../../lib/firestore-rest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addBookmark,
  addMealPlan,
  addRecipe,
  addRecipeToCollection,
  createCollection,
  deleteCollection,
  getBookmarks,
  getCollections,
  getMealPlans,
  getProfile,
  getRecipe,
  getRecipes,
  isBookmarked,
  removeMealPlan,
  removeRecipeFromCollection,
  updateProfile,
} from "../../lib/firebase";

// Typed shorthand references to the mock functions
const mockGetCollection = RestApi.getCollection as jest.Mock;
const mockGetDocument = RestApi.getDocument as jest.Mock;
const mockCreateDocument = RestApi.createDocument as jest.Mock;
const mockUpdateDocument = RestApi.updateDocument as jest.Mock;
const mockDeleteDocument = RestApi.deleteDocument as jest.Mock;
const mockQueryCollection = RestApi.queryCollection as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
});

// ────────────────────────────────────────────────────────────
// PROFILES
// ────────────────────────────────────────────────────────────

describe("getProfile", () => {
  it("calls RestApi.getDocument('profiles', userId)", async () => {
    const mockProfile = {
      id: "u1",
      email: "user@test.com",
      username: "testuser",
      is_admin: false,
    };
    mockGetDocument.mockResolvedValueOnce(mockProfile);

    const result = await getProfile("u1");
    expect(mockGetDocument).toHaveBeenCalledWith("profiles", "u1");
    expect(result).toEqual(mockProfile);
  });

  it("returns null when document does not exist", async () => {
    mockGetDocument.mockResolvedValueOnce(null);
    const result = await getProfile("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null and logs error when RestApi throws", async () => {
    mockGetDocument.mockRejectedValueOnce(new Error("Network error"));
    const result = await getProfile("u1");
    expect(result).toBeNull();
  });
});

describe("updateProfile", () => {
  it("calls RestApi.updateDocument with partial data", async () => {
    mockUpdateDocument.mockResolvedValueOnce(undefined);
    await updateProfile("u1", { username: "newname" });
    expect(mockUpdateDocument).toHaveBeenCalledWith(
      "profiles",
      "u1",
      { username: "newname" },
    );
  });
});

// ────────────────────────────────────────────────────────────
// RECIPES
// ────────────────────────────────────────────────────────────

describe("getRecipes", () => {
  it("calls RestApi.getCollection('recipes', 'created_at')", async () => {
    mockGetCollection.mockResolvedValueOnce([]);
    await getRecipes();
    expect(mockGetCollection).toHaveBeenCalledWith("recipes", "created_at");
  });

  it("returns all recipes from RestApi when no filters", async () => {
    const mockData = [
      {
        id: "r1",
        title: "Adobo",
        category: "Pork",
        region: "Luzon",
        ingredients: "Pork, Vinegar",
        instructions: "",
        nutrition: "",
        health_notes: "",
        history: "",
        fun_fact: "",
        image_url: "",
        user_id: "u1",
      },
      {
        id: "r2",
        title: "Sinigang",
        category: "Pork",
        region: "Luzon",
        ingredients: "Pork, Tamarind",
        instructions: "",
        nutrition: "",
        health_notes: "",
        history: "",
        fun_fact: "",
        image_url: "",
        user_id: "u1",
      },
    ];
    mockGetCollection.mockResolvedValueOnce(mockData);

    const recipes = await getRecipes();
    expect(recipes).toHaveLength(2);
  });

  it("filters recipes by category client-side", async () => {
    mockGetCollection.mockResolvedValueOnce([
      { id: "r1", title: "Adobo", category: "Pork", region: "Luzon", ingredients: "" },
      { id: "r2", title: "Kare-Kare", category: "Beef", region: "Luzon", ingredients: "" },
    ]);

    const recipes = await getRecipes({ category: "Pork" });
    expect(recipes).toHaveLength(1);
    expect(recipes[0].id).toBe("r1");
  });

  it("filters recipes by search term in title or ingredients", async () => {
    mockGetCollection.mockResolvedValueOnce([
      { id: "r1", title: "Chicken Adobo", category: "", region: "", ingredients: "Chicken, Vinegar" },
      { id: "r2", title: "Sinigang", category: "", region: "", ingredients: "Pork, Radish" },
    ]);

    const results = await getRecipes({ search: "chicken" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Chicken Adobo");
  });

  it("loads from AsyncStorage cache when RestApi fails", async () => {
    mockGetCollection.mockRejectedValueOnce(new Error("blocked"));
    const cachedRecipes = [{ id: "cached1", title: "Cached Adobo" }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(cachedRecipes),
    );

    const recipes = await getRecipes();
    expect(recipes).toHaveLength(1);
    expect(recipes[0].id).toBe("cached1");
  });

  it("caches results in AsyncStorage when fetch succeeds", async () => {
    mockGetCollection.mockResolvedValueOnce([{ id: "r1", title: "Adobo" }]);
    await getRecipes();
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});

describe("getRecipe", () => {
  it("calls RestApi.getDocument('recipes', recipeId)", async () => {
    mockGetDocument.mockResolvedValueOnce({ id: "r1", title: "Adobo" });
    const result = await getRecipe("r1");
    expect(mockGetDocument).toHaveBeenCalledWith("recipes", "r1");
    expect(result?.id).toBe("r1");
  });

  it("returns null when recipe not found", async () => {
    mockGetDocument.mockResolvedValueOnce(null);
    const result = await getRecipe("missing");
    expect(result).toBeNull();
  });
});

describe("addRecipe", () => {
  it("calls RestApi.createDocument('recipes', data) and returns {id}", async () => {
    mockCreateDocument.mockResolvedValueOnce("new-recipe-id");
    const result = await addRecipe({ title: "Lechon", category: "Pork" });
    expect(mockCreateDocument).toHaveBeenCalledWith(
      "recipes",
      expect.objectContaining({ title: "Lechon", category: "Pork" }),
    );
    expect(result).toEqual({ id: "new-recipe-id" });
  });

  it("invalidates recipe cache after adding", async () => {
    mockCreateDocument.mockResolvedValueOnce("rid");
    await addRecipe({ title: "Test" });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      "@lasangpinoy_recipes_cache",
    );
  });
});

// ────────────────────────────────────────────────────────────
// BOOKMARKS
// ────────────────────────────────────────────────────────────

describe("isBookmarked", () => {
  it("returns true when user has bookmarked the recipe", async () => {
    mockQueryCollection.mockResolvedValueOnce([
      { id: "b1", user_id: "u1", recipe_id: "r1" },
    ]);
    const result = await isBookmarked("u1", "r1");
    expect(result).toBe(true);
  });

  it("returns false when recipe not in bookmarks", async () => {
    mockQueryCollection.mockResolvedValueOnce([
      { id: "b1", user_id: "u1", recipe_id: "r2" },
    ]);
    const result = await isBookmarked("u1", "r1");
    expect(result).toBe(false);
  });

  it("returns false on RestApi error", async () => {
    mockQueryCollection.mockRejectedValueOnce(new Error("error"));
    const result = await isBookmarked("u1", "r1");
    expect(result).toBe(false);
  });
});

describe("addBookmark", () => {
  it("creates a bookmark document when none exists", async () => {
    mockQueryCollection.mockResolvedValueOnce([]);
    mockCreateDocument.mockResolvedValueOnce("b-new");

    const result = await addBookmark("u1", "r1");
    expect(mockCreateDocument).toHaveBeenCalledWith(
      "bookmarks",
      expect.objectContaining({ user_id: "u1", recipe_id: "r1" }),
    );
    expect(result).toEqual({ id: "b-new" });
  });

  it("does nothing when already bookmarked", async () => {
    mockQueryCollection.mockResolvedValueOnce([
      { id: "b1", user_id: "u1", recipe_id: "r1" },
    ]);

    await addBookmark("u1", "r1");
    expect(mockCreateDocument).not.toHaveBeenCalled();
  });
});

describe("getBookmarks", () => {
  it("queries bookmarks collection with user_id filter", async () => {
    mockQueryCollection.mockResolvedValueOnce([
      { id: "b1", user_id: "u1", recipe_id: "r1" },
    ]);
    const result = await getBookmarks("u1");
    expect(mockQueryCollection).toHaveBeenCalledWith(
      "bookmarks",
      "user_id",
      "==",
      "u1",
    );
    expect(result).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────────────
// MEAL PLANS
// ────────────────────────────────────────────────────────────

describe("addMealPlan", () => {
  it("creates a meal plan document and returns {id}", async () => {
    mockCreateDocument.mockResolvedValueOnce("plan-id-1");

    const result = await addMealPlan("u1", {
      date: "2024-12-25",
      meal_type: "lunch",
      recipe_id: "r1",
      recipe_title: "Adobo",
      recipe_image: "",
    });

    expect(mockCreateDocument).toHaveBeenCalledWith(
      "meal_plans",
      expect.objectContaining({
        user_id: "u1",
        date: "2024-12-25",
        meal_type: "lunch",
        recipe_id: "r1",
      }),
    );
    expect(result).toEqual({ id: "plan-id-1" });
  });
});

describe("getMealPlans", () => {
  it("queries meal_plans by user_id and filters by date range", async () => {
    mockQueryCollection.mockResolvedValueOnce([
      { id: "p1", user_id: "u1", date: "2024-12-20", meal_type: "lunch" },
      { id: "p2", user_id: "u1", date: "2024-12-25", meal_type: "dinner" },
      { id: "p3", user_id: "u1", date: "2024-12-31", meal_type: "breakfast" },
    ]);

    const result = await getMealPlans("u1", "2024-12-22", "2024-12-29");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });
});

describe("removeMealPlan", () => {
  it("calls RestApi.deleteDocument('meal_plans', planId)", async () => {
    mockDeleteDocument.mockResolvedValueOnce(undefined);
    await removeMealPlan("plan-id-1");
    expect(mockDeleteDocument).toHaveBeenCalledWith("meal_plans", "plan-id-1");
  });
});

// ────────────────────────────────────────────────────────────
// RECIPE COLLECTIONS
// ────────────────────────────────────────────────────────────

describe("createCollection", () => {
  it("creates a collection document with empty recipe_ids", async () => {
    mockCreateDocument.mockResolvedValueOnce("coll-id-1");

    const result = await createCollection("u1", "Favorites", "My faves");
    expect(mockCreateDocument).toHaveBeenCalledWith(
      "collections",
      expect.objectContaining({
        user_id: "u1",
        name: "Favorites",
        description: "My faves",
        recipe_ids: [],
      }),
    );
    expect(result).toEqual({ id: "coll-id-1" });
  });

  it("defaults description to empty string when not provided", async () => {
    mockCreateDocument.mockResolvedValueOnce("coll-id-2");

    await createCollection("u1", "No Description");
    const callArg = mockCreateDocument.mock.calls[0][1];
    expect(callArg.description).toBe("");
  });
});

describe("getCollections", () => {
  it("queries collections collection with user_id filter", async () => {
    mockQueryCollection.mockResolvedValueOnce([
      { id: "c1", user_id: "u1", name: "Favorites", recipe_ids: [] },
    ]);

    const result = await getCollections("u1");
    expect(mockQueryCollection).toHaveBeenCalledWith(
      "collections",
      "user_id",
      "==",
      "u1",
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Favorites");
  });

  it("returns [] on RestApi error", async () => {
    mockQueryCollection.mockRejectedValueOnce(new Error("error"));
    const result = await getCollections("u1");
    expect(result).toEqual([]);
  });
});

describe("deleteCollection", () => {
  it("calls RestApi.deleteDocument('collections', id)", async () => {
    mockDeleteDocument.mockResolvedValueOnce(undefined);
    await deleteCollection("coll-id-1");
    expect(mockDeleteDocument).toHaveBeenCalledWith("collections", "coll-id-1");
  });
});

describe("addRecipeToCollection", () => {
  it("reads current recipe_ids and appends new recipeId", async () => {
    mockGetDocument.mockResolvedValueOnce({ id: "c1", recipe_ids: ["r1", "r2"] });
    mockUpdateDocument.mockResolvedValueOnce(undefined);

    await addRecipeToCollection("c1", "r3");

    expect(mockUpdateDocument).toHaveBeenCalledWith(
      "collections",
      "c1",
      expect.objectContaining({ recipe_ids: ["r1", "r2", "r3"] }),
    );
  });

  it("does not duplicate an existing recipeId", async () => {
    mockGetDocument.mockResolvedValueOnce({ id: "c1", recipe_ids: ["r1"] });

    await addRecipeToCollection("c1", "r1");
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });
});

describe("removeRecipeFromCollection", () => {
  it("reads current recipe_ids and removes the specified recipeId", async () => {
    mockGetDocument.mockResolvedValueOnce({
      id: "c1",
      recipe_ids: ["r1", "r2", "r3"],
    });
    mockUpdateDocument.mockResolvedValueOnce(undefined);

    await removeRecipeFromCollection("c1", "r2");

    expect(mockUpdateDocument).toHaveBeenCalledWith(
      "collections",
      "c1",
      expect.objectContaining({ recipe_ids: ["r1", "r3"] }),
    );
  });
});
