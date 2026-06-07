import React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-[#34b277] hover:bg-[#2a9c66] disabled:opacity-60 text-white font-extrabold shadow-[0_8px_20px_rgba(52,178,119,0.28)]",
  secondary:
    "bg-white border border-[rgba(41,51,63,0.14)] hover:bg-[#f4f8f5] text-[#29333f] font-bold",
  ghost:
    "bg-transparent hover:bg-[#f4f8f5] text-[#69747f] hover:text-[#29333f] font-bold",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-4 py-2.5 rounded-xl",
  md: "text-sm px-5 py-3 rounded-2xl",
};

export interface ButtonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

/** Design-system button. Adds the standard press micro-interaction. */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition active:scale-[0.97] disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
