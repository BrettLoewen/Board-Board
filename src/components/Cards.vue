<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import type { Tables } from "../types/database.types";
import Card from "./Card.vue";
// import type { RealtimeChannel } from "@supabase/supabase-js";

const cards = ref<Tables<"cards">[]>([]);
// let channel: RealtimeChannel;

async function getCards() {
  const { data } = await supabase.from("cards").select();
  cards.value = data as Tables<"cards">[];
}

async function makeCard() {
  // await supabase.from("cards")
  //   .insert({
  //     x: Math.round((window.innerWidth - 150) / 2),
  //     y: Math.round((window.innerHeight - 150) / 2),
  //     width: 150,
  //     height: 150,
  //   });
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

  if (data) {
    cards.value.push(data);
    // channel.send({ type: "broadcast", event: "card-add", payload: data });
  }
}

onMounted(async () => {
  await getCards();

  // channel = supabase.channel("board-broadcast");
  // channel.on("broadcast", { event: "card-add" }, (payload) => {
  //   const card = payload.payload;
  //   if (!cards.value.some((c) => c.card_id === card.card_id)) {
  //     cards.value.push(card);
  //   }
  // });
  // channel.on("broadcast", { event: "card-update" }, (payload) => {
  //   const { id, data } = payload.payload;
  //   const card = cards.value.find((c) => c.card_id === id);
  //   if (card) {
  //     card.x = data.x;
  //     card.y = data.y;
  //     card.width = data.was;
  //     card.height = data.height;

  //     console.log("Card was updated");
  //   }
  // });
  // channel.subscribe();
  const channel = supabase
    .channel("db-changes")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "cards" }, (payload) => {
      const newCard = payload.new as Tables<"cards">;
      if (!cards.value.some((c) => c.card_id === newCard.card_id)) {
        cards.value.push(newCard);
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cards" }, (payload) => {
      const updated = payload.new as Tables<"cards">;
      const card = cards.value.find((c) => c.card_id === updated.card_id);
      if (card) {
        card.x = updated.x;
        card.y = updated.y;
        card.width = updated.width;
        card.height = updated.height;

        console.log("Card was updated");
      }
    })
    .subscribe();

  onUnmounted(() => {
    supabase.removeChannel(channel);
  });
});
</script>

<template>
  <button @click="makeCard">Make Card</button>
  <div v-for="card in cards" :key="card.card_id">
    <Card :card="card" />
  </div>
</template>

<style scoped></style>
