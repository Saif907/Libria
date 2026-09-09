import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine project root and frontend directories
const frontendDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(frontendDir, "..");
const envFile = path.join(frontendDir, ".env");

// Robust .env parser for VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!env[key]) env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const ownerUid = "0495ddf4-f683-4205-9ba9-6375329b0cc4";
const bucketName = "books";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in frontend/.env");
  process.exit(1);
}

console.log("🔗 Connecting to Supabase at:", supabaseUrl);
console.log("👤 Target User UID:", ownerUid);
console.log("📦 Target Bucket:", bucketName);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Normalize filenames to a clean slug ID with aliases for minor name differences
function toBookId(filename) {
  const stem = path.parse(filename).name;
  let normalized = stem
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_");

  // Alias known naming discrepancies
  if (normalized.includes("good_strategy_bad_strategy_by_richard_p_rumelt") || 
      normalized.includes("good_strategy_bad_strategy_by_richard_rumelt")) {
    return "good_strategy_bad_strategy_by_richard_rumelt";
  }
  return normalized;
}

// Load metadata manifests
function loadManifests() {
  const metadataMap = new Map();
  const manifestPaths = [
    path.join(rootDir, "outputs", "book_categories.json"),
    path.join(rootDir, "data", "book_categories.json"),
  ];

  for (const mPath of manifestPaths) {
    if (fs.existsSync(mPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(mPath, "utf-8"));
        for (const [key, meta] of Object.entries(raw)) {
          const id = toBookId(key);
          if (!metadataMap.has(id)) {
            metadataMap.set(id, meta);
          }
        }
      } catch (err) {
        console.warn(`⚠️ Warning: Failed to parse ${mPath}:`, err.message);
      }
    }
  }
  return metadataMap;
}

async function uploadFile(bucket, storagePath, fileBuffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
  }
}

async function main() {
  const metadataMap = loadManifests();
  const dataDir = path.join(rootDir, "data");
  const outputsDir = path.join(rootDir, "outputs");

  const pdfFiles = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith(".pdf"))
    : [];

  const mdFiles = fs.existsSync(outputsDir)
    ? fs.readdirSync(outputsDir).filter((f) => f.toLowerCase().endsWith(".md") && f !== ".md")
    : [];

  const books = new Map();

  for (const pdf of pdfFiles) {
    const id = toBookId(pdf);
    if (!books.has(id)) books.set(id, {});
    books.get(id).pdf = path.join(dataDir, pdf);
    books.get(id).pdfName = pdf;
  }

  for (const md of mdFiles) {
    const id = toBookId(md);
    if (!books.has(id)) books.set(id, {});
    books.get(id).md = path.join(outputsDir, md);
    books.get(id).mdName = md;
  }

  console.log(`\n📚 Discovered ${books.size} unique books.`);

  const catalogItems = [];
  let processed = 0;

  for (const [id, files] of books.entries()) {
    processed++;
    const meta = metadataMap.get(id) || {};
    const bookTitle = meta.title || id.replace(/_/g, " ");
    console.log(`[${processed}/${books.size}] Syncing: "${bookTitle}" (ID: ${id})`);

    const userBookPrefix = `users/${ownerUid}/books/${id}`;
    let pdfSize = 0;
    let mdSize = 0;

    // 1. Upload original.pdf if exists
    if (files.pdf && fs.existsSync(files.pdf)) {
      const pdfBuffer = fs.readFileSync(files.pdf);
      pdfSize = pdfBuffer.length;
      const pdfPath = `${userBookPrefix}/original.pdf`;
      process.stdout.write(`  ⏳ PDF (${(pdfSize / 1024 / 1024).toFixed(2)} MB)... `);
      await uploadFile(bucketName, pdfPath, pdfBuffer, "application/pdf");
      console.log("✅");
    }

    // 2. Upload content.md if exists
    if (files.md && fs.existsSync(files.md)) {
      const mdBuffer = fs.readFileSync(files.md);
      mdSize = mdBuffer.length;
      const mdPath = `${userBookPrefix}/content.md`;
      process.stdout.write(`  ⏳ Markdown (${(mdSize / 1024).toFixed(1)} KB)... `);
      await uploadFile(bucketName, mdPath, mdBuffer, "text/markdown");
      console.log("✅");
    }

    const hasPdf = Boolean(files.pdf);
    const hasMarkdown = Boolean(files.md);
    const status = hasMarkdown ? "ready" : "pending_conversion";

    // 3. Individual metadata.json
    const bookMetadata = {
      id,
      title: meta.title || id.replace(/_/g, " "),
      author: meta.author || "Unknown",
      published_date: meta.published_date || "",
      categories: meta.categories || [],
      description: meta.description || "",
      has_pdf: hasPdf,
      has_markdown: hasMarkdown,
      status,
      pdf_path: hasPdf ? `${userBookPrefix}/original.pdf` : null,
      markdown_path: hasMarkdown ? `${userBookPrefix}/content.md` : null,
      pdf_size_bytes: pdfSize,
      markdown_size_bytes: mdSize,
      updated_at: new Date().toISOString(),
    };

    const metaBuffer = Buffer.from(JSON.stringify(bookMetadata, null, 2), "utf-8");
    const metaPath = `${userBookPrefix}/metadata.json`;
    await uploadFile(bucketName, metaPath, metaBuffer, "application/json");
    console.log(`  ✅ metadata.json updated (Status: ${status})`);

    catalogItems.push(bookMetadata);
  }

  // Sort catalog alphabetically by title
  catalogItems.sort((a, b) => a.title.localeCompare(b.title));

  // 4. Construct and upload master catalog.json
  const catalog = {
    version: "1.0",
    user_id: ownerUid,
    updated_at: new Date().toISOString(),
    total_books: catalogItems.length,
    ready_books: catalogItems.filter((b) => b.status === "ready").length,
    pending_conversion_books: catalogItems.filter((b) => b.status === "pending_conversion").length,
    books: catalogItems,
  };

  console.log(`\n📋 Uploading master catalog.json (${catalog.ready_books} ready, ${catalog.pending_conversion_books} pending)...`);
  const catalogBuffer = Buffer.from(JSON.stringify(catalog, null, 2), "utf-8");
  const catalogPath = `users/${ownerUid}/catalog.json`;
  await uploadFile(bucketName, catalogPath, catalogBuffer, "application/json");
  console.log(`✅ Master catalog uploaded to: ${bucketName}/${catalogPath}`);

  console.log(`\n🎉 All Done! Complete library and tracking registry synced to Supabase.`);
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
