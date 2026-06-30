# Two Truths and a Lie 🎮

Team icebreaker game — players submit privately, host controls everything, real-time sync across any network.

Built with React + Supabase Realtime + Netlify.

---

## Deploy in 4 steps

### Step 1 — Supabase setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the **SQL Editor** and paste the contents of `supabase_schema.sql` → Run
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

### Step 2 — Configure environment

Copy `.env.example` to `.env`:

```
cp .env.example .env
```

Fill in your Supabase values:

```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 3 — Deploy to Netlify

**Option A — Netlify CLI (fastest):**
```bash
npm install
npm run build
npx netlify deploy --prod --dir=build
```

**Option B — Netlify UI:**
1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com) → New site from Git
3. Build command: `npm run build`
4. Publish directory: `build`
5. Add environment variables in Site Settings → Environment Variables

### Step 4 — Add env vars to Netlify

In Netlify dashboard → Site Settings → Environment Variables → Add:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

Redeploy. Done.

---

## How to play

### For the host:
1. Open the app → click **"I'm the host"**
2. A 4-letter game code appears — share it in your meeting chat
3. Watch players join in real time
4. Hit **Start** when everyone's ready
5. Use the Host Panel to drive each round:
   - Click "Show statements" to start voting
   - 30-second timer counts down
   - Players vote on their own device privately
   - Click "Reveal the lie!" when ready
6. Scoreboard updates automatically — podium at the end

### For players:
1. Open the app on their own device → click **"I'm a player"**
2. Enter the 4-letter code + their name
3. Type 3 statements privately (only they can see this)
4. Pick which one is the lie
5. Wait for the host to start their round
6. Vote privately on their device
7. See result instantly after reveal

### Scoring:
- Liar fools someone → **+1 point per person fooled**
- Player guesses correctly → **+1 point**

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 (Create React App) |
| Realtime sync | Supabase Realtime (postgres_changes) |
| Database | Supabase (PostgreSQL) |
| Hosting | Netlify |
| Styling | Plain CSS (no Tailwind) |

---

## Project structure

```
src/
├── components/
│   ├── Landing.jsx     # Home screen — host or player
│   ├── Host.jsx        # Host lobby + game panel + scoreboard
│   └── Player.jsx      # Join + submit + vote + result
├── lib/
│   ├── supabase.js     # Supabase client
│   └── useGame.js      # Game state hook
├── App.jsx             # Root — screen router
└── App.css             # All styles
```

---

## Built by
Shubham Majumdar — [github.com/smajumdar22](https://github.com/smajumdar22)
