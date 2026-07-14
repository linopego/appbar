import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Accesso demo" };

export default function AccessoDemoPage() {
  if (process.env.DEMO_MODE !== "true") redirect("/login");

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Accesso demo</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Entra come cliente demo senza bisogno di account o email.
          </p>
        </div>

        <Link
          href="/api/demo/autologin"
          className="block w-full py-3 px-4 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors"
        >
          Entra come cliente demo
        </Link>

        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p className="font-medium">Altri accessi demo:</p>
          <p>
            <strong>Staff POS</strong> →{" "}
            <Link href="/staff/studios-deco" className="underline">
              /staff/studios-deco
            </Link>{" "}
            · PIN Manager: <code>1234</code> · Barista: <code>5678</code>
          </p>
          <p>
            <strong>Super-admin</strong> →{" "}
            <Link href="/superadmin/login" className="underline">
              /superadmin/login
            </Link>{" "}
            · email: <code>linopegoraro.dir@gmail.com</code>
            <br />
            (password dalle Build Logs · TOTP saltato in demo mode)
          </p>
        </div>
      </div>
    </main>
  );
}
