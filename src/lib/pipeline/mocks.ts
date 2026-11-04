import type { RoomObject } from "@/lib/game/schema";
import type { InventoryReply } from "./scan";

/** A believable living room, used in mock mode so every screen can be built before the API key arrives. */
const LIVING_ROOM: Omit<InventoryReply["objects"][number], "frame">[] = [
  { name: "floor lamp", phrase: "floor lamp", box: { x: 0.06, y: 0.18, w: 0.16, h: 0.7 }, reachable: true, facts: [
    { kind: "color", about: "colour of the lampshade", value: "cream" },
    { kind: "shape", about: "shape of the lampshade", value: "drum" } ] },
  { name: "bookshelf", phrase: "bookshelf", box: { x: 0.62, y: 0.08, w: 0.32, h: 0.8 }, reachable: true, facts: [
    { kind: "count", about: "number of shelves", value: "4" },
    { kind: "count", about: "number of red book spines on the second shelf", value: "3" },
    { kind: "text", about: "title on the largest book spine", value: "Atlas of Islands" } ] },
  { name: "wall clock", phrase: "wall clock", box: { x: 0.4, y: 0.06, w: 0.14, h: 0.16 }, reachable: true, facts: [
    { kind: "time", about: "time shown on the clock", value: "4:20" },
    { kind: "shape", about: "shape of the clock face", value: "round" } ] },
  { name: "sofa", phrase: "sofa", box: { x: 0.2, y: 0.5, w: 0.5, h: 0.36 }, reachable: true, facts: [
    { kind: "count", about: "number of cushions", value: "3" },
    { kind: "color", about: "colour of the sofa", value: "teal" } ] },
  { name: "potted plant", phrase: "potted plant", box: { x: 0.74, y: 0.55, w: 0.18, h: 0.38 }, reachable: true, facts: [
    { kind: "color", about: "colour of the pot", value: "terracotta" },
    { kind: "count", about: "number of large leaves", value: "7" } ] },
  { name: "framed painting", phrase: "framed painting", box: { x: 0.1, y: 0.05, w: 0.26, h: 0.24 }, reachable: true, facts: [
    { kind: "text", about: "subject of the painting", value: "a sailing ship" },
    { kind: "color", about: "colour of the frame", value: "gold" } ] },
  { name: "coffee mug", phrase: "mug", box: { x: 0.42, y: 0.62, w: 0.08, h: 0.1 }, reachable: true, facts: [
    { kind: "text", about: "word printed on the mug", value: "Monday" },
    { kind: "color", about: "colour of the mug", value: "yellow" } ] },
  { name: "rug", phrase: "rug", box: { x: 0.15, y: 0.8, w: 0.6, h: 0.18 }, reachable: true, facts: [
    { kind: "pattern", about: "pattern on the rug", value: "stripes" } ] },
  { name: "table lamp", phrase: "table lamp", box: { x: 0.05, y: 0.4, w: 0.12, h: 0.25 }, reachable: true, facts: [
    { kind: "material", about: "material of the base", value: "glass" } ] },
  { name: "wooden box", phrase: "wooden box", box: { x: 0.55, y: 0.66, w: 0.12, h: 0.1 }, reachable: true, facts: [
    { kind: "material", about: "material of the box", value: "wood" },
    { kind: "pattern", about: "carving on the lid", value: "a star" } ] },
  { name: "candle", phrase: "candle", box: { x: 0.3, y: 0.38, w: 0.05, h: 0.12 }, reachable: true, facts: [
    { kind: "count", about: "number of candles on the shelf", value: "2" } ] },
  { name: "globe", phrase: "globe", box: { x: 0.66, y: 0.1, w: 0.12, h: 0.16 }, reachable: true, facts: [
    { kind: "color", about: "colour of the oceans", value: "blue" } ] },
  { name: "throw blanket", phrase: "blanket", box: { x: 0.25, y: 0.55, w: 0.2, h: 0.16 }, reachable: true, facts: [
    { kind: "pattern", about: "pattern on the blanket", value: "checks" } ] },
  { name: "photo frame", phrase: "photo frame", box: { x: 0.68, y: 0.3, w: 0.08, h: 0.1 }, reachable: true, facts: [
    { kind: "count", about: "number of people in the photo", value: "2" } ] },
  { name: "window", phrase: "window", box: { x: 0.35, y: 0.05, w: 0.3, h: 0.45 }, reachable: true, facts: [
    { kind: "count", about: "number of window panes", value: "6" } ] },
  { name: "stack of board games", phrase: "board game box", box: { x: 0.62, y: 0.72, w: 0.14, h: 0.12 }, reachable: true, facts: [
    { kind: "text", about: "name of the top game", value: "Ticket to Ride" } ] },
];

export function mockInventory(frameCount: number): InventoryReply {
  return {
    summary: "A cosy living room with a teal sofa, a tall bookshelf and a floor lamp by the window.",
    objects: LIVING_ROOM.map((o, i) => ({ ...o, frame: (i % Math.max(frameCount, 1)) + 1 })),
  };
}

/** Agrees with the first reading except for one detail, so the dropping path is exercised. */
export function mockSecondReading(objects: RoomObject[]) {
  return {
    answers: objects.flatMap((o) =>
      o.facts.map((f) => ({
        objectId: o.id,
        about: f.about,
        value: f.about === "number of large leaves" ? "9" : f.value,
      })),
    ),
  };
}
