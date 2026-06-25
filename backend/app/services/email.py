import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("garia.email")


def send_email(to_email: str, subject: str, body: str) -> None:
    """Sends a plain-text email via SMTP if configured, otherwise logs it.
    Keeping this as a single choke point makes it trivial to swap in a
    provider (SendGrid, SES, etc.) later without touching call sites."""
    if not settings.SMTP_HOST:
        logger.info("[DEV EMAIL] to=%s subject=%s\n%s", to_email, subject, body)
        return

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)


def notify_ticket_status_change(client_email: str, ticket_id: int, status: str) -> None:
    send_email(
        client_email,
        f"Support ticket #{ticket_id} updated",
        f"Your support ticket #{ticket_id} status changed to: {status}",
    )


def notify_meeting_event(client_email: str, meeting_id: int, event: str) -> None:
    send_email(client_email, f"Meeting #{meeting_id} {event}", f"Your meeting #{meeting_id} has been {event}.")


def notify_invoice_issued(client_email: str, invoice_id: int, total: float) -> None:
    send_email(
        client_email,
        f"Invoice #{invoice_id} issued",
        f"A new invoice #{invoice_id} for ${total:.2f} has been issued to your account.",
    )


def notify_feature_request_event(client_email: str, feature_request_id: int, event: str) -> None:
    send_email(
        client_email,
        f"Feature request #{feature_request_id} {event}",
        f"Your feature request #{feature_request_id} has been {event}.",
    )


def notify_maintenance_proof_rejected(client_email: str, record_id: int, reason: str, deadline: str) -> None:
    send_email(
        client_email,
        f"Maintenance payment proof rejected (#{record_id})",
        f"Your submitted proof was rejected: {reason}\nPlease resubmit before {deadline}.",
    )
