// Anonymous page-view counter (Cloudflare Pages Function; sibling of count.js).
//
// Records one page load by incrementing the `visits` integer in the same `COUNTER` KV namespace.
// Like count.js, the handler takes ONLY `env` — it never reads the request, so no IP address,
// headers, region, or content is ever seen or stored. POST increments and returns both totals.
export async function onRequestPost({ env }) {
  const visits = (Number(await env.COUNTER.get('visits')) || 0) + 1;
  await env.COUNTER.put('visits', String(visits));
  return Response.json({ downloads: Number(await env.COUNTER.get('downloads')) || 0, visits });
}
