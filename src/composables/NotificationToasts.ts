import { ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useRealtimeStore } from "@/stores/realtime";
import { REALTIME } from "@/constants";

export function useNotificationToasts() {
  const toast = useToast();
  const auth = useAuthStore();
  const realtime = useRealtimeStore();
  const user = ref();

  // Display a toast to inform the user that they received a friend request
  function handleFriendRequest() {
    toast.add({
      title: "You got a new friend request!",
      icon: "i-fluent-people-community-16-regular",
    });
  }

  watch(
    () => auth.user,
    (user) => {
      // If the user has an id, then a user exists, so the user just logged in
      if (user?.id) {
        // Subscribe to user-based events
        subscribeToEvents();
      }
      // If the user did not exist, then the user just logged out
      else {
        // Unsubscribe from user-based events now that the user has logged out.
        unsubscribeFromEvents();
      }
    },
    // Run immediataly once, and then run again when auth.user changes.
    // Ensures the user is always subscribed to their personal channel.
    { immediate: true },
  );

  function subscribeToEvents() {
    // Only subscribe to user-based events if the user is logged in.
    // If a user is not logged in, wait until they are logged in.
    if (!auth.user) {
      setTimeout(subscribeToEvents, 1000);
    } else {
      // Store the user data (so that events can be safely unsubscribed from after logout if needed)
      user.value = auth.user;

      // If a friend request is received, handle the message in handleFriendRequest
      realtime.on(
        `${REALTIME.TOPICS.USER}${auth.user.id}`,
        REALTIME.EVENTS.FRIEND_REQUEST,
        handleFriendRequest,
      );
    }
  }

  function unsubscribeFromEvents() {
    // If the user is logged in, there is no need to unsubscribe.
    // Covers cases where a timeout was started before logging in, but activates after logging in.
    if (auth.user) {
      return;
    }

    // If there is no stored user data, wait until there is user data.
    // The timeout is probably unnecessary, but it doesn't hurt to have it.
    // Unsubscribing from user-dependant channels requires the user data, so do not attempt to unsubscribe without the data.
    if (!user.value) {
      setTimeout(unsubscribeFromEvents, 1000);
    }
    // If there is stored user data, use it to clean up subscriptions
    else {
      // Clean up the subscription to friend requests
      realtime.off(
        `${REALTIME.TOPICS.USER}${user.value.id}`,
        REALTIME.EVENTS.FRIEND_REQUEST,
        handleFriendRequest,
      );
    }
  }
}
