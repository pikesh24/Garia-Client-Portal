from app.schemas.feature_request import FeatureRequestAdminOut
from pydantic import BaseModel


class ProjectFeaturesOut(BaseModel):
    base_features: list[FeatureRequestAdminOut]
    extra_features: list[FeatureRequestAdminOut]
