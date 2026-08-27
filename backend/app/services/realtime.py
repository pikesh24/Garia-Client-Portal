import asyncio
import logging

from fastapi import WebSocket

from app.models.enums import UserRole
from app.models.user import User

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Tracks live WebSocket connections and fans out thin "resource changed"
    events to them. Mutation routes run as sync `def` handlers (sync SQLAlchemy
    session), so the public methods here are plain sync functions that hop onto
    the WebSocket event loop via `asyncio.run_coroutine_threadsafe` rather than
    being awaited directly.
    """

    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._roles: dict[int, UserRole] = {}
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, user: User, websocket: WebSocket) -> None:
        await websocket.accept()
        if self.loop is None:
            self.loop = asyncio.get_running_loop()
        self._connections.setdefault(user.id, set()).add(websocket)
        self._roles[user.id] = user.role

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)
            self._roles.pop(user_id, None)

    async def _send_to_user(self, user_id: int, event: dict) -> None:
        for websocket in list(self._connections.get(user_id, set())):
            try:
                await websocket.send_json(event)
            except Exception:
                self.disconnect(user_id, websocket)

    async def _broadcast_async(
        self, resource: str, client_id: int | None, exclude_user_id: int | None, extra: dict
    ) -> None:
        event = {"resource": resource, "client_id": client_id, **extra}
        target_ids = {
            uid for uid, role in self._roles.items() if role in (UserRole.ADMIN, UserRole.DEVELOPER)
        }
        if client_id is not None:
            target_ids.add(client_id)
        target_ids.discard(exclude_user_id)
        for uid in target_ids:
            await self._send_to_user(uid, event)

    async def _notify_user_async(self, resource: str, user_id: int) -> None:
        await self._send_to_user(user_id, {"resource": resource, "client_id": None})

    def _schedule(self, coro) -> None:
        if self.loop is None:
            # Nobody has ever connected, so there's nobody to notify.
            return
        try:
            future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        except Exception:
            logger.exception("Failed to schedule realtime broadcast")
            return
        future.add_done_callback(
            lambda f: f.exception() and logger.exception("Realtime broadcast failed", exc_info=f.exception())
        )

    def broadcast_change(
        self, resource: str, client_id: int | None = None, exclude_user_id: int | None = None, **extra
    ) -> None:
        """Notify all connected admins + developers, plus one client if given.

        `exclude_user_id` skips the acting user's own connections (e.g. the sender
        of a chat message shouldn't get notified about their own message). Any
        extra keyword arguments are merged into the event payload as-is, for
        cases that need more than the bare resource/client_id (e.g. a chat
        message notification also carries `kind`, `feature_request_id`, etc.).

        Safe to call unconditionally after any mutation commit: never raises,
        and is a no-op if nobody is currently connected.
        """
        self._schedule(self._broadcast_async(resource, client_id, exclude_user_id, extra))

    def notify_user(self, resource: str, user_id: int) -> None:
        """Notify a single user only (e.g. self-profile-sync across tabs)."""
        self._schedule(self._notify_user_async(resource, user_id))


manager = ConnectionManager()
