'use-strict';

import Database from '../../database.js';

export const list = () => {
  return Database.tokens.chain.get('tokens').value();
};

export const insert = (token) => {
  /**
   * // Use this if only one device is allowed to be logged in
   *
   * Database.tokens.chain
   * .get('tokens')
   * .forEach(usr => {
   *   if(usr.username === userName)
   *     usr.valid = false;
   * })
   * .value();
   */

  return Database.tokensDB.chain.get('tokens').push({ token: token, valid: true }).value();
};

export const findByToken = (token) => {
  return Database.tokensDB.chain.get('tokens').find({ token: token }).value();
};

export const invalidateByToken = (token) => {
  return Database.tokensDB.chain.get('tokens').find({ token: token }).assign({ valid: false }).value();
};

export const invalidateAll = () => {
  let users = Database.tokensDB.chain.get('tokens').value();

  for (const user of users) {
    user.valid = false;
  }

  return Database.tokensDB.chain.get('tokens').set(users).value();
};
