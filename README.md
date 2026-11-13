# LOOP OUT — Tactical Operations

A browser-based first-person shooter built in stages with plain HTML/CSS/JavaScript and Three.js.

## Current stage: 2 — 3D gameplay foundation

Implemented:
- LOOP OUT identity, callsign/password account UI, operator selection and exactly two modes.
- BLACKOUT-only player profile table and signup trigger, isolated with unique `blackout_` names in the already-authorized Supabase project.
- Two distinct playable layouts: a larger Open World training compound and a compact Small Arena.
- Three.js first-person movement, mouse look, a visible rifle model, muzzle flash, raycast hit detection, respawning target dummies, ammo/reload and score.
- Mobile touch movement/look/fire/reload controls.
- Responsive desktop and mobile HUD.

Not implemented yet:
- Online multiplayer, synchronized players, matchmaking/rooms, server-authoritative combat, moving AI opponents, advanced weapon systems, missions or a production-scale open world.
- Combat is currently a local target range: dummies are stationary practice targets, not AI players. No real opponents or other human players are connected yet.

## Data isolation and authentication

BLACKOUT uses only `public.blackout_player_profiles` and functions/triggers prefixed `blackout_`. Its auth trigger only processes accounts tagged with `app='blackout'`; unrelated app signups do not create BLACKOUT profiles. No existing app tables are changed.

The browser uses the project's publishable key only. Never put a service-role key in frontend code. Callsigns are mapped to an internal synthetic email for Supabase password authentication; players never enter an email. Email confirmation must be disabled in the project's Auth settings for this prototype. Test that setting before treating signup as production-ready.

## Run

Open the repository through GitHub Pages or a local static server. The 3D runtime loads Three.js from jsDelivr. Use WASD + mouse + click to fire on desktop. On touch devices, use the left virtual stick and on-screen fire/reload controls.

## Development branch

`game-stage-1-foundation`

The default branch remains untouched until the staged build is reviewed.


## Included third-party environment assets

BLACKOUT now includes a small set of local GLB environment models:
- Kenney City Kit Suburban: three building models and a tree.
- Kenney City Kit Roads: construction barriers and cones.

Source pack: https://github.com/petroulacl/fps-buildings-env-kit
Original asset creator: Kenney.
License: CC0 / public domain, including commercial use. See `assets/blackout/CREDITS.md`.
Models load asynchronously; the existing procedural map remains as a fallback if loading fails.
