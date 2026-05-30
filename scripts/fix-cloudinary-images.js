#!/usr/bin/env node
/**
 * LasangPinoy — Fix Cloudinary Images
 * ─────────────────────────────────────────────────────────────────────────────
 * Wikimedia blocks server-side hotlinking (e.g. Cloudinary's fetch-by-URL),
 * so this script:
 *   1. Downloads each image locally as a buffer (with a proper User-Agent)
 *   2. Uploads the raw binary to Cloudinary via multipart/form-data
 *   3. PATCHes the Firestore document with the new optimised CDN URL
 *
 * Requires Node 18+ (native fetch, FormData, Blob).
 */

// ── Credentials ───────────────────────────────────────────────────────────────
const CLOUD_NAME = "dafcyj6fh";
const UPLOAD_PRESET = "lasangpinoy_unsigned";
const FIREBASE_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "";
const FIRESTORE_URL =
  "https://firestore.googleapis.com/v1/projects/lasangpinoy-mobile/databases/default/documents";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "";

// ── Wikimedia User-Agent (required by their API policy) ───────────────────────
const WIKIMEDIA_UA =
  "LasangPinoyApp/1.0 (educational project; contact@lasangpinoy.com)";

// ── Recipes whose images need fixing ──────────────────────────────────────────
const RECIPES = [
  {
    id: "pinakbet",
    url: "https://upload.wikimedia.org/wikipedia/commons/6/61/Pinakbet.jpg",
  },
  {
    id: "pancit-palabok",
    url: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Pancit_Palabok.jpg",
  },
  {
    id: "leche-flan",
    url: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Leche_flan_%28Philippines%29_01.jpg",
  },
  {
    id: "bibingka",
    url: "https://upload.wikimedia.org/wikipedia/commons/8/83/Bibingka_%28Philippines%29.jpg",
  },
  {
    id: "kinilaw",
    url: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Kinilaw_%28Philippine_Ceviche%29.jpg",
  },
  {
    id: "tinolang-manok",
    url: "https://upload.wikimedia.org/wikipedia/commons/6/62/Chicken_tinola.jpg",
  },
  {
    id: "ginataang-langka",
    url: "https://upload.wikimedia.org/wikipedia/commons/b/bf/Ginataang_langka_%28Philippines%29_01.jpg",
  },
];

// ── Step 1: Download image from Wikimedia → Buffer ────────────────────────────
async function downloadImage(url) {
  console.log(`    ↓  Downloading: ${url}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": WIKIMEDIA_UA,
      // Mimic a real browser request so Wikimedia is happy
      Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://en.wikipedia.org/",
    },
  });

  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText} while downloading ${url}`,
    );
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(
    `    ✔  Downloaded ${(buffer.length / 1024).toFixed(1)} KB  (${contentType})`,
  );
  return { buffer, contentType };
}

// ── Step 2: Upload buffer to Cloudinary via multipart/form-data ───────────────
async function uploadToCloudinary(buffer, contentType, publicId) {
  console.log(`    ↑  Uploading to Cloudinary as public_id="${publicId}" …`);

  // Derive a sane filename + extension from the contentType
  const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
  const filename = `${publicId}.${ext}`;

  // Node 18+ has native FormData and Blob
  const blob = new Blob([buffer], { type: contentType });
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", "lasangpinoy/recipes");
  form.append("public_id", publicId);
  // Overwrite any previous upload with the same public_id

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Cloudinary upload failed: ${data.error?.message || JSON.stringify(data)}`,
    );
  }

  // Apply automatic format, quality and width optimisations
  const optimisedUrl = data.secure_url.replace(
    "/upload/",
    "/upload/f_auto,q_auto,w_800/",
  );
  console.log(`    ✔  Cloudinary URL: ${optimisedUrl}`);
  return optimisedUrl;
}

// ── Step 3: Get Firebase ID token ─────────────────────────────────────────────
async function getFirebaseToken() {
  console.log("\n🔑  Signing in to Firebase …");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASS,
        returnSecureToken: true,
      }),
    },
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Firebase auth failed: ${data.error?.message || JSON.stringify(data)}`,
    );
  }

  console.log("    ✔  Authenticated\n");
  return data.idToken;
}

// ── Step 4: PATCH only the image_url field in Firestore ───────────────────────
async function patchImageUrl(recipeId, imageUrl, idToken) {
  console.log(`    📝  Patching Firestore document "recipes/${recipeId}" …`);

  // Using ?updateMask.fieldPaths=image_url ensures ONLY this field is written
  const endpoint =
    `${FIRESTORE_URL}/recipes/${recipeId}` + `?updateMask.fieldPaths=image_url`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fields: {
        image_url: { stringValue: imageUrl },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore PATCH failed for "${recipeId}": ${errText}`);
  }

  console.log(`    ✔  Firestore updated`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   LasangPinoy — Fix Cloudinary Images (binary upload)   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  Cloud Name    : ${CLOUD_NAME}`);
  console.log(`  Upload Preset : ${UPLOAD_PRESET}`);
  console.log(`  Recipes to fix: ${RECIPES.length}\n`);
  console.log("──────────────────────────────────────────────────────────\n");

  // Authenticate once; token lasts ~1 hour which is plenty for 7 recipes
  const idToken = await getFirebaseToken();

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const recipe of RECIPES) {
    console.log(
      `\n[${RECIPES.indexOf(recipe) + 1}/${RECIPES.length}]  📸  ${recipe.id}`,
    );
    console.log("─────────────────────────────────────────");

    try {
      // 1. Download image locally
      const { buffer, contentType } = await downloadImage(recipe.url);

      // 2. Upload binary to Cloudinary
      const cloudinaryUrl = await uploadToCloudinary(
        buffer,
        contentType,
        recipe.id,
      );

      // 3. Update Firestore
      await patchImageUrl(recipe.id, cloudinaryUrl, idToken);

      results.push({ id: recipe.id, status: "✅ SUCCESS", url: cloudinaryUrl });
      successCount++;
    } catch (err) {
      console.error(`    ❌  FAILED: ${err.message}`);
      results.push({
        id: recipe.id,
        status: "❌ FAILED",
        error: err.message,
        url: null,
      });
      failCount++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(
    "\n\n╔══════════════════════════════════════════════════════════╗",
  );
  console.log("║                        SUMMARY                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  ✅  Succeeded : ${successCount}`);
  console.log(`  ❌  Failed    : ${failCount}`);
  console.log("\n──────────────────────────────────────────────────────────");

  for (const r of results) {
    console.log(`\n  ${r.status}  →  ${r.id}`);
    if (r.url) {
      console.log(`             URL: ${r.url}`);
    } else {
      console.log(`           Error: ${r.error}`);
    }
  }

  console.log("\n──────────────────────────────────────────────────────────\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n💥  Unhandled error:", err.message);
  process.exit(1);
});
