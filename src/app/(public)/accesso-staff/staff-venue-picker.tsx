"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function StaffVenuePicker({
  venues,
}: {
  venues: { name: string; slug: string }[];
}) {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  if (venues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-xl border bg-card p-6 text-center">
        Nessun locale disponibile al momento.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="staff-venue" className="block text-sm font-medium mb-1.5">
          Locale
        </label>
        <select
          id="staff-venue"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full h-11 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Seleziona il locale —</option>
          {venues.map((venue) => (
            <option key={venue.slug} value={venue.slug}>
              {venue.name}
            </option>
          ))}
        </select>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!slug}
        onClick={() => router.push(`/staff/${slug}`)}
      >
        Vai al login POS
      </Button>
    </div>
  );
}
