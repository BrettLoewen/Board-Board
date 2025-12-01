<script setup lang="ts">
import { useNotificationToasts } from "./composables/NotificationToasts";

// Display toast pop-ups to notify the user of important information
useNotificationToasts();
</script>

<template>
  <UApp>
    <RouterView />
  </UApp>
</template>

<style>
html,
body,
#app {
  height: 100%;
}
</style>
