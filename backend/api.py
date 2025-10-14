"""Main FastAPI application with CORS configuration and router registration."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routers import data, exploration, discovery, conformance
from routers import ocpm_exploration

# Initialize FastAPI app
app = FastAPI(title="Oasis API", version="1.0.0")

# Add CORS middleware to allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:5173"],  # Vite dev server ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint - returns welcome message"""
    return {"message": "Welcome to Oasis API", "status": "running"}

# ============================================================================
# REGISTER ROUTERS
# ============================================================================

# Data management endpoints (upload/manage logs & models)
app.include_router(data.router, tags=["Data Management"])

# Exploration endpoints (DFG & visualization)
app.include_router(exploration.router, tags=["Exploration"])

# Discovery endpoints (process discovery algorithms)
app.include_router(discovery.router, tags=["Discovery"])

# Conformance checking endpoints
app.include_router(conformance.router, tags=["Conformance"])

# OCPM (Object-Centric Process Mining) endpoints
app.include_router(ocpm_exploration.router, tags=["OCPM"])

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
