#!/usr/bin/env node
/**
 * LasangPinoy — Cloudinary Setup Script
 * ──────────────────────────────────────
 * Creates an unsigned upload preset via the Cloudinary Admin API,
 * then prints the .env variables to add.
 *
 * Usage:
 *   node scripts/setup-cloudinary.js <CLOUD_NAME> <API_KEY> <API_SECRET>
 *
 * Find your credentials in the Cloudinary Console:
 *   Cloud Name  →  top-left corner of the Dashboard
 *   API Key     →  Settings → API Keys
 *   API Secret  →  Settings → API Keys (click "reveal")
 *
 * Requires Node 18+ (built-in fetch). Run: node --version to confirm.
 */

const [, , CLOUD_NAME, API_KEY, API_SECRET] = process.argv;

// ── Validate args ─────────────────────────────────────────────────────────────
if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error(`
  ❌  Missing arguments.

  Usage:
    node scripts/setup-cloudinary.js CLOUD_NAME API_KEY API_SECRET

  Where to find these in your Cloudinary Console:
    Cloud Name  →  top-left of the Dashboard
    API Key     →  Settings → API Keys
    API Secret  →  Settings → API Keys → click Reveal

  Example:
    node scripts/setup-cloudinary.js dq8abc123 123456789012345 AbCdEfGhIjKlMnOpQrSt
`);
  process.exit(1);
}

const PRESET_NAME = 'lasangpinoy_unsigned';
const FOLDER      = 'lasangpinoy/recipes';

// ── Create upload preset ──────────────────────────────────────────────────────
async function createUploadPreset() {
  const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

  const body = new URLSearchParams({
    name:            PRESET_NAME,
    unsigned:        'true',
    asset_folder:    FOLDER,
    overwrite:       'true',
    unique_filename: 'true',
    use_filename:    'false',
  });

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload_presets`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    if (data.error?.message?.toLowerCase().includes('already exists')) {
      console.log(`  ℹ️  Preset "${PRESET_NAME}" already exists — no changes made.`);
      return;
    }
    throw new Error(data.error?.message || JSON.stringify(data));
  }

  console.log(`  ✅  Preset created:`);
  console.log(`      Name:     ${data.name}`);
  console.log(`      Unsigned: ${data.unsigned}`);
  console.log(`      Folder:   ${data.asset_folder || FOLDER}`);
}

// ── Verify credentials ────────────────────────────────────────────────────────
async function verifyCredentials() {
  const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/usage`,
    { headers: { Authorization: `Basic ${auth}` } },
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      `Could not verify credentials (HTTP ${res.status}). ` +
      (data.error?.message || 'Check your Cloud Name, API Key and API Secret.'),
    );
  }

  const usage = await res.json();
  const storageMB = ((usage.storage?.usage ?? 0) / 1024 / 1024).toFixed(1);
  const limitGB   = ((usage.storage?.limit  ?? 0) / 1024 / 1024 / 1024).toFixed(0);

  console.log(`  ✅  Credentials verified`);
  console.log(`      Plan:    ${usage.plan ?? 'Free'}`);
  console.log(`      Storage: ${storageMB} MB used / ${limitGB} GB free-tier limit`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌤   Cloudinary Setup — LasangPinoy');
  console.log('─────────────────────────────────────────');
  console.log(`  Cloud Name : ${CLOUD_NAME}`);
  console.log(`  API Key    : ${API_KEY}`);
  console.log(`  API Secret : ${'*'.repeat(Math.max(0, API_SECRET.length - 4))}${API_SECRET.slice(-4)}`);
  console.log('─────────────────────────────────────────\n');

  try {
    process.stdout.write('  Verifying credentials ...\n');
    await verifyCredentials();

    process.stdout.write('\n  Creating upload preset ...\n');
    await createUploadPreset();

    console.log('\n─────────────────────────────────────────');
    console.log('✅  Setup complete!\n');
    console.log('Add these two lines to your .env file:\n');
    console.log(`  EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=${CLOUD_NAME}`);
    console.log(`  EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=${PRESET_NAME}`);
    console.log('\nThen restart the dev server:');
    console.log('  npx expo start -c\n');
    console.log('─────────────────────────────────────────\n');

  } catch (err) {
    console.error('\n❌  Setup failed:', err.message, '\n');
    process.exit(1);
  }
}

main();
