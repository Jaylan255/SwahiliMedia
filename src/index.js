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
          const fallbackUrl = new URL("/icons/icon-512.png", request.url);
          return env.ASSETS.fetch(new Request(fallbackUrl.toString()));
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
