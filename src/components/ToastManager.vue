<script setup lang="ts">
import { useNotificationToasts } from "@/composables/NotificationToasts";

useNotificationToasts();
</script>

<template>
  <slot />
</template>
