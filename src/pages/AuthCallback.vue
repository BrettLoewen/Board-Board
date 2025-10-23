<script setup lang="ts">
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "vue-router";

const router = useRouter();
// This tries to parse tokens from the URL and store them locally.
try {
  const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
  console.log(window.location.href);
  console.log(JSON.stringify(data));
  if (error) {
    console.error("Error exchanging code for session:", error.message);
  } else {
    console.log("Session stored:", data.session);
    router.push("/dashboard");
  }
} catch (err) {
  console.error("Unexpected error:", err);
}
</script>

<template>
  <div>Signing you in...</div>
</template>
