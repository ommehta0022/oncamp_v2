import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { useTheme } from "@/src/theme/ThemeProvider";
import { font, radius, spacing } from "@/src/theme/colors";
import Avatar from "@/src/components/Avatar";
import EmptyState from "@/src/components/EmptyState";
import ImageViewer from "@/src/components/ImageViewer";
import { useRole } from "@/src/context/RoleProvider";
import { api, GroupDto } from "@/src/lib/api";
import { showImagePicker, uploadMessageMedia } from "@/src/lib/imageUpload";

type Message = {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type?: "text" | "image";
  mediaUrl?: string;
  createdAt: string;
  replyTo?: { id: string; senderName: string; content: string };
  pinned?: boolean;
  own?: boolean;
  status?: "sent" | "delivered" | "read";
};

function normalizeMessage(row: any, groupId: string, currentUserId?: string): Message {
  return {
    id: row.id,
    groupId,
    senderId: row.sender_id || row.senderId,
    senderName: row.users?.name || row.senderName || "Member",
    senderAvatar: row.senderAvatar || "",
    content: row.content || "",
    type: row.type || "text",
    mediaUrl: row.mediaUrl || row.media_url,
    createdAt: row.created_at
      ? new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : row.createdAt || "",
    own: row.own || row.sender_id === currentUserId,
    status: "sent",
  };
}

export default function GroupChat() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useRole();
  const { showActionSheetWithOptions } = useActionSheet();
  useSafeAreaInsets();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    api.groups.get(id).then(setGroup).catch(() => setGroup(null));
    api.groups.messages(id)
      .then((rows: any) => {
        if (Array.isArray(rows)) setMessages(rows.reverse().map((row) => normalizeMessage(row, id, user?.id)));
      })
      .catch(() => {});
  }, [id, user?.id]);

  if (!group) return null;

  const pinned = messages.find((m) => m.pinned);

  const handleImagePick = async () => {
    const uri = await showImagePicker({ aspect: [4, 3], quality: 0.8 });
    if (!uri) return;
    
    setSendingImage(true);
    try {
      const result = await uploadMessageMedia(id!, uri);
      const saved = await api.groups.sendMessage(id!, {
        content: "",
        type: "image",
        mediaUrl: result.url,
        clientMessageId: `client-${Date.now()}`,
      });
      setMessages((m) => [...m, normalizeMessage(saved, id!, user?.id)]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      Alert.alert("Error", "Failed to send image");
    } finally {
      setSendingImage(false);
    }
  };

  const handleLongPress = (message: Message) => {
    const isOwn = message.senderId === user?.id;
    const options = [
      "Reply",
      message.type === "text" ? "Copy Text" : null,
      isOwn ? "Delete" : null,
      !isOwn ? "Report" : null,
      "Cancel",
    ].filter(Boolean) as string[];

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: options.indexOf("Delete") !== -1 ? options.indexOf("Delete") : undefined,
      },
      async (buttonIndex) => {
        if (buttonIndex === undefined) return;
        
        switch (options[buttonIndex]) {
          case "Reply":
            setReplyTo(message);
            break;
          case "Copy Text":
            await Clipboard.setStringAsync(message.content);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            break;
          case "Delete":
            Alert.alert("Delete Message", "Are you sure?", [
              { text: "Cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await api.groups.deleteMessage(id!, message.id);
                    setMessages((m) => m.filter((msg) => msg.id !== message.id));
                  } catch {
                    Alert.alert("Error", "Failed to delete message");
                  }
                },
              },
            ]);
            break;
          case "Report":
            Alert.alert("Report Message", "Report this message to group admins?", [
              { text: "Cancel" },
              { text: "Report", style: "destructive" },
            ]);
            break;
        }
      }
    );
  };

  const openImage = (url: string) => {
    setViewerImage(url);
    setViewerVisible(true);
  };

  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    setReplyTo(null);
    try {
      const saved = await api.groups.sendMessage(id!, {
        content,
        type: "text",
        clientMessageId: `client-${Date.now()}`,
      });
      setMessages((m) => [...m, normalizeMessage(saved, id!, user?.id)]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      setText(content);
    }
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
          <Avatar uri={group.avatarUrl} name={group.name} size={40} verified={group.official} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onSurface, fontSize: font.lg, fontWeight: "500" }} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: font.sm }} numberOfLines={1}>
              {(group.memberCount || 0).toLocaleString()} members
            </Text>
          </View>
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
        <View style={[styles.pinnedBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ width: 3, height: 34, backgroundColor: colors.brandPrimary, borderRadius: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.brandPrimary, fontSize: font.sm, fontWeight: "500" }}>Pinned message</Text>
            <Text style={{ color: colors.onSurface, fontSize: font.sm }} numberOfLines={1}>
              {pinned.content}
            </Text>
          </View>
          <Ionicons name="pin" size={16} color={colors.onSurfaceTertiary} />
        </View>
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
            return <Bubble msg={item} showAvatar={showAvatar} showName={showName} onReply={() => setReplyTo(item)} onLongPress={() => handleLongPress(item)} onImagePress={openImage} />;
          }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 2 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState icon="chatbubble-outline" title="No messages yet" message="Start the first real conversation in this group." />
          }
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
          <TouchableOpacity 
            onPress={handleImagePick} 
            disabled={sendingImage}
            style={[styles.iconBtn, { opacity: sendingImage ? 0.5 : 1 }]}
          >
            {sendingImage ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.brandPrimary} />
            )}
          </TouchableOpacity>
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
            disabled={!text.trim()}
            style={[styles.sendBtn, { backgroundColor: colors.brandPrimary }]}
            testID="chat-send-btn"
          >
            <Ionicons name="arrow-up" size={22} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      
      <ImageViewer
        visible={viewerVisible}
        imageUrl={viewerImage}
        onClose={() => setViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

function Bubble({ msg, showAvatar, showName, onReply, onLongPress, onImagePress }: { 
  msg: Message; 
  showAvatar: boolean; 
  showName: boolean; 
  onReply: () => void; 
  onLongPress: () => void;
  onImagePress: (url: string) => void;
}) {
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
        onLongPress={onLongPress}
        delayLongPress={300}
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
        
        {msg.type === "image" && msg.mediaUrl ? (
          <TouchableOpacity onPress={() => onImagePress(msg.mediaUrl!)} activeOpacity={0.9}>
            <Image 
              source={{ uri: msg.mediaUrl }} 
              style={styles.messageImage}
              contentFit="cover"
            />
          </TouchableOpacity>
        ) : (
          <Text style={{ color: own ? colors.onBrandPrimary : colors.onSurface, fontSize: font.base, lineHeight: 20 }}>
            {msg.content}
          </Text>
        )}
        
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
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
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
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1, minHeight: 40, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
