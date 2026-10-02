# CookingTube — architecture

An overview of the interface. Deployment, storage and the API are covered in the [technical guide](TECHNICAL.md).

## Stack

- **Next.js 16 + React 19**, TypeScript, plain CSS design tokens, self-hosted Onest and Bricolage Grotesque fonts.
- **Gemini** video understanding through the Interactions API; the key stays on the server.
- **Local-first data**: `useSyncExternalStore` stores for the library, progress, shopping list and timers, validated with Zod.
- **Watch & cook** with the YouTube IFrame API on `youtube-nocookie.com`, loaded only when you press play.
- **Canvas-rendered** share images and a print stylesheet for the PDF card.
- **PWA** with an offline fallback, plus optional Cloudflare storage for a shared, votable library.

```
app/            routes: home, recipe, cooking mode, PDF card, library, favourites, shopping, API
components/app  shell, generation, sheets, watch & cook, timer, sharing
components/screens  one file per screen
lib/            Gemini pipeline, local library, i18n, icons, timers, covers
data/           the curated list of popular videos
public/         fonts, icon sprites, covers and photography
```
