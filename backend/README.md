# Garia Solutions API

FastAPI backend for the Garia Solutions client portal: client/admin accounts, meetings,
support tickets, feature requests with quoting, discounts, invoices, and annual
maintenance compliance.

## Stack

- FastAPI + SQLAlchemy 2.0 + Alembic
- PostgreSQL (via `psycopg` v3)
- JWT auth (access + refresh tokens, role-based: `admin` / `client`)
- Local disk file storage (`uploads/`)
- SMTP email, falls back to console logging when unconfigured

## Setup

1. Create and activate a virtualenv, then install dependencies:

   ```
   python -m venv .venv
   source .venv/Scripts/activate   # Windows Git Bash
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` / `JWT_SECRET_KEY` at minimum.

3. Start Postgres (e.g. `docker run -e POSTGRES_USER=garia -e POSTGRES_PASSWORD=garia -e POSTGRES_DB=garia_solutions -p 5432:5432 -d postgres:16`).

4. Generate and apply the first migration:

   ```
   alembic revision --autogenerate -m "initial schema"
   alembic upgrade head
   ```

5. Run the API:

   ```
   uvicorn app.main:app --reload
   ```

6. Create the first admin user directly (no public admin signup endpoint by design):

   ```python
   from app.db.session import SessionLocal
   from app.models.user import User
   from app.models.enums import UserRole
   from app.core.security import hash_password

   db = SessionLocal()
   db.add(User(email="admin@gariasolutions.com", password_hash=hash_password("changeme"),
                full_name="Garia Admin", role=UserRole.ADMIN))
   db.commit()
   ```

## Project layout

- `app/models/` — SQLAlchemy models, one file per domain
- `app/schemas/` — Pydantic request/response models
- `app/api/routes/` — one router per portal page; `admin_*.py` routers require the admin role
- `app/services/` — business logic: pricing/discount math, invoicing, file storage, email
- `app/core/` — config, JWT/password security, shared `BusinessRuleViolation` (422) / `IrreversibleActionConflict` (409) exceptions

## Key business rules implemented

- Meetings: must be requested >=24h in advance; offline meetings require `can_book_offline_meeting`; admin reschedule -> client accept or counter-propose.
- Support tickets: attachment required to file; full status history timeline.
- Feature requests: one-way clarification rule (client can only submit a full description override, not free-form replies); authorization and base-feature activation are irreversible (409 on repeat); completion requires `actual_hours_taken`.
- Discounts: only one active discount per client — activating a new one deactivates the rest.
- Invoices: draft generation pulls eligible feature requests (`status != cancelled` and `added_by_client = true`) and/or unbilled maintenance records for the project, applies the client's active discount, then finalizing snapshots a signed document and locks the invoice. Clients only ever see finalized/paid invoices, never drafts.
- Maintenance: annual flat fee snapshotted from `project.maintenance_price`; rejected proof opens a 7-day penalty window (`penalty_deadline`). A maintenance record can be billed on an invoice at most once. The infrastructure cost registry remains informational only and not billed automatically.

## Auth model

`POST /api/auth/login` returns an access token (short-lived) and a refresh token
(rotated on use, revocable, stored hashed in `refresh_tokens`). Send the access token
as `Authorization: Bearer <token>`; call `POST /api/auth/refresh` to rotate.
