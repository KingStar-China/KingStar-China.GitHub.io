export function getSupabaseConfig(env = import.meta.env || {}) {
  const url = String(env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY || "");

  return {
    enabled: Boolean(url && anonKey),
    url,
    anonKey,
  };
}

export async function requestSupabaseAuth(config, path, body) {
  return requestSupabase(config, path, {
    method: "POST",
    auth: false,
    body: JSON.stringify(body),
  });
}

export async function requestSupabaseRest(config, path, options = {}, accessToken = "") {
  return requestSupabase(config, path, options, accessToken);
}

async function requestSupabase(config, path, options = {}, accessToken = "") {
  const headers = {
    apikey: config.anonKey,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    headers.Authorization = `Bearer ${config.anonKey}`;
  }

  const response = await fetch(`${config.url}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || response.statusText);
  }

  return payload;
}
