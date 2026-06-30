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
  navigation grid, so they also avoid trees and water) plus birds circling
  overhead with flapping wings, to bring the scene to life.
- ☀️ **Atmosphere** — soft shadows, hemisphere + directional lighting, and
  distance fog.

Everything is self-contained (no asset downloads), so it builds and deploys
reliably as a static site.

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
src/wildlife.js    # deer, squirrels and birds with natural animation
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
