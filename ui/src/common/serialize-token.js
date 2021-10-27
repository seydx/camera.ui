const parseJwt = (token) => {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );

  return JSON.parse(jsonPayload);
};

class UserService {
  serialize(user) {
    if (!user) {
      return null;
    }

    const serializedUser = parseJwt(user.access_token);
    return {
      id: serializedUser.id,
      username: serializedUser.username,
      sessionTimer: serializedUser.sessionTimer,
      permissionLevel: serializedUser.permissionLevel,
      photo: serializedUser.photo,
      ...user,
    };
  }
}

export default new UserService();
