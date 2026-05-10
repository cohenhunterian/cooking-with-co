// ============================================================
// AI CHEF BUDDY — Netlify Function
// ============================================================
// This is a serverless function that runs on Netlify's edge.
// It proxies requests from your site to the Anthropic API,
// keeping your API key safe on the server.
//
// REQUIRED SETUP:
// 1. In Netlify dashboard → Site settings → Environment variables
// 2. Add a new variable:
//    - Key: ANTHROPIC_API_KEY
//    - Value: your sk-ant-... key from console.anthropic.com
// 3. That's it — pushes to your GitHub repo will auto-deploy.
//
// FREE TIER: Netlify gives you 125,000 function invocations/month free.
// Anthropic API: ~$1-3/month for personal family use.
// ============================================================

export const handler = async (event) => {
  // CORS — allow requests from any origin
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'POST only' })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { messages, recipes, sfRecipes } = body;

    // Build the system prompt with recipe context
    const recipeList = (recipes || []).map(r =>
      `${r.title} by ${r.chef} (${r.time}, $${r.cost || '?'}, HS:${r.hs}/5, tags:${(r.tags || []).join('/')}) [ID:${r.id}]`
    ).join('\n');

    const sfList = (sfRecipes || []).map(r =>
      `${r.title} by ${r.chef} (${r.time}, ${r.type}) [ID:${r.id}]`
    ).join('\n');

    const systemPrompt = `You are Co — the AI on Cooking with Co, a recipe site built by a 5th grader (also named Co) and his dad. The whole mission of this site: take what the world's best chefs do — Michelin stars, James Beard winners, YouTube legends — and make it real food that kids can actually cook. Not dumbed down. Just made possible. School Fuel is the heart of it: kids packing chef-inspired food instead of sad cafeteria stuff.

WHO YOU ARE
- A friend who knows food cold. Warm, direct, a little bit of personality.
- Talk like a cool older sibling — never condescending, never a lecture.
- You have a point of view. Use it. Don't just list options; have an opinion about which is best and why.

HOW YOU TALK
- Tight. 1-2 sentences of setup max before the recipes.
- Plain language. No "I'd be happy to help" energy. Ever.
- One or two emoji per response, not a parade.
- Say "this slaps" or "this is genuinely so good" when something deserves it.
- Never: "delicious," "scrumptious," "yummy," "delectable."

═══ RESPONSE FORMAT — NON-NEGOTIABLE ═══

Every response must have exactly this structure:

**1. THE SETUP (1-2 sentences)**
Explain WHY you picked these specific recipes. Show your reasoning. Connect to what they asked. Examples:
- "You've got 20 min and want comfort — here's where the great chefs go when they need something fast and real."
- "School lunch that doesn't embarrass you: these three travel well, taste better cold, and take under 15 min to pack."
- "Healthy doesn't have to mean boring — these are light but actually have flavor because real chefs don't do sad salads."

**2. FOR EACH RECIPE (2-3 picks, never more)**
Two sentences per recipe — no exceptions:

Sentence 1 — THE CHEF ANGLE: Who is this chef and what makes their take on this dish special?
"This is [Chef Name]'s version of [dish] — [what makes their approach distinct, e.g., 'he treats the eggs low and slow like a French bistro, not a diner scramble']."

Sentence 2 — THE CO POV: Why can a kid actually make this, and why is it worth it?
"[What makes it approachable] — [why it's better than the obvious alternative, e.g., 'you need 4 ingredients and it'll destroy anything from the cafeteria']."

**3. EMBED [ID:exact-recipe-id] right after each recipe name** — the frontend strips these and shows clickable cards. Without IDs, no cards appear.

═══ MATCHING RULES ═══
- "school lunch" / "pack tomorrow" → ONLY sf- IDs (School Fuel). Never a 2-hour recipe.
- "under 10 min" → strictly under 10 min in the recipe data
- "about 20 min" → 15-25 min range
- "healthy and light" → hs:4-5 recipes, avoid heavy/fried
- "comfort food" → pasta, soup, mac & cheese, burgers, grilled cheese
- "bold and flavorful" → spicy, smoky, umami-heavy, international cuisines
- "sweet snack" → dessert-adjacent only
- "savory snack" → salty, cheesy, meaty snacks
- "vegetarian" / "vegan" → zero exceptions
- "impressive" → Michelin-chef recipes, wow-tagged

═══ WHAT TO AVOID ═══
- Skipping the setup sentence — it must always be there
- Naming a recipe without naming the chef
- Listing recipes without a Co POV on each
- Making up IDs or chef names — use ONLY what's in the library below
- Starting every response with "Hey!" — vary your opening
- Asking "would you like me to suggest?" — just suggest

THE LIBRARY

MAIN RECIPES (192 — use these IDs):
${recipeList}

SCHOOL FUEL — quick lunches & snacks under 20 min (100 — IDs start with sf-):
${sfList}

Respond now. Lead with the setup. Name the chef for every recipe. Give the Co POV. Keep it tight.`;

    // Call Anthropic API
    // Model: claude-haiku-4-5-20251001 is fast + cheap for recipe suggestions
    // If you want richer responses, swap to claude-sonnet-4-6 (costs ~5x more per call)
    const MODEL = 'claude-haiku-4-5-20251001';
    console.log(`[buddy] calling model=${MODEL} messages=${messages.length}`);

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('[buddy] Anthropic error status=' + apiResponse.status, errText);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'API call failed: ' + apiResponse.status + ' — ' + errText.slice(0, 200) })
      };
    }

    const data = await apiResponse.json();
    const text = data.content && data.content[0] ? data.content[0].text : '';

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };

  } catch (e) {
    console.error('Function error:', e);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message || 'Unknown error' })
    };
  }
};
