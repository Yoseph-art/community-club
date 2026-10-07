# Community Club Matchday

Squad, training, games and injuries for Community Club turf football.

Plain HTML, CSS and JavaScript. No build step.

## Run locally

```
node serve.mjs
```

Then open http://localhost:5070

## Data

Everything is saved in the browser on each device (localStorage). Use Settings → Backup to download a copy.
Shared data across phones comes later (Supabase); only `store.js` changes for that.

## Files

- `index.html` – page shell
- `styles.css` – look and layout
- `app.js` – screens and logic
- `store.js` – where data is saved
- `sample-data.js` – made-up squad for trying the app
