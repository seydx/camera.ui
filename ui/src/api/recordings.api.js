import api from './index';

const resource = '/recordings';

export const getRecording = async (recordingId) => await api.get(`${resource}/${recordingId}`);

export const getRecordings = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

export const removeRecording = async (recordingId, parameters) =>
  await api.delete(`${resource}/${recordingId}${parameters ? parameters : ''}`);

export const removeRecordings = async () => await api.delete(resource);
