// Push Notification Service for LasangPinoy Mobile
// Uses expo-notifications for local and push notifications

import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { createLogger } from "./logger";

const log = createLogger("Notifications");

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushTokenResult {
  token: string | null;
  error: string | null;
}

/**
 * Request permission and return the Expo push token.
 * Returns null token if permission is denied or device is a simulator.
 */
export async function registerForPushNotificationsAsync(): Promise<PushTokenResult> {
  if (Platform.OS === "web") {
    return { token: null, error: "Push notifications are not supported on web." };
  }

  // Check existing permissions first
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return { token: null, error: "Push notification permission denied." };
  }

  // Get the Expo push token
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    log.info("Push token obtained:", tokenData.data);
    return { token: tokenData.data, error: null };
  } catch (error: any) {
    log.error("Failed to get push token", error);
    return { token: null, error: error.message || "Failed to get push token." };
  }
}

/**
 * Schedule a local notification immediately.
 * Useful for in-app events like recipe approval.
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  if (Platform.OS === "web") return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data || {}, sound: true },
    trigger: null, // fire immediately
  });
}

/**
 * Schedule a local notification after a delay (seconds).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  delaySeconds: number,
  data?: Record<string, any>,
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data || {} },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds },
  });
  return id;
}

/**
 * Cancel all scheduled local notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Add a listener for notifications received while app is foregrounded.
 * Returns the subscription — call .remove() to clean up.
 */
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Add a listener for when a user taps a notification.
 * Returns the subscription — call .remove() to clean up.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Notify the user that their recipe submission was approved.
 */
export async function notifyRecipeApproved(recipeTitle: string): Promise<void> {
  await sendLocalNotification(
    "Recipe Approved! 🎉",
    `Your recipe "${recipeTitle}" has been approved and is now live!`,
    { screen: "/(tabs)" },
  );
}

/**
 * Notify the user that their recipe submission was rejected.
 */
export async function notifyRecipeRejected(
  recipeTitle: string,
  reason?: string,
): Promise<void> {
  await sendLocalNotification(
    "Recipe Update",
    reason
      ? `Your recipe "${recipeTitle}" was not approved: ${reason}`
      : `Your recipe "${recipeTitle}" was not approved at this time.`,
    { screen: "/(tabs)/submit" },
  );
}

/**
 * Notify about a new recipe added (for all users — local only).
 */
export async function notifyNewRecipe(recipeTitle: string): Promise<void> {
  await sendLocalNotification(
    "New Recipe Added! 🍽️",
    `Check out the new recipe: ${recipeTitle}`,
    { screen: "/(tabs)" },
  );
}

/**
 * Notify customer that delivery has started — invite them to track live.
 */
export async function notifyDeliveryStarted(orderNumber: string): Promise<void> {
  await sendLocalNotification(
    "Your order is on the way! 🛵",
    `Order ${orderNumber} has been picked up. Tap to track live delivery.`,
    { screen: "/(tabs)/collections" },
  );
}

/**
 * Notify both parties that live tracking is now active.
 */
export async function notifyBothOptedIn(): Promise<void> {
  await sendLocalNotification(
    "Live tracking is active 📍",
    "You can now see real-time delivery location on the map.",
    {},
  );
}
