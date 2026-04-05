// Global Jest setup for LasangPinoy Mobile tests

// ── Environment variables for modules that read them at load time ──────────
process.env.EXPO_PUBLIC_QWEN_API_KEY = "sk-test-api-key-for-jest";

// ── Silence known noisy logs in tests ───────────────────
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "info").mockImplementation(() => {});
jest.spyOn(console, "debug").mockImplementation(() => {});
// Keep console.warn and console.error visible so test failures surface clearly

// ── AsyncStorage mock ────────────────────────────────────
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));

// ── React Native mock ────────────────────────────────────
jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: any) => obj.ios ?? obj.default },
  Alert: {
    alert: jest.fn(),
  },
  Share: {
    share: jest.fn().mockResolvedValue({ action: "sharedAction" }),
  },
  Linking: {
    openURL: jest.fn(),
  },
  StyleSheet: {
    create: (s: any) => s,
    flatten: (s: any) => s,
    hairlineWidth: 1,
  },
  Dimensions: {
    get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
    addEventListener: jest.fn(),
  },
}));

// ── expo-constants mock ──────────────────────────────────
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { eas: { projectId: "test-project-id" } },
    },
    easConfig: { projectId: "test-project-id" },
  },
}));

// ── expo-notifications mock ───────────────────────────────
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "undetermined" }),
  requestPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  getExpoPushTokenAsync: jest
    .fn()
    .mockResolvedValue({ data: "ExponentPushToken[test-token]" }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue("notif-id-1"),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationReceivedListener: jest
    .fn()
    .mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest
    .fn()
    .mockReturnValue({ remove: jest.fn() }),
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: "timeInterval",
    DATE: "date",
  },
}));

// ── Firebase mocks ────────────────────────────────────────
jest.mock("firebase/app", () => ({
  initializeApp: jest.fn().mockReturnValue({ name: "test-app" }),
  getApps: jest.fn().mockReturnValue([]),
  getApp: jest.fn().mockReturnValue({ name: "test-app" }),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn().mockReturnValue({
    currentUser: null,
  }),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({})),
  FacebookAuthProvider: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn().mockReturnValue({ type: "test-db" }),
  collection: jest.fn().mockReturnValue("collection-ref"),
  doc: jest.fn().mockReturnValue("doc-ref"),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  setDoc: jest.fn(),
  query: jest.fn().mockImplementation((...args) => ({ query: args })),
  where: jest.fn().mockImplementation((...args) => ({ where: args })),
  orderBy: jest.fn().mockImplementation((...args) => ({ orderBy: args })),
  Timestamp: {
    now: jest
      .fn()
      .mockReturnValue({ seconds: 1711929600, nanoseconds: 0 }),
    fromDate: jest.fn().mockImplementation((d) => ({
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
  arrayUnion: jest.fn().mockImplementation((val) => ({
    _methodName: "arrayUnion",
    _elements: [val],
  })),
  arrayRemove: jest.fn().mockImplementation((val) => ({
    _methodName: "arrayRemove",
    _elements: [val],
  })),
}));
