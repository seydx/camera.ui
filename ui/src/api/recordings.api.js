import api from './index';

const resource = '/recordings';

const getRecording = async (recordingId) => await api.get(`${resource}/${recordingId}`);

const getRecordings = async (parameters) => await api.get(`${resource}${parameters ? parameters : ''}`);

const removeRecording = async (recordingId, parameters) =>
  await api.delete(`${resource}/${recordingId}${parameters ? parameters : ''}`);

const removeRecordings = async () => await api.delete(resource);

export { getRecording, getRecordings, removeRecording, removeRecordings };
