const ALLOWED_IMAGE_HOSTS = new Set([
  "castillabizz.com",
  "www.castillabizz.com",
  "swahilicinema.com",
  "www.swahilicinema.com",
  "s3.ap-southeast-1.wasabisys.com",
  "s3.eu-central-2.wasabisys.com"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
