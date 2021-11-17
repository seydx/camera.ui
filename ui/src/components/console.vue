<template lang="pug">
  #terminal.console
</template>

<script>
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { getLog } from '@/api/system.api';

export default {
  name: 'Console',
  props: {
    terminal: {
      type: Object,
      default: () => ({}),
    },
  },
  data() {
    return {
      fitAddon: null,
      term: null,
    };
  },
  sockets: {
    clearLog() {
      if (this.term) {
        this.term.clear();
      }
    },
    logMessage(message) {
      if (this.term) {
        message = message + '\r\n';
        this.term.write(message);
        this.fitAddon.fit();
      }
    },
  },
  async mounted() {
    let terminalContainer = document.getElementById('log');

    this.term = new Terminal();
    this.fitAddon = new FitAddon();

    this.term.loadAddon(this.fitAddon);
    this.term.open(terminalContainer);

    this.term._initialized = true;
    this.fitAddon.fit();

    const log = await getLog();

    const message = log.data + '\r\n';

    this.term.write(message);
    this.fitAddon.fit();
    window.addEventListener('resize', this.resizeHandler);
  },
  beforeDestroy() {
    this.term?.dispose();
    this.fitAddon?.dispose();

    window.addEventListener('orientationchange', this.resizeHandler);
    window.removeEventListener('resize', this.resizeHandler);
  },
  methods: {
    resizeHandler() {
      setTimeout(() => this.fitAddon.fit(), 500);

      /*const logContainer = document.querySelector('.log');
      const logContainerWidth = logContainer.clientWidth;

      const xtermViewport = document.querySelector('.xterm-viewport');
      xtermViewport.style.width = `${logContainerWidth}px`;*/
    },
  },
};
</script>
