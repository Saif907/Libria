/**
 * Read-only access to the book bucket over the GCS JSON API.
 *
 * SERVER ONLY. Every export here is reachable exclusively from inside a
 * `createServerFn().handler()` body, which TanStack Start strips out of the
 * client bundle. The service-account key must never reach a browser — anyone
 * could lift it from devtools and drain the bucket.
 *
 * Deliberately not using `@google-cloud/storage`: this app builds through nitro
 * with Cloudflare as the default target (see vite.config.ts), where that SDK's
 * Node built-ins are unreliable. `fetch` + WebCrypto is one code path that runs
 * unchanged on local dev, Workers and Cloud Run.
 */

const STORAGE_API = "https://storage.googleapis.com/storage/v1/b";
const OAUTH_TOKEN_URI = "https://oauth2.googleapis.com/token";
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

/** Read-only is all the frontend ever needs; writes go through the backend. */
const SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

/** Renew this far before real expiry so a request never races the deadline. */
const REFRESH_MARGIN_SECONDS = 300;

/** Off GCP the metadata host simply does not resolve — bound the wait anyway. */
const METADATA_TIMEOUT_MS = 1000;

/* ---------- Config ---------- */

/** Defaults match the values the backend's GCSStreamer hardcodes. */
const DEFAULT_BUCKET = "libria-rag-ebooks-storage";
const DEFAULT_PREFIX = "outputs_md/docling_v1";
/** Where the original PDFs live, alongside the converted markdown. */
const DEFAULT_PDF_PREFIX = "ebooks";

function env(key: string): string | undefined {
  const cfEnv = (globalThis as unknown as { __CLOUDFLARE_ENV__?: Record<string, string> })
    .__CLOUDFLARE_ENV__;
  const value = cfEnv?.[key] ?? (typeof process === "undefined" ? undefined : process.env?.[key]);
  return value !== undefined && value !== "" ? value : undefined;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function gcsConfig(): { bucket: string; prefix: string; pdfPrefix: string } {
  return {
    bucket: env("GCS_BUCKET") ?? DEFAULT_BUCKET,
    prefix: trimSlashes(env("GCS_PREFIX") ?? DEFAULT_PREFIX),
    pdfPrefix: trimSlashes(env("GCS_PDF_PREFIX") ?? DEFAULT_PDF_PREFIX),
  };
}

/* ---------- Errors ---------- */

export class GcsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GcsError";
  }
}

/** Turns an API failure into something actionable rather than "request failed". */
async function toGcsError(response: Response, action: string): Promise<GcsError> {
  const body = await response.text().catch(() => "");
  const hint =
    response.status === 401
      ? " — the service-account credentials were rejected. Check GCP_SERVICE_ACCOUNT_JSON is the full, unmodified key JSON."
      : response.status === 403
        ? ` — authenticated, but not authorised. Grant the service account roles/storage.objectViewer on gs://${gcsConfig().bucket}.`
        : "";
  return new GcsError(
    `GCS ${action} failed (${response.status})${hint}${body ? `: ${body.slice(0, 300)}` : ""}`,
    response.status,
  );
}

/* ---------- Access tokens ---------- */

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type CachedToken = { value: string; expiresAt: number };

let cachedToken: CachedToken | undefined;
let inFlightToken: Promise<CachedToken> | undefined;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  // A cold SSR render fires several loaders at once; without this each one pays
  // for its own token exchange.
  inFlightToken ??= mintToken().finally(() => {
    inFlightToken = undefined;
  });

  cachedToken = await inFlightToken;
  return cachedToken.value;
}

/**
 * Precedence mirrors Google's own ADC: an explicitly configured key wins, and
 * the runtime's attached identity is the fallback. That means local dev and
 * Cloudflare use the key, while Cloud Run needs no key at all.
 */
async function mintToken(): Promise<CachedToken> {
  const key = serviceAccountKey();
  if (key) return tokenFromServiceAccount(key);

  const fromMetadata = await tokenFromMetadataServer();
  if (fromMetadata) return fromMetadata;

  throw new GcsError(
    "No GCS credentials available. Set GCP_SERVICE_ACCOUNT_JSON in frontend/.env " +
      "(the full service-account key JSON on one line), or run on a GCP runtime " +
      "whose service account has roles/storage.objectViewer on the bucket.",
  );
}

function serviceAccountKey(): ServiceAccountKey | undefined {
  const raw = env("GCP_SERVICE_ACCOUNT_JSON");
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GcsError(
      "GCP_SERVICE_ACCOUNT_JSON is not valid JSON. It must be the whole key file " +
        "on a single line — flatten it with: jq -c . key.json",
    );
  }

  const key = parsed as Partial<ServiceAccountKey>;
  if (!key.client_email || !key.private_key) {
    throw new GcsError(
      "GCP_SERVICE_ACCOUNT_JSON is missing client_email or private_key — it does " +
        "not look like a service-account key file.",
    );
  }
  return key as ServiceAccountKey;
}

async function tokenFromServiceAccount(key: ServiceAccountKey): Promise<CachedToken> {
  const tokenUri = key.token_uri ?? OAUTH_TOKEN_URI;
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;

  const signingInput = [
    base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))),
    base64Url(
      new TextEncoder().encode(
        JSON.stringify({
          iss: key.client_email,
          scope: SCOPE,
          aud: tokenUri,
          iat: issuedAt,
          exp: issuedAt + expiresIn,
        }),
      ),
    ),
  ].join(".");

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await importPrivateKey(key.private_key),
    new TextEncoder().encode(signingInput),
  );

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${base64Url(new Uint8Array(signature))}`,
    }),
  });

  if (!response.ok) throw await toGcsError(response, "token exchange");

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new GcsError("Token exchange returned no access_token.");
  }
  return {
    value: payload.access_token,
    expiresAt: Date.now() + ((payload.expires_in ?? expiresIn) - REFRESH_MARGIN_SECONDS) * 1000,
  };
}

/** Resolves to undefined when not running on GCP, so the caller can fall through. */
async function tokenFromMetadataServer(): Promise<CachedToken | undefined> {
  try {
    const response = await fetch(METADATA_TOKEN_URL, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    });
    if (!response.ok) return undefined;

    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) return undefined;
    return {
      value: payload.access_token,
      expiresAt: Date.now() + ((payload.expires_in ?? 3600) - REFRESH_MARGIN_SECONDS) * 1000,
    };
  } catch {
    return undefined;
  }
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    throw new GcsError(
      "The private key is in PKCS#1 form. GCP service-account keys are PKCS#8 — " +
        "re-download the key with `gcloud iam service-accounts keys create`.",
    );
  }
  const der = decodeBase64(
    pem.replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, ""),
  );
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/* ---------- Base64 ---------- */

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------- Requests ---------- */

async function authorizedFetch(url: URL): Promise<Response> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${await getAccessToken()}` },
  });

  // A token can be revoked mid-life; drop it so the retry mints a fresh one
  // instead of failing every request until the process restarts.
  if (response.status === 401) {
    cachedToken = undefined;
    const retry = await fetch(url, {
      headers: { authorization: `Bearer ${await getAccessToken()}` },
    });
    return retry;
  }
  return response;
}

export type GcsObject = {
  /** Full object path including the prefix, e.g. `outputs_md/docling_v1/x.md`. */
  name: string;
  sizeBytes: number;
  /** RFC 3339 timestamp, or "" when the API omitted it. */
  updated: string;
};

/** Lists every object under `prefix`, following pagination. */
export async function listObjects(prefix: string): Promise<GcsObject[]> {
  const { bucket } = gcsConfig();
  const objects: GcsObject[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${STORAGE_API}/${encodeURIComponent(bucket)}/o`);
    url.searchParams.set("prefix", prefix);
    // Ask only for the three fields used, so the response stays small.
    url.searchParams.set("fields", "items(name,size,updated),nextPageToken");
    url.searchParams.set("maxResults", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await authorizedFetch(url);
    if (!response.ok) throw await toGcsError(response, `list ${prefix}`);

    const payload = (await response.json()) as {
      items?: { name?: string; size?: string; updated?: string }[];
      nextPageToken?: string;
    };

    for (const item of payload.items ?? []) {
      if (!item.name) continue;
      objects.push({
        name: item.name,
        sizeBytes: Number(item.size ?? 0),
        updated: item.updated ?? "",
      });
    }
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return objects;
}

/** Downloads an object as UTF-8 text. Returns null when it does not exist. */
export async function downloadText(objectName: string): Promise<string | null> {
  const { bucket } = gcsConfig();
  const url = new URL(
    `${STORAGE_API}/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`,
  );
  url.searchParams.set("alt", "media");

  const response = await authorizedFetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw await toGcsError(response, `download ${objectName}`);
  return response.text();
}

/* ---------- Signed URLs ---------- */

/**
 * A PDF is far too large to pass through this server: it would double the
 * egress, and a Cloudflare Worker cannot buffer a 20 MB body at all. Instead the
 * browser is handed a time-limited signed URL and streams the object straight
 * from GCS, which also means range requests work — the viewer paints page one
 * without downloading the rest.
 *
 * Long enough to read a book without the link dying mid-scroll; short enough
 * that a leaked URL stops working the same hour.
 */
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Handing out a cached URL only for the first half of its life guarantees every
 * caller gets at least 30 minutes of validity.
 */
const SIGNED_URL_CACHE_MS = (SIGNED_URL_TTL_SECONDS / 2) * 1000;

const SIGNING_ALGORITHM = "GOOG4-RSA-SHA256";
const IAM_SIGN_BLOB = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts";
const METADATA_EMAIL_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email";

const signedUrls = new Map<string, { url: string; expiresAt: number }>();

/**
 * V4 signed download URL for a private object, valid for one hour.
 *
 * Signing needs the private key, which only the configured-key path has. On a
 * GCP runtime with no key there is nothing local to sign with, so the IAM
 * Credentials API signs on the service account's behalf instead — one extra
 * round trip, absorbed by the cache below.
 */
export async function signedObjectUrl(objectName: string): Promise<string> {
  const cached = signedUrls.get(objectName);
  if (cached && Date.now() < cached.expiresAt) return cached.url;

  const { bucket } = gcsConfig();
  const key = serviceAccountKey();
  const clientEmail = key?.client_email ?? (await serviceAccountEmail());

  // "auto" is what Google's own client libraries use for V4 download URLs, so
  // this works without knowing the bucket's region.
  const now = new Date();
  const datetime = `${now.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
  const date = datetime.slice(0, 8);
  const credentialScope = `${date}/auto/storage/goog4_request`;

  const query: Record<string, string> = {
    "X-Goog-Algorithm": SIGNING_ALGORITHM,
    "X-Goog-Credential": `${clientEmail}/${credentialScope}`,
    "X-Goog-Date": datetime,
    "X-Goog-Expires": String(SIGNED_URL_TTL_SECONDS),
    "X-Goog-SignedHeaders": "host",
    // Forced rather than trusted: objects uploaded without a content type would
    // otherwise download as octet-stream instead of opening in the viewer.
    "response-content-disposition": "inline",
    "response-content-type": "application/pdf",
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${rfc3986(name)}=${rfc3986(query[name]!)}`)
    .join("&");

  const canonicalResource = `/${bucket}/${encodeObjectPath(objectName)}`;
  const canonicalRequest = [
    "GET",
    canonicalResource,
    canonicalQuery,
    "host:storage.googleapis.com",
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    SIGNING_ALGORITHM,
    datetime,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = key
    ? await signLocally(stringToSign, key.private_key)
    : await signViaIam(stringToSign, clientEmail);

  const url =
    `https://storage.googleapis.com${canonicalResource}` +
    `?${canonicalQuery}&X-Goog-Signature=${signature}`;

  signedUrls.set(objectName, { url, expiresAt: Date.now() + SIGNED_URL_CACHE_MS });
  return url;
}

async function signLocally(stringToSign: string, privateKey: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    await importPrivateKey(privateKey),
    new TextEncoder().encode(stringToSign),
  );
  return hex(new Uint8Array(signature));
}

async function signViaIam(stringToSign: string, clientEmail: string): Promise<string> {
  const response = await fetch(
    `${IAM_SIGN_BLOB}/${encodeURIComponent(clientEmail)}:signBlob`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await getAccessToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        payload: btoa(String.fromCharCode(...new TextEncoder().encode(stringToSign))),
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GcsError(
      `Could not sign a PDF URL (${response.status}). On a GCP runtime the ` +
        `service account needs roles/iam.serviceAccountTokenCreator on itself, ` +
        `or set GCP_SERVICE_ACCOUNT_JSON to sign locally instead.` +
        (body ? ` Response: ${body.slice(0, 300)}` : ""),
      response.status,
    );
  }

  const payload = (await response.json()) as { signedBlob?: string };
  if (!payload.signedBlob) throw new GcsError("signBlob returned no signature.");
  return hex(decodeBase64(payload.signedBlob));
}

let cachedEmail: string | undefined;

async function serviceAccountEmail(): Promise<string> {
  if (cachedEmail) return cachedEmail;
  try {
    const response = await fetch(METADATA_EMAIL_URL, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
    });
    if (response.ok) {
      cachedEmail = (await response.text()).trim();
      if (cachedEmail) return cachedEmail;
    }
  } catch {
    // Fall through to the actionable error below.
  }
  throw new GcsError(
    "Cannot sign PDF URLs: no service-account identity available. Set " +
      "GCP_SERVICE_ACCOUNT_JSON in frontend/.env, or run on a GCP runtime.",
  );
}

/* ---------- Encoding helpers ---------- */

/** encodeURIComponent leaves these RFC 3986 sub-delims alone; signing cannot. */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Encodes each segment but keeps the separators, as the canonical URI requires. */
function encodeObjectPath(objectName: string): string {
  return objectName.split("/").map(rfc3986).join("/");
}

function hex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
}
