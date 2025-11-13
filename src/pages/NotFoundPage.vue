<script setup lang="ts">
import { ROUTES } from "@/constants";
import router from "@/router";

// Return the user to the welcome page
function toWelcomePage() {
  router.push(ROUTES.ROOT);
}
</script>

<template>
  <div class="center">
    <h1>404 Error</h1>
    <p>Sorry, we couldn't find that page</p>
    <UButton class="home-button" @click="toWelcomePage">Back to Home</UButton>
  </div>
</template>

<style scoped>
:deep(.center) {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  height: 100%;
  padding-top: 2%;
  padding-left: 20%;
  padding-right: 20%;
}
:deep(.center h1) {
  font-size: 32pt;
  margin-bottom: 20px;
}
:deep(.center p) {
  font-size: 14pt;
  margin-bottom: 20px;
}

:deep(.home-button:active) {
  background-color: var(--color-primary-800);
}
:deep(.home-button:hover) {
  cursor: pointer;
}
</style>
