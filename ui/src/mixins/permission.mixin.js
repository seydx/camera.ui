import store from '@/store';

export default {
  methods: {
    checkLevel: (levels) => {
      if (!levels) {
        return false;
      }

      if (!Array.isArray(levels)) {
        levels = [levels];
      }

      const user = store.getters['auth/user'];

      return user
        ? user &&
            levels.every((level) => user.permissionLevel.includes(level) || user.permissionLevel.includes('admin'))
        : false;
    },
  },
};
