// Order-related constants for FoodFix Food Ordering System

export const ORDER_STATUSES = [
  "pending", "accepted", "preparing", "out_for_delivery",
  "delivered", "unable_to_fulfill", "cancelled", "issue_encountered",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  accepted: "Processing",
  preparing: "Preparing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  unable_to_fulfill: "Unable to Fulfill",
  cancelled: "Cancelled",
  issue_encountered: "Issue Encountered",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "#F39C12",
  accepted: "#3498DB",
  preparing: "#9B59B6",
  out_for_delivery: "#E67E22",
  delivered: "#27AE60",
  unable_to_fulfill: "#E74C3C",
  cancelled: "#95A5A6",
  issue_encountered: "#E67E22",
};

export const ORDER_TYPES = [
  "delivery_now",
  "delivery_later",
  "dine_in",
  "pick_up",
] as const;

export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  delivery_now: "Order Now (Delivery)",
  delivery_later: "Order for Later (Delivery)",
  dine_in: "Dine In",
  pick_up: "Pick Up",
};

export const PAYMENT_METHODS = ["cod", "gcash"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  gcash: "GCash",
};

export const USER_ROLES = ["admin", "staff", "customer"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Owner / Admin",
  staff: "Staff",
  customer: "Customer",
};

export const LOW_STOCK_THRESHOLD = 10;

export const MENU_CATEGORIES = [
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
  "Made to Order",
] as const;

export type MenuCategory = (typeof MENU_CATEGORIES)[number];

export const MENU_CATEGORY_COLORS: Record<string, string> = {
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
  "Made to Order": "#8B4513",
};
