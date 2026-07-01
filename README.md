# Forest Wanderer — Three.js Isometric RPG (MVP)

An isometric, RPG-style game built with [Three.js](https://threejs.org/) and
bundled with [Vite](https://vitejs.dev/), ready to deploy on
[Vercel](https://vercel.com/).

This MVP places an **animated character in a procedurally generated forest**
and lets you move around with classic click-to-move controls.

## Features

- 🎥 **Isometric camera** — an orthographic camera at a fixed angle that smoothly
  follows the character.
- 🧍 **Animated character** — a low-poly humanoid built entirely from primitives
  with a procedural walk cycle (swinging arms/legs, step bounce) and an idle
  breathing bob. No external 3D model files required.
- 🌲 **Procedural forest** — conifers, rocks and shrubs scattered with a seeded
  PRNG so the layout is stable between reloads.
- 🖱️ **Click / tap to move** — raycast onto the ground and walk the character to
  the marked spot; it turns to face the direction of travel.
- 🧭 **Obstacle-avoiding navigation** — grid-based A* pathfinding routes the
  character around trees and rocks instead of through them.
- 🌊 **Stream & bridge** — a rippling stream crosses the forest; the water is
  impassable, so the character must route to the wooden bridge to cross.
- 🦌 **Wildlife** — wandering deer and scurrying squirrels (which share the
  player's navigation grid, so they avoid trees, rocks and the stream) plus
  birds circling overhead with flapping wings. The deer and squirrels are
  skittish: when the player gets close they **flee** — routing away with the
  same pathfinding, at a faster gait (the deer bounds, the squirrel darts) —
  and settle back into wandering once you give them space.
- 🎣 **NPC + branching dialogue** — a fisherman stands on the bridge with an
  animated rod, line and bobber; walk up to him and he strikes up a conversation
  with clickable answer/question options (a small dialogue tree). He even points
  you toward the chest.
- 🧰 **Chest & loot** — an animated treasure chest opens as you approach; a loot
  interface lets you take items (or "Take All") into your bag.
- 🎒 **RPG inventory, equipment & stats** — a bag with **limited slots** and a
  **weight/carry-capacity** limit (scales with Strength); an equipment paperdoll
  (**helmet, chestplate, gloves, belt, boots, weapon, shield**) whose gear
  **appears on the 3D character**; a character sheet with attributes
  (STR/DEX/VIT/INT), Armor, Damage, Health and Gold; hover **tooltips** on every
  item. Open it with the 🎒 button or the **I** key.
- 🗂️ **Item taxonomy** — items carry a **rarity** (Common → Uncommon → Rare →
  Epic → Legendary), **item level**, weight, value, protection/damage, attribute
  bonuses and **magical powers** (affixes like *Flaming* or *of the Bear*). Higher
  rarity scales stats and adds more magic. Consumables (food/potions) heal, coins
  become gold.
- 🐕 **Companion dog** — a loyal dog follows the player (trotting to catch up
  when it falls behind) and otherwise roams and explores nearby, tail wagging.
  It uses the same navigation grid, so it rounds obstacles and crosses the
  bridge to stay with you.
- 🐎 **Scripted encounter** — cross the bridge and a mounted knight rides up,
  blocks the way and warns "Halt or I'll attack!". Press on toward him and he
  couches his lance, charges and runs you through — a death screen with a
  restart. Retreat (or wait) and he stands down.
- ☀️ **Atmosphere** — soft shadows, hemisphere + directional lighting, and
  distance fog.

Everything is self-contained (no asset downloads), so it builds and deploys
reliably as a static site.

## Version stamp

The loading screen (and a subtle badge in the bottom-left corner) shows a build
stamp so you can confirm you're running the latest version:

```
v<package.json version> · <git commit> · built <UTC timestamp>
```

The version, commit hash and build time are injected at build time
(`vite.config.js`). The semantic version is bumped in `package.json` with each
change, and the git commit/timestamp update on every build — so if the stamp
matches the latest commit, you know the deployment is current.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build locally
```

## Deploying to Vercel

The project is configured for Vercel's Vite preset (see `vercel.json`):

- **Build command:** `npm run build`
- **Output directory:** `dist`

Deploy either by importing the repository in the Vercel dashboard, or with the
CLI:

```bash
npm i -g vercel
vercel        # preview deployment
vercel --prod # production deployment
```

## Project structure

```
index.html         # canvas + HUD, loads the module entry point
src/main.js        # renderer, scene, isometric camera, lighting, game loop
src/character.js   # procedural animated humanoid
src/forest.js      # procedural world (ground, trees, rocks, shrubs)
src/stream.js      # animated stream + wooden bridge
src/wildlife.js    # deer, squirrels, birds and the companion dog
src/npc.js         # fisherman NPC (rod, line, bobber, idle animation)
src/dialogue.js    # branching dialogue panel (clickable options)
src/chest.js       # treasure chest with an animated hinged lid
src/items.js       # item taxonomy: rarity, slots, affixes, base items, makeItem
src/inventory.js   # inventory, equipment paperdoll, character stats + loot UI
src/knight.js      # mounted knight (horse, lance, shield) for the encounter
src/navigation.js  # A* grid pathfinding (obstacle + stream avoidance)
src/style.css      # HUD + layout
vite.config.js     # Vite build config (relative base for static hosting)
vercel.json        # Vercel framework/build settings
```

## Where to go next

- Swap the primitive character for a glTF model with skeletal animation
  (`GLTFLoader` + `AnimationMixer`).
- Add collision against trees/rocks, an inventory, NPCs, or enemies.
- Introduce terrain height, a day/night cycle, or pathfinding.
