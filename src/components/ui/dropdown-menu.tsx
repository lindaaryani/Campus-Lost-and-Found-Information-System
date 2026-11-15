"use client";
import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, ...p }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        align="end"
        className={cn("z-50 min-w-52 rounded-lg border border-line bg-surface p-1.5 shadow-pop", className)}
        {...p}
      />
    </M.Portal>
  );
}
export function DropdownMenuItem({ className, ...p }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink outline-none data-[highlighted]:bg-primary-50 [&_svg]:size-4 [&_svg]:text-muted", className)}
      {...p}
    />
  );
}
export const DropdownMenuLabel = ({ className, ...p }: React.ComponentProps<typeof M.Label>) => (
  <M.Label className={cn("px-2.5 py-2 text-xs text-muted", className)} {...p} />
);
export const DropdownMenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
