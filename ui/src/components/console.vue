<template lang="pug">
  #terminal.console
</template>

<script>
import stripAnsi from 'strip-ansi';
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
    filter: {
      type: Array,
      default: () => [],
    },
  },

  data() {
    return {
      fitAddon: null,
      term: null,
      fullLog: [],
    };
  },

  sockets: {
    clearLog() {
      this.fullLog = [];
      this.term?.clear();
    },
    logMessage(message) {
      this.fullLog.push(message);
      this.writeMessage(message);
    },
  },

  async mounted() {
    let terminalContainer = document.getElementById('log');

    this.term = new Terminal(this.terminal);
    this.fitAddon = new FitAddon();

    this.term?.loadAddon(this.fitAddon);
    this.term?.open(terminalContainer);

    this.term._initialized = true;
    this.fitAddon?.fit();

    const log = await getLog();

    this.fullLog = log.data.replace(/[\n]+/g, '\r\n').split('\r\n');
    this.writeMessage(this.fullLog);

    bus.$on('extendSidebar', this.triggerSidebar);

    window.addEventListener('orientationchange', this.resizeHandler);
    window.addEventListener('resize', this.resizeHandler);

    this.$watch('filter', this.watchFilter, { deep: true });
  },
  beforeDestroy() {
    bus.$off('extendSidebar', this.triggerSidebar);

    window.removeEventListener('orientationchange', this.resizeHandler);
    window.removeEventListener('resize', this.resizeHandler);

    this.term?.dispose();
    this.fitAddon?.dispose();

    this.term = null;
    this.fitAddon = null;
  },
  methods: {
    resizeHandler() {
      setTimeout(() => this.fitAddon?.fit(), 500);
    },
    triggerSidebar() {
      setTimeout(() => this.fitAddon?.fit(), 500);
    },
    writeMessage(message) {
      if (!Array.isArray(message)) {
        message = [message + '\r\n'];
      }

      const write = (msg) => {
        this.term?.write(msg);
        this.fitAddon?.fit();

        setTimeout(() => {
          this.term?.scrollToBottom();
        }, 100);
      };

      if (this.filter.length) {
        message.forEach((line) => {
          const text = stripAnsi(line);

          if (this.filter.some((filter) => text.toLowerCase().includes(filter.toLowerCase()))) {
            write(line + '\r\n');
          }
        });
      } else {
        write(message.join('\r\n'));
      }
    },
    watchFilter() {
      this.term?.clear();
      this.writeMessage(this.fullLog);
    },
  },
};
</script>
