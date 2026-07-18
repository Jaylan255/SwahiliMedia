const fs = require('fs');

const file = 'src/index.js';
let code = fs.readFileSync(file, 'utf8');

const marker = 'export default {';

if (!code.includes(marker)) {
  throw new Error('export default haijaonekana kwenye src/index.js');
}

const helper = `
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
    \`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=\${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}\`,
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
      Authorization: \`Bearer \${apiToken}\`
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

`;

code = code.replace(marker, helper + '\n' + marker);

code = code.replace(
  'const url = new URL(request.url);',
  `const url = new URL(request.url);

    if (url.pathname === "/api/media-url") {
      return handleOfficialMediaRefresh(request, env);
    }`
);

fs.writeFileSync(file, code);
console.log('Official refresh endpoint imeongezwa');
