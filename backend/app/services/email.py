from dataclasses import dataclass
from email.message import EmailMessage as SmtpEmailMessage
import json
import smtplib
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.core.config import get_settings


@dataclass(frozen=True)
class EmailMessage:
    to_email: str
    subject: str
    text: str
    html: str | None = None


def build_verification_email(to_email: str, full_name: str, token: str, app_url: str | None = None) -> EmailMessage:
    base_url = _clean_app_url(app_url)
    verify_url = f"{base_url}/verify-email?token={quote(token)}"
    first_name = full_name.split(" ")[0] if full_name else "there"
    return EmailMessage(
        to_email=to_email,
        subject="Verify your Spark IoT account",
        text=(
            f"Hi {first_name},\n\n"
            "Welcome to Spark IoT. Verify your email to start creating real projects, "
            "device tokens, Arduino sketches and live dashboards.\n\n"
            f"Verify email: {verify_url}\n\n"
            f"Testing token: {token}\n\n"
            "If you did not create this account, you can ignore this email.\n"
        ),
        html=(
            f"<p>Hi {first_name},</p>"
            "<p>Welcome to <strong>Spark IoT</strong>. Verify your email to start creating real projects, "
            "device tokens, Arduino sketches and live dashboards.</p>"
            f'<p><a href="{verify_url}">Verify your Spark IoT account</a></p>'
            "<p>If you did not create this account, you can ignore this email.</p>"
        ),
    )


def build_password_reset_email(to_email: str, full_name: str, token: str, app_url: str | None = None) -> EmailMessage:
    base_url = _clean_app_url(app_url)
    reset_url = f"{base_url}/reset-password?token={quote(token)}"
    first_name = full_name.split(" ")[0] if full_name else "there"
    return EmailMessage(
        to_email=to_email,
        subject="Reset your Spark IoT password",
        text=(
            f"Hi {first_name},\n\n"
            "Use this one-time link to reset your Spark IoT password. The token expires in 30 minutes.\n\n"
            f"Reset password: {reset_url}\n\n"
            f"Testing token: {token}\n\n"
            "If this was not you, ignore this email and rotate your password from Settings.\n"
        ),
        html=(
            f"<p>Hi {first_name},</p>"
            "<p>Use this one-time link to reset your Spark IoT password. The token expires in 30 minutes.</p>"
            f'<p><a href="{reset_url}">Reset your Spark IoT password</a></p>'
            "<p>If this was not you, ignore this email and rotate your password from Settings.</p>"
        ),
    )


def send_email(message: EmailMessage) -> dict[str, str]:
    settings = get_settings()
    if settings.resend_api_key:
        return _send_resend_email(message)
    if not settings.smtp_host:
        return {"status": "dev_skipped", "provider": "smtp"}

    smtp_message = SmtpEmailMessage()
    smtp_message["From"] = settings.smtp_from_email
    smtp_message["To"] = message.to_email
    smtp_message["Subject"] = message.subject
    smtp_message.set_content(message.text)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as client:
            if settings.smtp_use_tls:
                client.starttls()
            if settings.smtp_username:
                client.login(settings.smtp_username, settings.smtp_password)
            client.send_message(smtp_message)
    except Exception as exc:
        return {"status": "failed", "provider": "smtp", "error": exc.__class__.__name__}
    return {"status": "sent", "provider": "smtp"}


def _send_resend_email(message: EmailMessage) -> dict[str, str]:
    settings = get_settings()
    payload = {
        "from": settings.smtp_from_email,
        "to": [message.to_email],
        "subject": message.subject,
        "text": message.text,
        "html": message.html or message.text.replace("\n", "<br />"),
    }
    request = Request(
        settings.resend_api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": f"SparkIoT/0.1 ({settings.app_public_url})",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()
        return {
            "status": "failed",
            "provider": "resend",
            "error": exc.__class__.__name__,
            "detail": detail[:500],
        }
    except Exception as exc:
        return {"status": "failed", "provider": "resend", "error": exc.__class__.__name__}
    return {"status": "sent", "provider": "resend"}


def _clean_app_url(app_url: str | None) -> str:
    settings = get_settings()
    return (app_url or settings.app_public_url).rstrip("/")
