import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CLIENT = "client"


class MeetingType(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"


class MeetingStatus(str, enum.Enum):
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    RESCHEDULE_PENDING = "reschedule_pending"
    DENIED = "denied"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ProposedBy(str, enum.Enum):
    CLIENT = "client"
    ADMIN = "admin"


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    OUT_OF_SCOPE = "out_of_scope"
    RESOLVED = "resolved"


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FeatureRequestStatus(str, enum.Enum):
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    DECLINED = "declined"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OUT_OF_SCOPE = "out_of_scope"
    CANCELLED = "cancelled"


class ChallengeStatus(str, enum.Enum):
    NONE = "none"
    OPEN = "open"
    APPROVED = "approved"
    DENIED = "denied"


class DiscountType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"
    PAID = "paid"


class MaintenanceStatus(str, enum.Enum):
    PENDING = "pending"
    PROOF_SUBMITTED = "proof_submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
