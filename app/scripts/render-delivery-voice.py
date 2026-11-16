"""Render Wobbly Delivery's voice lines to files (B-GAME-38), in the pinned read-aloud voice.

  npx tsx scripts/delivery-voice-lines.mts > <work>/lines.json
  python scripts/render-delivery-voice.py --lines <work>/lines.json --work <work>

The voice is the one the app's read-aloud uses (cloudbuild.prod.yaml TTS_VOICE_EN/HE: Chirp 3 HD Sulafat),
called on the EU Cloud TTS endpoint with this machine's gcloud Application Default Credentials. The token is
held in memory only. The lines are authored game copy with no child data. Takes are cached in <work>/raw by the
exact text and rate sent, so a re-run only renders lines that are new or changed.

The voice reads two unpointed Hebrew names unevenly ("Pep" came out as pap, pet or pe-pe; "Aya" as ya, i-ya or
a-ya), so the voice is given them pointed (SAY). On 16 Nov a blind check, with the name blanked from the script,
heard Pep pointed with tsere as "pep" and Aya with two qamats as "a-ya" on most takes, against pap and a scatter
for the unpointed spellings. The screen keeps the copy's spelling; lines.json
records the lines as the copy writes them, so a test can tell when the copy and the files part.

Processing per clip: trim to 40 ms before the first and 120 ms after the last active frame; normalise the
active speech to a common RMS (-16 dBFS, the Sneak & Freeze lines' level); a look-ahead limiter holds peaks at
-1 dBFS; 5 ms fades; mono 24 kHz; AAC 64 kb/s m4a. Writes public/audio/kid/delivery/{en,he}/<id>.m4a and
manifest.json (lengths in ms, which the game uses to time the stitched request), plus <work>/report.json."""
import argparse, base64, hashlib, json, math, os, re, shutil, subprocess, sys, urllib.error, urllib.request, wave

import numpy as np

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(APP, "public", "audio", "kid", "delivery")
VOICE = {"en": ("en-US", "en-US-Chirp3-HD-Sulafat"), "he": ("he-IL", "he-IL-Chirp3-HD-Sulafat")}
ENDPOINT = "https://eu-texttospeech.googleapis.com/v1/text:synthesize"
TARGET_DBFS, CEILING_DBFS, LEAD_MS, TAIL_MS = -16.0, -1.0, 40, 120
# Voice input only: the names as the voice should hear them (a one-letter prefix such as the ל of "to" stays).
SAY = {"he": {"פפ": "פֵּפ", "איה": "אָיָה"}, "en": {}}


def spoken(text, lang):
    for written, said in SAY[lang].items():
        text = re.sub(rf"(?<![א-ת])([ולבמהש]?){written}(?![א-ת])", rf"\g<1>{said}", text)
    return text


def run(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()


def synth(text, lang, token, project, rate):
    code, name = VOICE[lang]
    audio = {"audioEncoding": "LINEAR16", "sampleRateHertz": 24000}
    if rate != 1.0:
        audio["speakingRate"] = rate
    body = json.dumps({"input": {"text": text}, "voice": {"languageCode": code, "name": name}, "audioConfig": audio}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "Authorization": "Bearer " + token, "Content-Type": "application/json", "x-goog-user-project": project})
    with urllib.request.urlopen(req, timeout=60) as r:
        return base64.b64decode(json.load(r)["audioContent"])


def read_wav(path):
    with wave.open(path) as w:
        rate, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        a = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32)
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a / 32768.0, rate


def write_wav(path, x, rate):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = np.clip(np.round(x * 32767.0), -32767, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm.tobytes())


def db(v):
    return 20 * math.log10(max(v, 1e-9))


def active(x, rate):
    """First and last active sample (5 ms frames within 36 dB of the loudest, floor -52 dBFS) and the active RMS."""
    hop = int(rate * 0.005)
    frames = x[: (len(x) // hop) * hop].reshape(-1, hop)
    fr = np.array([db(float(np.sqrt(np.mean(f * f)))) for f in frames])
    loud = fr > max(-52.0, float(fr.max()) - 36.0)
    on = np.where(loud)[0]
    act = frames[loud].ravel()
    return int(on[0]) * hop, (int(on[-1]) + 1) * hop, db(float(np.sqrt(np.mean(act * act))))


def limit(y, rate, ceiling_db):
    c = 10 ** (ceiling_db / 20)
    g = np.minimum(1.0, c / np.maximum(np.abs(y), 1e-9))
    k = max(1, int(rate * 0.004))
    held = np.min(np.lib.stride_tricks.sliding_window_view(np.pad(g, (k, k), mode="edge"), 2 * k + 1), axis=1)
    sm = np.convolve(np.pad(held, (k, k), mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="valid")
    out = y * np.minimum(sm, held)
    m = float(np.max(np.abs(out)))
    if m > c:
        out *= c / m
    return out, round(db(float(np.min(np.minimum(sm, held)))), 2)


def fade(y, rate, ms=5):
    n = min(len(y) // 2, int(rate * ms / 1000))
    if n:
        r = np.linspace(0, 1, n, dtype=np.float32)
        y[:n] *= r; y[-n:] *= r[::-1]
    return y


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--lines", required=True)
    p.add_argument("--work", required=True)
    p.add_argument("--rate", type=float, default=0.92, help="speaking rate; a little under 1 for a listening game")
    p.add_argument("--project", default=os.environ.get("GCP_PROJECT_ID") or run("gcloud config get-value project"))
    args = p.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is required")
    lines = json.load(open(args.lines, encoding="utf-8"))
    token = None
    manifest = {"ext": "m4a", "he": {}, "en": {}, "foley": {}}
    report = {"voice": {k: v[1] for k, v in VOICE.items()}, "endpoint": ENDPOINT, "rate": args.rate, "clips": {}}
    for lang in ("en", "he"):
        for lid, text in lines[lang].items():
            say = spoken(text, lang)
            take = hashlib.sha1(f"{VOICE[lang][1]}|{args.rate}|{say}".encode()).hexdigest()[:10]
            raw = os.path.join(args.work, "raw", lang, f"{lid}-{take}.wav")
            if not os.path.exists(raw):
                token = token or run("gcloud auth application-default print-access-token")
                try:
                    data = synth(say, lang, token, args.project, args.rate)
                except urllib.error.HTTPError as e:
                    sys.exit(f"{lang}/{lid}: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:300]}")
                os.makedirs(os.path.dirname(raw), exist_ok=True)
                open(raw, "wb").write(data)
            x, rate = read_wav(raw)
            a, b, rms = active(x, rate)
            y = x[max(0, a - int(rate * LEAD_MS / 1000)): min(len(x), b + int(rate * TAIL_MS / 1000))].copy()
            y *= 10 ** ((TARGET_DBFS - rms) / 20)
            y, reduction = limit(y, rate, CEILING_DBFS)
            y = fade(y, rate)
            wav = os.path.join(args.work, "final", lang, f"{lid}.wav")
            write_wav(wav, y, rate)
            m4a = os.path.join(OUT, lang, f"{lid}.m4a")
            os.makedirs(os.path.dirname(m4a), exist_ok=True)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-c:a", "aac", "-b:a", "64k",
                            "-movflags", "+faststart", m4a], check=True)
            ms = round(len(y) / rate * 1000)
            manifest[lang][lid] = ms
            report["clips"][f"{lang}/{lid}"] = {"text": text, "said": say, "ms": ms, "raw_ms": round(len(x) / rate * 1000),
                                                "active_rms_dbfs": round(rms, 2), "limiter_db": reduction}
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=1)
        f.write("\n")
    with open(os.path.join(OUT, "lines.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump({lang: lines[lang] for lang in ("en", "he")}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(os.path.join(args.work, "report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print(f"{sum(len(manifest[l]) for l in ('en', 'he'))} clips; manifest {os.path.join(OUT, 'manifest.json')}")


if __name__ == "__main__":
    main()
