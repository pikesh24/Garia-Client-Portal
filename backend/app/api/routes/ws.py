from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from app.core.security import resolve_user_id_from_access_token
from app.db.session import SessionLocal
from app.models.user import User
from app.services.realtime import manager

router = APIRouter(tags=["ws"])


def _lookup_user_sync(user_id: int) -> User | None:
    with SessionLocal() as db:
        return db.get(User, user_id)


@router.websocket("/api/ws")
async def ws_endpoint(websocket: WebSocket, token: str) -> None:
    user_id = resolve_user_id_from_access_token(token)
    user = await run_in_threadpool(_lookup_user_sync, user_id) if user_id is not None else None

    if user is None or not user.is_active:
        await websocket.close(code=4401)
        return

    await manager.connect(user, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user.id, websocket)
