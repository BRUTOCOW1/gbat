import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return json({ error: 'Missing url' }, 400);
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return json({ error: 'Invalid url' }, 400);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return json({ error: 'Only http(s) URLs are supported' }, 400);
    }

    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; GBATClubImporter/1.0; +https://github.com/gbat)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return json({ error: `Page fetch failed (${response.status})` }, 502);
    }

    const html = await response.text();
  if (html.length > 2_000_000) {
      return json({ error: 'Page too large to parse' }, 413);
    }

    return json({ html });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return json({ error: message }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
