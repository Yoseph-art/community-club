// Keeps the free Supabase project awake: Supabase pauses free projects after 7 days without use
// (a break from the turf, holidays). Once a day Cloudflare asks the database "are you there?"
// (cc_ping in supabase/schema.sql, which reads no records). Runs on Cloudflare, not on a laptop.
// Publish: npx wrangler deploy --config tools/keepalive/wrangler.jsonc
export default {
  async scheduled(event, env) {
    const r = await fetch(`${env.DB_URL}/rest/v1/rpc/cc_ping`, {
      method: 'POST',
      headers: { apikey: env.DB_KEY, 'Content-Type': 'application/json' },
      body: '{}',
    });
    console.log(`cc_ping: ${r.status} ${await r.text()}`);
    if (!r.ok) throw new Error(`The database did not answer (${r.status})`);
  },
};
