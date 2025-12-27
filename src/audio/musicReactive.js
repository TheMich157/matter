export class MusicReactive {
  constructor(app) {
    this.app = app;
    this.running = false;
    this.stream = null;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.ctx = new AudioContext();

      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);

      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.loop();
    } catch (err) {
      this.running = false;
      this.stream = null;
      if (this.ctx) {
        try { this.ctx.close(); } catch (_) {}
      }
      this.app.log("Microphone access unavailable. Enable mic or choose another input device.", "error");
      this.app.setSceneMsg?.("Microphone access unavailable.", "error");
    }
  }

  async loop() {
    if (!this.running) return;

    this.analyser.getByteFrequencyData(this.data);

    let bass = 0;
    for (let i = 0; i < 15; i++) bass += this.data[i];
    bass /= 15;

    const brightness = Math.max(10, Math.min(100, bass / 255 * 100));

    const t = Date.now() / 600;
    const r = Math.round(128 + 127 * Math.sin(t));
    const g = Math.round(128 + 127 * Math.sin(t + 2));
    const b = Math.round(128 + 127 * Math.sin(t + 4));

    await this.app.setColor(r, g, b);
    await this.app.setBrightness(brightness);

    setTimeout(() => this.loop(), 160);
  }

  stop() {
    this.running = false;
    if (this.ctx) this.ctx.close();
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
