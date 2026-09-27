from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    admin_base_project,
    admin_billing,
    admin_developers,
    admin_discounts,
    admin_feature_requests,
    admin_maintenance,
    admin_meetings,
    admin_projects,
    admin_tickets,
    admin_users,
    auth,
    billing,
    developer_tickets,
    discounts,
    feature_requests,
    maintenance,
    meetings,
    profile,
    project_features,
    projects,
    tickets,
    ws,
)
from app.core.config import settings

IS_PRODUCTION = settings.ENVIRONMENT == "production"

app = FastAPI(
    title=settings.PROJECT_NAME,
    # The interactive docs publish a full map of every route and schema.
    # Keep them for local work, hide them in production.
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    if IS_PRODUCTION:
        # Tells the browser to refuse plain HTTP for this host from now on,
        # so a network attacker cannot strip TLS on a later visit.
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


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
app.include_router(projects.router)
app.include_router(meetings.router)
app.include_router(tickets.router)
app.include_router(feature_requests.router)
app.include_router(project_features.router)
app.include_router(discounts.router)
app.include_router(billing.router)
app.include_router(maintenance.router)
app.include_router(maintenance.client_router)

# Admin routers
app.include_router(admin_users.router)
app.include_router(admin_developers.router)
app.include_router(admin_projects.router)
app.include_router(admin_base_project.router)
app.include_router(admin_meetings.router)
app.include_router(admin_meetings.project_scoped_router)
app.include_router(admin_tickets.router)
app.include_router(admin_tickets.project_scoped_router)
app.include_router(admin_feature_requests.router)
app.include_router(admin_feature_requests.project_scoped_router)
app.include_router(admin_discounts.router)
app.include_router(admin_discounts.project_scoped_router)
app.include_router(admin_billing.router)
app.include_router(admin_billing.project_scoped_router)
app.include_router(admin_maintenance.router)
app.include_router(admin_maintenance.records_project_scoped_router)
app.include_router(admin_maintenance.infra_costs_project_scoped_router)

# Developer-facing routers
app.include_router(developer_tickets.router)

# WebSocket (real-time sync)
app.include_router(ws.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
