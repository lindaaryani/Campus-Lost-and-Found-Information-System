"use client";
import * as React from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ActionForm, SubmitButton } from "./forms";
import type { ActionState } from "@/lib/types";

/**
 * Dialog konfirmasi untuk tindakan penting (batalkan klaim, ubah status, dsb.).
 * Selalu memanggil Server Action sungguhan; field tambahan (mis. catatan) lewat `children`.
 */
export function ActionDialog({
  trigger, triggerVariant = "secondary", triggerSize = "sm", title, description, submitLabel, submitVariant = "primary",
  action, hidden, children, triggerClassName,
}: {
  trigger: React.ReactNode; triggerVariant?: ButtonProps["variant"]; triggerSize?: ButtonProps["size"];
  title: string; description?: React.ReactNode; submitLabel: string; submitVariant?: ButtonProps["variant"];
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  hidden?: Record<string, string | number>; children?: React.ReactNode; triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription asChild><div>{description}</div></DialogDescription>}
        <ActionForm action={action} onSuccess={() => setOpen(false)} className="mt-4 space-y-4">
          {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
          {children}
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose asChild><Button variant="secondary">Batal</Button></DialogClose>
            <SubmitButton variant={submitVariant}>{submitLabel}</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
