<script setup lang="ts">
import { AUTH, ROUTES } from "@/constants";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";
import { ref } from "vue";

const auth = useAuthStore();

const mode = ref(AUTH.MODES.LOGIN);
const authPanelActive = ref(false);

function onCloseAuth() {
  authPanelActive.value = false;
}

function login() {
  mode.value = AUTH.MODES.LOGIN;
  authPanelActive.value = true;
}

function signUp() {
  mode.value = AUTH.MODES.SIGN_UP;
  authPanelActive.value = true;
}

function dashboard() {
  router.push(ROUTES.DASHBOARD);
}
</script>

<template>
  <div class="container">
    <div class="welcome">
      <h1>Welcome to Board Board!</h1>
      <p>A digital whiteboard for collaborative planning, brainstorming, and organization.</p>
    </div>
    <div v-if="auth.profile" class="auth-layout">
      <UButton class="auth-button" @click="dashboard">Go to Dashboard</UButton>
    </div>
    <div v-else class="auth-layout">
      <UButton class="auth-button" @click="login">Login</UButton>
      <UButton class="auth-button" @click="signUp">Sign Up</UButton>
    </div>
  </div>
  <AuthPanel v-if="authPanelActive" :mode="mode" @close-auth="onCloseAuth" />
</template>

<style>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 200px;
  min-width: 100%;
  min-height: 200px;
}

.welcome {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 10px;
}
.welcome h1 {
  font-size: 60pt;
}
.welcome p {
  width: 50%;
  font-size: 15pt;
}

.auth-layout {
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  gap: 10px;
}

.auth-button {
  justify-content: center;
  font-size: 12pt;
}
.auth-button:active {
  background-color: var(--color-primary-800);
}
</style>
