import React from "react";

export interface CardProps {
  hover?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

/**
 * Parchment panel card. Uses the token-based `.arbor-surface` semantic class
 * (design item D2) rather than hard-coded hex, so it doesn't depend on the
 * legacy dark-class override layer.
 */
export function Card({ hover = false, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`arbor-surface rounded-3xl transition ${
        hover ? "hover:-translate-y-0.5 hover:shadow-xl" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
