<script setup lang="ts">
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";

const props = defineProps({ mode: { type: String, default: "login" } });

const emit = defineEmits(["closeAuth"]);

const fields: AuthFormField[] = [
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
  {
    name: "remember",
    label: "Remember me",
    type: "checkbox",
  },
];

function onSubmit(payload: FormSubmitEvent<{ email: string; password: string }>) {
  console.log("Submitted", payload);
}

function formTitle() {
  if (props.mode === "login") {
    return "Login";
  } else {
    return "Sign Up";
  }
}

function closeAuth() {
  console.log("click");
  emit("closeAuth");
}
</script>

<template>
  <div class="fill" @click="closeAuth">
    <UPageCard class="panel">
      <UAuthForm
        :fields="fields"
        :title="formTitle()"
        icon="i-lucide-lock"
        @submit="onSubmit"
        @click.stop
      >
        <template v-if="props.mode === 'login'" #description>
          Don't have an account? <ULink to="#" class="text-primary font-medium">Sign up</ULink>.
        </template>
        <template v-else #description>
          Already have an account? <ULink to="#" class="text-primary font-medium">Login</ULink>.
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
