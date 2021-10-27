import api from './index';

const resource = '/backup';
const download_resource = 'download';
const restore_resource = 'restore';

const downloadBackup = async (userStorage) =>
  await api.get(`${resource}/${download_resource}`, {
    params: {
      localStorage: userStorage,
    },
    responseType: 'arraybuffer',
  });

const restoreBackup = async (backupData) => await api.post(`${resource}/${restore_resource}`, backupData);

export { downloadBackup, restoreBackup };
