export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 只允许 GET / HEAD 缓存
    const cacheable =
      request.method === "GET" ||
      request.method === "HEAD";

    const cache = caches.default;

    if (cacheable) {
      const cached = await cache.match(request);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("X-TMDB-Cache", "HIT");
        return new Response(cached.body, {
          status: cached.status,
          headers
        });
      }
    }

    let targetUrl;
    let cacheTTL;

    // ==========================
    // API
    // https://tmdb.xxx.com/3/movie/550
    // ==========================
    if (
      url.pathname.startsWith("/3/") ||
      url.pathname.startsWith("/4/")
    ) {
      targetUrl =
        "https://api.themoviedb.org" +
        url.pathname +
        url.search;

      cacheTTL = 3600;
    }

    // ==========================
    // 图片
    // https://tmdb.xxx.com/t/p/w500/xxx.jpg
    // ==========================
    else if (
      url.pathname.startsWith("/t/p/")
    ) {
      targetUrl =
        "https://image.tmdb.org" +
        url.pathname;

      cacheTTL = 2592000; // 30天
    }

    else {
      return new Response(
        JSON.stringify({
          service: "TMDB Proxy",
          api: "/3/*",
          image: "/t/p/*"
        }),
        {
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers
    });

    const headers = new Headers(upstream.headers);

    headers.set(
      "Cache-Control",
      `public, s-maxage=${cacheTTL}`
    );

    headers.set(
      "Access-Control-Allow-Origin",
      "*"
    );

    headers.set(
      "X-TMDB-Cache",
      "MISS"
    );

    const response = new Response(
      upstream.body,
      {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      }
    );

    if (
      cacheable &&
      upstream.ok
    ) {
      ctx.waitUntil(
        cache.put(
          request,
          response.clone()
        )
      );
    }

    return response;
  }
};
