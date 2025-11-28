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
const friends = ref<{ id: string; name: string }[]>([]);
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

async function sendFriendRequest(): Promise<void> {
  console.log("Sending code " + requestId.value);

  // Tell the database to send a friend request to the given friend code.
  // If successful, will get back the user id that the friend request was sent to.
  const { data, error } = await supabase.rpc("send_friend_request", {
    from_user: auth.user?.id ?? "",
    to_friend_code: requestId.value ?? "",
  });

  if (error) {
    console.log(error);
    return;
  }

  // If the friend request creation in the database was successful and a user id for that user was received,
  // send a broadcast message to that user to inform them of the friend request.
  console.log(data);
  if (data) {
    const topic = REALTIME.TOPICS.USER + data;
    const event = REALTIME.EVENTS.FRIEND_REQUEST;
    console.log(await realtime.sendToTopic(topic, event, {}));
  } else {
    console.log("Friend request created previously, updating timestamp");
  }
}

async function acceptFriendRequest(requestId: string): Promise<void> {
  console.log("Accept request from " + requestId);

  //
  const { data, error } = await supabase.rpc("accept_friend_request", {
    friend_request_id: requestId,
  });

  if (error) {
    console.log(error);
  }

  //
  if (data) {
    console.log(data);
    // Update the friends page UI
    getFriendRequests();
    getFriends();

    // Inform the friend request's sender that the request was accepted
    const topic = REALTIME.TOPICS.USER + data;
    const event = REALTIME.EVENTS.FRIEND_ACCEPTED;
    console.log(await realtime.sendToTopic(topic, event, {}));
  }
}

async function rejectFriendRequest(requestId: string): Promise<void> {
  console.log("Reject request from " + requestId);

  //
  const { error } = await supabase.rpc("delete_friend_request", {
    friend_request_id: requestId,
  });

  if (error) {
    console.log(error);
  }

  getFriendRequests();
}

async function getFriends(): Promise<void> {
  // Get the friendship relationships that this user has with other users.
  // Will be converted to user_profile rows later.
  const { data, error } = await supabase
    .from("friends")
    .select()
    .or(`user_id_1.eq.${auth.profile?.id},user_id_2.eq.${auth.profile?.id}`);

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    console.log(data);

    // Clear the stored data so just the up-to-date info is used/displayed
    friends.value = [];

    // Loop through each row of the data
    data.forEach(async (friend) => {
      // Get the user_profile of the other user
      // If the this user's id matches user 1 in the friendship, then get user 2's profile data
      if (friend.user_id_1 === auth.profile?.id) {
        // Get the other user's profile data
        const { data, error } = await supabase
          .from("user_profiles")
          .select()
          .eq("id", friend.user_id_2)
          .limit(1);

        if (error) {
          console.error(error);
          return;
        }

        if (data) {
          // Store the data from the friend that is needed by the UI
          friends.value.push({
            id: data[0]?.id ?? "",
            name: data[0]?.username ?? "",
          });
        }
      }
      // If the this user's id matches user 2 in the friendship, then get user 1's profile data
      else {
        // Get the other user's profile data
        const { data, error } = await supabase
          .from("user_profiles")
          .select()
          .eq("id", friend.user_id_1)
          .limit(1);

        if (error) {
          console.error(error);
          return;
        }

        if (data) {
          // Store the data from the friend that is needed by the UI
          friends.value.push({
            id: data[0]?.id ?? "",
            name: data[0]?.username ?? "",
          });
        }
      }
    });
  }
}

async function removeFriend(friendId: string): Promise<void> {
  console.log("Remove " + friendId);

  // Delete the friends row that includes both this user and the friend id
  const { error } = await supabase.from("friends").delete().or(`and(
      user_id_1.eq.${auth.profile?.id},
      user_id_2.eq.${friendId}),
    and(
      user_id_1.eq.${friendId},
      user_id_2.eq.${auth.profile?.id})`);

  if (error) {
    console.error(error);
    return;
  }
}

function updateLists() {
  getFriendRequests();
  getFriends();
}

onMounted(() => {
  if (!auth.user) return;

  // If a friend request is received, update the list of friend requests using getFriendRequests
  realtime.on(
    `${REALTIME.TOPICS.USER}${auth.user.id}`,
    REALTIME.EVENTS.FRIEND_REQUEST,
    getFriendRequests,
  );

  // If a friend request is accepted, update the lists of friends and friend requests
  realtime.on(
    `${REALTIME.TOPICS.USER}${auth.user.id}`,
    REALTIME.EVENTS.FRIEND_ACCEPTED,
    updateLists,
  );

  getFriendRequests();
  getFriends();
});

onBeforeUnmount(() => {
  if (!auth.user) return;

  // Clean up the subscriptions
  realtime.off(
    `${REALTIME.TOPICS.USER}${auth.user.id}`,
    REALTIME.EVENTS.FRIEND_REQUEST,
    getFriendRequests,
  );
  realtime.on(
    `${REALTIME.TOPICS.USER}${auth.user.id}`,
    REALTIME.EVENTS.FRIEND_ACCEPTED,
    updateLists,
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

    <USeparator class="separator" color="neutral" size="sm" label="Your Friend Code" />
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

    <USeparator class="separator" color="neutral" size="sm" label="Friend Requests" />
    <div class="horizontal-layout">
      <UInput v-model="requestId" placeholder="Friend's code" />
      <UButton class="select-button" @click="sendFriendRequest">Send Request</UButton>
    </div>
    <div class="margin-top-15 rounded-md border-0 p-2.5 ring ring-inset ring-accented">
      <div v-if="friendRequests && friendRequests.length > 0" class="friends-container">
        <p class="text-sm">Pending Friend Requests</p>
        <div
          class="friend-request rounded-md border-0 ring ring-inset ring-accented"
          v-for="friendRequest in friendRequests"
          :key="friendRequest.id"
        >
          <p class="content-center">{{ friendRequest.name }}</p>
          <div class="flex gap-2.5">
            <UButton
              variant="subtle"
              icon="i-carbon-checkmark-outline"
              @click="acceptFriendRequest(friendRequest.id)"
            >
              Accept
            </UButton>
            <UButton
              variant="subtle"
              icon="i-carbon-close-outline"
              color="error"
              @click="rejectFriendRequest(friendRequest.id)"
            >
              Reject
            </UButton>
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-sm text-center text-muted">No Pending Friend Requests</p>
      </div>
    </div>

    <USeparator class="separator" color="neutral" size="sm" label="Friends" />
    <div v-if="friends && friends.length > 0" class="flex flex-col gap-2.5">
      <div
        v-for="friend in friends"
        :key="friend.id"
        class="friend-request rounded-md border-0 ring ring-inset ring-accented"
      >
        <p class="content-center">{{ friend.name }}</p>
        <UButton
          variant="subtle"
          icon="i-carbon-close-outline"
          color="error"
          @click="removeFriend(friend.id)"
        >
          Remove
        </UButton>
      </div>
    </div>
    <div v-else>
      <p class="text-sm text-center text-muted">No Friends</p>
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

.margin-top-15 {
  margin-top: 15px;
}

.friends-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.friend-request {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 10px;
}
</style>
