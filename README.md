# Oasis

Oasis is a process mining workspace for exploring event logs, process models, and object-centric event logs in one place.

It combines a Next.js frontend with a FastAPI backend and PM4Py-based analysis tools. The project includes starter assets.

## What Oasis Can Do

Oasis supports both case-centric process mining and object-centric process mining.

- Upload and manage event logs, process models, and OCEL files
- Explore logs and OCELs with summary views and visualizations
- Discover process models from logs
- Run conformance checks between logs and models
- Compare models and inspect custom trace diagnostics
- Flatten OCEL data for case-centric analysis
- Run AutoPM and object-centric analysis workflows from the same workspace

Main workspace areas in the UI:

- `Data`
- `Flatten OCEL`
- `Exploration`
- `Discovery`
- `Conformance`
- `AutoPM`
- `OCPM Exploration`
- `OCPM Discovery`
- `OCPM Conformance`
- `AutoOCPM`

## Recommended Usage

The recommended way to use Oasis is locally with Docker.

The deployed version is useful for viewing the interface and browsing the project, but its backend is intentionally limited. For uploads, analysis runs, and the full interactive workflow, local Docker usage is the better experience.

## Run Locally With Docker

Requirements:

- Clone the repo
- Docker Desktop or Docker Engine with Compose

Start the app:

```bash
docker compose up --build
```

Then open:

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API: [http://localhost:8000](http://localhost:8000)

Stop the stack with:

```bash
docker compose down
```
