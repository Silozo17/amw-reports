/**
 * AES-256-GCM token encryption/decryption for OAuth tokens at rest.
 * Encrypted values are stored as "enc:<base64(iv + ciphertext)>".
 * Plaintext values (pre-migration) pass through decryptToken unchanged.
 */

const ENCRYPTION_PREFIX = "enc:";

async function getEncryptionKey(): Promise<CryptoKey | null> {
  const keyHex = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!keyHex || keyHex.length !== 64) return null;
  const keyBytes = new Uint8Array(
    keyHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  if (!key) return plaintext; // No key configured — store plaintext
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  return ENCRYPTION_PREFIX + btoa(String.fromCharCode(...combined));
}

export async function decryptToken(stored: string): Promise<string> {
  if (!stored.startsWith(ENCRYPTION_PREFIX)) return stored; // plaintext
  const key = await getEncryptionKey();
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to decrypt tokens");
  }
  const combined = Uint8Array.from(
    atob(stored.slice(ENCRYPTION_PREFIX.length)),
    (c) => c.charCodeAt(0),
  );
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}
