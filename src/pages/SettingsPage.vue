<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
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
// Store whether there are differences between the settings form's fields and the user's stored data
const changesMade = ref<boolean>(false);

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

// Fetch the user's preferences and return them
async function getUserPreferences(): Promise<
  { colorMode: "light" | "dark" | "auto" | undefined } | undefined
> {
  const { data } = await supabase.from("user_preferences").select().eq("user_id", auth.profile?.id);
  if (data) {
    return { colorMode: data[0]?.color_mode ? data[0]?.color_mode : "auto" };
  }
  return undefined;
}

// Get the user's preferences, apply them, and store them in state
async function applyUserPreferences(): Promise<void> {
  const data = await getUserPreferences();

  // Apply the user's color mode preference
  if (data && data.colorMode) {
    state.colorMode = data.colorMode;
    colorMode.value = state.colorMode;
  }
}

// Return the user to the dashboard page
async function toDashboardPage(): Promise<void> {
  // Undo any preferences changes that were not saved when exiting the settings page
  await applyUserPreferences();

  router.push(ROUTES.DASHBOARD);
}

// Used to validate the form fields during edits and before the final submission
async function validate(data: typeof state): Promise<FormError[]> {
  const errors: FormError[] = [];
  console.log("validate: " + JSON.stringify(data));

  // If a new username was entered, and is too short, than print an error to the username form field about that
  if (data.username && (data.username as string)?.length < 3) {
    errors.push({ name: "username", message: "Username too short!" });
  }

  // Update the color mode of the site to match the dropdown
  colorMode.value = data.colorMode;

  // Check if any changes have been made to the user's preferences (so the undo button is correct)
  await checkForChanges();

  return errors;
}

async function submit(payload: FormSubmitEvent<typeof state>): Promise<void> {
  console.log("submit: " + JSON.stringify(payload.data));

  if (auth.user) {
    // If a new username was entered, update the user's username
    if (payload.data.username && (payload.data.username as string)?.length >= 3) {
      await supabase
        .from("user_profiles")
        .update({ username: payload.data.username })
        .eq("id", auth.user.id);
    }

    const preferences = await getUserPreferences();

    // If the color mode entered in the settings form differs from the saved on, update the user's color mode preference
    if (preferences && preferences.colorMode !== payload.data.colorMode) {
      await supabase
        .from("user_preferences")
        .update({ color_mode: payload.data.colorMode })
        .eq("user_id", auth.user.id);
    } else {
      console.log("color mode didn't change, not updating");
    }

    // Reset the username field now that the changes have been saved
    state.username = undefined;

    // Update the change tracking flag now that the changes have been saved
    await checkForChanges();
  }
}

async function checkForChanges(): Promise<void> {
  // Get the user's current preferences to see if the new settings are different
  const preferences = await getUserPreferences();
  if (preferences) {
    // If the color mode being set differs from the currently saved color mode, changes have been made
    if (preferences.colorMode !== state.colorMode) {
      changesMade.value = true;
      return;
    }
  }

  // If the username being set differs from the currently saved username, changes have been made
  if (auth.profile?.username && state.username && state.username !== auth.profile?.username) {
    changesMade.value = true;
    return;
  }

  // If no changes were found, store that result
  changesMade.value = false;
}

async function undoChanges(): Promise<void> {
  // Undo the preferences by applying the saved preferences
  await applyUserPreferences();

  // Clear the username field's value
  state.username = undefined;

  // Update the changesMade state with the cleared changes
  await checkForChanges();
}

async function deleteAccount(): Promise<void> {
  // Undo any preferences changes that were from the logged in user.
  // The color mode changing back to 'auto' will happen in the auth.deleteAccount logic.
  state.username = undefined;

  // Delete the account and logout the user
  await auth.deleteAccount();
}

onMounted(async () => {
  // Get the user's preferences and apply them to the app and settings state
  await applyUserPreferences();
});
</script>

<template>
  <UButton
    v-if="!changesMade"
    class="back-button"
    variant="ghost"
    color="neutral"
    size="xs"
    @click="toDashboardPage"
  >
    <template #leading>
      <UIcon name="i-ion-arrow-back-circle-outline" class="w-10 h-10" />
    </template>
  </UButton>
  <UModal
    v-else
    title="Undo your changes?"
    description="You have unsaved changes to your settings. Are you sure you want to revert to your last saved settings?"
    :close="{ class: 'modal-close-button' }"
  >
    <UButton class="back-button" variant="ghost" color="neutral" size="xs">
      <template #leading>
        <UIcon name="i-ion-arrow-back-circle-outline" class="w-10 h-10" />
      </template>
    </UButton>

    <template #body="{ close }">
      <div class="modal-buttons">
        <UButton
          color="error"
          label="Quit without saving"
          class="delete-button"
          @click="toDashboardPage"
        />
        <UButton
          color="neutral"
          variant="outline"
          label="Cancel"
          class="modal-cancel-button"
          @click="close"
        />
      </div>
    </template>
  </UModal>

  <div class="center">
    <h1>Settings</h1>

    <UForm :validate="validate" :state="state" class="settings-form" @submit="submit">
      <UFormField label="Change Username" name="username">
        <UInput
          :placeholder="auth.profile ? auth.profile.username : 'Username'"
          v-model="state.username"
        />
      </UFormField>

      <UFormField label="Change Theme" name="colorMode">
        <USelect
          :items="colorModeItems"
          :icon="colorModeIcon"
          value-key="value"
          v-model="state.colorMode"
          class="w-48"
        />
      </UFormField>
      <div class="horizontal-layout">
        <UButton type="submit" class="save-button">Save Changes</UButton>
        <UButton
          :disabled="!changesMade"
          :variant="changesMade ? 'outline' : 'soft'"
          color="neutral"
          :class="changesMade ? 'undo-button' : ''"
          @click="undoChanges"
        >
          Undo Changes
        </UButton>
      </div>
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
        :close="{ class: 'modal-close-button' }"
      >
        <UButton color="error" class="delete-button">Delete Account</UButton>

        <template #body="{ close }">
          <div class="modal-buttons">
            <UButton color="error" label="Delete" class="delete-button" @click="deleteAccount" />
            <UButton
              color="neutral"
              variant="outline"
              label="Cancel"
              class="modal-cancel-button"
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

.horizontal-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 15px;
}

.save-button:active {
  background-color: var(--color-primary-800);
}
.save-button:hover {
  cursor: pointer;
}

.undo-button:active {
  background-color: var(--color-neutral-600);
}
.undo-button:hover {
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

.modal-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 10px;
}

.modal-close-button:active {
  background-color: var(--color-neutral-800);
}
.modal-close-button:hover {
  cursor: pointer;
}

.modal-cancel-button:active {
  background-color: var(--color-neutral-800);
}
.modal-cancel-button:hover {
  cursor: pointer;
}
</style>
