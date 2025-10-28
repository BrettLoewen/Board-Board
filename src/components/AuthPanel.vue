<script setup lang="ts">
import { AUTH, ROUTES } from "@/constants";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";
import { ref } from "vue";
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";

const props = defineProps({ mode: { type: String, default: AUTH.MODES.LOGIN } });
const mode = ref<string>(props.mode);
const valid = ref<string>(AUTH.VALIDATION.VALID);

const emit = defineEmits(["closeAuth"]);

const auth = useAuthStore();

const loginFields: AuthFormField[] = [
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "Enter your email",
    required: true,
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    placeholder: "Enter your password",
    required: true,
  },
];

const signUpFields: AuthFormField[] = [
  {
    name: "username",
    type: "text",
    label: "Username",
    placeholder: "Enter your username",
    required: true,
  },
  ...loginFields,
];

function fields() {
  if (mode.value === AUTH.MODES.LOGIN) {
    return loginFields;
  } else {
    return signUpFields;
  }
}

async function onSubmit(
  payload: FormSubmitEvent<{ username: string; email: string; password: string }>,
) {
  console.log("Submitted", payload.data);
  if (mode.value === AUTH.MODES.LOGIN || (payload.data.username && payload.data.username !== "")) {
    try {
      if (mode.value === AUTH.MODES.LOGIN) {
        await auth.login(payload.data.email, payload.data.password);
        // If your local env has email confirmations off, the user may be signed in immediately.
        // In prod, Supabase may send confirmation email — behavior depends on project settings.
      } else {
        const data = await auth.signup(
          payload.data.username,
          payload.data.email,
          payload.data.password,
        );
        if (data.user && !data.session) {
          console.log("email confirmation needed");
          valid.value = AUTH.VALIDATION.VALID;
          router.push(ROUTES.EMAIL);
          return;
        }
      }
      console.log("sending to dashboard");
      valid.value = AUTH.VALIDATION.VALID;
      router.push({ path: ROUTES.DASHBOARD });
    } catch (err) {
      console.log(String(err));
      if (
        String(err).includes(AUTH.ERRORS.INVALID) ||
        String(err).includes(AUTH.ERRORS.ALREADY_REGISTERED) ||
        String(err).includes(AUTH.ERRORS.EMAIL_NOT_CONFIRMED)
      ) {
        valid.value = AUTH.VALIDATION.INVALID;
      } else if (String(err).includes(AUTH.ERRORS.WEAK_PASSWORD)) {
        valid.value = AUTH.VALIDATION.WEAK_PASSWORD;
      } else if (String(err).includes(AUTH.ERRORS.DATABASE_ERROR)) {
        valid.value = AUTH.VALIDATION.INVALID_USERNAME;
      }
    }
  } else {
    valid.value = AUTH.VALIDATION.MISSING_FIELD;
  }
}

function formTitle() {
  if (mode.value === AUTH.MODES.LOGIN) {
    return "Login";
  } else if (mode.value === AUTH.MODES.SIGN_UP) {
    return "Sign Up";
  } else {
    return "";
  }
}

function closeAuth() {
  valid.value = AUTH.VALIDATION.VALID;
  emit("closeAuth");
}

function switchAuthMode() {
  if (mode.value === AUTH.MODES.LOGIN) {
    mode.value = AUTH.MODES.SIGN_UP;
  } else {
    mode.value = AUTH.MODES.LOGIN;
  }
}
</script>

<template>
  <div class="fill" @mousedown="closeAuth">
    <UPageCard class="panel">
      <UAuthForm
        :fields="fields()"
        :title="formTitle()"
        icon="i-lucide-lock"
        @submit="onSubmit"
        @mousedown.stop
      >
        <template v-if="mode === AUTH.MODES.LOGIN" #description>
          Don't have an account?
          <ULink to="/" as="button" @click="switchAuthMode" class="text-primary font-medium"
            >Sign up</ULink
          >.
        </template>
        <template v-else #description>
          Already have an account?
          <ULink to="/" as="button" @click="switchAuthMode" class="text-primary font-medium"
            >Login</ULink
          >.
        </template>
        <template v-if="valid === AUTH.VALIDATION.INVALID" #validation>
          <UAlert
            class="alert"
            icon="i-lucide-info"
            variant="subtle"
            color="error"
            :description="AUTH.MESSAGES.INVALID"
          />
        </template>
        <template v-else-if="valid === AUTH.VALIDATION.WEAK_PASSWORD" #validation>
          <UAlert
            class="alert"
            icon="i-lucide-info"
            variant="subtle"
            color="error"
            :description="AUTH.MESSAGES.WEAK_PASSWORD"
          />
        </template>
        <template v-else-if="valid === AUTH.VALIDATION.MISSING_FIELD" #validation>
          <UAlert
            class="alert"
            icon="i-lucide-info"
            variant="subtle"
            color="error"
            :description="AUTH.MESSAGES.MISSING_FIELD"
          />
        </template>
        <template v-else-if="valid === AUTH.VALIDATION.INVALID_USERNAME" #validation>
          <UAlert
            class="alert"
            icon="i-lucide-info"
            variant="subtle"
            color="error"
            :description="AUTH.MESSAGES.INVALID_USERNAME"
          />
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>

<style>
.fill {
  display: flex;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.panel {
  margin: 10rem;
  min-width: 25rem;
}

.alert {
  align-items: center;
  height: 2rem;
}
</style>
