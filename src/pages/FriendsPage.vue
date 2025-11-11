<script setup lang="ts">
import { ref } from "vue";
import { ROUTES } from "@/constants";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();

const requestId = ref<string>("");
const friends = ref<string[]>(["Billy", "Steve", "Bob"]);

// Return the user to the dashboard page
function toDashboardPage(): void {
  router.push(ROUTES.DASHBOARD);
}

function cycleFriendCode(): void {
  console.log("Refreshing code");
}

function sendFriendCode(): void {
  console.log("Sending code " + requestId.value);
}
</script>

<template>
  <UButton class="back-button" variant="ghost" color="neutral" size="xs" @click="toDashboardPage">
    <template #leading>
      <UIcon name="i-ion-arrow-back-circle-outline" class="w-10 h-10" />
    </template>
  </UButton>

  <div class="center">
    <h1>Friends</h1>

    <USeparator class="separator" color="neutral" label="Your Friend Code" />
    <div class="horizontal-layout">
      <UInput disabled :placeholder="auth.profile?.usename" />
      <UButton class="select-button" @click="cycleFriendCode">Get New Code</UButton>
    </div>

    <USeparator class="separator" color="neutral" label="Send Request" />
    <div class="horizontal-layout">
      <UInput v-model="requestId" placeholder="Friend's code" />
      <UButton class="select-button" @click="sendFriendCode">Send Request</UButton>
    </div>

    <USeparator class="separator" color="neutral" label="Friends" />
    <div>
      <div v-for="friend in friends" :key="friend">
        <p>{{ friend }}</p>
      </div>
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

.separator {
  margin-top: 15px;
  margin-bottom: 15px;
}

.horizontal-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 15px;
}

.select-button {
  width: 120px;
  display: flex;
  justify-content: center;
}
.select-button:active {
  background-color: var(--color-primary-800);
}
.select-button:hover {
  cursor: pointer;
}
</style>
