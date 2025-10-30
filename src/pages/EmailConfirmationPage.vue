<script setup lang="ts">
import { ROUTES } from "@/constants";
import router from "@/router";

// Return the user to the welcome page
function toWelcomePage() {
  router.push(ROUTES.ROOT);
}
</script>

<template>
  <h1>An Email has been sent to your Inbox</h1>
  <p>Please confirm your email before continuing</p>
  <button @click="toWelcomePage">Back to Home</button>
</template>

<style></style>
