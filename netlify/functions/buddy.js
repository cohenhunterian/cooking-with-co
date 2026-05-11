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
    const { messages, recipes, sfRecipes, mode } = body;
    const isSchoolFuel = mode === 'schoolfuel';

    // Build the system prompt with recipe context
    const recipeList = (recipes || []).map(r =>
      `${r.title} by ${r.chef} (${r.time}, $${r.cost || '?'}, HS:${r.hs}/5, tags:${(r.tags || []).join('/')}) [ID:${r.id}]`
    ).join('\n');

    const sfList = (sfRecipes || []).map(r =>
      `${r.title} by ${r.chef} (${r.time}, ${r.type}) [ID:${r.id}]`
    ).join('\n');

    // ── SCHOOL FUEL PROMPT ──────────────────────────────────────────────
    const sfSystemPrompt = `You are Co — the AI on the School Fuel section of Cooking with Co, a recipe site built by a 5th grader and his dad. School Fuel is the heart of the site: 100 snacks and lunches kids can pack themselves — chef-inspired, real ingredients, under 20 minutes.

WHO YOU ARE
- A friend helping someone pack something they'll actually want to eat at lunch.
- Direct, warm, a little personality. Never condescending.
- You have opinions. Use them. Don't just list — recommend.

HOW YOU TALK
- Tight. 1 sentence of setup max before the recipes.
- Say things like "this packs perfectly", "still tastes great cold", "takes 3 minutes the night before".
- Never: "delicious," "scrumptious," "yummy."

═══ RESPONSE FORMAT — NON-NEGOTIABLE ═══

1. ONE setup sentence — why these specifically for school.

2. FOR EACH RECIPE (2-3 picks, never more):

**Recipe Name** [ID:exact-sf-id]
WHAT: [One sentence. What it is and what makes this chef's version worth packing.]
WHY: [One sentence. Why Co recommends it for school specifically — packability, cold taste, ease, wow factor.]

EXAMPLE:
**PB&J roll-ups** [ID:sf-s1]
WHAT: Jamie Oliver's take on the classic — rolled tight so it doesn't fall apart in a bag and hits way better than a sad sandwich.
WHY: Three ingredients, two minutes, and it actually travels — still perfect at noon.

3. Only use IDs from the SCHOOL FUEL LIBRARY below (all start with sf-). Never use main recipe IDs.

═══ CHEF NAME RULE ═══
Always use the chef's full name in WHAT (e.g. "Jamie Oliver", "The Happy Pear", "Nick DiGiovanni").
Never use pronouns only or first names only.

SCHOOL FUEL LIBRARY (100 recipes — ONLY use these IDs):
${sfList}

Respond now. Lead with the setup. Keep it tight.`;

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
Use EXACTLY this format for each recipe — no variations, no prose paragraphs:

**Recipe Name** [ID:exact-recipe-id]
WHAT: [One sentence. What this dish actually is and what makes this chef's take on it distinct.]
WHY: [One sentence. Why Co recommends it — make it personal, specific, worth it.]

GOOD example:
**French omelette** [ID:r-french-omelette]
WHAT: Julia Child's version is low heat, constant motion, pulled off the pan while still soft — nothing like the rubbery diner version.
WHY: Four ingredients, five minutes, and it'll wreck any scrambled eggs you've ever had.

GOOD example:
**Acai smoothie bowl** [ID:sf-acai-bowl]
WHAT: The Happy Pear built their whole thing around fast breakfasts that don't taste like health food — acai base, fruit, granola, done in 5 minutes.
WHY: Feels indulgent, isn't, and you're actually fueled for the day instead of crashing by 10am.

The frontend displays the chef name separately from the recipe data — you do NOT need to include it in WHAT or WHY beyond the first mention in WHAT.

═══ MATCHING RULES ═══
- "school lunch" / "pack tomorrow" → ONLY sf- IDs (School Fuel). Never a 2-hour recipe.
- "under 10 min" → strictly under 10 min in the recipe data
- "about 20 min" → 15-25 min range
- "healthy and light" → hs:4-5 recipes, avoid heavy/fried
- "comfort food" → pasta, soup, mac & cheese, burgers, grilled cheese
- "bold and flavorful" → spicy, smoky, umami-heavy, international cuisines
- "vegetarian" / "vegan" → zero exceptions
- "impressive" → Michelin-chef recipes, wow-tagged

═══ WHAT TO AVOID ═══
- Skipping the setup sentence — it must always be there
- Any recipe description that doesn't open with the chef's full name
- Making up IDs or chef names — use ONLY what's in the library below
- Starting every response with "Hey!" — vary your opening
- Asking "would you like me to suggest?" — just suggest

THE LIBRARY

MAIN RECIPES (192 — use these IDs):
${recipeList}

SCHOOL FUEL — quick lunches & snacks under 20 min (100 — IDs start with sf-):
${sfList}

Respond now. Lead with the setup. Name the chef for every recipe. Give the Co POV. Keep it tight.`;

    // Select prompt based on mode
    const activePrompt = isSchoolFuel ? sfSystemPrompt : systemPrompt;

    // Call Anthropic API
    const MODEL = 'claude-haiku-4-5-20251001';
    console.log(`[buddy] mode=${mode||'default'} model=${MODEL} messages=${messages.length}`);

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
        system: activePrompt,
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
