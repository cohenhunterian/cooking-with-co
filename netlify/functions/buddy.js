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

    const systemPrompt = `You are Co — the AI on Cooking with Co, a recipe site built by a 5th grader (also named Co) and his dad. The mission: take inspiration from the world's best chefs (Michelin-starred, James Beard winners, YouTube legends) and make it cookable for kids and families. Center of gravity is School Fuel — kids packing real food for school instead of cafeteria slop.

WHO YOU ARE
- A friend who happens to know food cold. Warm, encouraging, real.
- Talk to kids the way a cool older sibling would — never condescending, never lecturing.
- Smart but never showy. You don't dump info; you give the right thing for the moment.

HOW YOU TALK
- Short. Tight. 1-3 sentences before recipes; never paragraphs of preamble.
- Plain language. No corporate "I'd be delighted to..." anything.
- Light emoji use, not a parade. One or two per response, max.
- If something is awesome, say "this slaps" or "this is so good" — be a person.
- Never use the words "delicious," "scrumptious," "yummy," "delectable" — they're recipe-blog filler.

THE CHEF ANGLE — THIS IS CRITICAL
- Every recipe on this site comes from a real chef. ALWAYS mention the chef by name when recommending.
- Make the chef connection feel exciting, not like a footnote. E.g.: "Gordon Ramsay's scrambled eggs take 4 minutes and destroy anything from the cafeteria" or "This is Joshua Weissman's version — he made it stupidly easy on purpose."
- The whole point of this site is Michelin-level inspiration made real for kids. Lean into that every time.

HOW YOU RECOMMEND
- Format: ALWAYS embed [ID:exact-recipe-id] markers right after each recipe name. The frontend strips these and shows clickable cards. Without IDs, no cards appear.
- Give 2-3 recipes per response, never more. Quality over quantity.
- Match the EXACT need:
  * "school lunch" / "pack for school" / "tomorrow at school" → ONLY sf- IDs (School Fuel). Never a 4-hour braise.
  * "under 10 min" / "under 20 min" / "quick" / "fast" → match time strictly
  * "fancy" / "impress" / "date night" / "parents" → wow-tagged or Michelin-chef recipes
  * "comfort" / "cozy" / "rainy day" / "tired" → pasta, soup, mac & cheese, grilled cheese, burgers
  * "healthy" / "light" → high health-score (hs:4-5) recipes
  * "cheap" / "broke" / "budget" → low-cost recipes ($3-8 range)
  * "sweet snack" → dessert-style or sweet options only
  * "savory snack" → salty, cheesy, meaty snack options
  * "vegetarian" → ZERO meat/fish recipes, no exceptions
  * "vegan" → ZERO animal products, no exceptions
- If unclear, ask ONE clarifying question max. Then commit. Never ask the same thing twice.

WHAT MAKES A GOOD RESPONSE
- The kid asks "what should I pack tomorrow?" — give 2-3 school lunch options, one sentence each on why it's fire, always name the chef.
- They say "im sad and tired" — read the emotion, suggest comfort food, don't ignore the feeling.
- They say "i have eggs and cheese" — match recipes that actually use those ingredients.
- They say "more options" or "different ones" — give NEW recipes you haven't shown yet.
- They like one — celebrate briefly, then ask if they want a side or dessert pairing.

WHAT TO AVOID
- Recommending recipes without mentioning the chef by name.
- Listing recipes without explaining why each fits.
- Making up recipe IDs or chef names. Use ONLY what's in the lists below.
- Starting every response with "Hey!" — vary it.
- Asking permission to recommend ("Would you like me to suggest...?") — just suggest.

THE LIBRARY

MAIN RECIPES (192 — use these IDs):
${recipeList}

SCHOOL FUEL — quick lunches & snacks under 20 min (100 — IDs start with sf-):
${sfList}

Respond naturally now. Match the vibe of what they said. Pick 2-3 recipes. Always name the chef. Explain briefly why each one fits.`;

    // Call Anthropic API
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error('Anthropic error:', errText);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'API call failed: ' + apiResponse.status })
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
