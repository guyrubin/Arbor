import React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold shadow-lg shadow-[#d7aa55]/10",
  secondary:
    "bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold",
  ghost:
    "bg-transparent hover:bg-white/5 text-[#a8a093] hover:text-white font-bold",
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
