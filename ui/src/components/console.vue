<template lang="pug">
  #terminal.console
</template>

<script>
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { bus } from '@/main';

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

    bus.$on('extendSidebar', this.triggerSidebar);

    window.addEventListener('orientationchange', this.resizeHandler);
    window.addEventListener('resize', this.resizeHandler);
  },
  beforeDestroy() {
    this.term?.dispose();
    this.fitAddon?.dispose();

    bus.$off('extendSidebar', this.triggerSidebar);

    window.removeEventListener('orientationchange', this.resizeHandler);
    window.removeEventListener('resize', this.resizeHandler);
  },
  methods: {
    resizeHandler() {
      setTimeout(() => this.fitAddon.fit(), 500);
    },
    triggerSidebar() {
      setTimeout(() => this.fitAddon.fit(), 500);
    },
  },
};
</script>
