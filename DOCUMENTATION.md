# FOODFIX — Source Code Documentation

**Version:** 2.7.0  
**Last Updated:** April 2026  
**Platform:** React Native (Expo) — Android  
**Repository:** https://github.com/burikethhh/PUPLasangpinoy

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Authentication Flow](#4-authentication-flow)
5. [Data Models](#5-data-models)
6. [Firestore Collections](#6-firestore-collections)
7. [Screen Reference](#7-screen-reference)
8. [Firebase Integration](#8-firebase-integration)
9. [AI Integration](#9-ai-integration)
10. [State Management Patterns](#10-state-management-patterns)
11. [Environment Variables](#11-environment-variables)
12. [Build & Release Process](#12-build--release-process)
13. [Key Logic Flows](#13-key-logic-flows)
14. [Constants & Configuration](#14-constants--configuration)

---

# 1. PROJECT OVERVIEW

**FOODFIX** is a Filipino food ordering mobile application built for a PUP (Polytechnic University of the Philippines) academic project. It allows customers to browse a menu, add items to a cart, place orders (delivery, dine-in, or pick-up), and track order progress in real-time. Staff can manage incoming orders, and an admin/owner dashboard provides full control over the menu, users, orders, and app settings.

## Key Capabilities

- **Customer**: Browse menu, search, add to cart, checkout with date/time/location picker, GCash or COD payment, track orders, live chat with store, AI food scanner, suggest dishes
- **Staff**: View orders, mark as prepared, archive completed orders
- **Admin/Owner**: Full order management (accept/reject/advance status), menu CRUD, user management, staff creation, app settings (delivery fee, GCash toggle), view suggestions, live chat with customers

---

# 2. TECHNOLOGY STACK

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile framework |
| Expo | SDK 54 | Development platform & build tooling |
| Expo Router | 6.x | File-based navigation (tabs, stacks) |
| TypeScript | 5.9.x | Type safety |
| React | 19.1.0 | UI rendering |

## Backend & Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Authentication | Firebase Auth | Email/password + Google + Facebook sign-in |
| Database | Cloud Firestore | NoSQL document storage for all data |
| Image Upload | Cloudinary | Menu item images |
| AI Vision | Alibaba Qwen VL Max | Food image recognition (dish/ingredient scan) |
| Local Storage | AsyncStorage | Cart persistence, caching |

## Key Dependencies

- `@react-native-async-storage/async-storage` — Cart data persistence
- `@react-native-community/datetimepicker` — Schedule pickup/delivery time
- `expo-image-picker` — Camera for AI food scan
- `expo-location` — Delivery location picker
- `expo-notifications` — Push notifications
- `firebase` (v12) — Auth, Firestore, Storage
- `react-native-safe-area-context` — Safe area insets

---

# 3. PROJECT STRUCTURE

```
FOODFIX/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Authentication screens
│   │   ├── _layout.tsx           # Auth stack layout
│   │   ├── welcome.tsx           # Unified login (email+password+social)
│   │   ├── login.tsx             # Customer-specific login (legacy, still used for deep links)
│   │   └── signup.tsx            # Customer registration
│   │
│   ├── (tabs)/                   # Customer tab navigator
│   │   ├── _layout.tsx           # Tab bar config + cart badge
│   │   ├── index.tsx             # Menu browsing (categories, search, favorites)
│   │   ├── scan.tsx              # Cart + Checkout (time picker, map, payment)
│   │   ├── collections.tsx       # Order history + archive
│   │   ├── chat.tsx              # Live chat with store
│   │   ├── submit.tsx            # Favorites screen
│   │   └── profile.tsx           # Profile, AI scanner, suggestions, logout
│   │
│   ├── (admin)/                  # Admin tab navigator
│   │   ├── _layout.tsx           # Admin tabs + auth guard
│   │   ├── index.tsx             # Admin dashboard (stats, quick actions)
│   │   ├── recipes.tsx           # Order management (status workflow)
│   │   ├── categories.tsx        # Menu CRUD (add/edit/delete items)
│   │   ├── feedback.tsx          # Live chat with customers
│   │   ├── submissions.tsx       # Review customer dish suggestions
│   │   └── users.tsx             # Staff/user management, settings
│   │
│   ├── (staff)/                  # Staff tab navigator
│   │   ├── _layout.tsx           # Staff tabs + auth guard
│   │   ├── index.tsx             # Staff order view + mark prepared
│   │   └── profile.tsx           # Staff profile + logout
│   │
│   ├── _layout.tsx               # Root layout (auth state listener)
│   ├── index.tsx                 # Entry redirect
│   └── policies.tsx              # Privacy policy / Terms
│
├── lib/                          # Business logic & API layer
│   ├── firebase.ts               # Firebase init, auth functions, profile CRUD
│   ├── firebase-store.ts         # Firestore CRUD: orders, messages, reviews, etc.
│   ├── firestore-rest.ts         # REST API fallback for Firestore operations
│   ├── firebase-helpers.ts       # Utility helpers for Firebase
│   ├── cloudinary.ts             # Image upload to Cloudinary
│   ├── qwen-ai.ts                # AI food/ingredient analysis
│   ├── notifications.ts          # Push notification helpers
│   └── logger.ts                 # Debug logging utility
│
├── constants/                    # App-wide constants
│   ├── order.ts                  # Order statuses, types, payment methods, categories
│   ├── theme.ts                  # Color palette, typography
│   └── food-categories.ts        # Food category definitions
│
├── components/                   # Reusable UI components
│   ├── ui/                       # Base UI primitives
│   └── ...                       # Themed text, views, etc.
│
├── app.json                      # Expo config (name, icons, version, plugins)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── firestore.rules               # Firestore security rules
└── .env                          # Environment variables (not committed)
```

---

# 4. AUTHENTICATION FLOW

## Unified Login (v2.7.0+)

The welcome screen (`app/(auth)/welcome.tsx`) provides a single unified login form for all roles:

1. User enters **email + password** → Firebase Auth `signInWithEmailAndPassword`
2. On success, fetch profile from Firestore (`users/{uid}`)
3. **Auto-route by role**:
   - `profile.is_admin === true` → redirect to `/(admin)`
   - `profile.role === "staff"` → redirect to `/(staff)`
   - else → redirect to `/(tabs)` (customer)
4. Social login (Google, Facebook) follows the same auto-routing logic

## Role Hierarchy

| Role | Created By | Capabilities |
|------|-----------|-------------|
| **Admin** | Manual (Firestore) | Full access: orders, menu, users, settings, chat |
| **Staff** | Admin (via Users screen) | View orders, mark prepared, archive |
| **Customer** | Self-registration | Browse, order, track, chat, scan, suggest |

## Auth State Listener

`app/_layout.tsx` listens to `onAuthStateChanged`. When a user is detected, it fetches the profile and routes accordingly. On sign-out, it redirects to `/(auth)/welcome`.

## Signup

`signup.tsx` creates a Firebase Auth account, then creates a Firestore profile document with `role: "customer"`, `is_admin: false`.

---

# 5. DATA MODELS

All TypeScript interfaces are defined in `lib/firebase-store.ts` and `lib/firebase.ts`.

## Profile (`lib/firebase.ts`)

```typescript
interface Profile {
  id: string;           // Firebase Auth UID
  email: string;
  username: string;
  is_admin: boolean;
  role: 'admin' | 'staff' | 'customer';
  phone?: string;
  address?: string;
  created_at: Timestamp;
}
```

## MenuItem (`lib/firebase-store.ts`)

```typescript
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  available: boolean;
  created_at: Timestamp;
}
```

## Order

```typescript
interface Order {
  id: string;
  order_number: string;       // e.g. "LP-20260426-1234"
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;        // pending → accepted → preparing → out_for_delivery → delivered
  order_type: OrderType;      // delivery_now | delivery_later | dine_in | pick_up
  payment_method: PaymentMethod; // cod | gcash
  scheduled_date?: string;
  scheduled_time?: string;
  reject_reason?: string;
  prepared_by?: string;
  created_at: Timestamp;
  updated_at?: Timestamp;
}
```

## OrderItem

```typescript
interface OrderItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}
```

## Message

```typescript
interface Message {
  id: string;
  conversation_id: string;   // customer's UID
  sender_id: string;
  sender_name: string;
  sender_role: string;        // "customer" | "admin" | "staff"
  content: string;
  read: boolean;
  created_at: Timestamp;
}
```

## Review

```typescript
interface Review {
  id: string;
  user_id: string;
  username: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  rating: number;
  comment: string;
  created_at: Timestamp;
}
```

## AppSettings

```typescript
interface AppSettings {
  delivery_fee: number;
  gcash_enabled: boolean;
  gcash_number?: string;
  store_name: string;
  store_address: string;
  store_phone: string;
}
```

---

# 6. FIRESTORE COLLECTIONS

| Collection | Document ID | Description |
|-----------|-------------|-------------|
| `users` | Firebase Auth UID | User profiles (role, contact info) |
| `menu_items` | Auto-generated | Menu items with name, price, category, image |
| `orders` | Auto-generated | Customer orders with items, status, delivery info |
| `messages` | Auto-generated | Chat messages grouped by `conversation_id` |
| `reviews` | Auto-generated | Menu item reviews and ratings |
| `favorites` | Auto-generated | Customer favorited menu items |
| `suggestions` | Auto-generated | Customer-submitted dish suggestions |
| `settings` | `app_settings` | Singleton: delivery fee, GCash config |

## Order Status Workflow

```
pending → accepted → preparing → out_for_delivery → delivered
   └────────→ rejected (with reason)
   └────────→ cancelled
```

Each transition is triggered by admin via the Orders screen (`recipes.tsx`). Staff can mark orders as `preparing` → `out_for_delivery` (via "Mark as Prepared").

---

# 7. SCREEN REFERENCE

## Customer Screens (`(tabs)/`)

| File | Tab Name | Description |
|------|----------|-------------|
| `index.tsx` | Menu | Category filter, search, add-to-cart, favorites |
| `scan.tsx` | Cart | Cart items, checkout flow (date/time/location/payment), GCash notice |
| `collections.tsx` | Orders | Active/history orders with tracker, archive tab |
| `chat.tsx` | Chat | Real-time messaging with store, long-press delete |
| `submit.tsx` | Favorites | Saved favorite menu items |
| `profile.tsx` | Profile | Edit profile, AI food scanner, suggest dish, logout |

## Admin Screens (`(admin)/`)

| File | Tab Name | Description |
|------|----------|-------------|
| `index.tsx` | Dashboard | Order stats, quick actions |
| `recipes.tsx` | Orders | Full order management with status advancement, reject, archive, tracker |
| `categories.tsx` | Menu | Add/edit/delete menu items with image upload |
| `feedback.tsx` | Messages | Chat with customers, long-press delete messages |
| `submissions.tsx` | Suggestions | Review/approve/reject dish suggestions, archive |
| `users.tsx` | More | Staff/user management (collapsible), settings, role previews |

## Staff Screens (`(staff)/`)

| File | Tab Name | Description |
|------|----------|-------------|
| `index.tsx` | Orders | View orders, mark prepared, address visible, tracker, archive |
| `profile.tsx` | Profile | Basic profile info, logout |

---

# 8. FIREBASE INTEGRATION

## Dual-Mode Architecture

The app uses a **dual-mode** Firestore access pattern defined in `lib/firebase-store.ts`:

1. **SDK Mode** (default): Uses the Firebase JS SDK (`firebase/firestore`) for direct Firestore access
2. **REST API Mode** (fallback): Uses `lib/firestore-rest.ts` to make direct HTTP requests to the Firestore REST API when the SDK is blocked (e.g., certain network environments)

The `firestoreOp` helper function abstracts this:

```typescript
async function firestoreOp<T>(sdkFn: () => Promise<T>, restFn: () => Promise<T>): Promise<T> {
  if (useRestApi) return restFn();
  try { return await sdkFn(); }
  catch (e) {
    handleSdkBlocked(e);     // Switches to REST mode on specific errors
    return restFn();          // Retry with REST
  }
}
```

## Key Functions (`lib/firebase-store.ts`)

| Function | Description |
|----------|-------------|
| `getMenuItems()` | Fetch all menu items |
| `createOrder(data)` | Create new order with auto-generated order number |
| `getOrders(filter?)` | Fetch orders, optionally filtered by status |
| `getOrdersByUser(userId)` | Fetch orders for a specific customer |
| `updateOrderStatus(id, status, data?)` | Advance order status |
| `sendMessage(data)` | Send a chat message |
| `getMessages(conversationId)` | Fetch chat messages for a conversation |
| `deleteMessage(messageId)` | Delete a chat message |
| `getConversations()` | Get all conversation threads (admin) |
| `markMessagesRead(convId, role)` | Mark messages as read |
| `getSettings()` | Fetch app settings |
| `saveSettings(data)` | Save app settings |
| `getAllUsers()` | Fetch all user profiles |
| `createStaffAccount(...)` | Create a staff user via Firebase Auth + Firestore |

## Auth Functions (`lib/firebase.ts`)

| Function | Description |
|----------|-------------|
| `signIn(email, password)` | Email/password authentication |
| `signUp(email, password)` | Create new customer account |
| `logOut()` | Sign out current user |
| `resetPassword(email)` | Send password reset email |
| `getProfile(userId)` | Fetch user profile from Firestore |
| `updateProfile(userId, data)` | Update user profile fields |
| `getCurrentUser()` | Get currently authenticated user |
| `setRestTokenFromUser(user)` | Store auth token for REST API mode |

---

# 9. AI INTEGRATION

File: `lib/qwen-ai.ts`

The app uses the **Alibaba Qwen VL Max** model for food image analysis, accessed via the OpenRouter API.

## `analyzeImageWithQwen(base64Image, type)`

- **type = "dish"**: Identifies the dish name, whether it's Filipino, description, ingredients, and cooking tips
- **type = "ingredient"**: Identifies individual ingredients in the image

The AI scan is accessible from the customer Profile screen. After scanning, a **"Suggest This Dish"** button auto-fills the suggestion form with the detected dish name and description.

## Response Format (dish)

```typescript
{
  type: "dish",
  dishName: "Adobo",
  isFilipino: true,
  description: "...",
  ingredients: ["pork", "soy sauce", ...],
  cookingTips: "...",
  funFact: "..."
}
```

---

# 10. STATE MANAGEMENT PATTERNS

The app uses **React hooks** for all state management — no external state libraries.

## Patterns Used

- **`useState`** — Component-local state for form fields, lists, modals
- **`useEffect`** — Data fetching on mount, timers
- **`useCallback`** — Memoized fetch functions
- **`useFocusEffect`** (Expo Router) — Refresh data when screen comes into focus
- **`AsyncStorage`** — Cart persistence across sessions
  - Key: `@foodfix_cart` (migrated from `@lasangpinoy_cart`)
  - Stores: `JSON.stringify(cartItems[])` with `menu_item_id`, `name`, `price`, `quantity`, `image_url`

## Cart Badge

`(tabs)/_layout.tsx` polls `AsyncStorage` every 3 seconds to update the cart item count badge on the Cart tab icon.

## Data Refresh

Most screens use `useFocusEffect` to reload data from Firestore whenever the screen gains focus. Pull-to-refresh is available on order lists.

---

# 11. ENVIRONMENT VARIABLES

Stored in `.env` (not committed). Required variables:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_DATABASE_ID=...       # Firestore database ID (or "default")
EXPO_PUBLIC_QWEN_API_KEY=...               # Alibaba Qwen API key
EXPO_PUBLIC_OPENROUTER_API_KEY=...         # OpenRouter API key (for AI)
EXPO_PUBLIC_GEMINI_API_KEY=...             # Google Gemini (optional fallback)
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=...      # Cloudinary cloud name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=...   # Cloudinary unsigned upload preset
```

---

# 12. BUILD & RELEASE PROCESS

## Prerequisites

- Node.js 18+
- Java 17 (for Android builds)
- Android SDK
- Expo CLI (`npx expo`)

## Development

```bash
npx expo start          # Start dev server
npx expo start --android   # Start with Android device/emulator
```

## Production Build (APK)

```bash
# 1. Prebuild native code
npx expo prebuild --platform android --clean

# 2. Build release APK
cd android
./gradlew assembleRelease -x lintVitalAnalyzeRelease

# 3. APK location
# android/app/build/outputs/apk/release/app-release.apk
```

## GitHub Release

```bash
gh release create v2.7.0 \
  "android/app/build/outputs/apk/release/app-release.apk#FOODFIX-v2.7.0.apk" \
  --title "FOODFIX v2.7.0" \
  --notes "Changelog..."
```

## Version Bumping

Update all three locations:
1. `app.json` → `expo.version`, `expo.android.versionCode`, `expo.ios.buildNumber`
2. `app/(tabs)/profile.tsx` → version display text

---

# 13. KEY LOGIC FLOWS

## Order Placement (Customer)

1. Customer browses menu (`index.tsx`), adds items to cart → stored in `AsyncStorage`
2. Opens Cart tab (`scan.tsx`), sees cart items with quantities
3. Selects order type: Delivery Now, Delivery Later, Dine-In, Pick-Up
4. For delivery: picks date/time (spinner picker), selects location on map
5. Chooses payment: COD or GCash (shows notice to coordinate via chat)
6. Confirms → `createOrder()` writes to Firestore with status `"pending"`
7. Cart is cleared from AsyncStorage

## Order Workflow (Admin)

1. Admin sees new orders in Orders tab (`recipes.tsx`)
2. Can advance status: `pending` → `accepted` → `preparing` → `out_for_delivery` → `delivered`
3. Can reject with reason at `pending` stage
4. Each status change calls `updateOrderStatus()`
5. Completed orders can be archived (local-only, stored in `Set<string>`)

## Live Chat

1. Customer sends message → stored in `messages` collection with `conversation_id = customer.uid`
2. Admin sees conversation list → clicks to open → marks messages as read
3. Both sides can long-press to delete messages (calls `deleteMessage()`)

## AI Food Scanner

1. Customer taps "AI Scan" on profile → camera opens
2. Photo captured → base64 sent to `analyzeImageWithQwen()`
3. Result displayed in modal with dish name, description, ingredients
4. "Suggest This Dish" button → auto-fills suggestion form → submits to `suggestions` collection

---

# 14. CONSTANTS & CONFIGURATION

## Order Statuses (`constants/order.ts`)

```typescript
const ORDER_STATUSES = ["pending", "accepted", "preparing", "out_for_delivery", "delivered", "rejected", "cancelled"];
```

## Order Types

```typescript
const ORDER_TYPES = ["delivery_now", "delivery_later", "dine_in", "pick_up"];
```

## Payment Methods

```typescript
const PAYMENT_METHODS = ["cod", "gcash"];
```

## Menu Categories

```typescript
const MENU_CATEGORIES = [
  "Main Dish", "Soup", "Noodles", "Dessert", "Appetizer",
  "Breakfast", "Seafood", "Vegetable", "Snacks", "Beverage"
];
```

## Theme Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Orange | `#F25C05` | Buttons, accents, customer theme |
| Dark Brown | `#2E1A06` | Text, admin theme |
| Cream Background | `#F9F0DC` | Screen backgrounds |
| Staff Blue | `#3498DB` | Staff theme, processing status |
| Success Green | `#27AE60` | Delivered, approved |
| Error Red | `#E74C3C` | Rejected, errors |
| Warning Yellow | `#F39C12` | Pending status |

---

*End of Documentation — FOODFIX v2.7.0*
