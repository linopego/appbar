import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Account, Profile } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";

// Guardia anti-collegamento accidentale: cliente loggato con email A che
// preme "Continua con Google" con email B non deve agganciare l'account
// Google B al cliente A. Il linking è permesso solo a parità di email.

const { dbMock, cookieStore, mockAuth } = vi.hoisted(() => ({
  dbMock: {
    customerAccount: { findUnique: vi.fn() },
    customerSession: { findUnique: vi.fn() },
  },
  cookieStore: { get: vi.fn() },
  mockAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
// redirect() di Next lancia un errore con digest NEXT_REDIRECT
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  },
}));

import { authConfig } from "@/lib/auth/config";
import LoginPage from "@/app/(public)/login/page";

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

function googleAccount(): Account {
  return {
    type: "oidc",
    provider: "google",
    providerAccountId: "google-sub-123",
  } as Account;
}

function callSignIn(account: Account, profile?: Profile) {
  const signIn = authConfig.callbacks.signIn;
  return signIn({
    user: { id: "provider-id", email: profile?.email ?? null } as unknown as AdapterUser,
    account,
    profile,
  });
}

function withActiveSession(email: string) {
  cookieStore.get.mockImplementation((name: string) =>
    name === "authjs.session-token" ? { value: "sess-token-1" } : undefined
  );
  dbMock.customerSession.findUnique.mockResolvedValue({
    expires: FUTURE,
    customer: { email },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue(undefined);
  dbMock.customerAccount.findUnique.mockResolvedValue(null);
  dbMock.customerSession.findUnique.mockResolvedValue(null);
});

describe("callback signIn (guardia sul linking OAuth)", () => {
  it("linking con sessione attiva ed email DIVERSA → negato, verso la pagina di errore", async () => {
    withActiveSession("anna@example.com");
    const result = await callSignIn(googleAccount(), { email: "altra@gmail.com" });
    expect(result).not.toBe(true);
    expect(result).toBe("/login/errore?error=EmailMismatch");
  });

  it("linking con sessione attiva e profilo SENZA email → negato", async () => {
    withActiveSession("anna@example.com");
    const result = await callSignIn(googleAccount(), {});
    expect(result).toBe("/login/errore?error=EmailMismatch");
  });

  it("linking con sessione attiva e STESSA email (case-insensitive) → consentito", async () => {
    withActiveSession("Anna@Example.com");
    const result = await callSignIn(googleAccount(), { email: "anna@example.com" });
    expect(result).toBe(true);
  });

  it("login normale senza sessione attiva → consentito", async () => {
    const result = await callSignIn(googleAccount(), { email: "chiunque@gmail.com" });
    expect(result).toBe(true);
    // senza cookie di sessione non si interroga nemmeno il DB delle sessioni
    expect(dbMock.customerSession.findUnique).not.toHaveBeenCalled();
  });

  it("account Google già collegato → login normale consentito (nessun linking)", async () => {
    withActiveSession("anna@example.com");
    dbMock.customerAccount.findUnique.mockResolvedValue({ id: "acc-1" });
    const result = await callSignIn(googleAccount(), { email: "altra@gmail.com" });
    expect(result).toBe(true);
  });

  it("sessione scaduta → trattata come assente, login consentito", async () => {
    withActiveSession("anna@example.com");
    dbMock.customerSession.findUnique.mockResolvedValue({
      expires: new Date(Date.now() - 1000),
      customer: { email: "anna@example.com" },
    });
    const result = await callSignIn(googleAccount(), { email: "altra@gmail.com" });
    expect(result).toBe(true);
  });

  it("provider non OAuth (magic link) → nessuna guardia", async () => {
    const result = await callSignIn({
      type: "email",
      provider: "resend",
      providerAccountId: "anna@example.com",
    } as Account);
    expect(result).toBe(true);
    expect(dbMock.customerAccount.findUnique).not.toHaveBeenCalled();
  });
});

describe("/login (pagina)", () => {
  it("cliente già loggato → redirect immediato a /home", async () => {
    mockAuth.mockResolvedValue({ user: { id: "cust-1" } });
    await expect(
      LoginPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_REDIRECT:/home");
  });

  it("anonimo → vede il form di login", async () => {
    mockAuth.mockResolvedValue(null);
    const jsx = await LoginPage({ searchParams: Promise.resolve({}) });
    expect(jsx).toBeTruthy();
  });
});
