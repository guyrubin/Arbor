# Studio V2 private review build

This entry renders the actual production Studio V2 home, worlds, quest, collection and games. Do not replace the home with a separate presentation gallery.

From `app/`, run:

```sh
npx vite build --config scripts/studio-v2-preview/vite.config.ts
```

Output: `dist-studio-preview/` under `app/`. Deploy the built index and external assets with the neutral `public/visuals/studio-v2/`, `public/fonts/`, and Sneak audio/scenery assets. Never copy `_proof/hero`, private book assets, production environment variables, family data or the design export's fixed child illustrations.

The preview adapters provide a synthetic five-year-old profile, browser speech, no telemetry and dedicated bounded local creation/quest collections. Sprout is the correct production fallback for a profile without an approved avatar. The interface itself is not mocked. The parent hold/challenge control is retained; completing it returns to the review's sky.

Publication of this private review is separate from merging or deploying Arbor production.
