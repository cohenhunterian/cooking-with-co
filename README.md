# Cooking with Co

Recipe site built by a 5th grader and his dad. 192 chef recipes + 100 School Fuel snacks/lunches + AI Chef Buddy.

---

## What's in here

```
cooking-with-co/
├── index.html              ← The whole site (one file, ~680KB)
├── netlify.toml            ← Netlify config
├── netlify/
│   └── functions/
│       └── buddy.js        ← AI Chef Buddy proxy (calls Anthropic API securely)
└── README.md               ← This file
```

---

## First-time setup

### 1. Push to GitHub

```bash
cd cooking-with-co
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/cooking-with-co.git
git push -u origin main
```

### 2. Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Pick **GitHub**, authorize, choose your `cooking-with-co` repo
3. Build settings: leave everything default (the `netlify.toml` handles it)
4. Click **Deploy**
5. Wait ~30 seconds — your site is live at something like `https://random-name-123.netlify.app`

### 3. Add the Anthropic API key

This is what makes AI Chef Buddy actually smart:

1. Get an API key at [console.anthropic.com](https://console.anthropic.com) (need to add ~$5 credit)
2. In your Netlify site dashboard → **Site configuration** → **Environment variables** → **Add a variable**
   - Key: `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-...` key
3. Click **Save**
4. Trigger a redeploy: **Deploys** → **Trigger deploy** → **Deploy site**

### 4. (Optional) Custom domain

In Netlify dashboard → **Domain management** → **Add a domain** — point your own domain at the site.

---

## Everyday workflow

**Make changes:**
1. Edit `index.html` (or any file)
2. Commit & push to GitHub:
   ```bash
   git add .
   git commit -m "describe what changed"
   git push
   ```
3. Netlify auto-deploys in ~30 seconds. Your site updates automatically.

**Test locally:**
```bash
# Install Netlify CLI (one-time)
npm install -g netlify-cli

# Run locally with functions working
netlify dev
# Opens http://localhost:8888 with the function proxy hooked up
```

---

## How the AI Chef Buddy works

When a kid types in the chat:

1. Browser POSTs to `/.netlify/functions/buddy` with the message + recipe data
2. Netlify function receives it, adds the system prompt, calls Anthropic with your API key
3. API key never leaves the server — kids and visitors can't see it
4. Claude responds → function returns text → browser renders it as cards

**If the function fails** (no API key, network error, rate limit), the buddy falls back to the built-in local keyword matcher. So the site never breaks.

---

## Costs

- **Netlify**: free tier covers 125,000 function calls/month. You won't hit it.
- **Anthropic**: Claude Sonnet 4 is ~$3 per million input tokens. A typical chat = ~2,000 tokens. ~$1-3/month for a family.

---

## Troubleshooting

**AI Buddy not working?**
- Check Netlify dashboard → **Functions** tab → click `buddy` → **Logs**. Errors show up there.
- Most common: forgot to add `ANTHROPIC_API_KEY` env variable, or didn't redeploy after adding it.

**Site shows old version?**
- Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R).
- Check Netlify **Deploys** tab — confirm the latest commit deployed successfully.

**Local dev not connecting to function?**
- Make sure you ran `netlify dev` not just `python3 -m http.server`.
- Run `netlify link` first to connect to your Netlify site.
