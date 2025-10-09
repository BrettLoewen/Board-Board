<script setup lang="ts">
import { ref, onMounted } from "vue";
import { supabase } from "./lib/supabaseClient";
import type { Tables } from "./types/database.types";

const cards = ref<Tables<"cards">[]>([]);

async function getCards() {
  const { data } = await supabase.from("cards").select();
  cards.value = data as Tables<"cards">[];
}

async function makeCard() {
  await supabase.from("cards").insert({ x: 1, y: 2, width: 2, height: 3 });
}

onMounted(() => {
  getCards();
});
</script>

<template>
  <button @click="makeCard">Make Card</button>
  <ul>
    <li v-for="card in cards" :key="card.card_id">{{ card.x }}</li>
  </ul>
</template>

<style scoped></style>
