/* Same-origin image bridge for 5e.tools bestiary tokens.
   Three.js uploads images into WebGL and therefore needs a CORS-clean source.
   This function only proxies the fixed bestiary-token path; it is not an open
   URL proxy. Netlify/edge caches successful art for one week. */
exports.handler = async function(event) {
  const q = event.queryStringParameters || {};
  const source = String(q.source || "").trim();
  const name = String(q.name || "").trim();
  const safeSource = /^[A-Za-z0-9 _+.'-]{1,80}$/.test(source);
  const safeName = /^[^/\\\0\r\n]{1,160}$/.test(name);
  if (!safeSource || !safeName) {
    return { statusCode: 400, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Invalid token identity" };
  }
  const upstream = "https://5e.tools/img/bestiary/tokens/" + encodeURIComponent(source) + "/" + encodeURIComponent(name) + ".webp";
  try {
    const res = await fetch(upstream, { headers: { "user-agent": "Trials-of-Kirtas/Forge-token-art" } });
    if (!res.ok) {
      return { statusCode: res.status === 404 ? 404 : 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" }, body: "Token art unavailable" };
    }
    const contentType = res.headers.get("content-type") || "";
    if (!/^image\//i.test(contentType)) {
      return { statusCode: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }, body: "Token source was not an image" };
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000",
        "access-control-allow-origin": "*",
        "x-content-type-options": "nosniff"
      },
      body: bytes.toString("base64")
    };
  } catch (err) {
    return { statusCode: 502, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }, body: "Token art fetch failed" };
  }
};
