import api from './index';

const resource = '/backup';
const download_resource = 'download';
const restore_resource = 'restore';

export const downloadBackup = async (userStorage) =>
  await api.get(`${resource}/${download_resource}`, {
    params: {
      localStorage: userStorage,
    },
    responseType: 'arraybuffer',
  });

export const restoreBackup = async (backupData) => await api.post(`${resource}/${restore_resource}`, backupData);
