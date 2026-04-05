/**
 * Tests for lib/notifications.ts
 *
 * Strategy:
 *  - expo-notifications is mocked in jest.setup.ts (global)
 *  - Platform.OS is controlled per-test using jest.doMock + isolateModules
 *  - The global mock defaults to: getPermissionsAsync → "undetermined",
 *    requestPermissionsAsync → "granted", getExpoPushTokenAsync → "ExponentPushToken[test-token]"
 */

import * as Notifications from "expo-notifications";
import {
    addNotificationReceivedListener,
    addNotificationResponseListener,
    cancelAllNotifications,
    notifyRecipeApproved,
    notifyRecipeRejected,
    registerForPushNotificationsAsync,
    scheduleLocalNotification,
    sendLocalNotification,
} from "../../lib/notifications";

// react-native Platform mock is already set to { OS: "ios" } in jest.setup.ts

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to default happy-path mock values
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
    status: "undetermined",
  });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
    status: "granted",
  });
  (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
    data: "ExponentPushToken[test-token]",
  });
});

// ────────────────────────────────────────────────────────────
// registerForPushNotificationsAsync
// ────────────────────────────────────────────────────────────

describe("registerForPushNotificationsAsync", () => {
  it("returns null token on web platform", async () => {
    const { Platform } = require("react-native");
    const savedOS = Platform.OS;
    Platform.OS = "web";
    try {
      const result = await registerForPushNotificationsAsync();
      expect(result.token).toBeNull();
      expect(result.error).toMatch(/web/i);
    } finally {
      Platform.OS = savedOS;
    }
  });

  it("requests permission when existing status is 'undetermined'", async () => {
    await registerForPushNotificationsAsync();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("skips requestPermissionsAsync when permission is already granted", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: "granted",
    });
    await registerForPushNotificationsAsync();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("returns null token when permission is denied", async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: "denied",
    });
    const result = await registerForPushNotificationsAsync();
    expect(result.token).toBeNull();
    expect(result.error).toMatch(/denied/i);
  });

  it("returns push token on successful grant", async () => {
    const result = await registerForPushNotificationsAsync();
    expect(result.token).toBe("ExponentPushToken[test-token]");
    expect(result.error).toBeNull();
  });

  it("passes projectId from expo-constants to getExpoPushTokenAsync", async () => {
    await registerForPushNotificationsAsync();
    const callArg = (Notifications.getExpoPushTokenAsync as jest.Mock).mock
      .calls[0][0];
    expect(callArg?.projectId).toBe("test-project-id");
  });

  it("returns null token when getExpoPushTokenAsync throws", async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(
      new Error("Simulator does not support push tokens."),
    );
    const result = await registerForPushNotificationsAsync();
    expect(result.token).toBeNull();
    expect(result.error).toMatch(/Simulator/i);
  });
});

// ────────────────────────────────────────────────────────────
// sendLocalNotification
// ────────────────────────────────────────────────────────────

describe("sendLocalNotification", () => {
  it("calls scheduleNotificationAsync with correct title and body", async () => {
    await sendLocalNotification("My Title", "My Body");

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: "My Title",
          body: "My Body",
        }),
        trigger: null, // fires immediately
      }),
    );
  });

  it("forwards optional data payload", async () => {
    await sendLocalNotification("T", "B", { screen: "home" });

    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(call.content.data).toEqual({ screen: "home" });
  });

  it("does nothing on web platform", async () => {
    const { Platform } = require("react-native");
    const savedOS = Platform.OS;
    Platform.OS = "web";
    try {
      await sendLocalNotification("T", "B");
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    } finally {
      Platform.OS = savedOS;
    }
  });
});

// ────────────────────────────────────────────────────────────
// scheduleLocalNotification
// ────────────────────────────────────────────────────────────

describe("scheduleLocalNotification", () => {
  it("schedules with a TIME_INTERVAL trigger and returns an id", async () => {
    const id = await scheduleLocalNotification("Reminder", "Cook now!", 60);
    expect(id).toBe("notif-id-1");
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(call.trigger.seconds).toBe(60);
  });
});

// ────────────────────────────────────────────────────────────
// cancelAllNotifications
// ────────────────────────────────────────────────────────────

describe("cancelAllNotifications", () => {
  it("calls cancelAllScheduledNotificationsAsync", async () => {
    await cancelAllNotifications();
    expect(
      Notifications.cancelAllScheduledNotificationsAsync,
    ).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────
// addNotificationReceivedListener / addNotificationResponseListener
// ────────────────────────────────────────────────────────────

describe("addNotificationReceivedListener", () => {
  it("returns a subscription with .remove()", () => {
    const handler = jest.fn();
    const sub = addNotificationReceivedListener(handler);
    expect(sub).toHaveProperty("remove");
  });
});

describe("addNotificationResponseListener", () => {
  it("returns a subscription with .remove()", () => {
    const handler = jest.fn();
    const sub = addNotificationResponseListener(handler);
    expect(sub).toHaveProperty("remove");
  });
});

// ────────────────────────────────────────────────────────────
// notifyRecipeApproved
// ────────────────────────────────────────────────────────────

describe("notifyRecipeApproved", () => {
  it("fires a notification with 'Recipe Approved' title", async () => {
    await notifyRecipeApproved("Chicken Adobo");
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(call.content.title).toMatch(/Recipe Approved/i);
  });

  it("includes the recipe title in the notification body", async () => {
    await notifyRecipeApproved("Chicken Adobo");
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(call.content.body).toContain("Chicken Adobo");
  });

  it("fires immediately (trigger: null)", async () => {
    await notifyRecipeApproved("Kare-Kare");
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(call.trigger).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// notifyRecipeRejected
// ────────────────────────────────────────────────────────────

describe("notifyRecipeRejected", () => {
  it("includes the rejection reason in the notification body", async () => {
    await notifyRecipeRejected("Sinigang", "Missing instructions");
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(call.content.body).toContain("Missing instructions");
  });

  it("uses a generic message when no reason is provided", async () => {
    await notifyRecipeRejected("Sinigang");
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock
      .calls[0][0];
    expect(call.content.body).not.toContain("undefined");
    expect(call.content.body).toContain("Sinigang");
  });
});
