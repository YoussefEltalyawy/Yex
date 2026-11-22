import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type IconType = IconSvgElement;

export function Icon({ icon, size = 16, className, strokeWidth = 1.7 }: { icon: IconType; size?: number; className?: string; strokeWidth?: number }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} className={cn("shrink-0", className)} />;
}

type Variant = "solid" | "accent" | "ghost" | "subtle" | "outline" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  solid: "bg-fg text-canvas hover:opacity-90 active:opacity-80 shadow-[0_1px_2px_rgb(0_0_0/0.12)]",
  accent: "bg-accent text-accent-fg hover:brightness-105 active:brightness-95 shadow-[0_1px_2px_rgb(0_0_0/0.12)]",
  ghost: "text-fg-2 hover:bg-hover hover:text-fg active:bg-press",
  subtle: "bg-hover text-fg hover:bg-press",
  outline: "text-fg shadow-[inset_0_0_0_1px_var(--color-stroke-strong)] hover:bg-hover active:bg-press",
  danger: "text-danger hover:bg-danger-soft",
};
const sizes: Record<Size, string> = {
  xs: "h-6 px-1.5 text-xs gap-1 rounded-md",
  sm: "h-7 px-2.5 text-sm gap-1.5 rounded-md",
  md: "h-8 px-3 text-base gap-1.5 rounded-lg",
  lg: "h-10 px-4 text-md gap-2 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconType;
  iconRight?: IconType;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ghost", size = "md", icon, iconRight, className, children, type = "button", ...rest },
  ref,
) {
  const iconSize = size === "lg" ? 18 : size === "xs" ? 14 : 16;
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,color,opacity,box-shadow,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon icon={iconRight} size={iconSize} className="opacity-60" />}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "children"> & { label: string }>(function IconButton(
  { icon, label, size = "sm", className, ...rest },
  ref,
) {
  const dims = size === "xs" ? "w-6 px-0" : size === "sm" ? "w-7 px-0" : size === "md" ? "w-8 px-0" : "w-10 px-0";
  return <Button ref={ref} icon={icon} size={size} aria-label={label} title={label} className={cn(dims, className)} {...rest} />;
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      dir="auto"
      className={cn(
        "h-8 w-full rounded-lg bg-surface px-2.5 text-base text-fg shadow-[inset_0_0_0_1px_var(--color-stroke-strong)] outline-none transition-shadow placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-accent),0_0_0_3px_var(--color-accent-soft)]",
        className,
      )}
      {...rest}
    />
  );
});

/** Borderless input that blends into its container (titles, inline adds). */
export const BareInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function BareInput({ className, ...rest }, ref) {
  return <input ref={ref} dir="auto" className={cn("w-full bg-transparent outline-none placeholder:text-fg-4", className)} {...rest} />;
});

export function AutoTextarea({ className, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} dir="auto" rows={1} value={value} className={cn("w-full resize-none bg-transparent outline-none placeholder:text-fg-4", className)} {...rest} />;
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 font-sans text-2xs font-medium text-fg-3 shadow-[inset_0_0_0_1px_var(--color-stroke-strong)]", className)}>
      {children}
    </kbd>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl bg-surface shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function Pill({ children, className, tint }: { children: ReactNode; className?: string; tint?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs font-medium", tint ? `tint-${tint} tint-bg tint-text` : "bg-hover text-fg-2", className)}>
      {children}
    </span>
  );
}

export function SectionLabel({ children, className, action }: { children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn("flex h-7 items-center justify-between px-1 text-xs font-medium text-fg-3", className)}>
      <span>{children}</span>
      {action}
    </div>
  );
}

export function Empty({ icon, title, hint, action, className }: { icon?: ReactNode; title: string; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {icon && <div className="mb-1 text-[28px] leading-none">{icon}</div>}
      <div className="font-display text-lg text-fg">{title}</div>
      {hint && <div className="max-w-[340px] text-sm leading-relaxed text-fg-3">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Progress({ value, className, tint }: { value: number; className?: string; tint?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-hover", tint && `tint-${tint}`, className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tint ? "tint-solid" : "bg-accent")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn("size-4 animate-spin rounded-full border-2 border-stroke-strong border-t-fg-2", className)} />;
}
