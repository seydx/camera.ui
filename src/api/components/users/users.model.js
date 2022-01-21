'use-strict';

import { customAlphabet } from 'nanoid/async';

import Database from '../../database.js';

const nanoid = customAlphabet('1234567890abcdef', 10);

export const list = async () => {
  return await Database.interfaceDB.chain.get('users').cloneDeep().value();
};

export const findByName = async (username) => {
  return await Database.interfaceDB.chain.get('users').find({ username: username }).cloneDeep().value();
};

export const createUser = async (userData) => {
  const user = {
    id: await nanoid(),
    username: userData.username,
    password: userData.password,
    photo: userData.photo || false,
    sessionTimer: userData.sessionTimer || 14400, //4h
    permissionLevel: userData.permissionLevel || 1,
  };

  return await Database.interfaceDB.chain.get('users').push(user).value();
};

export const patchUser = async (username, userData) => {
  const user = await Database.interfaceDB.chain.get('users').find({ username: username }).cloneDeep().value();

  for (const [key, value] of Object.entries(userData)) {
    if (user[key] !== undefined) {
      user[key] = value;
    }
  }

  return await Database.interfaceDB.chain.get('users').find({ username: username }).assign(user).value();
};

export const removeByName = async (username) => {
  return await Database.interfaceDB.chain
    .get('users')
    .remove((usr) => usr.username === username)
    .value();
};
