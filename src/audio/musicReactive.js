export class MusicReactive {
  constructor(app) {
    this.app = app;
    this.running = false;
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.data = null;
    this._timer = null;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    try {
      // 1) zober sourceId pre “screen” (s audio)
      const src = await window.electron?.getAudioSourceId?.();
      if (!src?.id) throw new Error("No audio source available");

      // 2) getUserMedia cez desktop capture (system audio)
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: src.id,
          },
        },
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: src.id,
          },
        },
      });

      // 3) WebAudio analyser
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const audioTracks = new MediaStream(this.stream.getAudioTracks());
      const sourceNode = this.ctx.createMediaStreamSource(audioTracks);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      sourceNode.connect(this.analyser);

      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.loop();

     this.app.log(`Music mode: capturing system audio (${src.name})`, "success");
  } catch (err) {
    this.running = false;
    this.cleanup();

    this.app.log(
      `System audio capture failed: ${err?.message || err}. In Windows you may need to select a screen source that supports audio.`,
      "error"
    );
  }
}

  async loop() {
    if (!this.running || !this.analyser) return;

    this.analyser.getByteFrequencyData(this.data);

    // bass energia (nižšie pásma)
    let bass = 0;
    const bins = Math.min(20, this.data.length);
    for (let i = 0; i < bins; i++) bass += this.data[i];
    bass /= bins;

    // 10..100
    const brightness = Math.max(10, Math.min(100, (bass / 255) * 100));

    // farba podľa času + bass (trochu viac “reactive”)
    const t = Date.now() / 550;
    const boost = bass / 255; // 0..1
    const r = Math.round(120 + 135 * Math.sin(t) * (0.6 + boost));
    const g = Math.round(120 + 135 * Math.sin(t + 2) * (0.6 + boost));
    const b = Math.round(120 + 135 * Math.sin(t + 4) * (0.6 + boost));

    await this.app.setColor(clamp(r), clamp(g), clamp(b));
    await this.app.setBrightness(Math.round(brightness));

    this._timer = setTimeout(() => this.loop(), 140);
  }

  stop() {
    this.running = false;
    if (this._timer) clearTimeout(this._timer);
    this.cleanup();
    this.app.log("Music mode stopped", "info");
  }

  cleanup() {
    try { this.ctx?.close(); } catch (_) {}
    this.ctx = null;

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.analyser = null;
    this.data = null;
  }
}

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}
