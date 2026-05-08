import type { Adapter, AdapterAccount, AdapterSession, AdapterUser } from "next-auth/adapters";
import type { Customer, PrismaClient } from "@prisma/client";

/**
 * Adapter Prisma custom: NextAuth si aspetta i modelli `user`, `account`,
 * `session`, ma il nostro schema usa `Customer`, `CustomerAccount`,
 * `CustomerSession` (con `customerId` invece di `userId`). Le tabelle DB
 * sottostanti hanno comunque i nomi standard NextAuth tramite `@@map`.
 */

function customerToUser(c: Customer): AdapterUser {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ") || null;
  return {
    id: c.id,
    email: c.email,
    emailVerified: c.emailVerified,
    name: fullName,
    image: c.image,
  };
}

export function CustomerPrismaAdapter(p: PrismaClient): Adapter {
  return {
    async createUser(data) {
      const customer = await p.customer.create({
        data: {
          email: data.email,
          emailVerified: data.emailVerified ?? null,
          firstName: data.name ?? null,
          image: data.image ?? null,
        },
      });
      return customerToUser(customer);
    },
    async getUser(id) {
      const c = await p.customer.findUnique({ where: { id } });
      return c ? customerToUser(c) : null;
    },
    async getUserByEmail(email) {
      const c = await p.customer.findUnique({ where: { email } });
      return c ? customerToUser(c) : null;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const account = await p.customerAccount.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { customer: true },
      });
      return account ? customerToUser(account.customer) : null;
    },
    async updateUser({ id, name, email, emailVerified, image }) {
      if (!id) throw new Error("updateUser requires an id");
      const c = await p.customer.update({
        where: { id },
        data: {
          ...(email !== undefined ? { email } : {}),
          ...(emailVerified !== undefined ? { emailVerified } : {}),
          ...(name !== undefined ? { firstName: name } : {}),
          ...(image !== undefined ? { image } : {}),
        },
      });
      return customerToUser(c);
    },
    async deleteUser(id) {
      await p.customer.delete({ where: { id } });
    },
    async linkAccount(account) {
      const { userId, ...rest } = account;
      await p.customerAccount.create({
        data: { ...rest, customerId: userId },
      });
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await p.customerAccount.delete({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
    },
    async createSession({ userId, sessionToken, expires }) {
      const s = await p.customerSession.create({
        data: { customerId: userId, sessionToken, expires },
      });
      return { sessionToken: s.sessionToken, userId: s.customerId, expires: s.expires };
    },
    async getSessionAndUser(sessionToken) {
      const result = await p.customerSession.findUnique({
        where: { sessionToken },
        include: { customer: true },
      });
      if (!result) return null;
      const { customer, customerId, ...rest } = result;
      const session: AdapterSession = {
        sessionToken: rest.sessionToken,
        userId: customerId,
        expires: rest.expires,
      };
      return { user: customerToUser(customer), session };
    },
    async updateSession({ sessionToken, expires, userId }) {
      const s = await p.customerSession.update({
        where: { sessionToken },
        data: {
          ...(expires !== undefined ? { expires } : {}),
          ...(userId !== undefined ? { customerId: userId } : {}),
        },
      });
      return { sessionToken: s.sessionToken, userId: s.customerId, expires: s.expires };
    },
    async deleteSession(sessionToken) {
      try {
        await p.customerSession.delete({ where: { sessionToken } });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") return;
        throw error;
      }
    },
    async createVerificationToken(data) {
      return await p.verificationToken.create({ data });
    },
    async useVerificationToken({ identifier, token }) {
      try {
        return await p.verificationToken.delete({
          where: { identifier_token: { identifier, token } },
        });
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") return null;
        throw error;
      }
    },
  } satisfies Adapter;
}

export type { AdapterUser, AdapterSession, AdapterAccount };
