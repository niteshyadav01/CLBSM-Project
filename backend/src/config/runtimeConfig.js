const WEAK_SECRETS = new Set([
  'replace-with-a-long-random-string',
  'local-dev-secret-change-before-production-2026',
]);

export function allowedClientOrigins(env = process.env) {
  return (env.CLIENT_ORIGIN || env.RENDER_EXTERNAL_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function validateRuntimeConfig(env = process.env) {
  if (!env.MONGODB_URI || !/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI)) {
    throw new Error('MONGODB_URI must be set to a valid MongoDB connection string.');
  }

  const minimumSecretLength = env.NODE_ENV === 'production' ? 32 : 20;
  if (!env.JWT_SECRET || env.JWT_SECRET.length < minimumSecretLength) {
    throw new Error(`JWT_SECRET must contain at least ${minimumSecretLength} characters.`);
  }
  if (env.NODE_ENV === 'production' && WEAK_SECRETS.has(env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a unique random value in production.');
  }

  if (env.NODE_ENV === 'production') {
    const origins = allowedClientOrigins(env);
    if (origins.length === 0) {
      throw new Error('CLIENT_ORIGIN must contain the HTTPS origin of the deployed frontend.');
    }

    for (const origin of origins) {
      let parsed;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error('CLIENT_ORIGIN must contain valid HTTPS origins.');
      }
      const localHttp = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
      if (
        (parsed.protocol !== 'https:' && !localHttp) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error('CLIENT_ORIGIN must be an HTTPS site, or http://localhost for local use, with no path or credentials.');
      }
    }
  }
}