import { redirect } from "next/navigation";

/** Judges' shortcut: a ready-made room they can play without scanning. */
export default function Demo() {
  const id = process.env.DEMO_GAME_ID;
  redirect(id ? `/game/${id}/play` : "/");
}
