<template lang="pug">
div
  BackToTop
  Navbar(:name="$t('recordings')")
  BreadcrumbFilter(
    :active="true",
    dataType="recordings",
    :showAllRemove="recordings.length !== 0 && checkLevel('recordings:edit')", 
    :showFilterCameras="true",
    :showFilterDate="true",
    :showFilterLabelsFor="'recordings'",
    :showFilterRooms="true",
    :showFilterTypes="true", 
    @filter="filterRecordings",
    @remove-all="removeAll"
  )
  main.inner-container.w-100.h-100vh-calc-filter.pt-save.footer-offset
    .container.pt-3.d-flex.flex-wrap.justify-content-center.align-content-center.position-absolute-fullsize(v-if="loading")
      b-spinner.text-color-primary
    .container.pt-3(v-else)
      .row
        .col-lg-4.col-md-6.col-12.my-1.recording-cards(
          v-for="(recording, imageIndex) in recordings", 
          :key="imageIndex" 
          :data-id="recording.id" 
          data-aos="fade-up"
          data-aos-duration="1000"
          loop
        )
          LightboxCard(
            :recording="recording",
            :key="recording.fileName",
            @remove-image="remove($event, imageIndex)",
            @show-image="index = imageIndex"
          )
      CoolLightBox(
        :items="images" 
        :index="index"
        @close="index = null"
        :closeOnClickOutsideMobile="true"
        :useZoomBar="true"
      )
      div(data-aos="fade-up" data-aos-duration="1000")
        infinite-loading(
          :identifier="infiniteId", 
          @infinite="infiniteHandler"
        )
          div(slot="spinner")
            b-spinner.text-color-primary
          div(slot="no-more") {{ $t("no_more_data") }}
          div(slot="no-results") {{ $t("no_results") }}
  Footer
</template>

<script>
import CoolLightBox from 'vue-cool-lightbox';
import 'vue-cool-lightbox/dist/vue-cool-lightbox.min.css';
import InfiniteLoading from 'vue-infinite-loading';

import { getRecordings, removeRecording, removeRecordings } from '@/api/recordings.api';
import BackToTop from '@/components/back-to-top.vue';
import BreadcrumbFilter from '@/components/breadcrumb-filter.vue';
import Footer from '@/components/footer.vue';
import LightboxCard from '@/components/lightbox-card.vue';
import Navbar from '@/components/navbar.vue';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Recordings',
  components: {
    BackToTop,
    BreadcrumbFilter,
    CoolLightBox,
    Footer,
    InfiniteLoading,
    LightboxCard,
    Navbar,
  },
  data() {
    return {
      index: null,
      infiniteId: Date.now(),
      images: [],
      loading: true,
      page: 1,
      query: '',
      recordings: [],
    };
  },
  sockets: {
    recording(recording) {
      this.recordings.unshift(recording);
      this.images.unshift({
        title: `${recording.camera} - ${recording.time}`,
        src: `/files/${recording.fileName}`,
        thumb: recording.recordType === 'Video' ? `/files/${recording.name}@2.jpeg` : `/files/${recording.fileName}`,
      });
    },
  },
  mounted() {
    this.loading = false;
  },
  methods: {
    filterRecordings(filter) {
      if (filter) {
        this.loading = true;
        this.recordings = [];
        this.page = 1;
        this.query = '';

        if (filter.cameras && filter.cameras.length > 0) {
          this.query += `&cameras=${filter.cameras.toString()}`;
        }

        if (filter.labels && filter.labels.length > 0) {
          this.query += `&labels=${filter.labels.toString()}`;
        }

        if (filter.rooms && filter.rooms.length > 0) {
          this.query += `&rooms=${filter.rooms.toString()}`;
        }

        if (filter.types && filter.types.length > 0) {
          this.query += `&types=${filter.types.toString()}`;
        }

        if (filter.dateRange && filter.dateRange.start) {
          this.query += `&from=${filter.dateRange.start}`;
        }

        if (filter.dateRange && filter.dateRange.end) {
          this.query += `&to=${filter.dateRange.end}`;
        }
      }

      this.infiniteId = Date.now();
      this.loading = false;
    },
    async infiniteHandler($state) {
      try {
        if (this.checkLevel('recordings:access')) {
          const response = await getRecordings(`?refresh=true&page=${this.page || 1}` + this.query);

          if (response.data.result.length > 0) {
            this.page += 1;
            this.recordings = [...this.recordings, ...response.data.result];
            this.images = this.recordings.map((rec) => {
              return {
                title: `${rec.camera} - ${rec.time}`,
                src: `/files/${rec.fileName}`,
                thumb: rec.recordType === 'Video' ? `/files/${rec.name}@2.jpeg` : `/files/${rec.fileName}`,
              };
            });
            $state.loaded();
          } else {
            $state.complete();
          }
        } else {
          this.$toast.error(this.$t('no_access'));
          $state.complete();
        }
      } catch (err) {
        this.$toast.error(err.message);
      }
    },
    async remove(recording, index) {
      try {
        await removeRecording(recording.id, '?refresh=true');

        const card = document.querySelector('div[data-id="' + recording.id + '"]');

        card.dataset.aos = 'fade';
        card.dataset.aosDuration = '500';
        card.classList.remove('aos-init');
        card.classList.remove('aos-animate');

        await timeout(500);

        //this.recordings = this.recordings.splice(index, 1);
        this.images = this.images.splice(index, 1);
        this.$delete(this.recordings, index);

        //Refresh infinite loading
        if (this.recordings.length === 0) {
          this.infiniteId += 1;
        }

        this.$toast.success(`${this.$t('recording')} ${this.$t('removed')}!`);
      } catch (err) {
        console.log(err);
        this.$toast.error(err.message);
      }
    },
    async removeAll() {
      try {
        await removeRecordings();

        const cards = document.querySelectorAll('.aos-animate');

        for (const card of cards) {
          card.dataset.aos = 'fade-up';
          card.dataset.aosDuration = '500';
          card.classList.remove('aos-init');
          card.classList.remove('aos-animate');
        }

        await timeout(500);

        this.$toast.success(this.$t('all_recordings_removed'));
        this.recordings = [];
        this.images = [];
      } catch (err) {
        this.$toast.error(err.message);
      }
    },
  },
};
</script>

<style scoped>
.inner-container {
  margin-top: 140px;
}

.recording-fade-enter-active {
  transition: all 0.4s ease;
}
.recording-fade-leave-active {
  transition: all 0.4s cubic-bezier(1, 0.5, 0.8, 1);
}
.recording-fade-enter,
.recording-fade-leave-to {
  transform: translateY(-30px);
  opacity: 0;
}

@media (max-width: 767px) {
  .recording-cards {
    max-width: 80%;
    margin: 0 auto;
  }
}

@media (max-width: 500px) {
  .recording-cards {
    max-width: 90%;
    margin: 0 auto;
  }
}

@media (max-width: 400px) {
  .recording-cards {
    max-width: 95%;
    margin: 0 auto;
  }
}

@media (max-width: 320px) {
  .recording-cards {
    max-width: 100%;
    margin: 0 auto;
  }
}
</style>
