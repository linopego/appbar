type ErrorData = Record<string, unknown> | undefined;

export function messageForCode(code: string | undefined, data?: ErrorData): string {
  switch (code) {
    case "TICKET_NOT_FOUND":
      return "Ticket non trovato";
    case "WRONG_VENUE": {
      const venue = data?.["ticketVenue"];
      return typeof venue === "string"
        ? `Ticket di un altro locale: ${venue}`
        : "Ticket non valido per questo locale";
    }
    case "EXPIRED":
      return "Ticket scaduto";
    case "ALREADY_CONSUMED": {
      const consumedAt = data?.["consumedAt"];
      const who = typeof data?.["consumedByName"] === "string" ? data["consumedByName"] : "altro operatore";
      if (consumedAt) {
        const date = new Date(consumedAt as string);
        const time = new Intl.DateTimeFormat("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
        return `Già consegnato alle ${time} da ${who}`;
      }
      return `Già consegnato da ${who}`;
    }
    case "REFUNDED":
      return "Ticket rimborsato";
    case "RATE_LIMITED":
      return "Troppi tentativi, riprova tra qualche secondo";
    case "UNAUTHORIZED_STAFF":
      return "Sessione scaduta, accedi di nuovo";
    default:
      return "Errore. Riprova.";
  }
}
