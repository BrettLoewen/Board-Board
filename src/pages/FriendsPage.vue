<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useClipboard } from "@vueuse/core";
import { REALTIME, ROUTES } from "@/constants";
import router from "@/router";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabaseClient";
import { useRealtimeStore } from "@/stores/realtime";

const auth = useAuthStore();
const realtime = useRealtimeStore();
const { copy, copied } = useClipboard();

const friendCode = computed<string | undefined>(() => {
  return auth.profile?.friend_code;
});
const requestId = ref<string>("");
const friends = ref<string[]>(["Billy", "Steve", "Bob"]);

const friendRequests = ref<{ id: string; name: string }[]>([]);
const friendRequestSenders = ref<string[]>([]);

// Return the user to the dashboard page
function toDashboardPage(): void {
  router.push(ROUTES.DASHBOARD);
}

async function cycleFriendCode(close: () => void): Promise<void> {
  // Close the modal
  close();

  // Tell the database to generate a new friend code
  await supabase.rpc("refresh_friend_code", { user_id: auth.user?.id ?? "" });

  // Fetch and store the updated user data
  await auth.fetchProfile();
}

async function getFriendRequests(): Promise<void> {
  // Get the data for all friend request messages sent to the logged in user, along with the username of the users who sent the requests
  const { data, error } = await supabase
    .from("user_messages")
    .select(
      `
      id,
      from_user_id,
      to_user_id,
      message_status,
      message_type,
      sender:user_profiles!user_messages_from_user_id_fkey (
        username
      )
    `,
    )
    .eq("message_type", "friend_request")
    .eq("to_user_id", auth.profile?.id);

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    // Clear the stored data so just the up-to-date info is used/displayed
    friendRequests.value = [];
    friendRequestSenders.value = [];

    // Loop through each row of the data
    data.forEach((request) => {
      // If it has not already been added (in case there are duplicated requests)
      if (!friendRequestSenders.value.includes(request.from_user_id ?? "")) {
        // Store the request's sender, so duplicate requests from the same user cannot be shown if they exist
        friendRequestSenders.value.push(request.from_user_id ?? "");

        // Store the data from the request that is needed by the UI
        friendRequests.value.push({
          id: request.id,
          name: request.sender?.username ?? "",
        });
      }
    });
  }
}

async function sendFriendCode(): Promise<void> {
  console.log("Sending code " + requestId.value);

  // Tell the database to send a friend request to the given friend code.
  // If successful, will get back the user id that the friend request was sent to.
  const { data, error } = await supabase.rpc("send_friend_request", {
    from_user: auth.user?.id ?? "",
    to_friend_code: requestId.value ?? "",
  });

  if (error) {
    console.log(error);
  }

  // If the friend request creation in the database was successful and a user id for that user was received,
  // send a broadcast message to that user to inform them of the friend request.
  if (data) {
    console.log(data);
    const topic = REALTIME.TOPICS.USER + data;
    const event = REALTIME.EVENTS.FRIEND_REQUEST;
    console.log(await realtime.sendToTopic(topic, event, {}));
  }
}

onMounted(() => {
  if (!auth.user) return;

  // If a friend request is received, handle the message in handleFriendRequest
  realtime.on(
    `${REALTIME.TOPICS.USER}${auth.user.id}`,
    REALTIME.EVENTS.FRIEND_REQUEST,
    getFriendRequests,
  );

  getFriendRequests();
});

onBeforeUnmount(() => {
  if (!auth.user) return;

  // Clean up the subscription to friend requests
  realtime.off(
    `${REALTIME.TOPICS.USER}${auth.user.id}`,
    REALTIME.EVENTS.FRIEND_REQUEST,
    getFriendRequests,
  );
});
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
      <UInput disabled :value="friendCode ?? ''">
        <template #trailing>
          <UTooltip text="Copy to clipboard">
            <UButton
              class="clipboard-button"
              :color="copied ? 'success' : 'neutral'"
              variant="link"
              size="sm"
              :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'"
              aria-label="Copy to clipboard"
              @click="copy(friendCode ?? '')"
            />
          </UTooltip>
        </template>
      </UInput>
      <UModal
        title="Get a new friend code?"
        description="This will update the code that other users can send friend requests to. Are you sure you want to update your code?"
        :close="{ class: 'friend-code-modal-close-button' }"
      >
        <UButton class="select-button">Get New Code</UButton>

        <template #body="{ close }">
          <div class="list">
            <ol class="normal">
              <li>Your friends and shared boards will persist.</li>
              <li>Previously sent friend requests for the old code will persist.</li>
              <li>New friend requests to the old code will fail.</li>
            </ol>
          </div>
          <div class="friend-code-modal-buttons">
            <UButton label="Get New Code" class="select-button" @click="cycleFriendCode(close)" />
            <UButton
              color="neutral"
              variant="outline"
              label="Cancel"
              class="friend-code-modal-cancel-button"
              @click="close"
            />
          </div>
        </template>
      </UModal>
    </div>

    <USeparator class="separator" color="neutral" label="Friend Requests" />
    <div class="horizontal-layout">
      <UInput v-model="requestId" placeholder="Friend's code" />
      <UButton class="select-button" @click="sendFriendCode">Send Request</UButton>
    </div>
    <div>
      <div v-for="friendRequest in friendRequests" :key="friendRequest.id">
        <p>{{ friendRequest.name }}</p>
      </div>
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

.clipboard-button:hover {
  cursor: pointer;
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

.friend-code-modal-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 10px;
}

.friend-code-modal-close-button:active {
  background-color: var(--color-neutral-800);
}
.friend-code-modal-close-button:hover {
  cursor: pointer;
}

.friend-code-modal-cancel-button:active {
  background-color: var(--color-neutral-800);
}
.friend-code-modal-cancel-button:hover {
  cursor: pointer;
}

.list {
  padding-bottom: 24px;
}

ol.normal {
  padding-left: 20px;
  list-style-type: disc;
}
</style>
