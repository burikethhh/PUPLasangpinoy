# LasangPinoy Mobile - Complete Documentation

**Version:** 1.1.0  
**Last Updated:** April 2026  
**Status:** Active Development — Audit Pass Complete

---

## Quick Status Summary

| Category | Count | Status |
|----------|-------|--------|
| Completed Features | 52+ | ✅ Done |
| Pending Features | 2 | 🔄 Planned |
| Unimplemented Features | 0 | ✅ All Started |
| Items Pending Testing | 45+ | 🧪 Needs Verification |
| Bug Fixes Applied | 22 | ✅ Fixed |
| Known Issues | 2 | ⚠️ Documented |

---

# TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Application Goals](#2-application-goals)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Environment Variables & API Keys](#5-environment-variables--api-keys)
6. [Firebase Configuration](#6-firebase-configuration)
7. [Database Schema](#7-database-schema)
8. [Security Rules](#8-security-rules)
9. [AI Integration](#9-ai-integration)
10. [Features & Screens](#10-features--screens)
11. [Authentication Flow](#11-authentication-flow)
12. [REST API Implementation](#12-rest-api-implementation)
13. [Development Progress](#13-development-progress)
    - [Completed Features](#completed-features-)
    - [Pending Features](#pending-features-)
    - [Unimplemented Features](#unimplemented-features-)
    - [Pending Testing](#pending-testing-)
14. [Bug Fixes & Known Issues](#14-bug-fixes--known-issues)
15. [Future ML Implementation](#15-future-ml-implementation)
16. [Deployment Guide](#16-deployment-guide)
17. [Test Accounts & Credentials](#17-test-accounts--credentials)
18. [Commands Reference](#18-commands-reference)
19. [Troubleshooting](#19-troubleshooting)

---

# 1. PROJECT OVERVIEW

## What is LasangPinoy Mobile?

**LasangPinoy Mobile** is a cross-platform mobile application dedicated to preserving and sharing Filipino culinary heritage. The app serves as a comprehensive digital cookbook featuring traditional Filipino recipes, AI-powered food recognition, and an intelligent chatbot for learning about Filipino cuisine.

## App Identifiers

| Property | Value |
|----------|-------|
| App Name | LasangPinoy Mobile |
| Package Name | lasangpinoymobile |
| Slug | LasangPinoyMobile |
| Version | 1.0.0 |
| Scheme | lasangpinoymobile |
| Platforms | iOS, Android, Web |

## Target Audience

- Filipino food enthusiasts
- Home cooks learning Filipino cuisine
- Cultural heritage preservationists
- Tourists exploring Filipino food culture
- Filipino diaspora seeking traditional recipes

---

# 2. APPLICATION GOALS

## Primary Goals

1. **Preserve Filipino Culinary Heritage**
   - Document traditional recipes with historical context
   - Include regional variations and cultural significance
   - Store fun facts and cultural trivia

2. **Educate Users About Filipino Cuisine**
   - Provide detailed cooking instructions
   - Include nutritional information
   - Share health benefits and dietary notes
   - Offer cultural history of each dish

3. **Enable AI-Powered Food Discovery**
   - Identify Filipino dishes from photos
   - Recognize ingredients and suggest recipes
   - Provide intelligent recipe recommendations

4. **Create an Engaging User Experience**
   - Bookmark favorite recipes
   - Rate and review dishes
   - Interactive AI chatbot for questions
   - Filter recipes by region and category

## Success Metrics

- Number of registered users
- Recipes viewed per session
- Bookmarks created
- AI scan usage
- Chatbot interactions
- User feedback ratings

---

# 3. TECHNOLOGY STACK

## Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile framework |
| Expo | SDK 54.0.33 | Development platform & tooling |
| Expo Router | 6.0.23 | File-based navigation |
| TypeScript | 5.9.2 | Type-safe JavaScript |
| React | 19.1.0 | UI component library |

## Backend Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Authentication | Firebase Auth | User sign-in/sign-up |
| Database | Firebase Firestore | NoSQL document storage |
| Storage | Firebase Storage | Image storage |
| AI Vision | Alibaba Qwen VL Max | Food/ingredient recognition |
| AI Chat | Alibaba Qwen Plus | Conversational AI |

## Complete Dependencies

```json
{
  "dependencies": {
    "@expo/vector-icons": "^15.0.3",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-native-firebase/app": "^23.8.8",
    "@react-native-firebase/auth": "^23.8.8",
    "@react-native-firebase/firestore": "^23.8.8",
    "@react-navigation/bottom-tabs": "^7.4.0",
    "@react-navigation/elements": "^2.6.3",
    "@react-navigation/native": "^7.2.1",
    "@react-navigation/native-stack": "^7.14.9",
    "expo": "~54.0.33",
    "expo-auth-session": "~7.0.10",
    "expo-constants": "~18.0.13",
    "expo-crypto": "~15.0.8",
    "expo-file-system": "~19.0.21",
    "expo-font": "~14.0.11",
    "expo-haptics": "~15.0.8",
    "expo-image": "~3.0.11",
    "expo-image-picker": "~17.0.10",
    "expo-linking": "~8.0.11",
    "expo-router": "~6.0.23",
    "expo-secure-store": "~15.0.8",
    "expo-splash-screen": "~31.0.13",
    "expo-status-bar": "~3.0.9",
    "expo-symbols": "~1.0.8",
    "expo-system-ui": "~6.0.9",
    "expo-web-browser": "~15.0.10",
    "firebase": "^12.11.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.81.5",
    "react-native-gesture-handler": "~2.28.0",
    "react-native-reanimated": "~4.1.1",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-url-polyfill": "^3.0.0",
    "react-native-web": "~0.21.0",
    "react-native-worklets": "0.5.1"
  },
  "devDependencies": {
    "@types/react": "~19.1.0",
    "eslint": "^9.25.0",
    "eslint-config-expo": "~10.0.0",
    "typescript": "~5.9.2"
  }
}
```

---

# 4. PROJECT STRUCTURE

```
C:\Users\USER\OneDrive\Desktop\PUP\
│
├── app/                              # Application screens (Expo Router)
│   ├── _layout.tsx                   # Root layout with navigation
│   ├── index.tsx                     # Entry point (auth redirect)
│   ├── modal.tsx                     # Modal screen
│   │
│   ├── (auth)/                       # Authentication screens
│   │   ├── _layout.tsx               # Auth layout
│   │   ├── welcome.tsx               # Landing page
│   │   ├── login.tsx                 # User login (email + OAuth)
│   │   ├── signup.tsx                # User registration
│   │   └── admin-login.tsx           # Admin login
│   │
│   ├── (tabs)/                       # Main user screens (tab navigation)
│   │   ├── _layout.tsx               # Tab bar layout
│   │   ├── index.tsx                 # Home - Browse recipes
│   │   ├── scan.tsx                  # AI image scanner
│   │   ├── chat.tsx                  # AI chatbot
│   │   └── profile.tsx               # User profile & bookmarks
│   │
│   ├── (admin)/                      # Admin screens
│   │   ├── _layout.tsx               # Admin layout
│   │   ├── index.tsx                 # Admin dashboard
│   │   ├── recipes.tsx               # Recipe management
│   │   ├── users.tsx                 # User management
│   │   ├── regions.tsx               # Region management
│   │   └── nutrition.tsx             # Nutrition info editor
│   │
│   └── recipe/                       # Recipe detail screens
│       └── [id].tsx                  # Dynamic recipe detail page
│
├── lib/                              # Core libraries
│   ├── firebase.ts                   # Firebase SDK + REST API client
│   ├── firestore-rest.ts             # Firestore REST API fallback
│   ├── firebase-helpers.ts           # Error handling utilities
│   └── qwen-ai.ts                    # Alibaba Qwen AI integration
│
├── components/                       # Reusable UI components
├── constants/                        # App constants and themes
├── hooks/                            # Custom React hooks
│
├── assets/                           # Static assets
│   └── images/
│       ├── icon.png
│       ├── favicon.png
│       ├── splash-icon.png
│       ├── android-icon-foreground.png
│       ├── android-icon-background.png
│       └── android-icon-monochrome.png
│
├── scripts/                          # Utility scripts
│   ├── seed-firebase-rest.ts         # Database seeding
│   ├── setup-admin.ts                # Admin user creation
│   ├── diagnose-firestore.ts         # Firestore diagnostics
│   └── test-firestore-rest.ts        # REST API testing
│
├── .env                              # Environment variables
├── app.json                          # Expo configuration
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript configuration
├── firebase.json                     # Firebase CLI configuration
├── firestore.rules                   # Firestore security rules (production)
├── firestore-dev.rules               # Firestore security rules (development)
├── firestore.indexes.json            # Firestore indexes
└── storage.rules                     # Storage security rules
```

---

# 5. ENVIRONMENT VARIABLES & API KEYS

## .env File Location

`C:\Users\USER\OneDrive\Desktop\PUP\.env`

## Complete Environment Configuration

```env
# ============================================
# FIREBASE CONFIGURATION
# ============================================

# Firebase Web API Key
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyAZ36rq3scKZDT5SsETJ_SYIOEB9Gcbkyk

# Firebase Auth Domain
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=lasangpinoy-mobile.firebaseapp.com

# Firebase Project ID
EXPO_PUBLIC_FIREBASE_PROJECT_ID=lasangpinoy-mobile

# Firebase Storage Bucket
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=lasangpinoy-mobile.firebasestorage.app

# Firebase Messaging Sender ID
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=931661584129

# Firebase App ID
EXPO_PUBLIC_FIREBASE_APP_ID=1:931661584129:web:c9755a01f54a31cf29ed00

# ============================================
# ALIBABA CLOUD QWEN AI CONFIGURATION
# ============================================

# Qwen API Key (DashScope Platform)
EXPO_PUBLIC_QWEN_API_KEY=sk-74f4c56187114b07bf52d0bb6ac21aee
```

## API Keys Summary Table

| Service | Key Name | Value | Purpose |
|---------|----------|-------|---------|
| Firebase | API Key | `AIzaSyAZ36rq3scKZDT5SsETJ_SYIOEB9Gcbkyk` | Web SDK authentication |
| Firebase | Project ID | `lasangpinoy-mobile` | Project identifier |
| Firebase | App ID | `1:931661584129:web:c9755a01f54a31cf29ed00` | Web app identifier |
| Firebase | Sender ID | `931661584129` | Cloud messaging |
| Firebase | Auth Domain | `lasangpinoy-mobile.firebaseapp.com` | OAuth redirects |
| Firebase | Storage Bucket | `lasangpinoy-mobile.firebasestorage.app` | File storage |
| Qwen AI | API Key | `sk-74f4c56187114b07bf52d0bb6ac21aee` | AI Vision & Chat |

---

# 6. FIREBASE CONFIGURATION

## Firebase Project Details

| Property | Value |
|----------|-------|
| Project Name | lasangpinoy-mobile |
| Project ID | lasangpinoy-mobile |
| Project Number | 931661584129 |
| Region | asia-southeast1 |
| Database Type | Firestore Native Mode |
| Database Name | (default) |

## Firebase Console URLs

| Service | URL |
|---------|-----|
| Console Home | https://console.firebase.google.com/project/lasangpinoy-mobile |
| Authentication | https://console.firebase.google.com/project/lasangpinoy-mobile/authentication |
| Firestore | https://console.firebase.google.com/project/lasangpinoy-mobile/firestore |
| Storage | https://console.firebase.google.com/project/lasangpinoy-mobile/storage |
| Users | https://console.firebase.google.com/project/lasangpinoy-mobile/authentication/users |

## Firebase Services Status

| Service | Status | Configuration |
|---------|--------|---------------|
| Authentication | ✅ Enabled | Email/Password, Google, Facebook |
| Cloud Firestore | ✅ Enabled | asia-southeast1 region |
| Cloud Storage | ✅ Enabled | Default bucket |
| Hosting | ❌ Not configured | - |
| Functions | ❌ Not configured | - |
| Analytics | ❌ Not configured | - |

## Firebase Configuration in Code

**File:** `lib/firebase.ts`

```typescript
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyAZ36rq3scKZDT5SsETJ_SYIOEB9Gcbkyk",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "lasangpinoy-mobile.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "lasangpinoy-mobile",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "lasangpinoy-mobile.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "931661584129",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:931661584129:web:c9755a01f54a31cf29ed00"
};
```

---

# 7. DATABASE SCHEMA

## Collections Overview

| Collection | Description | Document Count |
|------------|-------------|----------------|
| `profiles` | User profiles and admin flags | Variable |
| `recipes` | Filipino recipes with full details | 8+ (seeded) |
| `regions` | Philippine regions | 8 (seeded) |
| `bookmarks` | User's saved recipes | Variable |
| `feedback` | Recipe ratings and reviews | Variable |

## Collection: profiles

**Purpose:** Store user account information and admin privileges.

```typescript
interface Profile {
  id: string;              // Firebase Auth UID (document ID)
  email: string;           // User's email address
  username: string;        // Display name
  is_admin: boolean;       // Admin privilege flag (default: false)
  created_at: Timestamp;   // Account creation timestamp
}
```

**Example Document:**
```json
{
  "id": "ifZP9BIlvpVfo2TN3imKiKixPUh2",
  "email": "Kethaguacito@gmail.com",
  "username": "Admin",
  "is_admin": true,
  "created_at": "2026-03-27T10:30:00Z"
}
```

## Collection: recipes

**Purpose:** Store complete Filipino recipe information.

```typescript
interface Recipe {
  id: string;              // Auto-generated document ID
  title: string;           // Recipe name
  category: string;        // "Main Dish" | "Soup" | "Noodles" | "Dessert"
  region: string;          // Philippine region of origin
  ingredients: string;     // Comma-separated ingredient list
  instructions: string;    // Step-by-step cooking guide
  nutrition: string;       // Nutritional information
  health_notes: string;    // Health benefits and dietary notes
  history: string;         // Cultural and historical background
  fun_fact: string;        // Interesting trivia
  image_url: string;       // URL to recipe photo
  user_id: string;         // Creator's UID (empty for admin-created)
  created_at: Timestamp;   // Creation timestamp
}
```

**Example Document:**
```json
{
  "id": "adobo",
  "title": "Chicken Adobo",
  "category": "Main Dish",
  "region": "NCR - Metro Manila",
  "ingredients": "Chicken, soy sauce, vinegar, garlic, bay leaves, black peppercorns",
  "instructions": "1. Marinate chicken in soy sauce and vinegar...",
  "nutrition": "Calories: 350kcal, Protein: 28g, Fat: 22g, Carbs: 5g",
  "health_notes": "High in protein. Vinegar aids digestion.",
  "history": "Adobo predates Spanish colonization...",
  "fun_fact": "Over 100 variations of adobo exist!",
  "image_url": "https://images.unsplash.com/...",
  "user_id": "",
  "created_at": "2026-03-27T10:30:00Z"
}
```

## Collection: regions

**Purpose:** Store Philippine regions with culinary descriptions.

```typescript
interface Region {
  id: string;              // Document ID (slug)
  name: string;            // Region display name
  description: string;     // Culinary description
  created_at: Timestamp;   // Creation timestamp
}
```

**Seeded Regions (8 total):**

| ID | Name | Description |
|----|------|-------------|
| ncr | NCR - Metro Manila | The culinary melting pot of the Philippines |
| ilocos | Ilocos Region | Known for Bagnet, Pinakbet, and Empanada |
| central-luzon | Central Luzon | Rice granary with Kapampangan cuisine |
| calabarzon | CALABARZON | Famous for Bulalo and Tawilis |
| bicol | Bicol Region | Spicy coconut-based dishes like Bicol Express |
| western-visayas | Western Visayas | Home of La Paz Batchoy and Chicken Inasal |
| central-visayas | Central Visayas | Known for Lechon Cebu |
| davao | Davao Region | Fresh seafood and tropical fruits |

## Collection: bookmarks

**Purpose:** Track user's saved/favorite recipes.

```typescript
interface Bookmark {
  id: string;              // Auto-generated document ID
  user_id: string;         // User's Firebase UID
  recipe_id: string;       // Recipe document ID
  created_at: Timestamp;   // Bookmark timestamp
}
```

## Collection: feedback

**Purpose:** Store user ratings and reviews for recipes.

```typescript
interface Feedback {
  id: string;              // Auto-generated document ID
  user_id: string;         // User's Firebase UID
  recipe_id: string;       // Recipe document ID
  rating: number;          // 1-5 star rating
  comment: string;         // Written review
  created_at: Timestamp;   // Submission timestamp
}
```

## Database Indexes

**File:** `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "bookmarks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "bookmarks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "recipe_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "feedback",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "recipe_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "feedback",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "recipes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "recipes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "region", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Database Relationships

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   profiles  │       │   recipes   │       │   regions   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ email       │       │ title       │       │ name        │
│ username    │       │ category    │       │ description │
│ is_admin    │       │ region ─────┼───────│             │
│ created_at  │       │ ingredients │       │ created_at  │
└──────┬──────┘       │ instructions│       └─────────────┘
       │              │ nutrition   │
       │              │ health_notes│
       │              │ history     │
       │              │ fun_fact    │
       │              │ image_url   │
       │              │ user_id ────┼─────┐
       │              │ created_at  │     │
       │              └──────┬──────┘     │
       │                     │            │
       │    ┌────────────────┼────────────┘
       │    │                │
       ▼    ▼                ▼
┌─────────────┐       ┌─────────────┐
│  bookmarks  │       │  feedback   │
├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │
│ user_id (FK)│       │ user_id (FK)│
│ recipe_id(FK)│      │ recipe_id(FK)│
│ created_at  │       │ rating      │
└─────────────┘       │ comment     │
                      │ created_at  │
                      └─────────────┘
```

---

# 8. SECURITY RULES

## Firestore Security Rules (Production)

**File:** `firestore.rules`

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    // Check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Check if user is admin
    function isAdmin() {
      return isSignedIn() && 
             get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.is_admin == true;
    }
    
    // Check if user owns the resource
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    // ============================================
    // COLLECTION RULES
    // ============================================
    
    // PROFILES - Users can read their own, update own (except is_admin)
    match /profiles/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isOwner(userId) && 
                       request.resource.data.is_admin == resource.data.is_admin ||
                       isAdmin();
      allow delete: if isAdmin();
    }
    
    // RECIPES - Anyone can read, only admins can write
    match /recipes/{recipeId} {
      allow read: if true;
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
    
    // REGIONS - Anyone can read, only admins can write
    match /regions/{regionId} {
      allow read: if true;
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }
    
    // BOOKMARKS - Users can only access their own
    match /bookmarks/{bookmarkId} {
      allow read: if isOwner(resource.data.user_id);
      allow create: if isSignedIn() && 
                       request.resource.data.user_id == request.auth.uid;
      allow update: if false; // Bookmarks shouldn't be updated
      allow delete: if isOwner(resource.data.user_id) || isAdmin();
    }
    
    // FEEDBACK - Anyone can read, users can manage own
    match /feedback/{feedbackId} {
      allow read: if true;
      allow create: if isSignedIn() && 
                       request.resource.data.user_id == request.auth.uid &&
                       request.resource.data.rating >= 1 && 
                       request.resource.data.rating <= 5;
      allow update: if isOwner(resource.data.user_id);
      allow delete: if isOwner(resource.data.user_id) || isAdmin();
    }
  }
}
```

## Storage Security Rules

**File:** `storage.rules`

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isSignedIn() && 
             firestore.get(/databases/(default)/documents/profiles/$(request.auth.uid)).data.is_admin == true;
    }
    
    // Recipe images - public read, admin write only
    match /recipe-images/{imageId} {
      allow read: if true;
      allow write: if isAdmin() && 
                      request.resource.size < 5 * 1024 * 1024 &&  // Max 5MB
                      request.resource.contentType.matches('image/.*');
    }
    
    // Profile images - public read, owner write
    match /profile-images/{userId}/{imageId} {
      allow read: if true;
      allow write: if isSignedIn() && 
                      request.auth.uid == userId &&
                      request.resource.size < 2 * 1024 * 1024 &&  // Max 2MB
                      request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

# 9. AI INTEGRATION

## Alibaba Cloud Qwen AI

**Platform:** DashScope (Alibaba Cloud AI Services)
**Base URL:** `https://dashscope.aliyuncs.com/compatible-mode/v1`

### AI Models Used

| Model | Model ID | Purpose | Input |
|-------|----------|---------|-------|
| Qwen VL Max | qwen-vl-max | Image analysis | Images + text |
| Qwen Plus | qwen-plus | Chat conversations | Text only |

### Configuration

**File:** `lib/qwen-ai.ts`

```typescript
const QWEN_API_KEY = process.env.EXPO_PUBLIC_QWEN_API_KEY || 'sk-74f4c56187114b07bf52d0bb6ac21aee';
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
```

### AI Features

#### 1. Food Scanner (Image Recognition)

**Screen:** `app/(tabs)/scan.tsx`

**Modes:**
- **Dish Mode:** Identifies Filipino dishes from photos
- **Ingredients Mode:** Recognizes ingredients and suggests recipes

**Response Interface:**
```typescript
interface ScanResult {
  type: 'dish' | 'ingredients' | 'unknown';
  dishName?: string;           // Identified dish name
  confidence?: string;         // "high" | "medium" | "low"
  ingredients?: string[];      // Detected ingredients
  description?: string;        // Brief description
  suggestedRecipes?: string[]; // Recipe suggestions
  funFact?: string;           // Interesting trivia
  isFilipino?: boolean;       // Filipino dish flag
}
```

**Example API Request:**
```typescript
const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${QWEN_API_KEY}`
  },
  body: JSON.stringify({
    model: 'qwen-vl-max',
    messages: [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          { type: 'text', text: 'What Filipino dish is this?' }
        ]
      }
    ],
    max_tokens: 1000
  })
});
```

#### 2. AI Chatbot (Chef Pinoy)

**Screen:** `app/(tabs)/chat.tsx`

**Persona:** "Chef Pinoy" - Filipino cuisine expert

**Capabilities:**
- Answer questions about Filipino dishes
- Share recipe suggestions and cooking tips
- Explain cooking techniques
- Provide cultural context and history
- Share fun facts and trivia

**Example API Request:**
```typescript
const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${QWEN_API_KEY}`
  },
  body: JSON.stringify({
    model: 'qwen-plus',
    messages: [
      { role: 'system', content: chefPinoySystemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ],
    max_tokens: 500
  })
});
```

---

# 10. FEATURES & SCREENS

## User Features

| Feature | Screen | File | Description |
|---------|--------|------|-------------|
| Welcome | Welcome Page | `(auth)/welcome.tsx` | App introduction and entry |
| Login | User Login | `(auth)/login.tsx` | Email/password + OAuth |
| Sign Up | Registration | `(auth)/signup.tsx` | New user account creation |
| Browse | Home | `(tabs)/index.tsx` | Recipe grid with filters |
| Recipe Detail | Recipe View | `recipe/[id].tsx` | Full recipe information |
| Bookmark | Save Recipe | `recipe/[id].tsx` | Add to favorites |
| Feedback | Rate & Review | `recipe/[id].tsx` | Submit ratings |
| AI Scanner | Food Scan | `(tabs)/scan.tsx` | Photo-based recognition |
| AI Chat | Chatbot | `(tabs)/chat.tsx` | Conversational assistant |
| Profile | User Info | `(tabs)/profile.tsx` | Account and bookmarks |

## Admin Features

| Feature | Screen | File | Description |
|---------|--------|------|-------------|
| Admin Login | Admin Auth | `(auth)/admin-login.tsx` | Secure admin access |
| Dashboard | Overview | `(admin)/index.tsx` | Statistics and summary |
| Recipes | CRUD | `(admin)/recipes.tsx` | Manage recipes |
| Users | Management | `(admin)/users.tsx` | View/manage users |
| Regions | Management | `(admin)/regions.tsx` | Add/edit regions |
| Nutrition | Editor | `(admin)/nutrition.tsx` | Update nutrition info |

## Recipe Categories

| Category | Color | Hex Code | Description |
|----------|-------|----------|-------------|
| Main Dish | Orange | `#F25C05` | Primary dishes |
| Soup | Blue | `#4A8FE7` | Soups and stews |
| Noodles | Green | `#34B36A` | Noodle dishes |
| Dessert | - | - | Sweet treats |

---

# 11. AUTHENTICATION FLOW

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       APP LAUNCH                             │
│                           │                                  │
│                           ▼                                  │
│                   ┌───────────────┐                         │
│                   │   index.tsx   │                         │
│                   │  onAuthChange │                         │
│                   └───────┬───────┘                         │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│   ┌───────────┐    ┌───────────┐    ┌─────────────┐        │
│   │   GUEST   │    │   USER    │    │    ADMIN    │        │
│   │  No Auth  │    │  is_admin │    │   is_admin  │        │
│   │           │    │  = false  │    │   = true    │        │
│   └─────┬─────┘    └─────┬─────┘    └──────┬──────┘        │
│         │                │                 │                │
│         ▼                ▼                 ▼                │
│   ┌───────────┐    ┌───────────┐    ┌─────────────┐        │
│   │  Welcome  │    │  (tabs)   │    │   (admin)   │        │
│   │  Screen   │    │   Home    │    │  Dashboard  │        │
│   └───────────┘    └───────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Auth Token Management

The app uses a dual authentication system for maximum compatibility:

1. **Firebase SDK Auth:** Primary authentication method
2. **REST API Token:** Fallback for ad-blocked browsers

### Token Setting Points

| Action | Function | Token Set? |
|--------|----------|------------|
| Email/Password Login | `signIn()` | ✅ Yes |
| Email/Password Signup | `signUp()` | ✅ Yes |
| Google OAuth | `signInWithPopup()` + `setRestTokenFromUser()` | ✅ Yes |
| Facebook OAuth | `signInWithPopup()` + `setRestTokenFromUser()` | ✅ Yes |
| App Load (returning user) | `onAuthChange()` | ✅ Yes |
| Logout | `logOut()` | ✅ Cleared |

### Code Implementation

```typescript
// lib/firebase.ts

// Called on every auth state change
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdToken();
      RestApi.setAuthToken(token);  // Set REST API token
    } else {
      RestApi.setAuthToken(null);   // Clear token
    }
    callback(user);
  });
}

// Helper for OAuth flows
export async function setRestTokenFromUser(user: User) {
  if (user) {
    const token = await user.getIdToken();
    RestApi.setAuthToken(token);
  }
}
```

---

# 12. REST API IMPLEMENTATION

## Why REST API Fallback?

Ad blockers on web browsers can block Firebase SDK requests. The app automatically falls back to Firestore REST API to ensure functionality.

## REST API Base URL

```
https://firestore.googleapis.com/v1/projects/lasangpinoy-mobile/databases/(default)/documents
```

## REST API Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List Documents | GET | `/{collection}?key={API_KEY}` |
| Get Document | GET | `/{collection}/{docId}?key={API_KEY}` |
| Create Document | POST | `/{collection}?key={API_KEY}` |
| Update Document | PATCH | `/{collection}/{docId}?key={API_KEY}` |
| Delete Document | DELETE | `/{collection}/{docId}?key={API_KEY}` |
| Query Documents | POST | `:runQuery?key={API_KEY}` |

## REST API Functions

**File:** `lib/firestore-rest.ts`

| Function | Purpose |
|----------|---------|
| `getDocument(collection, docId)` | Fetch single document |
| `getCollection(collection, orderBy?)` | Fetch all documents |
| `queryCollection(collection, field, op, value)` | Query with filter |
| `createDocument(collection, data)` | Create new document |
| `setDocument(collection, docId, data)` | Set document with ID |
| `updateDocument(collection, docId, data)` | Update specific fields |
| `deleteDocument(collection, docId)` | Delete document |

## Auth Header Management

```typescript
// lib/firestore-rest.ts

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function setAuthToken(token: string | null) {
  cachedToken = token;
  tokenExpiry = token ? Date.now() + 3600000 : 0; // 1 hour expiry
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (cachedToken && Date.now() < tokenExpiry) {
    headers['Authorization'] = `Bearer ${cachedToken}`;
  }
  
  return headers;
}
```

---

# 13. DEVELOPMENT PROGRESS

## Completed Features ✅

### Core Features
- [x] Firebase Authentication (email/password)
- [x] Google OAuth integration
- [x] Facebook OAuth integration
- [x] User registration and login
- [x] Admin login with role verification
- [x] REST API fallback for web browsers
- [x] Auth token management

### Recipe Features
- [x] Browse all recipes
- [x] Filter by category (Main Dish, Soup, Noodles, Dessert)
- [x] Filter by Philippine region
- [x] Search recipes by title/ingredients
- [x] View recipe details
- [x] Bookmark favorite recipes
- [x] Rate and review recipes
- [x] Share recipes via native Share API

### AI Features
- [x] Image-based dish recognition (Qwen VL Max)
- [x] Ingredient identification
- [x] Recipe suggestions from ingredients
- [x] AI chatbot "Chef Pinoy" (Qwen Plus)
- [x] Conversation history

### Admin Features
- [x] Admin dashboard with statistics
- [x] Recipe CRUD operations
- [x] User management
- [x] Toggle admin status for users
- [x] Region management
- [x] Nutrition information editor
- [x] Feedback/reviews management
- [x] Firebase Storage image upload for recipes

### User Account Features
- [x] Edit profile (change display name)
- [x] Delete account with full data cleanup
- [x] Dark mode with persistence

### Shopping List
- [x] Shopping list utility (lib/shopping-list.ts) with AsyncStorage persistence
- [x] Shopping list tab screen (app/(tabs)/shopping.tsx)
- [x] Add/remove recipes from shopping list on recipe detail
- [x] Check off ingredients as you shop with progress bar
- [x] Share shopping list via native Share API
- [x] Shopping list access from Profile Settings with item count badge

### Push Notifications (NEW)
- [x] expo-notifications installed and configured
- [x] lib/notifications.ts — registerForPushNotificationsAsync, sendLocalNotification, scheduleLocalNotification
- [x] app/_layout.tsx — permission request on load, token saved to user profile
- [x] app.json — expo-notifications plugin added with orange icon tint
- [x] notifyRecipeApproved / notifyRecipeRejected / notifyNewRecipe helpers
- [x] Notifications fire when admin approves or rejects a submission

### User Recipe Submissions (NEW)
- [x] RecipeSubmission interface + CRUD in lib/firebase.ts (submitRecipe, getSubmissions, getUserSubmissions, approveSubmission, rejectSubmission, deleteSubmission)
- [x] app/(tabs)/submit.tsx — full submission form with image picker, category chips, region selector, optional fields, and My Submissions history tab
- [x] app/(admin)/submissions.tsx — admin approval panel with filter tabs (Pending/All/Approved/Rejected), approve/reject/delete actions, rejection reason modal, detail bottom sheet
- [x] Firestore security rules updated for recipe_submissions collection
- [x] Admin dashboard shows pending submission count badge in Submissions menu card
- [x] Submit tab added to user tab bar

### Technical
- [x] TypeScript throughout
- [x] Expo Router navigation
- [x] Firebase Firestore integration
- [x] REST API fallback
- [x] Error handling and retry logic
- [x] Security rules implemented
- [x] Database indexes configured
- [x] Offline cache invalidation on recipe/region writes
- [x] Admin layout auth race condition fix (onAuthChange listener)
- [x] Guest recipe reviews (unauthenticated users can read reviews)

## Pending Features 🔄

### High Priority (Recommended Next)

| Feature | Description | Difficulty | Estimated Effort |
|---------|-------------|------------|------------------|
| Push Notifications | Alert users about new recipes, bookmarked updates | Medium | 2-3 days |

### Medium Priority

| Feature | Description | Difficulty | Estimated Effort |
|---------|-------------|------------|------------------|
| Meal Planning | Calendar to plan weekly meals | Hard | 4-5 days |
| Recipe Collections | Create custom lists/folders of recipes | Medium | 2-3 days |

### Low Priority (Future Enhancements)

| Feature | Description | Difficulty | Estimated Effort |
|---------|-------------|------------|------------------|
| Social Features | Follow users, see their activity | Hard | 5-7 days |
| Custom ML Engine | On-device recipe recommendations | Hard | 1-2 weeks |
| Multi-language | Tagalog/Cebuano translations | Medium | 3-4 days |
| Video Recipes | Embed cooking tutorial videos | Medium | 2-3 days |
| Nutritional Calculator | Calculate totals for meal combinations | Medium | 2 days |
| User Recipe Submissions | Allow users to submit recipes (moderated) | Medium | 3-4 days |
| Advanced Search | Full-text search with filters | Medium | 2-3 days |
| Recipe Scaling | Adjust ingredient amounts by servings | Easy | 1 day |
| Cooking Timers | Built-in timers for recipe steps | Medium | 2 days |
| Print Recipe | Print-friendly recipe view | Easy | 0.5 day |

---

## Unimplemented Features ❌

The following features are **planned but not yet coded**:

### 1. Push Notifications
**Status:** Not started  
**Requirements:**
- Firebase Cloud Messaging (FCM) setup
- Expo Notifications configuration
- Notification permission handling
- Server-side trigger logic (optional: Firebase Functions)

**Files to create:**
- `lib/notifications.ts` - Notification service
- Update `app/_layout.tsx` - Permission request on app load

### 2. Offline Mode / Data Caching
**Status:** ✅ Completed  
**Implementation:**
- `getRecipes()` and `getRegions()` in `lib/firebase.ts` cache data to AsyncStorage
- When network requests fail, cached data is automatically loaded
- Cache is refreshed on every successful network fetch
- Uses keys `@lasangpinoy_recipes_cache` and `@lasangpinoy_regions_cache`

### 3. Password Reset Flow
**Status:** ✅ Completed  
**Implementation:**
- `resetPassword()` function in `lib/firebase.ts` calls `sendPasswordResetEmail()`
- "Forgot Password" modal in `app/(auth)/login.tsx` with email input
- Success/error handling with user-friendly messages
- Pre-fills user's email from the login form

### 4. Email Verification
**Status:** ✅ Completed  
**Implementation:**
- `verifyEmail()` function in `lib/firebase.ts` calls `sendEmailVerification()`
- Automatically triggered after signup in `app/(auth)/signup.tsx`
- Non-blocking: verification email is sent in background without affecting signup flow

### 5. Image Upload for Admin
**Status:** ✅ Completed  
**Implementation:**
- `uploadRecipeImage()` function in `lib/firebase.ts` uses Firebase Storage SDK
- Admin recipe form now uploads picked images to Firebase Storage
- Falls back to local URI if Storage upload fails
- Also added Image URL text input so admins can paste external image URLs
- Recipe form in `app/(admin)/recipes.tsx` supports both methods

### 6. Recipe Sharing
**Status:** ✅ Completed  
**Implementation:**
- Share button added to recipe detail screen (`app/recipe/[id].tsx`)
- Uses React Native's native `Share` API
- Shares recipe title, region, category, and ingredients
- Works on iOS, Android, and Web

### 7. Shopping List Generator
**Status:** ✅ Completed  
**Implementation:**
- `lib/shopping-list.ts` — full AsyncStorage-backed service (add, toggle, remove, clear, share)
- `app/(tabs)/shopping.tsx` — dedicated Shopping tab with grouped ingredients, checkboxes, progress bar
- Recipe detail (`app/recipe/[id].tsx`) — cart icon + banner to add/remove ingredients
- Profile Settings row with live item count badge
- Native Share API export with emoji-formatted grouped text

### 8. Meal Planning Calendar
**Status:** Not started  
**Requirements:**
- New Firestore collection: `meal_plans`
- Calendar UI component
- Date picker integration
- Weekly/monthly views

### 9. User Recipe Submissions
**Status:** Not started  
**Requirements:**
- New collection: `recipe_submissions` (pending approval)
- Admin approval workflow
- User notification on approval/rejection

### 10. Custom ML Recommendation Engine
**Status:** Documented only (see Section 15)  
**Requirements:**
- Content-based filtering algorithm
- User profile vector from bookmarks
- Recipe feature extraction
- Similarity calculation

---

## Pending Testing 🧪

The following items have been **implemented but need verification**:

### Critical - Must Test Before Release

| Item | What to Test | How to Test | Status |
|------|--------------|-------------|--------|
| REST API Auth Fix | Bookmarks load for returning users | 1. Login, bookmark a recipe, logout 2. Close browser completely 3. Reopen app, login again 4. Check profile - bookmarks should load | ⏳ Pending |
| OAuth Token Fix | Google/Facebook login sets REST token | 1. Use Google Sign In 2. Check console for `[REST] Auth token set` 3. Navigate to profile, bookmarks should work | ⏳ Pending |
| `onAuthChange` Integration | App correctly redirects on load | 1. Login as user → should go to (tabs) 2. Login as admin → should go to (admin) 3. Not logged in → should go to welcome | ⏳ Pending |

### Authentication Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Email/Password Login | Enter valid credentials, submit | Redirect to home, user data loads | ⏳ Pending |
| Email/Password Signup | Enter new email/password | Account created, profile created, redirect | ⏳ Pending |
| Admin Login | Login with admin credentials | Redirect to admin dashboard | ⏳ Pending |
| Invalid Login | Enter wrong password | Error message displayed | ⏳ Pending |
| Logout | Tap logout button | Redirect to welcome, session cleared | ⏳ Pending |
| Google OAuth | Tap "Sign in with Google" | Google popup, successful auth | ⏳ Pending |
| Facebook OAuth | Tap "Sign in with Facebook" | Facebook popup, successful auth | ⏳ Pending |

### Recipe Features Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Browse Recipes | Open home screen | All recipes displayed in grid | ⏳ Pending |
| Filter by Category | Tap category filter | Only matching recipes shown | ⏳ Pending |
| Filter by Region | Tap region filter | Only matching recipes shown | ⏳ Pending |
| Search Recipes | Type in search bar | Filtered results displayed | ⏳ Pending |
| View Recipe Detail | Tap on recipe card | Full recipe info displayed | ⏳ Pending |
| Bookmark Recipe | Tap bookmark icon | Recipe saved, icon changes | ⏳ Pending |
| Remove Bookmark | Tap bookmarked icon | Bookmark removed | ⏳ Pending |
| Submit Rating | Select stars, submit | Rating saved, average updated | ⏳ Pending |
| Submit Review | Write comment, submit | Review appears in list | ⏳ Pending |

### AI Features Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Scan Dish Photo | Take/select dish photo | AI identifies Filipino dish | ⏳ Pending |
| Scan Ingredients | Take photo of ingredients | AI lists ingredients, suggests recipes | ⏳ Pending |
| Chat with Chef Pinoy | Send question about Filipino food | AI responds with relevant info | ⏳ Pending |
| Chat History | Send multiple messages | Conversation history maintained | ⏳ Pending |
| Image from Gallery | Select from camera roll | Image processes correctly | ⏳ Pending |
| Camera Capture | Use camera directly | Photo captured and analyzed | ⏳ Pending |

### Admin Features Testing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View Dashboard | Login as admin | Statistics displayed | ⏳ Pending |
| Create Recipe | Fill form, submit | New recipe appears in list | ⏳ Pending |
| Edit Recipe | Modify existing recipe | Changes saved | ⏳ Pending |
| Delete Recipe | Delete recipe | Recipe removed | ⏳ Pending |
| View Users | Open users screen | All users listed | ⏳ Pending |
| Toggle Admin | Make user admin | User can access admin features | ⏳ Pending |
| Add Region | Create new region | Region appears in filters | ⏳ Pending |
| Edit Nutrition | Update nutrition info | Changes saved | ⏳ Pending |

### Cross-Platform Testing

| Platform | Device/Emulator | Status |
|----------|-----------------|--------|
| Web (Chrome) | Desktop browser | ⏳ Pending |
| Web (Safari) | Desktop browser | ⏳ Pending |
| Web (Firefox) | Desktop browser | ⏳ Pending |
| Web (with Ad Blocker) | Browser + uBlock Origin | ⏳ Pending |
| Android | Emulator / Physical device | ⏳ Pending |
| iOS | Simulator / Physical device | ⏳ Pending |
| Expo Go (Android) | Physical device | ⏳ Pending |
| Expo Go (iOS) | Physical device | ⏳ Pending |

### Error Handling Testing

| Test Case | How to Simulate | Expected Behavior | Status |
|-----------|-----------------|-------------------|--------|
| Network Error | Disable WiFi | Graceful error message | ⏳ Pending |
| Invalid API Key | Modify .env temporarily | Error logged, fallback attempted | ⏳ Pending |
| Firestore Permission Denied | Try unauthorized action | User-friendly error | ⏳ Pending |
| AI Service Down | Invalid Qwen key | Error message, app stable | ⏳ Pending |

### Performance Testing

| Metric | Target | How to Measure | Status |
|--------|--------|----------------|--------|
| Initial Load Time | < 3 seconds | Chrome DevTools | ⏳ Pending |
| Recipe List Render | < 500ms | React DevTools Profiler | ⏳ Pending |
| Image Scan Response | < 5 seconds | Console logging | ⏳ Pending |
| Chat Response Time | < 3 seconds | Console logging | ⏳ Pending |

---

# 14. BUG FIXES & KNOWN ISSUES

## Fixed Issues ✅

### Issue 1: REST API Token Not Set on App Load

**Problem:** When a user was already logged in (returning user), the REST API auth token was never set, causing authenticated API calls to fail.

**Root Cause:** `app/index.tsx` used `onAuthStateChanged` directly instead of `onAuthChange`.

**Fix Applied:**
```typescript
// Before (broken)
import { onAuthStateChanged } from 'firebase/auth';
onAuthStateChanged(auth, (user) => { ... });

// After (fixed)
import { onAuthChange } from '../lib/firebase';
onAuthChange((user) => { ... });
```

### Issue 2: OAuth Login Not Setting REST API Token

**Problem:** Google and Facebook sign-in didn't set the REST API token.

**Fix Applied:**
```typescript
// Added helper function
export async function setRestTokenFromUser(user: User) {
  const token = await user.getIdToken();
  RestApi.setAuthToken(token);
}

// Called after OAuth sign-in
const result = await signInWithPopup(auth, googleProvider);
await setRestTokenFromUser(result.user);
```

### Issue 3: Insufficient Error Logging

**Problem:** REST API errors showed generic messages without details.

**Fix Applied:** Enhanced logging in `firestore-rest.ts` with request details, auth status, and full error responses.

### Issue 4: Supabase References Remaining

**Problem:** Old Supabase imports and code remained after migration.

**Fix Applied:** Removed all Supabase references, deleted `lib/supabase.ts`, uninstalled package.

### Issue 5: Admin Layout Auth Race Condition

**Problem:** `app/(admin)/_layout.tsx` used synchronous `getCurrentUser()` which returns `null` on cold start before Firebase Auth restores the persisted session. Legitimate admins were redirected to the welcome screen.

**Fix Applied:** Replaced with a one-shot `onAuthChange` listener that waits for the first auth state resolution before making the admin check.

### Issue 6: Guest Users Could Not See Recipe Reviews

**Problem:** `fetchFeedbackData()` was only called inside `checkUser()`, which only ran for authenticated users. Logged-out visitors saw an empty reviews section even though reviews are publicly readable.

**Fix Applied:** `fetchFeedbackData()` is now called directly in the root `useEffect([id])` block, independent of authentication state.

### Issue 7: Stale Cache After Recipe/Region Writes

**Problem:** After adding, updating, or deleting a recipe or region, the AsyncStorage offline cache was never invalidated. The next offline session served stale data (showing deleted recipes, missing new ones).

**Fix Applied:** All write functions (`addRecipe`, `updateRecipe`, `deleteRecipe`, `addRegion`, `updateRegion`, `deleteRegion`) now call `AsyncStorage.removeItem(CACHE_KEY_*)` after every successful write — across both SDK and REST code paths.

### Issue 8: Hardcoded Qwen API Key

**Problem:** The Alibaba Qwen API key was hardcoded as a fallback string in `lib/qwen-ai.ts`, exposing it in every app bundle.

**Fix Applied:** Hardcoded fallback removed. The app now reads exclusively from `EXPO_PUBLIC_QWEN_API_KEY`. A `console.error` warning is shown if the key is missing, and both AI functions throw a descriptive error rather than silently using a baked-in key.

### Issue 9: Scan Mode Switch Did Not Clear Previous Result

**Problem:** Switching between "Identify Dish" and "Scan Ingredients" modes left the previous result card on screen, mixing UI from both modes.

**Fix Applied:** Mode toggle buttons now call `setResult(null)`, `setMatchedRecipes([])`, and `setError(null)` in addition to `setScanMode(...)`.

### Issue 10: Category/Region Filter Ignored Active Search Text

**Problem:** When tapping a category or region filter chip, `fetchRecipesData()` was called with no search keyword, silently discarding any text the user had typed.

**Fix Applied:** The `[activeCategory, activeRegion]` `useEffect` now calls `fetchRecipesData(search)`, passing the current search state.

### Issue 11: Deprecated Firebase Error Codes

**Problem:** Error handlers in `login.tsx` and `admin-login.tsx` checked for `auth/user-not-found` and `auth/wrong-password`, which are deprecated in Firebase SDK v9+. Friendly error messages never displayed.

**Fix Applied:** Added `auth/invalid-credential` error code handling in both files. The old codes are kept for backward compatibility.

## Known Issues 🐛

| Issue | Status | Workaround |
|-------|--------|------------|
| Ad blockers block Firebase SDK | Mitigated | REST API fallback |
| OAuth requires Firebase Console setup | Open | Manual setup in Firebase Console |

---

# 15. FUTURE ML IMPLEMENTATION

## Recommended ML Models (No External APIs)

### Option 1: Recipe Recommendation System ⭐ BEST

**Algorithm:** Content-Based Filtering with Cosine Similarity

**How It Works:**
1. Extract features from recipes (category, region, ingredients)
2. Create user profile from bookmarked recipes
3. Calculate similarity between user profile and all recipes
4. Recommend most similar recipes

**Math:**
```
similarity(A, B) = cos(θ) = (A · B) / (||A|| × ||B||)
```

### Option 2: K-Nearest Neighbors (KNN)

**Purpose:** Find similar recipes

**Algorithm:**
1. Extract features from target recipe
2. Calculate Euclidean distance to all other recipes
3. Return K nearest neighbors

**Math:**
```
distance(A, B) = √(Σ(ai - bi)²)
```

### Option 3: Image Classification (Advanced)

**Library:** TensorFlow.js
**Model:** Convolutional Neural Network (CNN)
**Requirement:** 100+ training images per dish

### Implementation Files

See `CUSTOM_ML_IMPLEMENTATION.md` for complete code examples.

---

# 16. DEPLOYMENT GUIDE

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Expo CLI (`npm install -g expo-cli`)
- Firebase CLI (`npm install -g firebase-tools`)

## Local Development

```bash
# 1. Navigate to project
cd C:\Users\USER\OneDrive\Desktop\PUP

# 2. Install dependencies
npm install

# 3. Start development server
npx expo start

# 4. Run options:
#    Press 'w' - Web browser
#    Press 'a' - Android emulator
#    Press 'i' - iOS simulator
#    Scan QR - Expo Go app
```

## Deploy Firebase Rules

```bash
# Login to Firebase
firebase login

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Deploy Storage rules
firebase deploy --only storage

# Deploy everything
firebase deploy
```

## Build for Production

```bash
# Build for Android
npx expo build:android

# Build for iOS
npx expo build:ios

# Build for Web
npx expo export:web
```

## Environment Setup for New Developers

1. Clone repository
2. Copy `.env.example` to `.env` (if exists)
3. Or create `.env` with all variables from Section 5
4. Run `npm install`
5. Run `npx expo start`

---

# 17. TEST ACCOUNTS & CREDENTIALS

## Admin Account

| Property | Value |
|----------|-------|
| Email | Kethaguacito@gmail.com |
| Password | Totogwapo123 |
| User UID | ifZP9BIlvpVfo2TN3imKiKixPUh2 |
| Role | Administrator |
| is_admin | true |

## Creating Test User

1. Open app
2. Navigate to Sign Up
3. Enter email and password (6+ characters)
4. Account created with `is_admin: false`

## Admin Features Access

After logging in as admin:
- Dashboard: Statistics overview
- `/recipes`: Create, edit, delete recipes
- `/users`: View all users, toggle admin
- `/regions`: Manage Philippine regions
- `/nutrition`: Update nutritional info

---

# 18. COMMANDS REFERENCE

## Development Commands

```bash
# Start development server
npx expo start

# Clear cache and start
npx expo start -c

# Start for specific platform
npx expo start --web
npx expo start --android
npx expo start --ios

# TypeScript check
npx tsc --noEmit

# Expo diagnostics
npx expo-doctor

# Security audit
npm audit

# Fix security issues
npm audit fix
```

## Firebase Commands

```bash
# Login
firebase login

# Logout
firebase logout

# List projects
firebase projects:list

# Deploy all
firebase deploy

# Deploy specific
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

## Build Commands

```bash
# Install dependencies
npm install

# Update dependencies
npm update

# Clean install
rm -rf node_modules && npm install

# Build web
npx expo export:web

# Build Android
eas build --platform android

# Build iOS
eas build --platform ios
```

## Seeding & Setup Scripts

```bash
# Seed database with regions and recipes
npx ts-node scripts/seed-firebase-rest.ts

# Create admin user
npx ts-node scripts/setup-admin.ts

# Test Firestore connectivity
npx ts-node scripts/test-firestore-rest.ts

# Diagnose Firestore issues
npx ts-node scripts/diagnose-firestore.ts
```

---

# 19. TROUBLESHOOTING

## Common Issues

### App doesn't start

```bash
# Clear cache and restart
npx expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install
npx expo start
```

### Firebase errors

1. Check internet connection
2. Verify `.env` file exists with correct values
3. Check Firebase Console for project status
4. Ensure security rules are deployed

### AI features don't work

1. Verify Qwen API key in `.env`
2. Check internet connection
3. Ensure camera/gallery permissions granted
4. Check console for API error messages

### Authentication issues

1. Verify Firebase Auth is enabled in Console
2. Check if email/password provider is enabled
3. For OAuth: Ensure providers configured in Firebase
4. Check console for auth error codes

### REST API errors

1. Check if auth token is set (look for `[REST] Auth token set` in console)
2. Verify security rules allow the operation
3. Check for index requirements (Firestore may need indexes)
4. Look for detailed error in `[REST] ... error:` logs

### TypeScript errors

```bash
# Check for type errors
npx tsc --noEmit

# If errors, fix them before running
```

### Build errors

```bash
# Check Expo doctor
npx expo-doctor

# Fix any reported issues
```

---

# DOCUMENT INFO

| Property | Value |
|----------|-------|
| Document Title | LasangPinoy Mobile - Complete Documentation |
| Version | 1.0.0 |
| Created | March 28, 2026 |
| Last Updated | March 28, 2026 |
| Author | Development Team |
| Project Status | Active Development |

---

**⚠️ CONFIDENTIAL: This document contains API keys and sensitive configuration. Do not share publicly.**

---

*End of Documentation*
