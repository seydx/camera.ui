<template lang="pug">
.content.tw-overflow-y-hidden
  .tw-flex.tw-justify-between.tw-mt-1.tw-relative.tw-z-5(style="height: 25px;")
    .tw-ml-2.tw-text-xs.tw-font-bold.text-muted {{ $t('rss_feed') }}
    .tw-ml-auto.tw-mr-2
      v-btn.text-muted(icon x-small @click="reloadFeed" style="margin-top: -5px;")
        v-icon {{ icons['mdiReload'] }}
      v-btn.text-muted(icon x-small @click="dialog = true" style="margin-top: -5px;")
        v-icon {{ icons['mdiCog'] }}

  .tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading" style="height: calc(100% - 25px - 0.25rem)")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  
  .tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-else-if="!feed" style="height: calc(100% - 25px - 0.25rem)")
    v-btn(fab small depressed @click="dialog = true" color="var(--cui-text-hint)")
      v-icon.text-default {{ icons['mdiPlusThick'] }}
  
  .tw-w-full.tw-overflow-x-hidden(v-else style="height: calc(100% - 25px - 0.25rem)")
    .tw-py-4.tw-pt-2.tw-px-2(v-if="items.length")
      v-row.overflow-hidden
        v-col.tw-py-1(v-for="(item,i) in items" :key="item.title" cols="12")
          v-card.tw-p-2.tw-relative(elevation="1")
            v-btn.rss-goto-button(icon small :href="item.link" target="_blank")
              v-icon {{ icons['mdiChevronRight'] }}
            .tw-flex.tw-justify-between.tw-items-center.rss-card-title
              v-card-title.tw-text-sm.tw-p-0 {{ item.title || $t('no_title') }}
    .tw-absolute.tw-inset-0.tw-flex.tw-justify-center.tw-items-center(v-else)
      .text-muted {{ $t('no_feed') }}

  v-dialog(v-model="dialog" width="400" scrollable)
    v-card(height="350")
      v-card-title {{ $t('rss_feed') }}
      v-divider
      v-card-text.tw-p-7.tw-flex.tw-flex-col.tw-items-center.tw-justify-center
        .tw-block(v-if="loadingDialog")
          v-progress-circular(indeterminate color="var(--cui-primary)" size="20")

        .tw-w-full(v-else)
          v-sheet.tw-p-3(rounded class="mx-auto" width="100%" color="rgba(0,0,0,0.2)")
            span.text-default {{ $t('rss_feed_widget_info') }}
            
          .tw-w-full.tw-mt-5
            label.text-default {{ $t('rss_url') }}
            v-text-field(v-model="feedValue" persistent-hint prepend-inner-icon="mdi-rss" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              template(v-slot:prepend-inner)
                  v-icon.text-muted {{ icons['mdiRss'] }}

      v-divider
      v-card-actions.tw-flex.tw-justify-end
        v-btn.text-default(text @click='dialog = false') {{ $t('cancel') }}
        v-btn(color='var(--cui-primary)' text @click='applyData') {{ $t('apply') }}
      
</template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiChevronRight, mdiCog, mdiPlusThick, mdiReload, mdiRss } from '@mdi/js';

import { getSetting } from '@/api/settings.api';

export default {
  name: 'ShortcutsWidget',

  props: {
    item: Object,
  },

  data() {
    return {
      loading: true,
      loadingDialog: false,

      dialog: null,

      icons: {
        mdiChevronRight,
        mdiCog,
        mdiPlusThick,
        mdiReload,
        mdiRss,
      },

      feed: '',
      feedValue: '',
      items: [],
    };
  },

  watch: {
    '$route.path': {
      handler() {
        this.dialog = false;
      },
    },
  },

  async mounted() {
    try {
      const widgets = await getSetting('widgets');
      const items = widgets.data.items;

      const rssWidget = items.find((item) => item.id === this.item.id);

      if (rssWidget?.feed) {
        this.feedValue = rssWidget?.feed;
        await this.loadFeed();
      }

      this.loading = false;
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {},

  methods: {
    async applyData() {
      this.loadingDialog = true;

      try {
        await this.loadFeed();

        this.$emit('widgetData', {
          id: this.item.id,
          data: {
            feed: this.feedValue,
          },
        });

        this.feed = this.feedValue;
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }

      this.dialog = false;
      this.loadingDialog = false;
    },
    async loadFeed() {
      this.loading = true;

      const response = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(this.feedValue)}`
      );
      const data = await response.json();

      if (data?.status === 'error') {
        throw new Error(data.message);
      }

      this.feed = this.feedValue;
      this.items = data.items;
      this.loading = false;
    },
    async reloadFeed() {
      try {
        await this.loadFeed();
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  min-height: 100px;
  background: var(--cui-bg-default);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.widget {
}

.rss-card {
  padding: 1rem;
  border-radius: 15px;
  background: var(--cui-bg-card);
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

.rss-goto-button {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.3);
  color: #fff !important;
}
</style>
