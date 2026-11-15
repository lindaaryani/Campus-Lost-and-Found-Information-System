"use client";
import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, Paperclip } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/types";
import { useToast } from "./toast";

const FormCtx = React.createContext<ActionState>(null);

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Form berbasis Server Action: galat per-kolom, nilai isian dipertahankan, toast saat sukses. */
export function ActionForm({
  action, children, className, onSuccess, successToast = true,
}: {
  action: Action; children: React.ReactNode; className?: string; onSuccess?: () => void; successToast?: boolean;
}) {
  const { push } = useToast();
  // Toast dikirim langsung dari pembungkus action (bukan dari useEffect): setelah aksi sukses halaman
  // di-revalidate dan elemen pemicunya bisa langsung hilang, sehingga efek komponen tidak sempat berjalan.
  const wrapped = React.useCallback(
    async (prev: ActionState, fd: FormData) => {
      const res = await action(prev, fd);
      if (res?.ok && res.message && successToast) push(res.message, "success");
      return res;
    },
    [action, push, successToast],
  );
  const [state, formAction] = useActionState(wrapped, null);
  const last = React.useRef<ActionState>(null);
  React.useEffect(() => {
    if (state && state !== last.current) {
      last.current = state;
      if (state.ok) onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <FormCtx.Provider value={state}>
      <form action={formAction} className={className} noValidate={false}>
        {state && !state.ok && state.message && (
          <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-md border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}
        {children}
      </form>
    </FormCtx.Provider>
  );
}

export function useFormState() {
  return React.useContext(FormCtx);
}

export function SubmitButton({ children, pendingText = "Memproses…", ...p }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || p.disabled} {...p}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? pendingText : children}
    </Button>
  );
}

interface FieldProps {
  name: string;
  label: string;
  hint?: string;
  as?: "input" | "textarea" | "select";
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  options?: { value: string | number; label: string }[];
  placeholder?: string;
  rows?: number;
  minLength?: number;
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  pattern?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  disabled?: boolean;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  value?: string;
  children?: React.ReactNode;
}

/** Label + kontrol + pesan galat yang terhubung (aria-describedby, aria-invalid). */
export function Field({ name, label, hint, as = "input", required, defaultValue, options, className, children, ...rest }: FieldProps) {
  const state = useFormState();
  const id = React.useId();
  const errors = state?.fieldErrors?.[name];
  const restored = state?.values?.[name];
  const dv = restored ?? (defaultValue != null ? String(defaultValue) : undefined);
  const describedBy = [errors?.length ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  const common = { id, name, required, "aria-invalid": errors?.length ? true : undefined, "aria-describedby": describedBy };
  const { value, onChange, rows, ...native } = rest;
  const valueProps = value !== undefined ? { value, onChange } : { defaultValue: dv, onChange };

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
        {required ? <span className="ml-0.5 text-accent-red" aria-hidden> *</span> : <span className="ml-1 text-xs font-normal text-muted">(opsional)</span>}
      </label>
      {as === "textarea" ? (
        <Textarea {...common} {...native} rows={rows ?? 4} {...valueProps} />
      ) : as === "select" ? (
        <Select {...common} {...native} {...valueProps}>
          {children ?? options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      ) : (
        <Input {...common} {...native} {...valueProps} />
      )}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {errors?.length ? (
        <p id={`${id}-err`} className="flex items-center gap-1.5 text-xs font-medium text-red-700">
          <AlertCircle className="size-3.5 shrink-0" />{errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/** Input berkas dengan validasi sisi-klien (tipe & ukuran) — validasi otoritatif tetap di server. */
export function FileField({
  name, label, hint, accept, maxMB, required,
}: { name: string; label: string; hint?: string; accept: string; maxMB: number; required?: boolean }) {
  const state = useFormState();
  const id = React.useId();
  const [clientError, setClientError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const err = clientError ?? state?.fieldErrors?.[name]?.[0];

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setClientError(null); setFileName(null);
    if (!f) return;
    const okType = accept.split(",").map((s) => s.trim()).includes(f.type);
    if (!okType) { setClientError("Format berkas tidak didukung."); e.target.value = ""; return; }
    if (f.size > maxMB * 1024 * 1024) { setClientError(`Ukuran berkas maksimal ${maxMB} MB.`); e.target.value = ""; return; }
    setFileName(f.name);
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}{required ? <span className="ml-0.5 text-accent-red" aria-hidden> *</span> : <span className="ml-1 text-xs font-normal text-muted">(opsional)</span>}
      </label>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-slate-300 bg-surface px-3.5 py-3 text-sm text-muted transition-colors hover:border-azure hover:bg-primary-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-azure"
      >
        <Paperclip className="size-4 shrink-0" />
        <span className="truncate">{fileName ?? "Pilih berkas…"}</span>
        <input id={id} name={name} type="file" accept={accept} onChange={onChange} className="sr-only" aria-invalid={err ? true : undefined} />
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {err && <p className="flex items-center gap-1.5 text-xs font-medium text-red-700"><AlertCircle className="size-3.5" />{err}</p>}
    </div>
  );
}
