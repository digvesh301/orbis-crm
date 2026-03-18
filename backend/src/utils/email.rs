use crate::{config::Config, errors::AppResult};

/// Send email verification link via Resend API
pub async fn send_verification_email(
    config: &Config,
    to_email: &str,
    first_name: &str,
    token: &str,
) -> AppResult<()> {
    let verify_url = format!(
        "{}/verify-email?token={}",
        config.frontend_url, token
    );

    let html = format!(
        r#"
        <!DOCTYPE html>
        <html>
        <body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; padding: 40px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="font-size: 24px; color: #1e293b; margin: 0 0 8px;">Welcome to {} CRM, {}! 🌐</h1>
            <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
              Thanks for signing up. Please verify your email to get started.
            </p>
            <a href="{}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Verify Email Address
            </a>
            <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0;">
              This link expires in 24 hours. If you didn't create an account, ignore this email.
            </p>
          </div>
        </body>
        </html>
        "#,
        config.app_name, first_name, verify_url
    );

    send_email_via_resend(
        config,
        to_email,
        &format!("Verify your {} CRM email", config.app_name),
        &html,
    ).await
}

/// Send password reset email
pub async fn send_password_reset_email(
    config: &Config,
    to_email: &str,
    first_name: &str,
    token: &str,
) -> AppResult<()> {
    let reset_url = format!(
        "{}/reset-password?token={}",
        config.frontend_url, token
    );

    let html = format!(
        r#"
        <!DOCTYPE html>
        <html>
        <body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; padding: 40px;">
          <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="font-size: 24px; color: #1e293b; margin: 0 0 8px;">Reset your password</h1>
            <p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
              Hi {}, we received a request to reset your password. Click below to choose a new one.
            </p>
            <a href="{}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Reset Password
            </a>
            <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0;">
              This link expires in 1 hour. If you didn't request a reset, ignore this email.
            </p>
          </div>
        </body>
        </html>
        "#,
        first_name, reset_url
    );

    send_email_via_resend(
        config,
        to_email,
        &format!("{} CRM — Password Reset", config.app_name),
        &html,
    ).await
}

/// Core function: send email using Resend API
async fn send_email_via_resend(
    config: &Config,
    to_email: &str,
    subject: &str,
    html: &str,
) -> AppResult<()> {
    if config.resend_api_key.is_empty() {
        // Dev mode: just log the email
        tracing::info!(
            "📧 [DEV EMAIL] To: {} | Subject: {} | (Set RESEND_API_KEY to send real emails)",
            to_email,
            subject
        );
        return Ok(());
    }

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.resend.com/emails")
        .bearer_auth(&config.resend_api_key)
        .json(&serde_json::json!({
            "from": format!("{} <{}>", config.email_from_name, config.email_from_address),
            "to": [to_email],
            "subject": subject,
            "html": html,
        }))
        .send()
        .await
        .map_err(|e| crate::errors::AppError::Internal(anyhow::anyhow!("Email send failed: {}", e)))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        tracing::error!("Resend API error {}: {}", status, body);
    }

    Ok(())
}
