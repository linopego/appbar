const QR_TOKEN_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function extractTicketToken(scanned: string): string | null {
  // Case 1: full URL /ticket/[token]
  try {
    const url = new URL(scanned);
    const match = url.pathname.match(/\/ticket\/([^/]+)/);
    if (match?.[1] && QR_TOKEN_REGEX.test(match[1])) {
      return match[1];
    }
  } catch {
    // not a valid URL, try as raw token
  }

  // Case 2: raw UUID v4
  if (QR_TOKEN_REGEX.test(scanned)) {
    return scanned;
  }

  return null;
}
