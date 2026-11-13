# LOOP OUT — Tactical Operations

A browser-based first-person shooter built with plain HTML/CSS/JavaScript and Three.js.

## Current development: Stage 2 + Stage 3

### Stage 2 — 3D gameplay foundation

Implemented in the development branch:
- LOOP OUT identity, callsign/password UI, operator selection and exactly two modes.
- Two different 3D layouts: Open World training compound and Small Arena.
- First-person movement, mouse look, mobile touch movement and aiming.
- Visible rifle model, recoil, weapon sway, muzzle flash and synthesized shot sound.
- Raycast target practice, ammo, reload, score and target respawn.
- Local GLB environment assets with procedural geometry fallback.
- Responsive HUD with health, score, ammunition and room player count.

### Stage 3 — first multiplayer layer

Implemented in this branch:
- Authenticated Supabase Realtime private channels for the two modes: `loopout:open_world` and `loopout:small_arena`.
- Presence tracking for connected players.
- Position and facing broadcasts at approximately 10 updates per second.
- Basic remote operator avatars with nameplates and smoothed movement.
- Player count and connection status in the HUD.
- Realtime authorization policies scoped only to the two LOOP OUT channel names.

This is an initial synchronization prototype, not a finished multiplayer shooter. Both modes currently use one shared channel each; there is no matchmaking, room capacity, party system or match-instance allocation.

## What is still missing

- Browser testing on desktop and mobile, including two separate authenticated browser sessions.
- A server-authoritative game server. Clients currently send their own positions, so a modified client can spoof movement.
- Server-validated shooting, hit detection, health, damage, death and respawn.
- Real weapon audio assets, reload animation, character animation and detailed player models.
- Moving AI opponents, missions, progression and production-scale maps.
- Network interpolation/lag compensation, anti-cheat and load testing.

Do not treat client-broadcast movement or local target hits as secure competitive gameplay.

## Supabase setup and data boundaries

The game uses the already-authorized Supabase project. It does not create a separate project or modify other applications' tables.

The existing BLACKOUT-prefixed database objects are retained as an internal legacy namespace for compatibility:
- Player profiles: `public.blackout_player_profiles`
- Signup metadata tag: `app='blackout'`
- Realtime channel names and visible branding use LOOP OUT.

The auth trigger only creates a game profile for users carrying the game metadata tag. Supabase Auth itself is shared by the existing Supabase project, so this is not full service-level auth isolation. The browser uses only the publishable key; never put a service-role or secret key in frontend code.

Required dashboard settings:
1. In Supabase Dashboard, open **Realtime → Settings**.
2. Disable **Allow public access to channels** so the private-channel RLS policies are enforced.
3. In **Authentication → Sign In / Providers**, disable email confirmations for this nickname/password prototype, or configure a compatible email flow. The UI maps callsigns to synthetic internal email identifiers, so players do not enter email addresses.

The Realtime policies are in `supabase/migrations/20261113_loop_out_realtime_room_authorization.sql`. They allow authenticated users to read/write Presence and Broadcast only on the two named LOOP OUT topics. The migration does not create or alter other apps' tables.

## Run

Serve the repository using GitHub Pages or a local static server. Three.js and GLTFLoader are loaded from jsDelivr.

Desktop: WASD to move, Shift to sprint, mouse to aim, click to fire, R to reload.

Touch devices: left virtual stick to move, drag the field to aim, and use FIRE / RELOAD.

## Development branch

`loop-out-stage-2-3`

The default branch remains untouched. The branch is not yet browser-verified; run two separate signed-in sessions in the same mode to validate the first realtime player sync.


## RAAZIM launch and device handling
- A branded RAAZIM startup screen precedes authentication.
- Supabase's persistent browser session is restored after the startup screen; returning players skip the login form unless they sign out or the browser session expires.
- The first user gesture requests fullscreen and landscape orientation where the browser supports those APIs.
- Phones that do not permit programmatic orientation locking (notably some iOS browser contexts) receive a rotate-to-landscape gate rather than a false promise that the browser can force rotation.
- Touch hardware uses a lower render pixel ratio and disables dynamic shadow maps to reduce GPU load. Desktop keeps higher quality rendering.
- The game view fills the screen on touch devices in landscape, with safe-area-aware HUD and controls.


## Combat update: local AI opponents
- Each map now spawns a small squad of AI combatants.
- Bots approach and strafe around the player, take shots inside engagement range, and respawn after elimination.
- Bot damage reduces the player's health; zero health triggers a local respawn.
- Hits on bots require two body hits in this prototype; eliminations increment the HUD counter.
- AI, damage and respawn are currently simulated on each browser client. They are not synchronized or server-validated, so this is a playable local combat layer, not cheat-resistant online PvP.
