"use client";

import { useSession } from "next-auth/react";

export interface AuthCustomer {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}

export function useCustomer(): {
  customer: AuthCustomer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
} {
  const { data, status } = useSession();
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  if (!isAuthenticated || !data?.user?.email) {
    return { customer: null, isLoading, isAuthenticated };
  }

  const customer: AuthCustomer = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name ?? null,
    image: data.user.image ?? null,
  };

  return { customer, isLoading, isAuthenticated };
}
