<script setup lang="ts">
import { AUTH, ROUTES } from "@/constants";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";
import { ref } from "vue";
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";

// Track the state of the auth panel
const props = defineProps({ mode: { type: String, default: AUTH.MODES.LOGIN } });
const mode = ref<string>(props.mode);
const valid = ref<string>(AUTH.VALIDATION.VALID);

const auth = useAuthStore();

// Define the fields used by the Nuxt UI AuthForm for the login mode
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

// Define the fields used by the Nuxt UI AuthForm for the sign up mode (includes the login fields)
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

// Return the form fields based on the auth panel's current state
function fields(): AuthFormField[] {
  if (mode.value === AUTH.MODES.LOGIN) {
    return loginFields;
  } else {
    return signUpFields;
  }
}

// Return the form title based on the auth panel's current state
function formTitle(): string {
  if (mode.value === AUTH.MODES.LOGIN) {
    return "Login";
  } else if (mode.value === AUTH.MODES.SIGN_UP) {
    return "Sign Up";
  } else {
    return "";
  }
}

function checkFormFields(
  payload: FormSubmitEvent<{ username: string; email: string; password: string }>,
): boolean {
  // If the user is trying to login, check email and password
  if (mode.value === AUTH.MODES.LOGIN) {
    return !!payload.data.email && !!payload.data.password;
  }
  // If the user is trying to sign up, check username, email, and password
  else {
    return !!payload.data.username && !!payload.data.email && !!payload.data.password;
  }
}

async function onSubmit(
  payload: FormSubmitEvent<{ username: string; email: string; password: string }>,
): Promise<void> {
  // console.log("Submitted", payload.data);
  // Check if all values were included.
  if (checkFormFields(payload)) {
    try {
      // In login mode, attempt to login the user
      if (mode.value === AUTH.MODES.LOGIN) {
        await auth.login(payload.data.email, payload.data.password);
      }
      // In sign up mode, attempt to sign up the user
      else {
        const data = await auth.signup(
          payload.data.username,
          payload.data.email,
          payload.data.password,
        );

        // If a user was returned but not a session, then email confirmation is enabled and required, so send the user to the email confirmation page.
        // Otherwise, they will also be logged in now.
        if (data.user && !data.session) {
          // console.log("email confirmation needed");
          valid.value = AUTH.VALIDATION.VALID;
          router.push(ROUTES.EMAIL);
          return;
        }
      }
      // console.log("sending to dashboard");

      // If this point was reached, the user was successfully logged in, so send them to the dashboard
      valid.value = AUTH.VALIDATION.VALID;
      router.push({ path: ROUTES.DASHBOARD });
    } catch (err) {
      // If the login or sign up operation failed, update the auth panel's state accordingly.
      // This state will be used to show a message to the user informing them about the nature of the auth failure.
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
  }
  // If a field was missing, update the auth panel's state
  else {
    valid.value = AUTH.VALIDATION.MISSING_FIELD;
  }
}

// Toggle between the login and sign up auth panel modes
function switchAuthMode(): void {
  if (mode.value === AUTH.MODES.LOGIN) {
    mode.value = AUTH.MODES.SIGN_UP;
  } else {
    mode.value = AUTH.MODES.LOGIN;
  }
}
</script>

<template>
  <UPageCard>
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
      <template #submit>
        <UButton type="submit" class="continue-button">Continue</UButton>
      </template>
    </UAuthForm>
  </UPageCard>
</template>

<style>
.alert {
  align-items: center;
  height: 2rem;
}

.continue-button {
  width: 100%;
  justify-content: center;
}
.continue-button:hover {
  cursor: pointer;
}
.continue-button:active {
  background-color: var(--color-primary-800);
}
</style>
