"use client";

import { useEffect } from "react";

/**
 * A phone that kept the app open across an update runs the old pages. On load,
 * compare this page's build with the live one and reload once if they differ.
 */
export function FreshBuild() {
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!mine || mine === "local") return;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(({ version }: { version?: string }) => {
        if (!version || version === "local" || version === mine) return;
        const key = `roomscape:reloaded:${version}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        window.location.reload();
      })
      .catch(() => {});
  }, []);
  return null;
}
