const ALLOWED_IMAGE_HOSTS = new Set([
  "castillabizz.com",
  "www.castillabizz.com",
  "swahilicinema.com",
  "www.swahilicinema.com",
  "s3.ap-southeast-1.wasabisys.com",
  "s3.eu-central-2.wasabisys.com"
]);


const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });

const verifyFirebaseUser = async (request, env) => {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token || !env.FIREBASE_WEB_API_KEY) {
    throw new Error("Authentication is required.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    }
  );

  const payload = await response.json().catch(() => ({}));
  const user = payload.users?.[0];

  if (!response.ok || !user?.localId) {
    throw new Error("Invalid Firebase login.");
  }

  return user;
};

const requestOfficialFreshUrl = async ({
  endpoint,
  apiToken,
  sourceId,
  action,
  episode,
  part
}) => {
  if (!endpoint || !apiToken) {
    throw new Error("Provider API is not configured.");
  }

  const target = new URL(endpoint);
  target.searchParams.set("source_id", sourceId);
  target.searchParams.set("action", action);
  target.searchParams.set("_fresh", Date.now().toString());

  if (episode) target.searchParams.set("episode", episode);
  if (part) target.searchParams.set("part", part);

  const response = await fetch(target.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiToken}`
    },
    cf: { cacheTtl: 0, cacheEverything: false }
  });

  const payload = await response.json().catch(() => ({}));
  const freshUrl =
    payload.url ||
    payload.data?.url ||
    payload.download_url ||
    payload.stream_url ||
    payload.data?.download_url ||
    payload.data?.stream_url ||
    "";

  if (!response.ok || !freshUrl) {
    throw new Error(payload.error || "Provider did not return a fresh URL.");
  }

  return freshUrl;
};

const handleOfficialMediaRefresh = async (request, env) => {
  try {
    await verifyFirebaseUser(request, env);

    const url = new URL(request.url);
const provider = String(url.searchParams.get("provider") || "").toLowerCase();
    const sourceId = String(url.searchParams.get("source_id") || "").trim();
    const action = url.searchParams.get("action") === "download"
      ? "download"
      : "stream";
    const episode = String(url.searchParams.get("episode") || "");
    const part = String(url.searchParams.get("part") || "");

    if (!sourceId) {
      return jsonResponse({ error: "source_id is required." }, 400);
    }

    let endpoint = "";
    let apiToken = "";

    if (provider === "castilla") {
      endpoint = env.CASTILLA_REFRESH_API_URL;
      apiToken = env.CASTILLA_API_TOKEN;
    } else if (provider === "swahilicinema") {
      endpoint = env.SWAHILICINEMA_REFRESH_API_URL;
      apiToken = env.SWAHILICINEMA_API_TOKEN;
    } else {
      return jsonResponse({ error: "Unknown provider." }, 400);
    }

    const freshUrl = await requestOfficialFreshUrl({
      endpoint,
      apiToken,
      sourceId,
      action,
      episode,
      part
    });

    return jsonResponse({
      url: freshUrl,
      provider,
      sourceId
    });
  } catch (error) {
    return jsonResponse(
      { error: error.message || "Fresh URL request failed." },
      401
    );
  }
};


export default {
  async fetch(request, env) {
    /* SWAMEDIA_API_ROUTES_V2 */
    const apiUrl = new URL(request.url);

    if (apiUrl.pathname === "/api/version") {
      return Response.json(
        { worker: "swamedia", version: "api-routes-v2" },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (apiUrl.pathname === "/api/media-url") {
      return handleOfficialMediaRefresh(request, env);
    }

    const requestUrl = new URL(request.url);

    if (requestUrl.pathname === "/api/media-url") {
      return handleOfficialMediaRefresh(request, env);
    }
    const url = new URL(request.url);
    if (url.pathname === "/api/media-route-test") {
      return new Response(JSON.stringify({
        ok: true,
        worker: "swamedia",
        version: "media-route-v3"
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Cache-Control": "no-store"
        }
      });
    }

    if (url.pathname === "/api/media-url") {
      return handleOfficialMediaRefresh(request, env);
    }

if (url.pathname === "/api/media-config") {
      return Response.json({
        enabled: env.MEDIA_REFRESH_ENABLED === "true",
        firebaseConfigured: Boolean(env.FIREBASE_WEB_API_KEY),
        castillaConfigured: Boolean(
          env.CASTILLA_WASABI_ACCESS_KEY_ID &&
          env.CASTILLA_WASABI_SECRET_ACCESS_KEY
        ),
        swahiliCinemaConfigured: Boolean(
          env.SWAHILI_WASABI_ACCESS_KEY_ID &&
          env.SWAHILI_WASABI_SECRET_ACCESS_KEY
        )
      }, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    if (url.pathname === "/api/ping") {
      return new Response("OK", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=UTF-8" }
      });
    }

    if (url.pathname === "/api/image-proxy") {
      try {
        const rawUrl = url.searchParams.get("url");
        if (!rawUrl) {
          return new Response("Missing image URL", { status: 400 });
        }

        const target = new URL(rawUrl);
        const hostname = target.hostname.toLowerCase();

        if (
          target.protocol !== "https:" ||
          !ALLOWED_IMAGE_HOSTS.has(hostname)
        ) {
          return new Response("Image host not allowed", { status: 403 });
        }

        const upstream = await fetch(target.toString(), {
          method: "GET",
          redirect: "follow",
          headers: {
            "Accept": "image/avif,image/webp,image/*,*/*;q=0.8"
          }
        });

        if (!upstream.ok) {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="720"><rect width="100%" height="100%" fill="#111"/><text x="50%" y="48%" fill="#fff" font-size="50" text-anchor="middle" font-family="Arial">SwaMedia</text><text x="50%" y="56%" fill="#aaa" font-size="24" text-anchor="middle" font-family="Arial">Poster unavailable</text></svg>`;
          return new Response(svg, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml; charset=UTF-8",
              "Cache-Control": "public, max-age=3600"
            }
          });
        }

        const contentType =
          upstream.headers.get("content-type") || "application/octet-stream";

        if (!contentType.toLowerCase().startsWith("image/")) {
          return new Response("Upstream response is not an image", {
            status: 415
          });
        }

        const body = await upstream.arrayBuffer();

        return new Response(request.method === "HEAD" ? null : body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
            "X-Content-Type-Options": "nosniff"
          }
        });
      } catch (error) {
        return new Response(
          "Proxy error: " + String(error?.message || error),
          { status: 502 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
