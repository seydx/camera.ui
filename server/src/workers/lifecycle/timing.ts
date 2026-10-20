export const TIMER_SCALE = process.env.CAMERAUI_DIAG_LIFECYCLE === '1' ? Number(process.env.CAMERAUI_DIAG_TIMER_SCALE) || 1 : 1;

export function scaled(ms: number): number {
  return Math.round(ms * TIMER_SCALE);
}

export const SYNC_INTERVAL_MS = scaled(5000);
export const REPORT_DEBOUNCE_MS = scaled(100);
export const SPAWN_REPORT_WAIT_MS = scaled(2000);
export const HEARTBEAT_TIMEOUT_MS = 8000;

export const LEASE_MS = scaled(20_000);
export const LEGACY_LEASE_MS = scaled(10_000);
export const LEASE_MIN_MS = scaled(10_000);
export const LEASE_MAX_MS = scaled(120_000);
export const LEASE_STOP_GRACE_MS = scaled(3000);
export const LEASE_TICK_MS = scaled(1000);
export const SILENT_WARN_MS = scaled(10_000);

export const WORKER_TIMEOUT_MS = scaled(15_000);
export const PRESENCE_TICK_MS = scaled(1000);
export const SELF_STALL_MS = scaled(5000);
export const FAILOVER_AFTER_MS = scaled(25_000);

export const NOTICE_SYNC_WAIT_MS = scaled(2000);
export const NOTICE_MARGIN_MS = scaled(5000);
export const NOTICE_CAP_MS = scaled(600_000);
export const LASTSEEN_WRITE_MS = 60_000;

export const MASTER_EXPECT_BACK_MS = { restart: scaled(60_000), update: scaled(180_000), stop: 0 };
export const WORKER_EXPECT_BACK_MS = { restart: scaled(30_000), update: scaled(120_000), stop: 0 };

export const HOLD_MAX_MS = scaled(120_000);
export const NO_PROGRESS_MS = scaled(30_000);
export const SPAWNED_POKE_MS = scaled(3000);
export const RESUME_INTERVAL_MS = scaled(2000);
export const RESUME_TIMEOUT_MS = scaled(15_000);
export const READY_BUFFER_MS = scaled(10_000);
export const READY_DEADLINE_MS = [45_000, 120_000, 300_000, 600_000].map(scaled);
export const STARTED_DEADLINE_MS = { plugin: scaled(300_000), camera: scaled(30_000) };
export const INITIALIZE_BACKOFF_MS = [2000, 5000, 10_000, 30_000].map(scaled);
export const INSTALL_IDLE_MS = scaled(600_000);
export const INSTALL_CAP_MS = scaled(1_200_000);
export const PREPARE_SILENT_MS = scaled(30_000);
export const RELEASE_ACK_WARN_MS = scaled(15_000);
export const RELEASE_ACK_FAIL_MS = scaled(60_000);
export const STORE_LINGER_MS = scaled(5000);
export const STORE_REPORT_WAIT_MS = scaled(8000);
export const REHOME_STABLE_MS = scaled(60_000);
export const REHOME_STABLE_MAX_MS = scaled(600_000);
export const REHOME_FLAP_WINDOW_MS = scaled(600_000);
export const OUTDATED_PROBE_MS = scaled(30_000);
export const UPDATE_RESTART_WINDOW_MS = scaled(180_000);
export const DESKTOP_UPDATE_RESTART_MS = scaled(900_000);
export const UPDATE_IDLE_MS = scaled(600_000);
export const LEGACY_UPDATE_IDLE_MS = scaled(360_000);
export const UPDATE_TOTAL_MS = scaled(2_100_000);

export const SUSPEND_MAX_MS = scaled(60_000);
export const PAIR_RETRY_MS = [scaled(5000), scaled(60_000)];
export const UNPAIRED_POLL_MS = scaled(30_000);
export const REJECT_SPACING_MS = scaled(20_000);
export const REJECT_TO_STATE = 3;
export const REJECT_DIAL_MS = [scaled(60_000), scaled(300_000)];
export const REJECT_DIAL_SLOW_AFTER = 10;
export const RELEASED_HEARTBEAT_MS = scaled(60_000);
export const MASTER_SEARCH_AFTER_MS = scaled(60_000);
export const MASTER_SEARCH_MS = [scaled(60_000), scaled(300_000)];
