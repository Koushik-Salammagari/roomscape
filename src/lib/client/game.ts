"use client";

export function hostKeyFor(id: string): string | null {
  try {
    return localStorage.getItem(`roomscape:host:${id}`);
  } catch {
    return null;
  }
}

export async function fetchGame<T>(id: string, opts: { asPlayer?: boolean } = {}): Promise<T> {
  const key = opts.asPlayer ? null : hostKeyFor(id);
  const res = await fetch(`/api/games/${id}`, { headers: key ? { "x-host-key": key } : {}, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "This game could not be loaded.");
  return data as T;
}

export async function postJSON<T>(url: string, body?: unknown, hostKey?: string | null): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(hostKey ? { "x-host-key": hostKey } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Reads a newline-delimited JSON stream, calling `onLine` for each message. */
export async function readLines<T>(res: Response, onLine: (msg: T) => void): Promise<void> {
  if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onLine(JSON.parse(line) as T);
  }
}
