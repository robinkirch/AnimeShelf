
"use client";

import { useState, useEffect } from 'react';

export function FooterYear() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  if (year === null) {
    // Return null or a placeholder before client-side hydration and effect runs
    // This avoids content mismatch between server and client initial render
    return null; 
  }

  return <>{year}</>;
}
