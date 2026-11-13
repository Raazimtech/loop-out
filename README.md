# LOOP OUT — Offline Survival

LOOP OUT is a single-player first-person survival shooter built with HTML, CSS, JavaScript and Three.js.

## Gameplay
- Splash screen, then straight into the game. No account, sign-in, registration, server session or multiplayer.
- Survive waves of pursuing zombies and hunter drones that chase and attack the player.
- Shoot enemies, reload, track health and eliminations. Enemies respawn after being eliminated.
- Open World and Small Arena environments, procedural weapon, recoil, muzzle flash and synthesized gunshot sound.
- Desktop keyboard/mouse controls and mobile touch controls.
- Player name is editable directly in the HUD and saved only on the device.

## Offline play and installation
LOOP OUT is a Progressive Web App. Open the published HTTPS site once while online so the service worker can cache the app shell, Three.js modules and local map assets. After that first successful cache, the installed app can launch and play without a network connection.

- **iPhone/iPad:** open in Safari, tap Share, then Add to Home Screen.
- **Android/desktop Chromium:** use Install app / Add to Home Screen when offered.

The app uses the official penguin logo from `gamelogo.png`. Offline availability depends on completing the first online load and service-worker cache install before going offline.

## Controls
**Desktop:** WASD move, Shift sprint, mouse aim, click fire, R reload.

**Touch:** left stick move, drag the field to aim, FIRE and RELOAD buttons. Landscape is recommended.

## Technology
- Three.js 0.180.0, cached by the service worker for offline use.
- Kenney CC0 environment assets in `assets/blackout/`; see `CREDITS.md`.
- No Supabase SDK, authentication, database, realtime channel or backend connection.
