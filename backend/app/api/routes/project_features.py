from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_client
from app.db.session import get_db
from app.models.feature_request import FeatureRequest
from app.models.user import User
from app.schemas.project_features import ProjectFeaturesOut

router = APIRouter(prefix="/api/project-features", tags=["project-features"], dependencies=[Depends(require_client)])


@router.get("", response_model=ProjectFeaturesOut)
def get_project_features(current_user: User = Depends(require_client), db: Session = Depends(get_db)):
    features = (
        db.query(FeatureRequest)
        .filter(FeatureRequest.client_id == current_user.id)
        .order_by(FeatureRequest.created_at.desc())
        .all()
    )
    # Base features must always be visible so the client can act on them (activate/decline).
    # Extra features only show once they've been approved into the client's active scope.
    base_features = [f for f in features if f.is_base_feature]
    extra_features = [f for f in features if not f.is_base_feature and f.added_by_client]
    return ProjectFeaturesOut(base_features=base_features, extra_features=extra_features)
