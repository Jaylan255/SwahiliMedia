export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ping") return new Response("OK");
    return env.ASSETS.fetch(request);
  }
};
