// A proxy or restarting server may return an HTML error page. Keep that
// implementation detail out of the UI while preserving ordinary API errors.
export async function readResponse<T>(response: Response): Promise<T> {
  try {
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("Unexpected response format");
    return (await response.json()) as T;
  } catch {
    throw new Error("Polis is temporarily unavailable. Please try again.");
  }
}
