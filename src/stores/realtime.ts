import { defineStore } from "pinia";
import { supabase } from "@/lib/supabaseClient";
import { ref, watch } from "vue";
import { useAuthStore } from "./auth";
import { REALTIME } from "@/constants";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Json } from "@/types/database.types";

type Handler = (payload: Json) => void;

// Stores a created realtime channel.
// Each function that subscribes to the channel will be stored in the handlers map.
// The handler's key will be the event type used for the function, and the value is a set of handler functions.
// The set of functions allows multiple functions to subscribe to the same channel and event type at the same time.
type ChannelRecord = {
  channel: RealtimeChannel;
  handlers: Map<string, Set<Handler>>;
  subscribed: boolean;
};

export const useRealtimeStore = defineStore("realtime", () => {
  const auth = useAuthStore();

  // Map to store channels and the handler functions that have subscribed to them.
  // When a new channel is created, it will be stored in this map, with the topic as the key.
  // The new channel with have no handlers (0 functions have subscribed to 0 event types).
  const channels = ref(new Map<string, ChannelRecord>());

  const init = async () => {
    // When the auth state changes, manage the user's personal channel.
    watch(
      () => auth.user,
      (user) => {
        // If the user has an id, then a user exists, so the user just logged in
        if (user?.id) {
          // Subscribe to the user's personal channel
          subscribe(`${REALTIME.TOPICS.USER}${user.id}`);
        }
        // If the user did not exist
        else {
          // Unsubscribe from any channels that belong to a user
          for (const key of Array.from(channels.value.keys())) {
            if (key.startsWith(REALTIME.TOPICS.USER)) {
              unsubscribe(key);
            }
          }
        }
      },
      // Run immediataly once, and then run again when auth.user changes.
      // Ensures the user is always subscribed to their personal channel.
      { immediate: true },
    );
  };

  function getOrCreateChannel(topic: string) {
    // Check if a channel with this topic has already been created and stored.
    // If so, return that channel instead of creating a new one.
    const existing = channels.value.get(topic);
    if (existing) return existing;

    // Create a new channel for the passed topic
    const channel = supabase.channel(topic);

    // Create a map entry for this channel that will let functions subscribe to specifically this channel topic
    const record: ChannelRecord = {
      channel,
      handlers: new Map(),
      subscribed: false,
    };

    // Store the map entry and return it
    channels.value.set(topic, record);
    return record;
  }

  function subscribe(topic: string) {
    // Get the channel for the passed topic
    const record = getOrCreateChannel(topic);

    // If the channel has already been subscribed to, do not subscribe again
    if (record.subscribed) {
      return;
    }

    const { channel } = record;

    // When a message is received on this channel, pass the payload to the relevant handlers based on the message's event type
    channel.on("broadcast", { event: "*" }, (payload) => {
      // Get the message's event type
      const eventName = payload.event ?? payload.type ?? "message";

      // Get the handler functions that are subscribed to this event
      const handlersForEvent = record.handlers.get(eventName) ?? record.handlers.get("*");

      // Invoke each handler with the given payload
      if (handlersForEvent) {
        for (const handler of handlersForEvent) {
          try {
            handler(payload);
          } catch (error) {
            console.error("realtime handler err", error);
          }
        }
      }
    });

    // Mark that this channel has been subscribed to
    record.subscribed = true;

    // Subscribe to the channel so the relevant handler functions can receive messages for their events
    channel.subscribe();
  }

  function unsubscribe(topic: string) {
    // Get the channel for the passed topic
    const record = channels.value.get(topic);
    if (!record) return;

    // Clean up the subscription to this channel
    record.channel.unsubscribe();
    supabase.removeChannel(record.channel as RealtimeChannel);

    // Clean up the reference to the channel
    channels.value.delete(topic);
  }

  function on(topic: string, event: string, handler: Handler) {
    // Get the channel for the passed topic
    const record = getOrCreateChannel(topic);

    // Ensure that this channel has been subscribed to (in case it was just created now)
    subscribe(topic);

    // Get the set of functions that are subscribed to the passed event type
    let set = record.handlers.get(event);

    // If a set has not been created yet for this channel and event type combination, create one
    if (!set) {
      set = new Set();
      record.handlers.set(event, set);
    }

    // Add the passed handler function to the set so it will be called when a message with the matching event is sent on the channel
    set.add(handler);
  }

  function off(topic: string, event: string, handler?: Handler) {
    // Get the channel for the passed topic
    const record = channels.value.get(topic);
    if (!record) return;

    // If no handler function was given, delete all handlers for the given event (delete the set of handlers mapped to this event)
    if (!handler) {
      record.handlers.delete(event);
    }
    // If a handler function was given, delete it specifically
    else {
      const set = record.handlers.get(event);
      set?.delete(handler);

      // If deleting this handler empties the set, delete the set mapped to the given event
      if (set && set.size === 0) record.handlers.delete(event);
    }

    // If the channel no longer has any handlers subscribed to it, unsubscribe from the channel entirely
    if (record.handlers.size === 0) {
      unsubscribe(topic);
    }
  }

  async function sendToTopic(topic: string, event: string, payload: Json) {
    // Get the channel for this topic
    const record = getOrCreateChannel(topic);

    // Send a broadcast message on this channel with the given event and payload
    const res = await record.channel.send({
      type: "broadcast",
      event,
      payload,
    });

    return res;
  }

  // Helper function that can be used to check if a topic has been subscribed to
  function isSubscribed(topic: string) {
    return channels.value.has(topic);
  }

  init();

  return {
    subscribe,
    unsubscribe,
    on,
    off,
    sendToTopic,
    isSubscribed,
  };
});
