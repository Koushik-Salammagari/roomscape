import Link from "next/link";

/** Phase 4 replaces this with the build theater. */
export default async function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 py-8">
      <h1 className="font-display text-3xl">Your room is scanned</h1>
      <p className="text-text-soft">Game building arrives in the next build. Game {id} is saved.</p>
      <Link href="/" className="text-lantern underline underline-offset-4">Start again</Link>
    </main>
  );
}
