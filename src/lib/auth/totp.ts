import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Ticket Sistema";

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotp(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function getOtpauthUrl(secret: string, email: string): string {
  return buildTotp(secret, email).toString();
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = buildTotp(secret, "verify");
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export async function generateQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: "M", margin: 2 });
}
