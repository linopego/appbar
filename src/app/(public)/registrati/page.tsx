import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "../login/login-form";

interface RegisterPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl ?? "/profilo";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Crea il tuo account</CardTitle>
          <CardDescription>
            Riceverai un link via email per attivare il tuo account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm mode="register" callbackUrl={callbackUrl} />
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Hai già un account?
          <Link href="/login" className="ml-1 font-medium text-foreground hover:underline">
            Accedi
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
