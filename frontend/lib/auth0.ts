/**
 * lib/auth0.ts — Auth0 client singleton for Next.js
 */
import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: process.env.AUTH0_SCOPE ?? "openid profile email",
    audience: process.env.AUTH0_AUDIENCE,
  },
});

/**
 * Get the user's access token from the current session.
 * Used by server-side route handlers to forward to FastAPI.
 */
export async function getAccessToken(): Promise<string> {
  const tokenResult = await auth0.getAccessToken();
  if (!tokenResult?.token) {
    throw new Error("No access token found in Auth0 session");
  }
  return tokenResult.token;
}
