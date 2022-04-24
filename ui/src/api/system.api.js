import api from './index';

const resource = '/system';
const changelog_resource = 'changelog';
const disk_resource = 'disk';
const db_resource = 'db';
const db_download_resource = 'db/download';
const ftp_restart_resource = 'ftp/restart';
const ftp_status_resource = 'ftp/status';
const ftp_stop_resource = 'ftp/stop';
const http_restart_resource = 'http/restart';
const http_status_resource = 'http/status';
const http_stop_resource = 'http/stop';
const log_resource = 'log';
const log_download_resource = 'log/download';
const mqtt_restart_resource = 'mqtt/restart';
const mqtt_status_resource = 'mqtt/status';
const mqtt_stop_resource = 'mqtt/stop';
const npm_resource = 'npm';
const restart_resource = 'restart';
const smtp_restart_resource = 'smtp/restart';
const smtp_status_resource = 'smtp/status';
const smtp_stop_resource = 'smtp/stop';
const update_resource = 'update';
const uptime_resource = 'uptime';

export const downloadDb = async () => await api.get(`${resource}/${db_download_resource}`);

export const downloadLog = async () => await api.get(`${resource}/${log_download_resource}`);

export const getChangelog = async (parameters) =>
  await api.get(`${resource}/${changelog_resource}${parameters ? parameters : ''}`);

export const getDiskLoad = async () => await api.get(`${resource}/${disk_resource}`);

export const getDb = async () => await api.get(`${resource}/${db_resource}`);

export const getFtpServerStatus = async () => await api.get(`${resource}/${ftp_status_resource}`);

export const getHttpServerStatus = async () => await api.get(`${resource}/${http_status_resource}`);

export const getLog = async () => await api.get(`${resource}/${log_resource}`);

export const getMqttClientStatus = async () => await api.get(`${resource}/${mqtt_status_resource}`);

export const getPackage = async () => await api.get(`${resource}/${npm_resource}`);

export const getSmtpServerStatus = async () => await api.get(`${resource}/${smtp_status_resource}`);

export const getUptime = async () => await api.get(`${resource}/${uptime_resource}`);

export const removeLog = async () => await api.delete(`${resource}/${log_resource}`);

export const restartFtp = async () => await api.put(`${resource}/${ftp_restart_resource}`);

export const restartHttp = async () => await api.put(`${resource}/${http_restart_resource}`);

export const restartMqtt = async () => await api.put(`${resource}/${mqtt_restart_resource}`);

export const restartSmtp = async () => await api.put(`${resource}/${smtp_restart_resource}`);

export const restartSystem = async () => await api.put(`${resource}/${restart_resource}`);

export const stopFtp = async () => await api.put(`${resource}/${ftp_stop_resource}`);

export const stopHttp = async () => await api.put(`${resource}/${http_stop_resource}`);

export const stopMqtt = async () => await api.put(`${resource}/${mqtt_stop_resource}`);

export const stopSmtp = async () => await api.put(`${resource}/${smtp_stop_resource}`);

export const updateSystem = async (parameters) =>
  await api.put(`${resource}/${update_resource}${parameters ? parameters : ''}`);
