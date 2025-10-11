<script setup lang="ts">
import { reactive, onMounted, useTemplateRef } from "vue";
import interact from "interactjs";
import { supabase } from "../lib/supabaseClient";
import type { Tables } from "../types/database.types";
import { throttle } from "@/utils/throttle";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Get the card data from the cards parent
const props = defineProps<{ card: Tables<"cards"> }>();

const card: Tables<"cards"> = reactive(props.card);
let channel: RealtimeChannel;

// Get a reference to the card element for the interaction mapping.
// Cannot use ".card" because it was mapping to the wrong card.
const cardElement = useTemplateRef("card-element");

// A single function to trigger both a broadcast of new card data and a write of that data to the database
function updateCard() {
  throttledWrite();
  throttledBroadcast();
}

// Write the new data for the card to the database
async function writeUpdate() {
  await supabase.from("cards").update(card).eq("card_id", card.card_id);
}

// Inform other clients of changes to the card's data so they can update immediately to the new data
async function broadcastUpdate() {
  channel.send({
    type: "broadcast",
    event: "card-update",
    payload: card,
  });
}

// Used to trigger delayed calls for writing and broadcasting card updates
const throttledWrite = throttle(writeUpdate, 200);
const throttledBroadcast = throttle(broadcastUpdate, 50);

// Setup interact.js to drag and resize the card
onMounted(() => {
  channel = supabase.channel("board-broadcast");
  channel.subscribe();

  // Ensure the card element is not null before making it interactable
  if (cardElement.value) {
    interact(cardElement.value)
      .draggable({
        listeners: {
          move(event) {
            if (!card) {
              console.log("No card found");
              return;
            }

            card.x += event.dx;
            card.y += event.dy;

            updateCard();
          },
        },
        inertia: false,
      })
      .resizable({
        edges: { top: true, left: true, bottom: true, right: true },
        invert: "reposition",
        listeners: {
          move(event) {
            if (!card) {
              console.log("No card found");
              return;
            }

            card.width = event.rect.width;
            card.height = event.rect.height;
            card.x += event.deltaRect.left;
            card.y += event.deltaRect.top;

            updateCard();
          },
        },
      });
  }
});
</script>

<template>
  <div
    class="card"
    :style="{
      transform: `translate(${card.x}px, ${card.y}px)`,
      width: card.width + 'px',
      height: card.height + 'px',
    }"
    ref="card-element"
  >
    <textarea class="cardTextarea" placeholder="Type something..."></textarea>
  </div>
</template>

<style>
.card {
  display: flex;
  position: absolute;
  background: white;
  border: 3px solid white;
  padding: 8px;
  user-select: none;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.card:active {
  cursor: move;
}
.card:focus-within {
  border-color: var(--ui-color-primary-400);
}

.cardTextarea {
  flex: 1;
  border-radius: 5px;
  color: black;
  resize: none;
}
.cardTextarea:active {
  cursor: move;
}
.cardTextarea:focus {
  outline: none;
}
</style>
