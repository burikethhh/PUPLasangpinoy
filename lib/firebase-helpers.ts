// Firebase Helpers - Error handling and retry logic for ad blocker resilience
import { Platform } from 'react-native';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Check if error is due to network/ad blocker
export function isBlockedError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code?.toLowerCase() || '';
  
  return (
    errorMessage.includes('blocked') ||
    errorMessage.includes('network') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('err_blocked_by_client') ||
    errorCode.includes('unavailable') ||
    errorCode.includes('network')
  );
}

// Wrapper for Firebase operations with retry logic
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'Firebase operation'
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Log the error
      console.warn(`${operationName} attempt ${attempt}/${MAX_RETRIES} failed:`, error?.message || error);
      
      // If it's the last attempt, throw
      if (attempt === MAX_RETRIES) {
        break;
      }
      
      // If it's a blocked error, wait and retry
      if (isBlockedError(error)) {
        console.log(`Retrying ${operationName} in ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY * attempt); // Exponential backoff
      } else {
        // For other errors, throw immediately
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Check Firebase connectivity
export async function checkFirebaseConnectivity(): Promise<{
  connected: boolean;
  error?: string;
  suggestion?: string;
}> {
  try {
    // Try to make a simple request to Firebase
    const response = await fetch('https://firestore.googleapis.com/', {
      method: 'HEAD',
      mode: 'no-cors', // This helps bypass some CORS issues
    });
    
    return { connected: true };
  } catch (error: any) {
    const isBlocked = isBlockedError(error);
    
    return {
      connected: false,
      error: error?.message || 'Unknown error',
      suggestion: isBlocked
        ? 'Ad blocker detected. Please disable your ad blocker for this site or use the mobile app.'
        : 'Network error. Please check your internet connection.',
    };
  }
}

// Map raw Firestore/Auth errors to user-friendly messages.
// Permission errors almost always mean one of:
//  1. The Firestore security rules in the Firebase console are outdated
//     (run: firebase deploy --only firestore:rules), or
//  2. The user's auth session expired and they need to log back in.
export function friendlyFirestoreError(error: any, fallback?: string): string {
  const raw = error?.message || fallback || "Something went wrong. Please try again.";
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  if (
    msg.includes("missing or insufficient permissions") ||
    msg.includes("permission-denied") ||
    msg.includes("permission denied") ||
    code.includes("permission-denied") ||
    error?.status === 403
  ) {
    return "Permission denied by the database. Please log out and log back in. If this keeps happening, the Firestore rules need to be deployed from the project folder (firebase deploy --only firestore:rules).";
  }
  return raw;
}

// Platform-specific Firebase initialization hints
export function getFirebaseHints(): string[] {
  const hints: string[] = [];
  
  if (Platform.OS === 'web') {
    hints.push('If you see "Database not found" errors, try:');
    hints.push('1. Disable ad blockers for localhost');
    hints.push('2. Use Chrome/Firefox without privacy extensions');
    hints.push('3. Or test on mobile with Expo Go (recommended)');
  }
  
  return hints;
}

// Safe wrapper for Firestore operations
export async function safeFirestoreOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  operationName: string = 'Firestore operation'
): Promise<T> {
  try {
    return await withRetry(operation, operationName);
  } catch (error: any) {
    console.error(`${operationName} failed after retries:`, error);
    
    // Return fallback value instead of crashing
    return fallback;
  }
}
