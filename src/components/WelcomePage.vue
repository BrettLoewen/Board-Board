<script setup lang="ts">
import { ref } from "vue";

const mode = ref("login");
const auth = ref(false);

function onCloseAuth() {
  console.log("clicked");
  auth.value = false;
}

function login() {
  mode.value = "login";
  auth.value = true;
}

function signUp() {
  mode.value = "sign-up";
  auth.value = true;
}
</script>

<template>
  <div class="container">
    <div class="welcome">
      <h1>Welcome to Board Board!</h1>
      <p>A digital whiteboard for collaborative planning, brainstorming, and organization.</p>
    </div>
    <div class="auth-layout">
      <UButton class="auth-button" @click="login">Login</UButton>
      <UButton class="auth-button" @click="signUp">Sign Up</UButton>
    </div>
  </div>
  <AuthPanel v-if="auth" :mode="mode" @close-auth="onCloseAuth" />
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
