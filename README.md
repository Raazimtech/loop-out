# BLACKOUT — Tactical Operations

A browser-based first-person shooter built in stages with plain HTML/CSS/JavaScript and Three.js.

## Current stage: 2 — 3D gameplay foundation

Implemented:
- BLACKOUT identity, callsign/password account UI, operator selection and exactly two modes.
- BLACKOUT-only player profile table and signup trigger, isolated with unique `blackout_` names in the already-authorized Supabase project.
- Three.js first-person training range with mouse look, WASD movement, collision boundaries, weapon firing, raycast hit detection, target dummies, ammo/reload and score.
- Mobile touch movement/look/fire/reload controls.
- Responsive desktop and mobile HUD.

Not implemented yet:
- Online multiplayer, synchronized players, matchmaking/rooms, server-authoritative combat, AI opponents, advanced weapons, missions or a production-scale open world.
- Real match separation between Open World and Small Arena; both currently load the training-range prototype, with the selected mode shown in the HUD.

## Data isolation and authentication

BLACKOUT uses only `public.blackout_player_profiles` and functions/triggers prefixed `blackout_`. Its auth trigger only processes accounts tagged with `app='blackout'`; unrelated app signups do not create BLACKOUT profiles. No existing app tables are changed.

The browser uses the project's publishable key only. Never put a service-role key in frontend code. Callsigns are mapped to an internal synthetic email for Supabase password authentication; players never enter an email. Email confirmation must be disabled in the project's Auth settings for this prototype. Test that setting before treating signup as production-ready.

## Run

Open the repository through GitHub Pages or a local static server. The 3D runtime loads Three.js from jsDelivr. Use WASD + mouse + click to fire on desktop. On touch devices, use the left virtual stick and on-screen fire/reload controls.

## Development branch

`game-stage-1-foundation`

The default branch remains untouched until the staged build is reviewed.
