# MyPlant 🌿

A modern web app for **AI plant identification** with full **Pl@ntNet** integration and GBIF enrichment.

## Features

- **Identify plants** from 1–5 photos (flower, leaf, fruit, bark, or auto)
- Confidence scores, scientific & common names, family/genus
- Choose flora/project (World, Useful plants, Weeds, Invasive…)
- Multi-language common names
- **Species search** against Pl@ntNet taxonomy
- Name alignment / synonym resolution
- **Rich details** via GBIF (full taxonomy, vernacular names, media)
- Links to GBIF and POWO (Plants of the World Online)
- Clean dark UI, fully client-side, API key stored only in your browser

## Quick start

1. Get a free API key at [https://my.plantnet.org](https://my.plantnet.org)  
   (500 identifications/day free)

2. Open `index.html` in a browser **or** serve the folder:

   ```bash
   # Python
   python -m http.server 8080

   # or Node
   npx serve .
   ```

3. Go to **Settings**, paste your API key, and save.

4. Important for browser use:
   - On my.plantnet.org → API key settings → check **“Expose my API key”**
   - Add your origin (e.g. `http://localhost:8080`) under **Authorized domains**

## How it works

| Action              | Pl@ntNet endpoint                          | Extra data      |
|---------------------|--------------------------------------------|-----------------|
| Identify from photo | `POST /v2/identify/{project}`              | + related images |
| Search species      | `GET /v2/projects/.../species?prefix=`     |                 |
| Align name          | `GET /v2/projects/.../species/align`       |                 |
| Plant details       | GBIF Species API                           | taxonomy, names, media |

## Credits

- Plant identification engine: [Pl@ntNet](https://plantnet.org/)
- Biodiversity data: [GBIF](https://www.gbif.org/)
- Taxonomy references: POWO / Kew

The image-based plant species identification service is based on the Pl@ntNet recognition API, regularly updated and accessible through https://my.plantnet.org/
