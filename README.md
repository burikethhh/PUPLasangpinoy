# LasangPinoy Mobile

**Filipino Cuisine Discovery App with AI-Powered Features**

A cross-platform mobile application dedicated to preserving and sharing Filipino culinary heritage through traditional recipes, AI-powered food recognition, and an intelligent chatbot.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on specific platform
npx expo start --web      # Web browser
npx expo start --android  # Android emulator
npx expo start --ios      # iOS simulator
```

---

## Features

### For Users
- Browse Filipino recipes by region and category
- AI-powered food scanner (identifies dishes from photos)
- AI chatbot "Chef Pinoy" for cuisine questions
- Bookmark favorite recipes
- Rate and review dishes
- Password reset via email

### For Admins
- Dashboard with statistics
- Recipe management (CRUD)
- User management
- Region management
- Nutrition information editor

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native, Expo SDK 54, TypeScript |
| Backend | Firebase (Auth, Firestore, Storage) |
| AI | Alibaba Cloud Qwen (Vision & Chat) |
| Navigation | Expo Router (file-based) |

---

## Project Structure

```
├── app/                    # Screens (Expo Router)
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # User tab screens
│   ├── (admin)/           # Admin screens
│   └── recipe/            # Recipe detail
├── lib/                   # Core libraries
│   ├── firebase.ts        # Firebase + REST API
│   ├── firestore-rest.ts  # REST API fallback
│   ├── firebase-helpers.ts # Error handling utilities
│   └── qwen-ai.ts         # AI integration
├── components/            # Reusable UI components
├── constants/             # App constants and themes
├── hooks/                 # Custom React hooks
├── scripts/               # Utility scripts
├── .env                   # Environment variables
└── DOCUMENTATION.md       # Full documentation
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [DOCUMENTATION.md](DOCUMENTATION.md) | Complete project documentation |

---

## Test Credentials

### Admin Account
- **Email:** `<set ADMIN_EMAIL in .env>`
- **Password:** `<set ADMIN_PASSWORD in .env>`

### User Account
Create your own via the Sign Up screen.

---

## Environment Setup

Create a `.env` file with:

```env
# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# Alibaba Cloud Qwen AI
EXPO_PUBLIC_QWEN_API_KEY=your_qwen_api_key
```

---

## Commands

```bash
# Development
npx expo start              # Start dev server
npx expo start -c           # Clear cache and start
npx tsc --noEmit           # TypeScript check
npx expo-doctor            # Expo diagnostics

# Firebase
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Build
npx expo export:web        # Build for web
```

---

## Status

- **Version:** 1.0.0
- **Status:** Active Development
- **Platform:** iOS, Android, Web

---

## License

Private - All rights reserved. © 2026 LasangPinoy.
