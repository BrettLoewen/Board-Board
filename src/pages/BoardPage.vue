<script setup lang="ts">
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/database.types";
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const board = ref<Tables<"boards">>();

async function getBoard(): Promise<void> {
  // Get the board's id out of the url (out of the route)
  const routeId = (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) ?? "";

  // Get the data about this board
  const { data, error } = await supabase.from("boards").select().eq("id", routeId).limit(1);

  if (error) {
    console.error(error);
    return;
  }

  // Store the data
  board.value = data[0];
}

onMounted(() => {
  getBoard();
});
</script>

<template>
  <UDashboardNavbar class="navbar-board">
    <ULink to="/dashboard" as="button" class="text-primary font-medium text-xl">Dashboard</ULink>

    <h1 class="navbar-board-title text-primary font-medium text-xl">{{ board?.name }}</h1>
  </UDashboardNavbar>

  <BoardToolbar />

  <DigitalBoard />
</template>

<style>
.navbar-board {
  display: flex;
  justify-content: left;
  gap: 0px;
  border-color: var(--ui-border-accented);
  box-shadow:
    0 3px 1px -2px rgba(0, 0, 0, 0.2),
    0 2px 2px 0 rgba(0, 0, 0, 0.14),
    0 1px 5px 0 rgba(0, 0, 0, 0.12);
  padding-left: 15px;
  padding-right: 15px;
}

.navbar-board-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
</style>
