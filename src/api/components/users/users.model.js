'use-strict';

const { customAlphabet } = require('nanoid/async');
const nanoid = customAlphabet('1234567890abcdef', 10);

const { Database } = require('../../database');

exports.list = async () => {
  return await Database.interfaceDB.get('users').value();
};

exports.findByName = async (username) => {
  return await Database.interfaceDB.get('users').find({ username: username }).value();
};

exports.createUser = async (userData) => {
  const user = {
    id: await nanoid(),
    username: userData.username,
    password: userData.password,
    photo: userData.photo || false,
    sessionTimer: userData.sessionTimer || 14400, //4h
    permissionLevel: userData.permissionLevel || 1,
  };

  return await Database.interfaceDB.get('users').push(user).write();
};

exports.patchUser = async (username, userData) => {
  const user = Database.interfaceDB.get('users').find({ username: username }).value();

  for (const [key, value] of Object.entries(userData)) {
    if (user[key] !== undefined) {
      user[key] = value;
    }
  }

  return await Database.interfaceDB.get('users').find({ username: username }).assign(user).write();
};

exports.removeByName = async (username) => {
  return await Database.interfaceDB
    .get('users')
    .remove((usr) => usr.username === username)
    .write();
};
