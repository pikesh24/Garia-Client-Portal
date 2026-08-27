from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import resolve_user_id_from_access_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.project import Project
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = resolve_user_id_from_access_token(token)
    if user_id is None:
        raise credentials_exception

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_client(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Client access required")
    return user


def require_developer(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.DEVELOPER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Developer access required")
    return user


def require_admin_or_developer(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.ADMIN, UserRole.DEVELOPER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or developer access required")
    return user


def get_owned_project(
    project_id: int, current_user: User = Depends(require_client), db: Session = Depends(get_db)
) -> Project:
    project = db.get(Project, project_id)
    if not project or project.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
