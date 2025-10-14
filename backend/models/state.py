"""Global state management for logs, models, and OCELs."""

# Store lists of uploaded logs and models
# Each log entry contains: {"metadata": {...}, "log_object": ...}
logs = []
models = []

# Store list of uploaded OCELs (Object-Centric Event Logs)
# Each OCEL entry contains: {"metadata": {...}, "ocel_object": ...}
ocels = []

# Global variable for the currently active model (used by conformance)
model = None

