#!/usr/bin/env node
/**
 * Fix broken Unsplash image URLs in Firestore.
 * Replaces them with working Wikimedia Commons images.
 */

const FIREBASE_KEY = "REDACTED_FIREBASE_API_KEY";
const FIRESTORE_URL =
  "https://firestore.googleapis.com/v1/projects/lasangpinoy-mobile/databases/default/documents";

// Mapping: recipe document ID → new working image URL (Wikimedia Commons via Wikipedia API)
const IMAGE_FIXES = {
  adobo:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Adobo_DSCF4391.jpg/800px-Adobo_DSCF4391.jpg",
  sinigang:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/The_Best_Sinigang_Cuisine.jpg/800px-The_Best_Sinigang_Cuisine.jpg",
  "kare-kare":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Mac_MG_5939.jpg/800px-Mac_MG_5939.jpg",
  "lechon-kawali":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Lechon_Kawali.jpg/800px-Lechon_Kawali.jpg",
  "bicol-express":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Bicol_Express.jpg/800px-Bicol_Express.jpg",
  "la-paz-batchoy":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Batchoy_of_Iloilo.jpg/800px-Batchoy_of_Iloilo.jpg",
  sisig:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Authentic_Kapampangan_Sisig.jpg/800px-Authentic_Kapampangan_Sisig.jpg",
  "halo-halo":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Halo-Halo.jpg/800px-Halo-Halo.jpg",
};

async function getFirebaseToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "Kethaguacito@gmail.com",
        password: "Totogwapo123",
        returnSecureToken: true,
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Firebase auth failed: ${data.error?.message}`);
  return data.idToken;
}

async function updateImageUrl(recipeId, newUrl, idToken) {
  const res = await fetch(
    `${FIRESTORE_URL}/recipes/${recipeId}?updateMask.fieldPaths=image_url`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          image_url: { stringValue: newUrl },
        },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Update failed for ${recipeId}: ${err}`);
  }
  return true;
}

async function main() {
  console.log("Authenticating...");
  const token = await getFirebaseToken();
  console.log("Authenticated.\n");

  console.log("\nUpdating Firestore documents...");
  let updated = 0;
  let failed = 0;

  for (const [id, url] of Object.entries(IMAGE_FIXES)) {
    try {
      await updateImageUrl(id, url, token);
      console.log(`  ✓ ${id} → updated`);
      updated++;
    } catch (e) {
      console.log(`  ✗ ${id}: ${e.message}`);
      failed++;
    }
    // Small delay to avoid Firestore rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed.`);
}

main().catch(console.error);
