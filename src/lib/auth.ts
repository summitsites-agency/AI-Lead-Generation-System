/**
 * Shared-password auth helpers. Uses Web Crypto only (no Node APIs) so this can
 * be imported from both the Edge middleware and Node route handlers.
 *
 * The cookie never stores the raw password — it stores a SHA-256 token derived
 * from it. The middleware recomputes the token from APP_PASSWORD and compares.
 */
export const AUTH_COOKIE = "leadgen_auth";

export async function authToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`leadgen:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
