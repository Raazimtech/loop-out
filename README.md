# BLACKOUT — Tactical Operations

A browser-based first-person multiplayer shooter, built in stages with plain HTML/CSS/JavaScript and Three.js planned for the 3D runtime.

## Current stage: 1 — Player foundation

Implemented in this branch:
- New BLACKOUT game interface replacing the old customer-support dashboard.
- Callsign/password account screens (Supabase-backed once the dedicated project is connected).
- Operator selection: Recon, Assault, Support.
- Exactly two deployment modes: Open World and Small Arena.
- Responsive desktop/mobile layout.
- Clear deployment placeholder rather than fake gameplay controls.

Not implemented yet:
- 3D movement, weapons, maps, bots, multiplayer rooms, live player synchronization.
- Supabase project connection and live account testing.

## Supabase isolation

**Do not connect this game to any existing Supabase project.** Create a separate project named `blackout-game` and run `supabase/schema.sql` in that project's SQL Editor.

Then:
1. In Supabase Authentication settings, disable email confirmations for this prototype. Nickname login uses a synthetic internal email address (`<nickname>@players.blackout.invalid`) because Supabase password authentication requires an email or phone identifier. Players never enter an email.
2. Add the dedicated project's Project URL and publishable key to the two constants at the top of the inline script in `index.html`.
3. Keep service-role keys out of browser code. Only the publishable/anon key belongs in this static frontend.
4. Test registration, duplicate nicknames, sign-in and profile persistence before starting Stage 2.

The database schema is scoped exclusively to this game. No existing app tables, credentials or data are reused.

## Development branch

`game-stage-1-foundation`

The default branch is intentionally untouched until the staged build is reviewed and ready to merge.
