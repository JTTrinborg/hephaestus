// All calls go to /api/, where nginx (or the Vite dev proxy) adds the API key.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// FastAPI puts the reason in "detail", as a string or a list of validation errors
function readDetail(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const loc = Array.isArray(d?.loc) ? d.loc.filter((p: unknown) => p !== "body").join(".") : "";
        return loc ? `${loc}: ${d?.msg}` : String(d?.msg ?? d);
      })
      .join("; ");
  }
  return null;
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Could not reach the API");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const fallback =
      res.status === 401 ? "The API rejected the key. Check FASTAPI_KEY" :
      res.status === 502 || res.status === 504 ? "The API is not answering. Is heph-api running?" :
      `Request failed with ${res.status}`;
    throw new ApiError(res.status, readDetail(body) ?? fallback);
  }
  return body as T;
}
