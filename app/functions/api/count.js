// Cloudflare Pages Function: anonymous download counter.
//
// Stores ONLY an integer in a KV namespace bound as `COUNTER`. It never receives or stores
// any document content — the POST body is ignored entirely. GET returns the total; POST
// increments and returns the new total.
//
// Setup (one time):
//   1. Create a KV namespace (dashboard → Workers & Pages → KV, or:
//        npx wrangler kv namespace create yeomanizer-counter)
//   2. In the Pages project → Settings → Functions → KV namespace bindings,
//      bind it with the variable name COUNTER.

export async function onRequestGet({ env }) {
  const n = Number(await env.COUNTER.get('downloads')) || 0;
  return Response.json({ count: n });
}

export async function onRequestPost({ env }) {
  const n = (Number(await env.COUNTER.get('downloads')) || 0) + 1;
  await env.COUNTER.put('downloads', String(n));
  return Response.json({ count: n });
}
