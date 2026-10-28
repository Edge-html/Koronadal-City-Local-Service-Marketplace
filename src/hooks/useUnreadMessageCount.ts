"use client";

import { useEffect, useState } from "react";
import { subscribeToConversations, subscribeToLatestMessage } from "@/lib/data";
import { addMessageReadStateListener, getConversationReadAt } from "@/lib/messageReadState";
import type { Conversation, DirectMessage } from "@/lib/types";

export function useUnreadMessageCount(uid: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }

    let conversations: Conversation[] = [];
    const latestMessages = new Map<string, DirectMessage | null>();
    const latestUnsubscribers = new Map<string, () => void>();

    const refreshCount = () => {
      const unread = conversations.reduce((total, conversation) => {
        const latest = latestMessages.get(conversation.id);
        if (!latest || latest.senderId === uid) return total;
        const sentAt = Date.parse(latest.createdAt);
        return sentAt > getConversationReadAt(uid, conversation.id) ? total + 1 : total;
      }, 0);
      setCount(unread);
    };

    const stopReadStateListener = addMessageReadStateListener(refreshCount);
    const stopConversations = subscribeToConversations(uid, (rows) => {
      conversations = rows;
      const currentIds = new Set(rows.map((conversation) => conversation.id));

      for (const [conversationId, unsubscribe] of latestUnsubscribers) {
        if (!currentIds.has(conversationId)) {
          unsubscribe();
          latestUnsubscribers.delete(conversationId);
          latestMessages.delete(conversationId);
        }
      }

      for (const conversation of rows) {
        if (latestUnsubscribers.has(conversation.id)) continue;
        latestMessages.set(conversation.id, null);
        latestUnsubscribers.set(conversation.id, subscribeToLatestMessage(
          conversation.id,
          (message) => {
            latestMessages.set(conversation.id, message);
            refreshCount();
          },
          () => {
            latestMessages.set(conversation.id, null);
            refreshCount();
          },
        ));
      }
      refreshCount();
    }, () => setCount(0));

    return () => {
      stopConversations();
      stopReadStateListener();
      for (const unsubscribe of latestUnsubscribers.values()) unsubscribe();
    };
  }, [uid]);

  return count;
}
