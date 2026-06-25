from app.schemas.feature_request import FeatureRequestOut
from pydantic import BaseModel


class ProjectFeaturesOut(BaseModel):
    base_features: list[FeatureRequestOut]
    extra_features: list[FeatureRequestOut]
