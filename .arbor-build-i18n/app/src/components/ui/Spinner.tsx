import React from "react";
import { RefreshCw } from "lucide-react";

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <RefreshCw className={`animate-spin ${className}`} />;
}

export default Spinner;
