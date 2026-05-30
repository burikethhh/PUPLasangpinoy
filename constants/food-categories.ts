export const FOOD_CATEGORIES = [
  "Main Dish",
  "Soup",
  "Noodles",
  "Dessert",
  "Appetizer",
  "Breakfast",
  "Seafood",
  "Vegetable",
  "Snacks",
  "Beverage",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_CATEGORY_COLORS: Record<string, string> = {
  "Main Dish": "#F25C05",
  Soup: "#4A8FE7",
  Noodles: "#34B36A",
  Dessert: "#E91E8C",
  Appetizer: "#9B59B6",
  Breakfast: "#F39C12",
  Seafood: "#00A8A8",
  Vegetable: "#2E7D32",
  Snacks: "#FF6F61",
  Beverage: "#3F51B5",
};
