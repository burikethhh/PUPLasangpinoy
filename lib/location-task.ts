// Background Location Task for FOODFIX Live Delivery Tracking
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getCurrentUser } from "./firebase";
import { upsertLocation } from "./firebase-store";
import { createLogger } from "./logger";

const log = createLogger("LocationTask");

export const LOCATION_TASK = "FOODFIX_DELIVERY_LOCATION";

// Active order ID passed to background task
let _activeOrderId: string | null = null;

// Define the background task (must be called at module top-level, before app mounts)
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    log.error("Background location error:", error.message);
    return;
  }
  if (!data || !_activeOrderId) return;

  const { locations } = data;
  if (!locations || locations.length === 0) return;

  const { latitude: lat, longitude: lng, accuracy, heading, speed } = locations[0].coords;
  const user = getCurrentUser();
  if (!user) return;

  try {
    await upsertLocation(_activeOrderId, user.uid, "staff", {
      lat,
      lng,
      accuracy: accuracy ?? undefined,
      heading: heading ?? undefined,
      speed: speed != null ? Math.round(speed * 3.6) : undefined,
    });
    log.debug(`Location updated: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  } catch (e: any) {
    log.warn("Failed to write location:", e.message);
  }
});

/**
 * Start background GPS tracking for an active delivery order.
 * Requires background location permission.
 */
export async function startDeliveryTracking(orderId: string): Promise<boolean> {
  try {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== "granted") {
      log.warn("Foreground location permission denied.");
      return false;
    }
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== "granted") {
      log.warn("Background location permission denied.");
      return false;
    }

    _activeOrderId = orderId;

    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,     // every 5 seconds for real-time tracking
      distanceInterval: 5,    // or every 5 meters
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "FOODFIX Delivery",
        notificationBody: "Tracking your delivery location...",
        notificationColor: "#F25C05",
      },
    });

    log.info(`Delivery tracking started for order ${orderId}`);
    return true;
  } catch (e: any) {
    log.error("startDeliveryTracking failed:", e.message);
    return false;
  }
}

/**
 * Stop background GPS tracking.
 */
export async function stopDeliveryTracking(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      log.info("Delivery tracking stopped.");
    }
  } catch (e: any) {
    log.warn("stopDeliveryTracking error:", e.message);
  }
  _activeOrderId = null;
}

/**
 * Check whether background tracking is currently active.
 */
export async function isTrackingActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}
