// Scheduled function: pings Supabase daily so the free-tier project is
// never idle long enough to auto-pause (Supabase pauses after ~7 days
// without any API activity).
export const config = {
  schedule: '@daily',
};

export const handler = async () => {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !serviceRoleKey) {
    console.warn('[supabase-keepalive] Skipped: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are not configured.');
    return { statusCode: 200, body: 'skipped: supabase not configured' };
  }

  try {
    const response = await fetch(`${url}/rest/v1/admin_tracked_folders?select=path&limit=1`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    console.log(`[supabase-keepalive] Ping sent, status ${response.status}`);
    return { statusCode: 200, body: `pinged, status ${response.status}` };
  } catch (error) {
    console.error('[supabase-keepalive] Ping failed', error);
    return { statusCode: 200, body: 'ping failed, see logs' };
  }
};
