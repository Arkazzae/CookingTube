# Cooking Tube

Polish React app: paste a public YouTube link, wait, and get ingredients and cooking steps. React 19, TypeScript, Next.js and the Gemini API. Local preview and Vercel use the same Next.js server.

## Run locally

```sh
npm install
cp .env.example .env.local
# Set GEMINI_API_KEY in .env.local.
npm run dev
```

Open http://127.0.0.1:5173. `GEMINI_MODEL` defaults to `gemini-3.5-flash`; `gemini-3.8-flash` and `gemini-3.5-flash-lite` can also be selected. The key stays on the server. Never prefix it with `NEXT_PUBLIC_` or commit `.env.local`.

## Vercel

Deploy the `web` directory. Set `GEMINI_API_KEY` as a sensitive Vercel environment variable and `GEMINI_MODEL=gemini-3.5-flash` in the deployment's environment. `vercel.json` configures Next.js and the build command.

```sh
npm run build:vercel
vercel deploy
```

## How it works

1. The form sends a link to `POST /api/recipe`. The server validates the YouTube host and video ID, bounds the request body, and rejects cross-origin browser requests.
2. The server sends the canonical public YouTube URL directly to [Gemini's video input](https://ai.google.dev/gemini-api/docs/video-understanding). It does not need to scrape YouTube captions from a Vercel IP address.
3. Gemini analyzes the video's audio and images and returns a Polish recipe using a JSON schema. The server validates the structure, rejects non-recipes and repetitive output, and removes quantities without a supporting model quotation. The browser validates the result again.
4. Ingredients and steps can be checked off. A link to the original film is always visible. The sample recipe is explicitly labelled and is never used as a fallback for a failed video.

There is no model download or WebGPU requirement. The UI supports cancellation and a bounded wait. Cancellation aborts the outgoing request when the runtime propagates the disconnect; provider computation may still finish. The provider request uses `store: false`, which disables interaction storage, not the provider's other data policies.

## Limits

- Only public YouTube videos accessible without sign-in are supported by this path. Private, unlisted, restricted or unavailable films may fail. The YouTube input feature is in preview.
- Gemini can mishear or miss details. Evidence quotations are model-generated observations, not independently verified transcripts. Unknown quantities remain blank. Exact step timestamps are omitted because there is no separate caption source to verify them.
- The selected models offer a [free tier with quotas](https://ai.google.dev/gemini-api/docs/pricing). Actual quotas and billing depend on the Google project. The app does not enable billing or automatically change providers/models when a quota is exhausted.
- Requests time out after two minutes of provider processing. Overload, quota and unavailable-video errors have Polish messages; provider error bodies and credentials are never returned to the browser.
- The cache holds up to 50 recipes for one hour per server instance. A two-request concurrency cap also applies per instance; these are best-effort protections, not a distributed rate limit.
- There is no account or persistent recipe storage yet.

The previous WebGPU experiment remains in `lib/local-recipe.ts` and `workers/recipe.worker.ts`, with a manual `build:worker` command. It is not imported by the current page or built during deployment. Legacy caption helpers and their tests remain for reference. The optional Cloudflare scripts are retained separately; the Gemini integration is verified on Next.js/Vercel.

## Local configuration

Keep API keys in `.env.local` (see `.env.example`). Git ignores environment
files, private keys, local deployment metadata and tool state throughout the
repository. Only templates without credentials or project identifiers belong
in version control.

The optional Cloudflare build uses `.openai/hosting.example.json` by default.
To configure deployment-specific bindings, copy it to `.openai/hosting.json`
and edit that ignored local file. The build reads the same configuration and
copies it into the ignored `dist` output. Vercel does not upload `.openai`.

## Checks

```sh
npm test
npx tsc --noEmit
npm run build:vercel
```

The API tests cover direct video input, credential isolation, source URL validation, malformed requests, non-recipes, quota errors, cancellation, caching and concurrency. A live test also needs an API key and consumes provider quota.
