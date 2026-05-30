import React from "react";

export interface CardProps {
  hover?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

/** Parchment/ink panel card used across tabs. */
export function Card({ hover = false, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`bg-[#141821] border border-white/10 rounded-3xl transition ${
        hover ? "hover:border-white/20 hover:-translate-y-0.5 hover:shadow-xl" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
