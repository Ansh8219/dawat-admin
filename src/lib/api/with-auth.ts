import { useAuth } from "@/lib/auth";
import { ApiError } from "./types";

/** Runs an authenticated API call, refreshing the token once on 401. */
export async function withAuthRetry<T>(fn: (accessToken: string) => Promise<T>): Promise<T> {
  const token = useAuth.getState().getAccessToken();
  if (!token) {
    throw new ApiError(401, "not_authenticated", "Please sign in again.");
  }

  try {
    return await fn(token);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) {
      throw err;
    }
    const refreshed = await useAuth.getState().refreshSession();
    const nextToken = useAuth.getState().getAccessToken();
    if (!refreshed || !nextToken) {
      throw err;
    }
    return fn(nextToken);
  }
}
