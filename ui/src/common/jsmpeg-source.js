class JSMpegWritableSource {
  // eslint-disable-next-line no-unused-vars
  constructor(url, options) {
    this.destination = null;

    this.completed = false;
    this.established = false;
    this.progress = 0;

    // Streaming is obiously true when using a stream
    this.streaming = true;
    this.started = false;
    this.chunks = 0;

    this.onPausedCallback = options.onSourcePaused;
    this.onEstablishedCallback = options.onSourceEstablished;
  }

  connect(destination) {
    this.destination = destination;
  }

  start() {
    this.established = true;
    this.completed = true;
    this.progress = 1;
  }

  pause(state) {
    if (this.started) {
      this.onPausedCallback(this);
    }

    this.chunks = 0;
    this.paused = true;
    this.started = !state;
  }

  resume() {
    // eslint-disable-line class-methods-use-this
  }

  destroy() {
    this.started = false;
  }

  write(buffer) {
    if (this.paused && !this.started && this.chunks < 10) {
      return this.chunks++;
    }

    const isFirstChunk = !this.started;
    this.started = true;

    if (isFirstChunk && this.onEstablishedCallback) {
      this.onEstablishedCallback(this);
    }

    this.destination.write(buffer);
  }
}

export default JSMpegWritableSource;
