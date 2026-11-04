"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Phase 1 stub: a camera check. The scan pipeline replaces this in Phase 3. */
function CameraCheck() {
  const params = useSearchParams();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"asking" | "live" | "blocked">("asking");

  useEffect(() => {
    if (params.get("theme")) document.documentElement.dataset.theme = params.get("theme")!;
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        setState("live");
      })
      .catch(() => setState("blocked"));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [params]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-6">
      <Link href="/" className="text-sm text-text-soft">
        Back
      </Link>
      <h1 className="font-display text-3xl">Point your camera at the room</h1>
      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border border-ink-line bg-night-deep">
        <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />
        {state === "blocked" ? (
          <p className="absolute inset-0 grid place-items-center p-8 text-center text-text-soft">
            Roomscape needs the camera to see your room. Allow camera access in your browser settings, then reload.
          </p>
        ) : null}
      </div>
      <p className="text-sm text-text-soft">
        Room scanning arrives in the next build. Mode: {params.get("mode")}, story: {params.get("theme")}, difficulty:{" "}
        {params.get("difficulty")}.
      </p>
    </main>
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <CameraCheck />
    </Suspense>
  );
}
