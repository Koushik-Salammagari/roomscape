/** Stories offered on the home page. Older games may still use "heist" or "haunted". */
export const THEMES = [
  { id: "lost-treasure", name: "Treasure hunt", line: "A sea captain hid her gold somewhere in this room." },
  { id: "mystery", name: "Murder mystery", line: "Lord Ashby is dead. The furniture saw who did it." },
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
