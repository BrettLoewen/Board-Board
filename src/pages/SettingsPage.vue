<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useColorMode } from "@vueuse/core";
import { ROUTES } from "@/constants";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabaseClient";
import type { FormError, FormSubmitEvent, SelectItem } from "@nuxt/ui";

const auth = useAuthStore();
const colorMode = useColorMode();

// Store the user's settings data
const state = reactive({
  username: undefined,
  colorMode: colorMode.value,
});

// Define the options for the color mode select dropdown
const colorModeItems = ref<SelectItem[]>([
  {
    label: "System",
    value: "auto",
    icon: "i-lucide-monitor",
  },
  {
    label: "Light",
    value: "light",
    icon: "i-ph-sun",
  },
  {
    label: "Dark",
    value: "dark",
    icon: "i-ph-moon",
  },
]);

// Ensure the displayed icon of the color mode select dropdown's header matches the icon of the currently selected color mode
const colorModeIcon = computed(
  () =>
    (colorModeItems.value as { label: string; value: string; icon: string }[]).find(
      (item) => item.value === state.colorMode,
    )?.icon,
);

// Return the user to the dashboard page
function toDashboardPage(): void {
  router.push(ROUTES.DASHBOARD);
}

// Used to validate the form fields during edits and before the final submission
function validate(data: typeof state): FormError[] {
  const errors: FormError[] = [];
  console.log("validate: " + JSON.stringify(data));

  // If a new username was entered, and is too short, than print an error to the username form field about that
  if (data.username && (data.username as string)?.length < 3) {
    errors.push({ name: "username", message: "Username too short!" });
  }

  // Update the color mode of the site to match the dropdown
  colorMode.value = data.colorMode;

  return errors;
}

async function submit(payload: FormSubmitEvent<typeof state>): Promise<void> {
  console.log("submit: " + JSON.stringify(payload.data));

  // If a new username was entered, update the user's username
  if (payload.data.username && (payload.data.username as string)?.length >= 3 && auth.user) {
    await supabase
      .from("user_profiles")
      .update({ username: payload.data.username })
      .eq("id", auth.user.id);
  }
}

async function deleteAccount(): Promise<void> {
  await auth.deleteAccount();
}
</script>

<template>
  <UButton class="back-button" variant="ghost" color="neutral" size="xs" @click="toDashboardPage">
    <template #leading>
      <UIcon name="i-ion-arrow-back-circle-outline" class="w-10 h-10" />
    </template>
  </UButton>

  <div class="center">
    <h1>Settings</h1>

    <UForm :validate="validate" :state="state" class="settings-form" @submit="submit">
      <UFormField label="Change Username" name="username">
        <UInput
          :placeholder="auth.profile ? auth.profile.username : 'Username'"
          v-model="state.username"
        />
      </UFormField>

      <UFormField label="Change Color Mode" name="colorMode">
        <USelect
          :items="colorModeItems"
          :icon="colorModeIcon"
          value-key="value"
          v-model="state.colorMode"
          class="w-48"
        />
      </UFormField>
      <UButton type="submit" class="save-button">Save Changes</UButton>
    </UForm>

    <USeparator
      class="danger-zone"
      color="error"
      label="Danger Zone"
      :ui="{ container: 'text-error', label: 'text-error' }"
    />
    <div>
      <UModal
        title="Delete your Account"
        description="This action cannot be reversed. Are you sure you want to delete your account?"
        :close="{ class: 'delete-modal-close-button' }"
      >
        <UButton color="error" class="delete-button">Delete Account</UButton>

        <template #body="{ close }">
          <div class="delete-modal-buttons">
            <UButton color="error" label="Delete" class="delete-button" @click="deleteAccount" />
            <UButton
              color="neutral"
              variant="outline"
              label="Cancel"
              class="delete-modal-cancel-button"
              @click="close"
            />
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<style>
.back-button {
  position: absolute;
  top: 20px;
  left: 20px;
  border-radius: 50%;
  color: #d1d7df;
}
.back-button:hover {
  background-color: #00000000;
  color: #ffffff;
  cursor: pointer;
}

.center {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding-top: 2%;
  padding-left: 20%;
  padding-right: 20%;
}
.center h1 {
  text-align: center;
  font-size: 32pt;
  margin-bottom: 20px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 15px;
}

.save-button:active {
  background-color: var(--color-primary-800);
}
.save-button:hover {
  cursor: pointer;
}

.danger-zone {
  margin-top: 15px;
  margin-bottom: 15px;
}

.delete-button:active {
  background-color: var(--color-error-800);
}
.delete-button:hover {
  cursor: pointer;
}

.delete-modal-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 10px;
}

.delete-modal-close-button:active {
  background-color: var(--color-neutral-800);
}
.delete-modal-close-button:hover {
  cursor: pointer;
}

.delete-modal-cancel-button:active {
  background-color: var(--color-neutral-800);
}
.delete-modal-cancel-button:hover {
  cursor: pointer;
}
</style>
