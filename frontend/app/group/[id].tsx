import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import { getGroup, messagesByGroup, currentUser, Message } from "@/src/data/mock";

export default function GroupChat() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = getGroup(id!);
  const initial = messagesByGroup[id!] || [];
  const [messages, setMessages] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const listRef = useRef<FlatList>(null);

  if (!group) return null;

  const pinned = messages.find((m) => m.pinned);

  const send = () => {
    if (!text.trim()) return;
    const msg: Message = {
      id: "m" + Date.now(),
      groupId: id!,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: text.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      own: true,
      status: "sent",
      replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.senderName, content: replyTo.content } : undefined,
    };
    setMessages((m) => [...m, msg]);
    setText("");
    setReplyTo(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.chatBg }} edges={["top"]} testID="group-chat-screen">
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Pressable
          onPress={() => router.push(`/group/info/${group.id}`)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md }}
        >
          <Avatar uri={group.image} name={group.name} size={40} verified={group.verified} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>
              {group.members.toLocaleString()} members · Priya, Rohan typing…
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.iconBtn} testID="chat-search-btn">
          <Ionicons name="search" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable
          style={styles.iconBtn}
          onPress={() => router.push(`/group/info/${group.id}`)}
          testID="chat-info-btn"
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      {pinned && (
        <Pressable style={[styles.pinnedBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ width: 3, height: 34, backgroundColor: colors.brandPrimary, borderRadius: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.brandPrimary, fontSize: font.sm, fontWeight: "500" }}>Pinned message</Text>
            <Text style={{ color: colors.onSurface, fontSize: font.sm }} numberOfLines={1}>
              {pinned.content}
            </Text>
          </View>
          <Ionicons name="pin" size={16} color={colors.onSurfaceTertiary} />
        </Pressable>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList showsVerticalScrollIndicator={false}
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            const showAvatar = !item.own && (!prev || prev.senderId !== item.senderId);
            const showName = !item.own && (!prev || prev.senderId !== item.senderId);
            return <Bubble msg={item} showAvatar={showAvatar} showName={showName} onReply={() => setReplyTo(item)} />;
          }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 2 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {replyTo && (
          <View style={[styles.replyPreview, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border }]}>
            <View style={{ width: 3, height: 34, backgroundColor: colors.brandSecondary, borderRadius: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.brandSecondary, fontSize: font.sm, fontWeight: "500" }}>
                Replying to {replyTo.senderName}
              </Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>
                {replyTo.content}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.onSurfaceTertiary} />
            </Pressable>
          </View>
        )}

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Pressable style={[styles.attachBtn, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="add" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={[styles.inputWrap, { backgroundColor: colors.surfaceTertiary }]}>
            <TextInput
              testID="chat-input"
              value={text}
              onChangeText={setText}
              placeholder="Message"
              placeholderTextColor={colors.muted}
              multiline
              style={{ flex: 1, color: colors.onSurface, fontSize: font.base, maxHeight: 100 }}
            />
            <Ionicons name="happy-outline" size={22} color={colors.onSurfaceTertiary} />
          </View>
          <Pressable
            onPress={send}
            style={[styles.sendBtn, { backgroundColor: colors.brandPrimary }]}
            testID="chat-send-btn"
          >
            <Ionicons name={text.trim() ? "arrow-up" : "mic"} size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ msg, showAvatar, showName, onReply }: { msg: Message; showAvatar: boolean; showName: boolean; onReply: () => void }) {
  const { colors } = useTheme();
  const own = msg.own;

  return (
    <View style={{ flexDirection: "row", justifyContent: own ? "flex-end" : "flex-start", alignItems: "flex-end", gap: spacing.sm, marginTop: showName ? spacing.sm : 2 }}>
      {!own && (
        <View style={{ width: 32 }}>
          {showAvatar && <Avatar uri={msg.senderAvatar} name={msg.senderName} size={32} />}
        </View>
      )}
      <Pressable
        onLongPress={onReply}
        style={[
          styles.bubble,
          {
            backgroundColor: own ? colors.bubbleOwn : colors.bubbleOther,
            borderTopLeftRadius: own ? radius.md : showAvatar ? 4 : radius.md,
            borderTopRightRadius: own ? 4 : radius.md,
            maxWidth: "78%",
          },
        ]}
      >
        {showName && !own && (
          <Text style={{ color: colors.brandPrimary, fontSize: font.sm, fontWeight: "500", marginBottom: 2 }}>
            {msg.senderName}
          </Text>
        )}
        {msg.replyTo && (
          <View style={[styles.replyQuote, { backgroundColor: own ? "#ffffff22" : colors.surfaceTertiary, borderLeftColor: own ? "#fff" : colors.brandSecondary }]}>
            <Text style={{ color: own ? "#ffffffcc" : colors.brandSecondary, fontSize: font.sm, fontWeight: "500" }}>
              {msg.replyTo.senderName}
            </Text>
            <Text style={{ color: own ? "#ffffffaa" : colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>
              {msg.replyTo.content}
            </Text>
          </View>
        )}
        <Text style={{ color: own ? colors.onBrandPrimary : colors.onSurface, fontSize: font.base, lineHeight: 20 }}>
          {msg.content}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-end", marginTop: 2, gap: 4 }}>
          <Text style={{ color: own ? "#ffffff99" : colors.muted, fontSize: 10 }}>{msg.createdAt}</Text>
          {own && (
            <Ionicons
              name={msg.status === "read" ? "checkmark-done" : "checkmark"}
              size={13}
              color={msg.status === "read" ? "#8DC7B3" : "#ffffffaa"}
            />
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 60,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  pinnedBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bubble: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  replyQuote: {
    borderLeftWidth: 3, paddingLeft: spacing.sm, paddingVertical: 4,
    borderRadius: 4, marginBottom: spacing.sm, paddingRight: spacing.sm,
  },
  replyPreview: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === "ios" ? spacing.md : spacing.sm,
  },
  attachBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  inputWrap: {
    flex: 1, minHeight: 40, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
