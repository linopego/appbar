import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  pressAffirmative,
  pressAffirmativeOnLime,
  pressNegative,
  type PressKind,
} from "@/lib/ui/press";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primario Klink: pill lime con testo Ink (mai bianco su lime).
        // Pressione affermativa: vira sul lime-hover (BRAND.md §6-bis)
        default: cn(
          "rounded-full bg-klink-lime font-semibold text-klink-ink hover:bg-klink-lime-hover",
          pressAffirmativeOnLime
        ),
        destructive: cn(
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
          pressNegative
        ),
        // Secondario Klink: bordo Ink, testo Ink, sfondo trasparente.
        // Pressione affermativa: si accende di lime pieno
        outline: cn(
          "rounded-full border border-klink-ink bg-transparent text-klink-ink hover:bg-klink-ink/5",
          pressAffirmative
        ),
        // Azione negativa esplicita (annulla, rimuovi, rifiuta): flash error-soft
        negative: cn(
          "rounded-full border border-input bg-transparent text-foreground hover:bg-muted",
          pressNegative
        ),
        secondary: cn(
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
          pressAffirmative
        ),
        ghost: "transition-colors hover:bg-accent hover:text-accent-foreground",
        link: "transition-colors text-foreground underline-offset-4 hover:underline",
      },
      size: {
        // Touch target ≥44px per i bottoni primari (BRAND.md)
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-full px-4 text-xs",
        lg: "h-12 rounded-full px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Tipo di impulso alla pressione per variante (BRAND.md §6-bis): il listener
// globale legge data-press e fa partire l'onda. Ghost e link non ne hanno.
const PRESS_KIND: Partial<Record<NonNullable<ButtonProps["variant"]>, PressKind>> = {
  default: "affirmative-on-lime",
  outline: "affirmative",
  secondary: "affirmative",
  destructive: "negative",
  negative: "negative",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        data-press={PRESS_KIND[variant ?? "default"]}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
