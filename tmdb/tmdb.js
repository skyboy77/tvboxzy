const API_CACHE_TTL = 3600;          // 1小时
const IMAGE_CACHE_TTL = 2592000;     // 30天
const KV_CACHE_TTL = 86400;          // 1天

const RATE_LIMIT = 300;              // 每分钟

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch (e) {
      return json(
        {
          error: e.message,
        },
        500
      );
    }
  }
};

async function handle(request, env, ctx) {
  const url = new URL(request.url);

  // -------------------
  // CORS
  // -------------------

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders()
    });
  }

  // -------------------
  // Rate Limit
  // -------------------

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    "unknown";

  const rlKey =
    `rl:${ip}:${Math.floor(Date.now()/60000)}`;

  if (env.TMDB_CACHE) {
    const count =
      parseInt(
        await env.TMDB_CACHE.get(rlKey) || "0"
      );

    if (count > RATE_LIMIT) {
      return json(
        {
          error: "rate limit exceeded"
        },
        429
      );
    }

    ctx.waitUntil(
      env.TMDB_CACHE.put(
        rlKey,
        String(count + 1),
        {
          expirationTtl: 120
        }
      )
    );
  }

  // -------------------
  // Routing
  // -------------------

  if (
    url.pathname.startsWith("/t/p/")
  ) {
    return imageProxy(
      request,
      url,
      ctx
    );
  }

  return apiProxy(
    request,
    url,
    env,
    ctx
  );
}

async function apiProxy(
  request,
  url,
  env,
  ctx
) {

  const cache = caches.default;

  const cacheKey =
    new Request(
      request.url,
      request
    );

  let cached =
    await cache.match(cacheKey);

  if (cached) {
    return addCacheHeader(
      cached,
      "EDGE-HIT"
    );
  }

  const kvKey =
    `api:${url.pathname}${url.search}`;

  if (env.TMDB_CACHE) {
    const kvData =
      await env.TMDB_CACHE.get(
        kvKey
      );

    if (kvData) {
      return new Response(
        kvData,
        {
          headers: {
            "content-type":
              "application/json",
            ...corsHeaders(),
            "X-TMDB-Cache":
              "KV-HIT"
          }
        }
      );
    }
  }

  const keys =
    (env.TMDB_KEYS || "")
      .split(",")
      .filter(Boolean);

  if (!keys.length) {
    throw new Error(
      "TMDB_KEYS missing"
    );
  }

  const key =
    keys[
      Math.floor(
        Date.now()/60000
      ) % keys.length
    ];

  const upstreamUrl =
    new URL(
      "https://api.themoviedb.org" +
      url.pathname
    );

  url.searchParams.forEach(
    (v, k) =>
      upstreamUrl.searchParams.set(
        k,
        v
      )
  );

  upstreamUrl.searchParams.set(
    "api_key",
    key
  );

  const upstream =
    await fetch(
      upstreamUrl.toString(),
      {
        headers: {
          accept:
            "application/json"
        }
      }
    );

  const text =
    await upstream.text();

  const headers =
    new Headers();

  headers.set(
    "content-type",
    "application/json"
  );

  headers.set(
    "cache-control",
    `public,max-age=${API_CACHE_TTL}`
  );

  Object.entries(
    corsHeaders()
  ).forEach(
    ([k, v]) =>
      headers.set(k, v)
  );

  headers.set(
    "X-TMDB-Cache",
    "MISS"
  );

  const response =
    new Response(
      text,
      {
        status:
          upstream.status,
        headers
      }
    );

  if (upstream.ok) {

    ctx.waitUntil(
      cache.put(
        cacheKey,
        response.clone()
      )
    );

    if (env.TMDB_CACHE) {
      ctx.waitUntil(
        env.TMDB_CACHE.put(
          kvKey,
          text,
          {
            expirationTtl:
              KV_CACHE_TTL
          }
        )
      );
    }
  }

  return response;
}

async function imageProxy(
  request,
  url,
  ctx
) {

  const cache =
    caches.default;

  const cached =
    await cache.match(
      request
    );

  if (cached) {
    return addCacheHeader(
      cached,
      "EDGE-HIT"
    );
  }

  const upstream =
    await fetch(
      "https://image.tmdb.org" +
      url.pathname,
      {
        headers: request.headers
      }
    );

  const headers =
    new Headers(
      upstream.headers
    );

  headers.set(
    "cache-control",
    `public,max-age=${IMAGE_CACHE_TTL}`
  );

  headers.set(
    "Access-Control-Allow-Origin",
    "*"
  );

  headers.set(
    "X-TMDB-Cache",
    "MISS"
  );

  const response =
    new Response(
      upstream.body,
      {
        status:
          upstream.status,
        headers
      }
    );

  if (upstream.ok) {
    ctx.waitUntil(
      cache.put(
        request,
        response.clone()
      )
    );
  }

  return response;
}

function addCacheHeader(
  response,
  value
) {
  const headers =
    new Headers(
      response.headers
    );

  headers.set(
    "X-TMDB-Cache",
    value
  );

  return new Response(
    response.body,
    {
      status:
        response.status,
      headers
    }
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",
    "Access-Control-Allow-Methods":
      "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers":
      "*"
  };
}

function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "content-type":
          "application/json",
        ...corsHeaders()
      }
    }
  );
}
