<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

function logout() {
  auth.logout();
}
</script>

<template>
  <h1>Dashboard</h1>
  <p v-if="auth.profile">
    Welcome, <strong>{{ auth.profile.username }}</strong
    >!
  </p>
  <p v-else>Loading profile...</p>
  <button @click="logout">Sign out</button>
</template>

<style></style>
