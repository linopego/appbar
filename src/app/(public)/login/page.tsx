import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl ?? "/profilo";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Accedi</CardTitle>
          <CardDescription>
            Inserisci la tua email per ricevere un link di accesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm mode="login" callbackUrl={callbackUrl} />
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Non hai un account?
          <Link href="/registrati" className="ml-1 font-medium text-foreground hover:underline">
            Registrati
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
