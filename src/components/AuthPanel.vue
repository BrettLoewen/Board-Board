<script setup lang="ts">
import { AUTH, ROUTES } from "@/constants";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";
import { ref } from "vue";

const props = defineProps({ mode: { type: String, default: AUTH.MODES.LOGIN } });
const mode = ref<string>(props.mode);

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
  try {
    if (mode.value === AUTH.MODES.LOGIN) {
      await auth.login(payload.data.email, payload.data.password);
      // If your local env has email confirmations off, the user may be signed in immediately.
      // In prod, Supabase may send confirmation email — behavior depends on project settings.
    } else {
      await auth.signup(payload.data.username, payload.data.email, payload.data.password);
    }
    router.push({ path: ROUTES.DASHBOARD });
  } catch (err) {
    console.log(String(err));
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
  <div class="fill" @click="closeAuth">
    <UPageCard class="panel">
      <UAuthForm
        :fields="fields()"
        :title="formTitle()"
        icon="i-lucide-lock"
        @submit="onSubmit"
        @click.stop
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
</style>
