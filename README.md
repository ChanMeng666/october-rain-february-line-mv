<div align="center">

# October Rain · February Line

**Two music videos drawn entirely in code: a web page draws every frame as a function of time, headless Chrome captures it, ffmpeg adds the song.**

</div>

## The films

### A Drizzle in October · 十月的微雨

<!-- FILM: a-drizzle-in-october · 16:9, 5:24 — Chan uploads the video here in GitHub's web editor -->

▶ Watch on YouTube: https://youtu.be/X3nUfLHawq4

### February, on an Extended Line · 二月的延长线

<!-- FILM: february-on-an-extended-line · 16:9, 5:14 — Chan uploads the video here in GitHub's web editor -->

▶ Watch on YouTube: https://youtu.be/B1q5akx2zPk

## How it's made

- **Cel film with line boil.** `lib/cel-engine.js` turns a centreline and a pressure profile into a variable-width ink outline, re-inked with a new noise seed every second frame so the lines breathe.
- **One-line film.** The whole day is a single polyline of relative pen moves; the two visible lines are parallel offsets of it, so they can never touch. A draw schedule maps lyric times to arc length and a virtual camera follows the pen.
- **Lyric timing from the recording.** faster-whisper word timestamps, aligned to the lyric sheet by pinyin (`tools/align.py`), plus librosa beats and energy envelopes.
- **Deterministic render.** Each film exposes `window.renderAt(t)`; `harness/render.mjs` seeks headless Chrome to every frame in parallel workers and ffmpeg muxes the untouched song.
- No image or video generation model is used for the picture. Songs by Chan Meng, made with Suno.

## Make your own

Needs Node.js 22+, Google Chrome and ffmpeg (Python 3.11+ only to rebuild timing). The songs are in `songs/`.

```bash
npm install
node harness/render.mjs films/01-october-rain  --workers 4 --audio songs/01-october-rain.mp3  --crf 16
node harness/render.mjs films/02-february-line --workers 5 --audio songs/02-february-line.mp3 --crf 16
# → films/<name>/out/video.mp4
```

## Licence

Code: MIT ([LICENSE](LICENSE)). Films, songs, images and other media made by Chan Meng: CC BY 4.0 ([LICENSE-MEDIA.md](LICENSE-MEDIA.md)). Excluded and under their own licences: the renderer, cel engine and paper textures adapted from [mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) (MIT), the fonts (SIL OFL 1.1) and the npm libraries. Full list in [CREDITS.md](CREDITS.md).

More detail: [docs/overview.md](docs/overview.md)
