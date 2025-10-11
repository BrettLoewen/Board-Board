<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import type { Tables } from "../types/database.types";
import Card from "./Card.vue";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { debounce } from "@/utils/debounce";

const cards = ref<Tables<"cards">[]>([]);
let channel: RealtimeChannel;

// Get the cards data from the database and store it
async function getCards() {
  const { data } = await supabase.from("cards").select();
  cards.value = data as Tables<"cards">[];
}

async function updateCards() {
  // Get the up-to-date cards data from the database
  const { data } = await supabase.from("cards").select();

  // If the data was successfully retrieved...
  if (data && (data as Tables<"cards">[]) !== undefined) {
    // Update the stored data to match the database's data.
    // Note: each card is updated individually to maintain the link between the parent's and child's card state.
    data.forEach((element) => {
      const card = cards.value.find((c) => c.card_id === element.card_id);
      if (card) {
        card.x = element.x;
        card.y = element.y;
        card.width = element.width;
        card.height = element.height;
      }
    });
  }
}

// Used to trigger a cards update after some time
const debouncedRead = debounce(updateCards, 400);

async function makeCard() {
  // Write a new card to the database.
  // Also return that as an object so it can be added to the array of cards.
  const { data } = await supabase
    .from("cards")
    .insert({
      x: Math.round((window.innerWidth - 150) / 2),
      y: Math.round((window.innerHeight - 150) / 2),
      width: 150,
      height: 150,
    })
    .select()
    .single();

  // If a card was successfully written to the database,
  // Add it to the array of cards
  // And inform other clients via broadcast that a new card was created (so they can add it immediately themselves)
  if (data) {
    cards.value.push(data);
    channel.send({ type: "broadcast", event: "card-add", payload: data });
  }
}

onMounted(async () => {
  // Get the cards data to display
  await getCards();

  // Subscribe to the following broadcasts:
  // - card-add: When a new card is added, add it to the array
  // - card-update: When a card is moved/resized, update it to match the new data
  // Note: debouncedRead is used to ensure full sync with the database after all broadcasts finish
  channel = supabase.channel("board-broadcast");
  channel.on("broadcast", { event: "card-add" }, (payload) => {
    const card = payload.payload;
    if (!cards.value.some((c) => c.card_id === card.card_id)) {
      cards.value.push(card);
      debouncedRead();
    }
  });
  channel.on("broadcast", { event: "card-update" }, (payload) => {
    const { card_id, ...data } = payload.payload;
    const card = cards.value.find((c) => c.card_id === card_id);
    if (card) {
      card.x = data.x;
      card.y = data.y;
      card.width = data.width;
      card.height = data.height;

      debouncedRead();
    }
  });
  channel.subscribe();
});

onUnmounted(() => {
  // Clean up the channel subscription
  supabase.removeChannel(channel);
});
</script>

<template>
  <button @click="makeCard">Make Card</button>
  <div v-for="card in cards" :key="card.card_id">
    <Card :card="card" />
  </div>
</template>

<style scoped></style>
