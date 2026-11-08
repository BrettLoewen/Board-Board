<script setup lang="ts">
import { computed } from "vue";
import { useBoardStore } from "@/stores/board";
import { initials } from "@/utils/users";

const board = useBoardStore();

// How many people are shown before the rest are folded into a "+N" chip, so the bar never runs into the
// board's name on narrow windows
const MAX_SHOWN = 4;

// Everyone else on the board, each in their own colour (which matches their cursor and the cards they hold)
const shown = computed(() => board.otherUsers.slice(0, MAX_SHOWN));
const hidden = computed(() => board.otherUsers.slice(MAX_SHOWN));
const hiddenNames = computed(() => hidden.value.map((user) => user.username).join(", "));
</script>

<template>
  <div v-if="board.otherUsers.length" class="presence-bar" aria-label="Also on this board">
    <UTooltip v-for="user in shown" :key="user.userId" :text="user.username">
      <span
        class="presence-avatar"
        :data-user-id="user.userId"
        :style="{ backgroundColor: user.color }"
        :aria-label="user.username"
        role="img"
      >
        {{ initials(user.username) }}
      </span>
    </UTooltip>
    <UTooltip v-if="hidden.length" :text="hiddenNames">
      <span class="presence-avatar presence-avatar-more" :aria-label="hiddenNames" role="img">
        +{{ hidden.length }}
      </span>
    </UTooltip>
  </div>
</template>

<style>
.presence-bar {
  display: flex;
  align-items: center;
  /* Chips overlap a little, like a stack of avatars */
  padding-left: 6px;
}

.presence-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: -6px;
  border-radius: 50%;
  border: 2px solid var(--ui-bg);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  user-select: none;
}

.presence-avatar-more {
  background-color: var(--ui-bg-accented);
  color: var(--ui-text);
}
</style>
