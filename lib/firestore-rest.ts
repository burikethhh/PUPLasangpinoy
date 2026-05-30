// Firestore REST API Client - Fallback for when SDK is blocked by ad blockers
// This uses the Firestore REST API which can bypass some ad blocker rules

import { getAuth } from 'firebase/auth';
import { Platform } from 'react-native';

// Firebase configuration
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'lasangpinoy-mobile';
const FIRESTORE_DATABASE_ID = process.env.EXPO_PUBLIC_FIREBASE_DATABASE_ID || 'default';
const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';

// REST API base URL - database id is configurable via EXPO_PUBLIC_FIREBASE_DATABASE_ID
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;

// Types for Firestore REST API responses
interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields: Record<string, FirestoreValue> };
  arrayValue?: { values: FirestoreValue[] };
}

interface FirestoreDocument {
  name: string;
  fields: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

interface FirestoreListResponse {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

// Convert Firestore value to JS value
function fromFirestoreValue(value: FirestoreValue): any {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return { seconds: Math.floor(new Date(value.timestampValue).getTime() / 1000) };
  if (value.nullValue !== undefined) return null;
  if (value.mapValue !== undefined) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields)) {
      result[k] = fromFirestoreValue(v);
    }
    return result;
  }
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  return null;
}

// Convert JS value to Firestore value
function toFirestoreValue(value: any): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: value.toString() };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value?.seconds !== undefined) {
    // Firestore Timestamp-like object
    return { timestampValue: new Date(value.seconds * 1000).toISOString() };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k !== 'id') { // Skip the 'id' field as it's stored in document path
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

// Convert Firestore document to plain object
function documentToObject(doc: FirestoreDocument): Record<string, any> {
  const id = doc.name.split('/').pop() || '';
  const data: Record<string, any> = { id };
  
  if (doc.fields) {
    for (const [key, value] of Object.entries(doc.fields)) {
      data[key] = fromFirestoreValue(value);
    }
  }
  
  return data;
}

// Get auth token from current Firebase Auth session
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export async function setAuthToken(token: string | null) {
  cachedToken = token;
  tokenExpiry = token ? Date.now() + 3600000 : 0; // 1 hour expiry
  console.log('[REST] Auth token', token ? 'set' : 'cleared');
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (cachedToken && Date.now() < tokenExpiry) {
    headers['Authorization'] = `Bearer ${cachedToken}`;
    return headers;
  }

  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const freshToken = await user.getIdToken(true);
      cachedToken = freshToken;
      tokenExpiry = Date.now() + 50 * 60 * 1000; // refresh window < 1h
      headers['Authorization'] = `Bearer ${freshToken}`;
      return headers;
    }
  } catch (refreshError) {
    console.warn('[REST] Token refresh failed', refreshError);
  }

  if (cachedToken && Date.now() >= tokenExpiry) {
    console.warn('[REST] Auth token expired, making unauthenticated request');
  } else if (!cachedToken) {
    console.warn('[REST] No auth token available, making unauthenticated request');
  }

  return headers;
}

// Fetch with timeout and error handling
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// ==================== REST API OPERATIONS ====================

// Get a single document
export async function getDocument(collection: string, docId: string): Promise<Record<string, any> | null> {
  const url = `${FIRESTORE_BASE_URL}/${collection}/${docId}?key=${API_KEY}`;
  
  try {
    const headers = await getAuthHeaders();
    console.log('[REST] getDocument request:', { collection, docId, hasAuth: !!headers['Authorization'] });
    
    const response = await fetchWithTimeout(url, { method: 'GET', headers });
    
    if (response.status === 404) {
      console.log('[REST] getDocument: document not found');
      return null;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[REST] getDocument error:', response.status, errorText);
      let errorMessage = 'Failed to get document';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const doc = await response.json() as FirestoreDocument;
    return documentToObject(doc);
  } catch (error: any) {
    console.error('[REST] getDocument failed:', error.message);
    throw error;
  }
}

// Get all documents in a collection
export async function getCollection(collection: string, orderByField?: string): Promise<Record<string, any>[]> {
  let url = `${FIRESTORE_BASE_URL}/${collection}?key=${API_KEY}`;
  
  if (orderByField) {
    // Add server-side ordering where supported
    url += `&orderBy=${orderByField}`;
  }
  
  try {
    const headers = await getAuthHeaders();
    console.log('[REST] getCollection request:', { collection, url, hasAuth: !!headers['Authorization'] });
    
    const response = await fetchWithTimeout(url, { method: 'GET', headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[REST] getCollection error:', response.status, errorText);
      let errorMessage = 'Failed to get collection';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json() as FirestoreListResponse;
    console.log('[REST] getCollection response:', { documentsCount: data.documents?.length || 0 });
    const documents = (data.documents || []).map(documentToObject);
    
    // Client-side sorting if orderByField specified
    if (orderByField) {
      documents.sort((a, b) => {
        const aVal = a[orderByField];
        const bVal = b[orderByField];
        if (aVal?.seconds && bVal?.seconds) {
          return bVal.seconds - aVal.seconds; // Descending for timestamps
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal);
        }
        return 0;
      });
    }
    
    return documents;
  } catch (error: any) {
    console.error('[REST] getCollection failed:', error.message);
    throw error;
  }
}

// Query documents with a simple filter
export async function queryCollection(
  collection: string, 
  field: string, 
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=',
  value: any
): Promise<Record<string, any>[]> {
  // For simple queries, we'll use structured query via POST
  const url = `${FIRESTORE_BASE_URL}:runQuery?key=${API_KEY}`;
  
  // Map operator to Firestore REST API format
  const opMap: Record<string, string> = {
    '==': 'EQUAL',
    '!=': 'NOT_EQUAL',
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN',
    '>=': 'GREATER_THAN_OR_EQUAL',
  };
  
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: opMap[operator],
          value: toFirestoreValue(value),
        },
      },
    },
  };
  
  try {
    const headers = await getAuthHeaders();
    console.log('[REST] queryCollection request:', { collection, field, operator, value, hasAuth: !!headers['Authorization'] });
    
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[REST] queryCollection error response:', response.status, errorText);
      let errorMessage = 'Failed to query collection';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        // Not JSON, use text
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const results = await response.json() as Array<{ document?: FirestoreDocument }>;
    console.log('[REST] queryCollection results:', results.length, 'documents');
    return results
      .filter(r => r.document)
      .map(r => documentToObject(r.document!));
  } catch (error: any) {
    console.error('[REST] queryCollection failed:', error.message);
    throw error;
  }
}

// Create a document with auto-generated ID
export async function createDocument(collection: string, data: Record<string, any>): Promise<string> {
  const url = `${FIRESTORE_BASE_URL}/${collection}?key=${API_KEY}`;
  
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id') {
      fields[key] = toFirestoreValue(value);
    }
  }
  
  const body = { fields };
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[REST] createDocument error:', error);
      throw new Error(error.error?.message || 'Failed to create document');
    }
    
    const doc = await response.json() as FirestoreDocument;
    return doc.name.split('/').pop() || '';
  } catch (error: any) {
    console.error('[REST] createDocument failed:', error.message);
    throw error;
  }
}

// Set/update a document with specific ID
export async function setDocument(collection: string, docId: string, data: Record<string, any>, merge = false): Promise<void> {
  const url = `${FIRESTORE_BASE_URL}/${collection}/${docId}?key=${API_KEY}`;
  
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id') {
      fields[key] = toFirestoreValue(value);
    }
  }
  
  const body = { fields };
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[REST] setDocument error:', error);
      throw new Error(error.error?.message || 'Failed to set document');
    }
  } catch (error: any) {
    console.error('[REST] setDocument failed:', error.message);
    throw error;
  }
}

// Update specific fields of a document
export async function updateDocument(collection: string, docId: string, data: Record<string, any>): Promise<void> {
  // Build updateMask for partial updates
  const fieldPaths = Object.keys(data).filter(k => k !== 'id');
  const updateMask = fieldPaths.map(f => `updateMask.fieldPaths=${f}`).join('&');
  const url = `${FIRESTORE_BASE_URL}/${collection}/${docId}?key=${API_KEY}&${updateMask}`;
  
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id') {
      fields[key] = toFirestoreValue(value);
    }
  }
  
  const body = { fields };
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[REST] updateDocument error:', error);
      throw new Error(error.error?.message || 'Failed to update document');
    }
  } catch (error: any) {
    console.error('[REST] updateDocument failed:', error.message);
    throw error;
  }
}

// Delete a document
export async function deleteDocument(collection: string, docId: string): Promise<void> {
  const url = `${FIRESTORE_BASE_URL}/${collection}/${docId}?key=${API_KEY}`;
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      console.error('[REST] deleteDocument error:', error);
      throw new Error(error.error?.message || 'Failed to delete document');
    }
  } catch (error: any) {
    console.error('[REST] deleteDocument failed:', error.message);
    throw error;
  }
}

// ==================== CONNECTIVITY TEST ====================

export async function testRestConnectivity(): Promise<boolean> {
  try {
    // Try to list a collection (even if empty, should return 200)
    const url = `${FIRESTORE_BASE_URL}/profiles?key=${API_KEY}&pageSize=1`;
    const response = await fetchWithTimeout(url, { method: 'GET' }, 5000);
    return response.ok || response.status === 404;
  } catch (error) {
    console.error('[REST] Connectivity test failed:', error);
    return false;
  }
}

// Check if we should use REST API (web platform with blocked SDK)
export function shouldUseRestApi(): boolean {
  return Platform.OS === 'web';
}
