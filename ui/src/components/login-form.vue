<template lang="pug">
.login-form
  ValidationObserver(v-slot="{ handleSubmit }")
    form#login-post(name="form", @submit.prevent="$emit('login', user)")
      .wrap-input
        ValidationProvider(
          name="name",
          rules="required",
          v-slot="{ errors }",
          mode="lazy"
        )
          input(
            autocomplete="username",
            v-model="user.username",
            type="text",
            name="username",
            :class="'input' + (errors[0] ? ' error_input' : '')"
          )
          span.focus-input(:data-placeholder="$t('username')")
      .wrap-input
        span.btn-show-pass
          b-icon(:icon="icon", aria-hidden="true", @click="showHidePassword()")
        ValidationProvider(
          name="password",
          rules="required",
          v-slot="{ errors }",
          mode="lazy"
        )
          input(
            autocomplete="current-password",
            v-model="user.password"
            :type="type"
            name="password",
            :class="'input' + (errors[0] ? ' error_input' : '')"
          )
          span.focus-input(:data-placeholder="$t('password')")
      .container-login-form-btn
        .row.w-100
          .col-7.p-0
            .wrap-login-form-btn
              .login-form-btn-bg
              button.login-form-btn
                span.text-white.mr-2(v-show='loading')
                  b-spinner(small type='grow')
                span.text-white {{ $t("signin") }}
          .col.text-right.p-0.d-flex.flex-wrap.justify-content-end.align-content-center
            b-button#popover-target-forgotpw.login-right-forgotpw {{ $t("forgotpw_title") }}
            b-popover(target="popover-target-forgotpw" triggers="hover" placement="top") {{ $t("forgotpw_content") }}
</template>

<script>
import { BIcon, BIconEyeFill, BIconEyeSlashFill } from 'bootstrap-vue';
import { ValidationObserver, ValidationProvider, extend } from 'vee-validate';

extend('required', {
  validate(value) {
    return {
      required: true,
      valid: !['', null, undefined].includes(value),
    };
  },
  computesRequired: true,
});

export default {
  name: 'LoginForm',
  components: {
    BIcon,
    BIconEyeFill,
    BIconEyeSlashFill,
    ValidationObserver,
    ValidationProvider,
  },
  props: {
    loading: Boolean,
  },
  data() {
    return {
      user: {
        username: '',
        password: '',
      },
      icon: 'eye-slash-fill',
      type: 'password',
    };
  },
  mounted() {
    const inputs = document.querySelectorAll('.input');
    Array.prototype.forEach.call(inputs, (element) => {
      element.addEventListener('blur', () => {
        if (element.value.trim() !== '') {
          element.classList.add('has-val');
        } else {
          element.classList.remove('has-val');
        }
      });
    });
  },
  methods: {
    showHidePassword() {
      if (this.type === 'password') {
        this.icon = 'eye-fill';
        this.type = 'text';
      } else {
        this.icon = 'eye-slash-fill';
        this.type = 'password';
      }
    },
  },
};
</script>

<style scoped>
.login-form {
  width: 100%;
  margin-top: 30px;
}

.wrap-input {
  width: 100%;
  position: relative;
  border-bottom: 1px solid #cfcfcf;
  margin-bottom: 30px;
  margin-top: 5px;
}

.input {
  font-size: 15px;
  color: var(--primary-font-color);
  line-height: 1.2;
  display: block;
  width: 100%;
  height: 45px;
  background: transparent;
  padding: 0 5px;
  font-weight: 600;
}

.input:focus {
  border: none !important;
}

.error_input {
  border: 1px solid #f50000b3;
  border-top-left-radius: 5px;
  border-top-right-radius: 5px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
  transition: 0.5s all;
}

.focus-input {
  position: absolute;
  display: block;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
}

.focus-input::before {
  content: '';
  display: block;
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  -webkit-transition: all 0.4s;
  -o-transition: all 0.4s;
  transition: all 0.4s;
  background: var(--primary-color);
}

.focus-input::after {
  font-size: 15px;
  color: #999999;
  line-height: 1.2;
  content: attr(data-placeholder);
  display: block;
  width: 100%;
  position: absolute;
  top: 16px;
  left: 0px;
  padding-left: 5px;
  -webkit-transition: all 0.4s;
  -o-transition: all 0.4s;
  transition: all 0.4s;
}

.input:focus + .focus-input::after {
  top: -15px;
}

.input:focus + .focus-input::before {
  width: 100%;
}

.has-val.input + .focus-input::after {
  top: -15px;
}

.has-val.input + .focus-input::before {
  width: 100%;
}

.focus-input {
  position: absolute;
  display: block;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
}

.focus-input::before {
  content: '';
  display: block;
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  -webkit-transition: all 0.4s;
  -o-transition: all 0.4s;
  transition: all 0.4s;
  background: var(--primary-color);
}

.focus-input::after {
  font-size: 15px;
  color: #999999;
  line-height: 1.2;
  content: attr(data-placeholder);
  display: block;
  width: 100%;
  position: absolute;
  top: 16px;
  left: 0px;
  padding-left: 5px;
  -webkit-transition: all 0.4s;
  -o-transition: all 0.4s;
  transition: all 0.4s;
}

.input:focus + .focus-input::after {
  top: -15px;
}

.input:focus + .focus-input::before {
  width: 100%;
}

.has-val.input + .focus-input::after {
  top: -15px;
}

.has-val.input + .focus-input::before {
  width: 100%;
}

.btn-show-pass {
  font-size: 15px;
  color: #999999 !important;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  position: absolute;
  height: 100%;
  top: 0;
  right: 0;
  padding-right: 5px;
  cursor: pointer;
  -webkit-transition: all 0.4s;
  -o-transition: all 0.4s;
  transition: all 0.4s;
}

.btn-show-pass:hover {
  color: var(--primary-color) !important;
}

.btn-show-pass.active {
  color: var(--primary-color) !important;
}

.container-login-form-btn {
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -ms-flex-wrap: wrap;
  flex-wrap: wrap;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  padding-top: 13px;
  width: 100%;
}

.container-login-form-btn a {
  font-size: 12px;
  font-weight: 600;
}

.wrap-login-form-btn {
  width: 100%;
  display: block;
  position: relative;
  z-index: 1;
  border-radius: 10px;
  overflow: hidden;
  margin: 0 auto;
}

.login-form-btn-bg {
  position: absolute;
  z-index: -1;
  width: 300%;
  height: 100%;
  top: 0;
  left: -100%;
}

.login-form-btn {
  font-size: 15px;
  color: #fff;
  line-height: 1.2;
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-pack: center;
  -ms-flex-pack: center;
  justify-content: center;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  padding: 0 20px;
  width: 90%;
  max-width: 150px;
  height: 50px;
  background: var(--primary-color);
  -webkit-transition: all 0.4s;
  -o-transition: all 0.4s;
  transition: all 0.4s;
  cursor: pointer;
  border-radius: 10px;
}

.login-form-btn:hover {
  background-color: var(--secondary-color);
}

.login-right-forgotpw,
.login-right-forgotpw:hover,
.login-right-forgotpw:active,
.login-right-forgotpw:focus {
  color: var(--primary-color) !important;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: none !important;
  border: none !important;
  text-align: right;
  box-shadow: none !important;
  padding: 0;
  margin: 0;
}
</style>
