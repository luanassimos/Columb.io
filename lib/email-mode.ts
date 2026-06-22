export type EmailSendMode = 'mock' | 'dry_run' | 'live';

const EMAIL_SEND_MODES: EmailSendMode[] = ['mock', 'dry_run', 'live'];

function normalizeEmailSendMode(value: string | undefined): EmailSendMode | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return EMAIL_SEND_MODES.includes(normalized as EmailSendMode)
    ? (normalized as EmailSendMode)
    : null;
}

export function getEmailSendMode(): EmailSendMode {
  const configuredMode = normalizeEmailSendMode(process.env.EMAIL_SEND_MODE);

  if (configuredMode) {
    return configuredMode;
  }

  return process.env.NODE_ENV === 'production' ? 'dry_run' : 'mock';
}

export function assertLiveEmailAllowed() {
  if (getEmailSendMode() !== 'live') {
    return null;
  }

  if (process.env.ALLOW_LIVE_EMAIL_SENDS === 'true') {
    return null;
  }

  return {
    error: 'Live email sending is blocked. Set ALLOW_LIVE_EMAIL_SENDS=true to explicitly allow real delivery.',
  };
}

export function shouldSendLiveEmail() {
  return getEmailSendMode() === 'live' && process.env.ALLOW_LIVE_EMAIL_SENDS === 'true';
}

export function getSafeRecipientOverride() {
  const override = process.env.EMAIL_TEST_RECIPIENT?.trim();
  if (!override) return null;

  return getEmailSendMode() === 'live' ? null : override;
}
