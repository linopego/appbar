import { CONTACT_EMAIL } from "@/lib/brand";

// "Serve aiuto?": tre FAQ essenziali in accordion + contatto. Visivamente
// secondaria: fondo bianco, testi ink-soft, niente lime.

const FAQS = [
  {
    q: "Quanto durano i ticket?",
    a: "Ogni ticket vale 30 giorni dalla data di acquisto. La scadenza è indicata sul ticket, qui in Klink e nell'email di conferma; alla scadenza il ticket non è più utilizzabile né rimborsabile.",
  },
  {
    q: "Come funziona il rimborso?",
    a: "Dal tuo profilo puoi chiedere il rimborso dei ticket ancora attivi e non scaduti. La richiesta viene valutata dal locale; se approvata, l'importo torna sul metodo di pagamento originale. In alcune fasce orarie (di solito la sera) l'invio delle richieste è sospeso.",
  },
  {
    q: "Ho pagato ma non vedo i ticket",
    a: "Controlla l'email di conferma (anche nello spam) e verifica di aver fatto accesso con lo stesso account usato per l'acquisto: i ticket sono legati all'account, non al telefono. Se ancora non li vedi, scrivici.",
  },
];

export function HelpCard() {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-1">
      <p className="text-sm font-medium mb-2">Serve aiuto?</p>
      {FAQS.map((faq) => (
        <details key={faq.q} className="group border-t first:border-t-0 py-2">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {faq.q}
            <span aria-hidden className="shrink-0 transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
        </details>
      ))}
      <p className="border-t pt-3 text-xs text-muted-foreground">
        Non hai trovato la risposta?{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-foreground underline underline-offset-2 hover:no-underline"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
    </div>
  );
}
