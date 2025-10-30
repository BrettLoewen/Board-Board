<script setup lang="ts">
import { ROUTES } from "@/constants";
import router from "@/router";

// Return the user to the welcome page
function toWelcomePage() {
  router.push(ROUTES.ROOT);
}
</script>

<template>
  <h1>404</h1>
  <p>Sorry, we couldn't find that page</p>
  <button @click="toWelcomePage">Back to Home</button>
</template>

<style></style>
