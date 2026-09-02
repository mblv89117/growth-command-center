import Image from "next/image";
import { cn } from "@/lib/utils";

type GccLogoProps = {
  className?: string;
  priority?: boolean;
  /** Compact mark for nav/sidebar; full wordmark for auth/marketing heroes */
  variant?: "full" | "mark";
};

/**
 * Official Growth Command Center brand mark (HVCG-approved).
 */
export function GccLogo({ className, priority = false, variant = "full" }: GccLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/gcc-logo.png"
        alt="Growth Command Center"
        width={40}
        height={40}
        className={cn("h-8 w-8 object-cover object-left", className)}
        priority={priority}
      />
    );
  }

  return (
    <Image
      src="/brand/gcc-logo.png"
      alt="Growth Command Center — powered by High Value Capital Group"
      width={320}
      height={107}
      className={cn("h-auto w-full max-w-[280px] object-contain", className)}
      priority={priority}
    />
  );
}
