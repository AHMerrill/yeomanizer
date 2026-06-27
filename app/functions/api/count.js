// Anonymous counters (Cloudflare Pages Function).
//
// Stores ONLY two integers in a KV namespace bound as `COUNTER`: `downloads` and `visits`. Every
// handler takes only `env` (the KV binding) — it NEVER reads the request, so no IP address, headers,
// region, document content, or anything else is ever seen, let alone stored. GET returns both
// totals; POST records one download. Page views are recorded by the sibling /api/visit endpoint.
//
// Setup (one time):
//   1. Create a KV namespace (dashboard → Workers & Pages → KV, or:
//        npx wrangler kv namespace create yeomanizer-counter)
//   2. In the Pages project → Settings → Functions → KV namespace bindings,
//      bind it with the variable name COUNTER.
async function totals(env) {
  return {
    downloads: Number(await env.COUNTER.get('downloads')) || 0,
    visits: Number(await env.COUNTER.get('visits')) || 0,
  };
}

export async function onRequestGet({ env }) {
  return Response.json(await totals(env));
}

export async function onRequestPost({ env }) {
  const downloads = (Number(await env.COUNTER.get('downloads')) || 0) + 1;
  await env.COUNTER.put('downloads', String(downloads));
  return Response.json({ downloads, visits: Number(await env.COUNTER.get('visits')) || 0 });
}
