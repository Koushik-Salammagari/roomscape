export const THEMES = [
  { id: "lost-treasure", name: "Lost treasure", line: "A sea captain hid her gold somewhere in this room." },
  { id: "heist", name: "The heist", line: "Something precious vanished at midnight. Find it before dawn." },
  { id: "haunted", name: "Haunted house", line: "Something in this room is restless. Find out what it wants." },
] as const;

export const DIFFICULTIES = [
  { id: "easy", name: "Easy", stations: 4, minutes: "10 to 15 min" },
  { id: "normal", name: "Normal", stations: 5, minutes: "15 to 20 min" },
  { id: "hard", name: "Hard", stations: 6, minutes: "20 to 25 min" },
] as const;

export const MODES = [
  { id: "host", name: "Host a hunt", line: "Hide a real gift. Roomscape writes every clue that leads to it." },
  { id: "quick", name: "Quick play", line: "Play your own room right now. The story hides the treasure." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type DifficultyId = (typeof DIFFICULTIES)[number]["id"];
export type ModeId = (typeof MODES)[number]["id"];
