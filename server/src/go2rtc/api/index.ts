import { API_EVENT } from '@camera.ui/sdk';

import { inject, provide } from '../../container.js';
import { RequestManager } from './manager.js';
import { ApplicationRoute } from './routes/application.js';
import { ConfigRoute } from './routes/config.js';
import { DiscoverRoute } from './routes/discover.js';
import { SnapshotRoute } from './routes/snapshot.js';
import { StreamsRoute } from './routes/streams.js';

import type { CameraUiAPI } from '../../api.js';

export class Go2RtcApi {
  public applicationRoute: ApplicationRoute;
  public configRoute: ConfigRoute;
  public snapshotRoute: SnapshotRoute;
  public streamsRoute: StreamsRoute;
  public discoverRoute: DiscoverRoute;

  private api: CameraUiAPI;

  private requestManager: RequestManager;

  constructor() {
    provide('go2rtcApi', this);

    this.api = inject('api');
    this.requestManager = new RequestManager();

    this.applicationRoute = new ApplicationRoute(this.requestManager);
    this.configRoute = new ConfigRoute(this.requestManager);
    this.snapshotRoute = new SnapshotRoute(this.requestManager);
    this.streamsRoute = new StreamsRoute(this.requestManager);
    this.discoverRoute = new DiscoverRoute(this.requestManager);

    this.api.setMaxListeners(this.api.getMaxListeners() + 1);
    this.api.once(API_EVENT.SHUTDOWN, this.clear.bind(this));
  }

  public clear(): void {
    this.requestManager.clear();
  }
}
