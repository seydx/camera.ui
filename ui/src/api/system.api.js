import api from './index';

const resource = '/system';
const changelog_resource = 'changelog';
const db_resource = 'db';
const db_download_resource = 'db/download';
const ftp_restart_resource = 'ftp/restart';
const ftp_status_resource = 'ftp/status';
const http_restart_resource = 'http/restart';
const http_status_resource = 'http/status';
const log_resource = 'log';
const log_download_resource = 'log/download';
const mqtt_restart_resource = 'mqtt/restart';
const mqtt_status_resource = 'mqtt/status';
const npm_resource = 'npm';
const restart_resource = 'restart';
const smtp_restart_resource = 'smtp/restart';
const smtp_status_resource = 'smtp/status';
const update_resource = 'update';
const uptime_resource = 'uptime';

const downloadDb = async () => await api.get(`${resource}/${db_download_resource}`);

const downloadLog = async () => await api.get(`${resource}/${log_download_resource}`);

const getChangelog = async (parameters) =>
  await api.get(`${resource}/${changelog_resource}${parameters ? parameters : ''}`);

const getDb = async () => await api.get(`${resource}/${db_resource}`);

const getFtpServerStatus = async () => await api.get(`${resource}/${ftp_status_resource}`);

const getHttpServerStatus = async () => await api.get(`${resource}/${http_status_resource}`);

const getLog = async () => await api.get(`${resource}/${log_resource}`);

const getMqttClientStatus = async () => await api.get(`${resource}/${mqtt_status_resource}`);

const getPackage = async () => await api.get(`${resource}/${npm_resource}`);

const getSmtpServerStatus = async () => await api.get(`${resource}/${smtp_status_resource}`);

const getUptime = async () => await api.get(`${resource}/${uptime_resource}`);

const removeLog = async () => await api.delete(`${resource}/${log_resource}`);

const restartFtp = async () => await api.put(`${resource}/${ftp_restart_resource}`);

const restartHttp = async () => await api.put(`${resource}/${http_restart_resource}`);

const restartMqtt = async () => await api.put(`${resource}/${mqtt_restart_resource}`);

const restartSmtp = async () => await api.put(`${resource}/${smtp_restart_resource}`);

const restartSystem = async () => await api.put(`${resource}/${restart_resource}`);

const updateSystem = async (parameters) =>
  await api.put(`${resource}/${update_resource}${parameters ? parameters : ''}`);

export {
  downloadDb,
  downloadLog,
  getChangelog,
  getDb,
  getFtpServerStatus,
  getHttpServerStatus,
  getLog,
  getMqttClientStatus,
  getPackage,
  getSmtpServerStatus,
  getUptime,
  removeLog,
  restartFtp,
  restartHttp,
  restartMqtt,
  restartSmtp,
  restartSystem,
  updateSystem,
};
