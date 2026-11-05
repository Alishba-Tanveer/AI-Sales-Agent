# Free topic-matched narrated video setup

The Content Engine creates a short MP4 from Pixabay footage selected by the script topic, with spoken narration of the title, hook, main points, and call to action. It no longer burns the script text onto the video or includes the stock clips' original audio. This is a narrated stock-footage montage, not newly generated AI footage or a talking avatar.

## One-time setup

1. Sign in to Pixabay and open its [API documentation](https://pixabay.com/api/docs/) to view your API key. Searches are cached locally for 24 hours as required by Pixabay's API rules.
2. Install FFmpeg Essentials on the API computer. The FFmpeg executable and `ffprobe.exe` must both be available. If `FFMPEG_PATH` points directly to `ffmpeg.exe`, keep `ffprobe.exe` in the same `bin` folder.
3. Install Python 3, then install the free `edge-tts` command line tool:

```powershell
py -m pip install edge-tts
```

`edge-tts` uses Microsoft's online Edge speech service through a community-maintained Python package. The API computer needs internet access for voice generation. The voice defaults to `en-US-JennyNeural`.

4. Add the settings to the API `.env` file:

```env
PIXABAY_API_KEY=your_pixabay_api_key
FFMPEG_PATH=C:/path/to/ffmpeg/bin/ffmpeg.exe
EDGE_TTS_PATH=edge-tts
VIDEO_TTS_VOICE=en-US-JennyNeural
API_PUBLIC_URL=http://localhost:4000
```

Change `FFMPEG_PATH` to your actual full path. If Windows cannot find `edge-tts`, set `EDGE_TTS_PATH` to the full path of `edge-tts.exe` (usually under Python's `Scripts` folder). For a deployed app, `API_PUBLIC_URL` must be the public API origin.

5. Restart the API. Generated videos are saved in `uploads/linkedin-videos` by default; use persistent storage for that folder, and set `VIDEO_STORAGE_DIR` if needed.

## Matching behavior

The app searches Pixabay with topic terms, scores results using their tags and related terms, and chooses the best matching clips. If Pixabay has no sufficiently relevant tagged clip, generation stops with an explanation instead of silently using unrelated footage. Pixabay's [API documentation](https://pixabay.com/api/docs/) describes its video-search fields, default rate limit, 24-hour caching rule, and attribution guidance.

## Troubleshooting

- Missing key: add `PIXABAY_API_KEY` to the API `.env` file and restart.
- FFmpeg/ffprobe error: verify `FFMPEG_PATH` and confirm `ffprobe.exe` is beside `ffmpeg.exe`.
- Missing voice command: install with `py -m pip install edge-tts`; if necessary, set `EDGE_TTS_PATH` to `edge-tts.exe`.
- Speech generation failure: confirm the API computer can reach the internet and try again later.
- No relevant clip found: make the script title and main points more specific. The app avoids using weakly related clips.
