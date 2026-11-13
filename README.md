# LOOP OUT — Tactical Operations

LOOP OUT is a browser-based first-person shooter built with HTML, CSS, JavaScript and Three.js. The production GitHub Pages source is the `main` branch.

## Included game

- RAAZIM startup screen before account access.
- Supabase callsign/password account flow and persistent browser sessions.
- Recon, Assault and Support operator selection.
- Two game modes: Open World and Small Arena.
- First-person movement, mouse aiming and mobile touch controls.
- Weapon model, recoil, sway, muzzle flash, synthesized firing sound, ammunition and reload.
- Training targets and local AI opponents with local damage, eliminations and respawn.
- Supabase Realtime presence, remote player nameplates and movement broadcasts.
- Landscape-first mobile game layout, safe-area-aware HUD and touch-oriented rendering quality.
- Kenney CC0 environment assets; see `assets/blackout/CREDITS.md`.

## Install as an app

LOOP OUT is configured as a Progressive Web App (PWA). Open the published site over HTTPS:

- **iPhone/iPad:** open the site in Safari, tap Share, then choose **Add to Home Screen**. The installed icon uses the official `gamelogo.png` penguin.
- **Android/desktop Chromium browsers:** open the site and use the browser's **Install app** or **Add to Home Screen** option when offered.

The installed app opens in standalone mode with the same penguin icon and LOOP OUT app name. The service worker caches the app shell; gameplay still requires an internet connection for Supabase authentication, multiplayer presence, and externally hosted Three.js resources.

## Controls

**Desktop:** WASD to move, Shift to sprint, mouse to aim, click to fire, R to reload.

**Touch devices:** left virtual stick to move, drag the field to aim, FIRE and RELOAD controls. The game requests landscape orientation and fullscreen after the user's startup gesture. Some mobile browsers (including iOS Safari in certain contexts) do not permit websites to force orientation; the rotate prompt is the fallback.

## Multiplayer and security limitations

The current multiplayer layer is a realtime presence/position-sharing prototype. Each mode currently has one shared channel, not individual match instances. There is no matchmaking, party system or room capacity. Client-reported positions can be spoofed. AI, hit detection, damage, death and respawn are local to each browser and are not server-authoritative.

A dedicated authoritative game server is still required for production online PvP, synchronized combat, reliable match state and anti-cheat. This branch has passed JavaScript syntax and entrypoint checks, but has not been validated through full desktop/mobile browser QA or two real simultaneous player sessions.

## Supabase configuration

The game uses the already-authorized Supabase project and its existing game-specific profile table, `public.blackout_player_profiles`. Legacy BLACKOUT-prefixed database objects remain for compatibility; visible game branding is LOOP OUT. The browser must use only the publishable key. Never expose a service-role key in frontend code.

Before nickname/password signup and private realtime channels work correctly, verify these Supabase dashboard settings:

1. **Realtime → Settings:** disable **Allow public access to channels** so private-channel RLS policies are enforced.
2. **Authentication → Sign In / Providers:** disable email confirmation for this synthetic-email callsign flow, or configure a compatible confirmation process.

The SQL setup and realtime authorization migration are in `supabase/schema.sql` and `supabase/migrations/`. Auth is shared at the Supabase project level; the profile table and trigger metadata are namespaced, but this is not full service-level auth isolation.

## Deployment

GitHub Pages deploys from `main`. The root `index.html`, `game.js`, assets, and Supabase SQL files are included in this branch. Three.js and GLTFLoader are loaded from jsDelivr.

## Validation

The `LOOP OUT validation` GitHub Actions workflow checks the game module syntax, inline application JavaScript syntax, required game entrypoints, and a headless Chromium startup smoke test on desktop and mobile. The browser test loads the real Three.js module and verifies that the RAAZIM entry button reveals the authentication screen.
