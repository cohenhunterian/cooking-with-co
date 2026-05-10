// ============================================================
// FEEDBACK LOGGER — Netlify Function
// ============================================================
// Receives refinement signals from the chat UI and logs them.
// These logs appear in: Netlify dashboard → Functions → feedback → Logs
//
// What this gives you over time:
//   - Which refinements ("Lighter", "Faster", "Cheaper") get clicked most
//   - What meal contexts trigger the most "not quite right" responses
//   - Direct signal for which recipes to add or which tags to fix
//
// To view logs: app.netlify.com → your site → Functions tab → feedback → View logs
// ============================================================

export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: '' };
  }

  try {
    const { refinement, context, ts } = JSON.parse(event.body || '{}');

    // Structured log — visible in Netlify function logs
    console.log(JSON.stringify({
      type: 'refinement_click',
      refinement: refinement || 'unknown',
      context: context || '',
      ts: ts || new Date().toISOString()
    }));

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (e) {
    console.error('feedback error:', e.message);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false })
    };
  }
};
