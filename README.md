# Roomscape

Scan any room and Roomscape turns it into a treasure hunt. An AI writes a short story, hides a chain of brain teasers in the real objects around you, and your phone's camera checks each find. Hosts can hide a real gift and let Roomscape write every clue that leads to it.

Built during the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026). Everything in this repository was written during the event.

## Meta models

Roomscape calls only Meta models at runtime.

| Model | Used for |
| --- | --- |
| Muse Spark 1.3 | Reading the room, double-checking object details, solving every puzzle before play |
| Muse Wonder 1.0 | Designing the story, puzzles, hints and unlock order |
| SAM 3.1 | Masking every object, live outlines during the hunt, cutouts for character art |
| Muse Image 1.0 | The themed room scene, talking-object characters, picture puzzles, the final front page |
| Muse Voice Transcribe 1.0 | Push-to-talk questions to characters |
| Muse Spark Open (Baseten) | Live answer checks and in-character conversation |

## Run it

```bash
npm install
cp .env.example .env.local   # add MODEL_API_KEY; without it the app runs on sample replies
npm run dev
```

Open http://localhost:3000 on your phone (same network) or in a mobile-sized browser window.
