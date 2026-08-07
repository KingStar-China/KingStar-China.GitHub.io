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

export async function requestSupabaseRestWithSession(config, path, options = {}, session = {}) {
  if (options.auth === false) {
    return requestSupabaseRest(config, path, options);
  }

  if (typeof session.ensureActive === "function") {
    await session.ensureActive();
  }

  const send = () => requestSupabaseRest(
    config,
    path,
    options,
    typeof session.getAccessToken === "function" ? session.getAccessToken() : "",
  );

  try {
    return await send();
  } catch (error) {
    const canRefresh = typeof session.canRefresh === "function" && session.canRefresh();
    if (error?.status !== 401 || !canRefresh || typeof session.refresh !== "function") {
      throw error;
    }

    await session.refresh();
    return send();
  }
}

export async function revokeSupabaseSession(config, accessToken) {
  const token = String(accessToken || "");
  if (!token) {
    return null;
  }

  return requestSupabaseRest(config, "/auth/v1/logout?scope=local", {
    method: "POST",
  }, token);
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
    keepalive: Boolean(options.keepalive),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = response.ok ? text : null;
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.msg || payload?.message || response.statusText);
    error.status = response.status;
    error.code = String(payload?.code || payload?.error_code || payload?.error || "");
    throw error;
  }

  return payload;
}
