import { defineStore } from "pinia";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { ref, watch } from "vue";
import { useAuthStore } from "./auth";
import { REALTIME } from "@/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (payload: any) => void;

type ChannelRecord = {
  channel: RealtimeChannel;
  handlers: Map<string, Set<Handler>>;
};

export const useRealtimeStore = defineStore("realtime", () => {
  const auth = useAuthStore();

  // Map to store channels and the handler functions.
  // When a
  const channels = ref(new Map<string, ChannelRecord>());

  const init = async () => {
    console.log("realtime init");

    watch(
      () => auth.user,
      (user) => {
        if (user?.id) {
          subscribe(`${REALTIME.TOPICS.USER}${user.id}`);
        } else {
          for (const key of Array.from(channels.value.keys())) {
            if (key.startsWith(REALTIME.TOPICS.USER)) {
              unsubscribe(key);
            }
          }
        }
      },
      // Run immediataly once, and then run again when auth.user changes
      { immediate: true },
    );
  };

  function getOrCreateChannel(topic: string) {
    const existing = channels.value.get(topic);
    if (existing) return existing;

    const channel = supabase.channel(topic);

    const record: ChannelRecord = {
      channel,
      handlers: new Map(),
    };

    channels.value.set(topic, record);
    return record;
  }

  function subscribe(topic: string) {
    const record = getOrCreateChannel(topic);
    const { channel } = record;

    channel.on("broadcast", { event: "*" }, (payload) => {
      const eventName = payload.event ?? payload.type ?? "message";
      const handlersForEvent = record.handlers.get(eventName) ?? record.handlers.get("*");
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

    channel.subscribe();
  }

  function unsubscribe(topic: string) {
    const record = channels.value.get(topic);
    if (!record) return;

    record.channel.unsubscribe();
    supabase.removeChannel(record.channel as RealtimeChannel);

    channels.value.delete(topic);
  }

  function on(topic: string, event: string, handler: Handler) {
    const record = getOrCreateChannel(topic);
    let set = record.handlers.get(event);
    if (!set) {
      set = new Set();
      record.handlers.set(event, set);
    }
    set.add(handler);
    record.channel.subscribe();
  }

  function off(topic: string, event: string, handler?: Handler) {
    const record = channels.value.get(topic);
    if (!record) return;
    if (!handler) {
      record.handlers.delete(event);
    } else {
      const set = record.handlers.get(event);
      set?.delete(handler);
      if (set && set.size === 0) record.handlers.delete(event);
    }

    if (record.handlers.size === 0) {
      unsubscribe(topic);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function sendToTopic(topic: string, event: string, payload: any) {
    console.log("SendToTopic " + topic + ", " + event);
    const record = getOrCreateChannel(topic);
    const res = await record.channel.send({
      type: "broadcast",
      event,
      payload,
    });

    return res;
  }

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
