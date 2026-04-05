// ─────────────────────────────────────────────────────────────
//  Cloudinary Image Upload — LasangPinoy
//  Free tier: 25 GB storage · 25 GB bandwidth/mo · No credit card
//
//  ONE-TIME CLOUDINARY SETUP:
//  1. Create free account at https://cloudinary.com
//  2. Copy your Cloud Name from the dashboard (top-left)
//  3. Settings → Upload → Upload Presets → Add upload preset
//       · Signing mode: Unsigned
//       · Folder: lasangpinoy/recipes
//       · Save → copy the preset name
//  4. Add to .env:
//       EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
//       EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=lasangpinoy_unsigned
//
//  HOW IT INTEGRATES WITH FIRESTORE:
//  · Firestore schema does NOT change at all.
//  · The `image_url` field in the `recipes` collection just stores
//    the Cloudinary CDN URL instead of a Firebase Storage URL.
//  · Example stored value:
//    "https://res.cloudinary.com/yourcloud/image/upload/f_auto,q_auto/
//     lasangpinoy/recipes/recipe_1714000000.jpg"
// ─────────────────────────────────────────────────────────────

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export interface CloudinaryUploadResult {
  secure_url: string; // HTTPS CDN URL — this is what gets stored in Firestore
  public_id: string; // Cloudinary asset ID (useful for deletion later)
  width: number;
  height: number;
  format: string;
  bytes: number;
}

/**
 * Upload a local image URI to Cloudinary via unsigned preset.
 * Returns the optimised CDN URL ready to store as `image_url` in Firestore.
 *
 * @param localUri  file:// URI from expo-image-picker
 * @param folder    Cloudinary sub-folder (default: lasangpinoy/recipes)
 */
export async function uploadToCloudinary(
  localUri: string,
  folder = "lasangpinoy/recipes",
): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary is not configured. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME " +
        "and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET to your .env file.",
    );
  }

  // Derive MIME type from file extension
  const ext = localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "gif"
        ? "image/gif"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

  // Build multipart/form-data body — no SDK needed, plain fetch works perfectly
  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    type: mimeType,
    name: `recipe_${Date.now()}.${ext}`,
  } as any);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  // 30-second hard timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData, signal: controller.signal },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Cloudinary] Upload failed:", errorBody);
      throw new Error(
        `Cloudinary upload failed (${response.status}): ${errorBody}`,
      );
    }

    const data: CloudinaryUploadResult = await response.json();

    console.log(
      `[Cloudinary] ✅ Uploaded: ${data.public_id} ` +
        `(${data.width}×${data.height}, ${Math.round(data.bytes / 1024)} KB)`,
    );

    // Append f_auto,q_auto — auto best format (WebP/AVIF) + intelligent compression.
    // Images load 30-70% faster with no visible quality loss.
    return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(
        "Cloudinary upload timed out. Check your connection and try again.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Returns true if the Cloudinary env vars are present. */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}
