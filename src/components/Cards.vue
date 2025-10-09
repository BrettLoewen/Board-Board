<script setup lang="ts">
import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabaseClient";
import type { Tables } from "../types/database.types";
import Card from "./Card.vue";

const cards = ref<Tables<"cards">[]>([]);

async function getCards() {
  const { data } = await supabase.from("cards").select();
  cards.value = data as Tables<"cards">[];
}

async function makeCard() {
  await supabase.from("cards").insert({
    x: Math.round((window.innerWidth - 150) / 2),
    y: Math.round((window.innerHeight - 150) / 2),
    width: 150,
    height: 150,
  });
}

onMounted(() => {
  getCards();
});
</script>

<template>
  <button @click="makeCard">Make Card</button>
  <div v-for="card in cards" :key="card.card_id">
    <Card :card="card" />
  </div>
</template>

<style scoped></style>
