import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings

UPLOAD_ROOT = Path(settings.UPLOAD_DIR)


def save_upload(file: UploadFile, subfolder: str) -> tuple[str, str]:
    """Persists an uploaded file to local disk under uploads/<subfolder>/.
    Returns (relative_path, original_filename)."""
    target_dir = UPLOAD_ROOT / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{extension}"
    target_path = target_dir / stored_name

    with target_path.open("wb") as out_file:
        out_file.write(file.file.read())

    relative_path = str(target_path).replace("\\", "/")
    return relative_path, file.filename or stored_name


def resolve_path(relative_path: str) -> Path:
    return Path(relative_path)
