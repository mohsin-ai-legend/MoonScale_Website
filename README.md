# moonScale site

Landing page for moonScale. Plain HTML, CSS and ES modules. GSAP and three.js load
from jsDelivr through the import map in `index.html`, so there is no build step.

## Run locally

```bash
python3 -m http.server 5173
```

Open http://localhost:5173. Add `?still=1` to see the page with motion off.

## Before launch

- Paste the scheduling link into `BOOKING_URL` in `src/main.js`.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`:

1. **Check and build**: syntax-checks the JavaScript, confirms every local file the page
   links to exists, and assembles the site into `public/`. Pull requests stop here.
2. **Deploy**: publishes `public/` to Firebase Hosting (site `moonscale` in project
   `picasso-510219`, https://moonscale.web.app), then checks the live URL.

The workflow signs in to Google Cloud through Workload Identity Federation, so no key is
stored in GitHub. Only runs from `main` of this repository can use it. The repository
secrets it reads are `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_DEPLOYER_SA`.
