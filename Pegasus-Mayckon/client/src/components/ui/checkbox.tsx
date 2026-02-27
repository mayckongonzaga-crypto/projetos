import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border-2 shadow-xs transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50",
        // Light mode
        "border-gray-400 bg-white data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary",
        // Dark mode - neon blue glow
        "dark:border-blue-400 dark:bg-transparent dark:shadow-[0_0_4px_rgba(59,130,246,0.5)] dark:data-[state=checked]:bg-blue-500 dark:data-[state=checked]:text-white dark:data-[state=checked]:border-blue-400 dark:data-[state=checked]:shadow-[0_0_8px_rgba(59,130,246,0.7)]",
        // Focus
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        // Invalid
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
