# 🎲 Yahtzee Scorekeeper

A tiny, self-hosted Yahtzee scorekeeper and game history. Bring five real dice
and your phones — this keeps score, enforces the rules, and remembers who won.

- **Shared scoreboard.** Start a game, share the 4-letter code, and everyone
  enters their own scores from their own phone. The board updates live.
- **No dice (yet).** You roll physical dice; the app records the scores. Virtual
  dice are on the roadmap.
- **Rules enforced.** Scores are validated server-side — no illegal Full Houses,
  and the Yahtzee bonus only counts if your Yahtzee box holds a 50.
- **Truly self-hosted.** One container, a single SQLite file on a volume. No
  external database, no cloud, no accounts.

Profiles are passwordless — pick your name and play. It's built for a household
or a game-night group that trusts each other, not the public internet.

## Run it (self-host)

Everything ships as one image on the GitHub Container Registry:

```bash
docker run -d \
  --name yahtzee \
  -p 8000:8000 \
  -v yahtzee-data:/data \
  ghcr.io/zeroxeleven/yahtzee:latest
```

Open <http://localhost:8000>. The SQLite database lives in the `yahtzee-data`
volume, so your history survives restarts and upgrades.

Prefer compose? See [`examples/docker-compose.yml`](examples/docker-compose.yml).

## Develop it

No Node or Python needed on your machine — everything runs in Docker with hot
reload:

```bash
docker compose up --build
```

- Frontend (Vite dev server): <http://localhost:5173>
- Backend (FastAPI docs): <http://localhost:8000/docs>

Edit files under `frontend/` or `backend/` and they reload automatically.

Run the backend tests:

```bash
docker compose run --rm backend pytest
```

## How scoring works

Players enter the **final score** for each category (we all know how to add).
The engine validates the entry is legal and does all the totaling:

| Category type | Entry | Validation |
|---|---|---|
| Upper (Ones–Sixes) | tap how many of that face (0–5) | value must be a valid multiple |
| Full House / Straights / Yahtzee | one tap: got it or scratch | value is `0` or the fixed score |
| 3/4 of a Kind, Chance | type the dice sum | `0` or `5`–`30` |

- **Upper bonus:** +35 when the upper section reaches 63.
- **Yahtzee bonus:** +100 each — but only if the Yahtzee box is already scored 50
  (scratching Yahtzee forfeits all bonuses, per the official rules).

The scoring engine is a small, pure module with unit tests:
[`backend/app/scoring.py`](backend/app/scoring.py),
[`backend/tests/test_scoring.py`](backend/tests/test_scoring.py).

## Architecture

```
frontend/   React + TypeScript + Vite   (dev: Vite server; prod: static bundle)
backend/    FastAPI + SQLite             (scoring engine, REST API)
Dockerfile           multi-stage → one production image (FastAPI serves the UI)
docker-compose.yml   two-service dev stack with hot reload
```

In production, FastAPI serves the pre-built React bundle from the same process,
so the whole app is a single container on a single port.

## Roadmap

- [x] Game history — review past games, resume active ones, delete junk games
- [x] Per-player stats across finished games (games played, wins, win rate, average, high score, total Yahtzees)
- [ ] Virtual dice (roll in-app, pick where the score goes)
- [ ] Tighter live sync via SSE (server→client push, replacing 2s polling; SSE over WebSockets since updates are one-directional and `EventSource` auto-reconnects when phones lock)
- [ ] Joker-rule helper prompts

## License

[MIT](LICENSE) © Brian Johnston
