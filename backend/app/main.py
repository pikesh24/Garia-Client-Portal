from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    admin_base_project,
    admin_billing,
    admin_discounts,
    admin_feature_requests,
    admin_maintenance,
    admin_meetings,
    admin_tickets,
    admin_users,
    auth,
    billing,
    discounts,
    feature_requests,
    maintenance,
    meetings,
    profile,
    project_features,
    tickets,
)
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Client-facing routers
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(meetings.router)
app.include_router(tickets.router)
app.include_router(feature_requests.router)
app.include_router(project_features.router)
app.include_router(discounts.router)
app.include_router(billing.router)
app.include_router(maintenance.router)

# Admin routers
app.include_router(admin_users.router)
app.include_router(admin_base_project.router)
app.include_router(admin_meetings.router)
app.include_router(admin_tickets.router)
app.include_router(admin_feature_requests.router)
app.include_router(admin_discounts.router)
app.include_router(admin_billing.router)
app.include_router(admin_maintenance.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
