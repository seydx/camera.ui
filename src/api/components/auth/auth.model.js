'use-strict';

const { Database } = require('../../database');

exports.list = () => {
  return Database.tokensDB.get('tokens').value();
};

exports.insert = (token) => {
  /* Use this if only one device is allowed to be logged in
  Tokens
  .get('tokens')
  .forEach(usr => {
    if(usr.username === userName)
      usr.valid = false;
  })
  .write();*/

  return Database.tokensDB.get('tokens').push({ token: token, valid: true }).write();
};

exports.findByToken = (token) => {
  return Database.tokensDB.get('tokens').find({ token: token }).value();
};

exports.invalidateByToken = (token) => {
  return Database.tokensDB.get('tokens').find({ token: token }).assign({ valid: false }).write();
};

exports.invalidateAll = () => {
  let users = Database.tokensDB.get('tokens').value();

  for (const user of users) {
    user.valid = false;
  }

  return Database.tokensDB.get('tokens').setState(users).write();
};
