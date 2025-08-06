// File: app/components/ui/card.tsx

import React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl shadow-md border bg-white p-4">
      {children}
    </div>
  );
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="mt-2">{children}</div>;
}
