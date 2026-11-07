<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useBoardStore } from "@/stores/board";

const route = useRoute();
const board = useBoardStore();

onMounted(() => {
  // Get the board's id out of the url (out of the route)
  const routeId = (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) ?? "";

  // Load the board and its cards into the board store
  board.load(routeId);
});

// The board store only ever holds the open board, so leave it (letting go of any held card and the board's
// realtime channel) when the board is closed
onUnmounted(() => {
  board.leave();
});
</script>

<template>
  <div class="board-page">
    <!-- The navbar's toggle opens a sidebar, and this app doesn't have one. Everything goes in the left slot
         because the navbar hides its centre slot on narrow windows. The title is centred by its own styles. -->
    <UDashboardNavbar class="navbar-board" :toggle="false">
      <template #left>
        <ULink to="/dashboard" as="button" class="text-primary font-medium text-xl">
          Dashboard
        </ULink>

        <h1 class="navbar-board-title text-primary font-medium text-xl">
          {{ board.board?.name }}
        </h1>
      </template>
    </UDashboardNavbar>

    <BoardToolbar />

    <DigitalBoard />
  </div>
</template>

<style>
.board-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

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
  /* The title stays centred on the page, so it gets the same space on both sides of it.
     Leaving room for the Dashboard link on the left stops a long name from running under it. */
  max-width: calc(100% - 280px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
