<script setup lang="ts">
import { ref } from "vue";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/stores/auth";
import type { DropdownMenuItem } from "@nuxt/ui";

const auth = useAuthStore();

const items = ref<DropdownMenuItem[][]>([
  [
    {
      // Display the user's username
      label: auth.profile.username,
      type: "label",
    },
  ],
  [
    {
      // Send the user to the settings page
      label: "Settings",
      icon: "i-lucide-cog",
      to: ROUTES.SETTINGS,
    },
    {
      // Send the user to the friends page
      label: "Friends",
      icon: "i-fluent-people-community-16-regular",
      to: ROUTES.FRIENDS,
    },
    {
      // Sign out the user (which will send the user back to the welcome page)
      label: "Logout",
      icon: "i-lucide-log-out",
      class: "logout",
      onSelect() {
        console.log("Logout");
        auth.logout();
      },
    },
  ],
]);
</script>

<template>
  <UDashboardNavbar>
    <template #left>
      <ULink to="/" as="button" class="text-primary font-medium">Board Board</ULink>
    </template>
    <template #right>
      <UDropdownMenu :items="items">
        <UButton class="navbar-right-button" size="sm">
          <template #leading>
            <UIcon name="i-fluent-person-circle-12-regular" class="w-6 h-6" />
          </template>
        </UButton>
      </UDropdownMenu>
    </template>
  </UDashboardNavbar>
</template>

<style>
.navbar-right-button {
  border-radius: 50%;
}
.navbar-right-button:hover {
  cursor: pointer;
}
.navbar-right-button:active {
  background-color: var(--color-primary-800);
}

.logout:hover {
  cursor: pointer;
}
</style>
