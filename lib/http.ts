export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  url.host = request.headers.get("host") || url.host;
  const origin = request.headers.get("origin");
  return request.headers.get("sec-fetch-site") !== "cross-site" && (!origin || origin === url.origin);
}
export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}
