/**
 * Reverse proxy taplaixe.vn through a Cloudflare Worker.
 * Deploy only if you are authorized to republish/proxy upstream content.
 */
const UPSTREAM = "https://taplaixe.vn";
const UPSTREAM_HOST = "taplaixe.vn";

function replaceHost(text, publicHost) {
  return text
    .replace(/https:\/\/(?:www\.)?taplaixe\.vn/gi, "https://" + publicHost)
    .replace(/http:\/\/(?:www\.)?taplaixe\.vn/gi, "https://" + publicHost)
    .replace(/\/\/(?:www\.)?taplaixe\.vn/gi, "//" + publicHost);
}

function rewriteSetCookie(value, publicHost) {
  return value.replace(/;\s*domain\s*=\s*\.?taplaixe\.vn/gi, "; Domain=" + publicHost);
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const publicHost = incoming.host;
    const upstream = new URL(UPSTREAM);
    upstream.pathname = incoming.pathname;
    upstream.search = incoming.search;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");

    for (const header of ["origin", "referer"]) {
      const value = headers.get(header);
      if (!value) continue;
      try {
        const u = new URL(value);
        if (u.host === publicHost) {
          u.protocol = "https:";
          u.host = UPSTREAM_HOST;
          headers.set(header, u.toString());
        }
      } catch (_) {}
    }

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
      body: /^(GET|HEAD)$/i.test(request.method) ? undefined : request.body
    };

    let response;
    try {
      response = await fetch(upstream.toString(), init);
    } catch (e) {
      return new Response("Upstream is temporarily unavailable", { status: 502 });
    }

    const outHeaders = new Headers(response.headers);
    const location = outHeaders.get("location");
    if (location) {
      try {
        const absolute = new URL(location, UPSTREAM);
        if (absolute.hostname === UPSTREAM_HOST || absolute.hostname === "www." + UPSTREAM_HOST) {
          absolute.protocol = "https:";
          absolute.host = publicHost;
          outHeaders.set("location", absolute.toString());
        }
      } catch (_) {}
    }

    // Keep cookie values unchanged, except for the domain scope.
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length) {
      outHeaders.delete("set-cookie");
      for (const cookie of cookies) outHeaders.append("set-cookie", rewriteSetCookie(cookie, incoming.hostname));
    } else if (outHeaders.has("set-cookie")) {
      outHeaders.set("set-cookie", rewriteSetCookie(outHeaders.get("set-cookie"), incoming.hostname));
    }

    const type = (response.headers.get("content-type") || "").toLowerCase();
    const textual = /text\/html|text\/css|(?:javascript|ecmascript)|application\/json|text\/plain|application\/xml|text\/xml|image\/svg\+xml|application\/manifest\+json/.test(type);

    if (textual && request.method !== "HEAD" && response.body) {
      // Only buffered text is changed. Non-text assets (including range/video) are streamed.
      const text = replaceHost(await response.text(), publicHost);
      for (const h of ["content-length", "content-encoding", "etag", "content-md5", "content-security-policy", "content-security-policy-report-only"]) {
        outHeaders.delete(h);
      }
      outHeaders.set("cache-control", "no-store");
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders
    });
  }
};
