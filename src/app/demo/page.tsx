import { redirect } from "next/navigation";

/** A real room built with the real models, so anyone can play without scanning. */
const DEMO_GAME_ID = process.env.DEMO_GAME_ID || "g_Zvmez17d15";

export default function Demo() {
  redirect(`/game/${DEMO_GAME_ID}/play?remote=1`);
}
