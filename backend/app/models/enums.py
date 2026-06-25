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
    RESCHEDULED = "rescheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    OUT_OF_SCOPE = "out_of_scope"
    RESOLVED = "resolved"


class FeatureRequestStatus(str, enum.Enum):
    INITIATED = "initiated"
    CLARIFICATION_REQUESTED = "clarification_requested"
    QUOTED = "quoted"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OUT_OF_SCOPE = "out_of_scope"
    CANCELLED = "cancelled"


class InitiatedBy(str, enum.Enum):
    CLIENT = "client"
    GARIA = "garia"


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
