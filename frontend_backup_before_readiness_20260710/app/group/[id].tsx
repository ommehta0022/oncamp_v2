import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Alert,
  Animated,
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
import ReportModal from "@/src/components/ReportModal";
import TypingIndicator from "@/src/components/TypingIndicator";
import ForwardModal from "@/src/components/ForwardModal";
import { useRole } from "@/src/context/RoleProvider";
import { api, GroupDto } from "@/src/lib/api";
import { showImagePicker, uploadMessageMedia } from "@/src/lib/imageUpload";
import { typography } from "@/src/theme/typography";
import { LinearGradient } from "expo-linear-gradient";

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
  dateString?: string;
};

function normalizeMessage(row: any, groupId: string, currentUserId?: string): Message {
  const d = row.created_at ? new Date(row.created_at) : new Date();
  
  let replyTo = undefined;
  if (row.replyTo) replyTo = row.replyTo;
  else if (row.reply_to) {
    replyTo = {
      id: row.reply_to.id,
      senderName: row.reply_to.senderName || row.reply_to.users?.name || "Member",
      content: row.reply_to.content,
    };
  }

  return {
    id: row.id,
    groupId,
    senderId: row.sender_id || row.senderId,
    senderName: row.users?.name || row.senderName || "Member",
    senderAvatar: row.senderAvatar || "",
    content: row.content || "",
    type: row.type || "text",
    mediaUrl: row.mediaUrl || row.media_url,
    createdAt: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    dateString: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    own: row.own || row.sender_id === currentUserId,
    status: "sent",
    replyTo,
  };
}

export default function GroupChat() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useRole();
  const { showActionSheetWithOptions } = useActionSheet();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<GroupDto | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("Someone");

  useEffect(() => {
    if (!id) return;
    api.groups.get(id).then(setGroup).catch(() => setGroup(null));
    api.groups.messages(id)
      .then((rows: any) => {
        if (Array.isArray(rows)) setMessages(rows.reverse().map((row) => normalizeMessage(row, id, user?.id)));
      })
      .catch(() => {});
      
    const typingInterval = setInterval(() => {
      setIsTyping(Math.random() > 0.85); // 15% chance someone is typing for demo
    }, 8000);
    return () => clearInterval(typingInterval);
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
        replyToId: replyTo?.id,
        clientMessageId: `client-${Date.now()}`,
      });
      setReplyTo(null);
      setMessages((m) => [...m, normalizeMessage(saved, id!, user?.id)]);
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      Alert.alert("Error", "Failed to send image");
    } finally {
      setSendingImage(false);
    }
  };

  const handleLongPress = (message: Message) => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isOwn = message.senderId === user?.id;
    const options = [
      "Reply",
      "Forward",
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
          case "Forward":
            setForwardMessage(message);
            break;
          case "Copy Text":
            await Clipboard.setStringAsync(message.content);
            if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            break;
          case "Delete":
            Alert.alert("Delete Message", "Are you sure?", [
              { text: "Cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await api.groups.deleteMessage(message.id);
                    setMessages((m) => m.filter((msg) => msg.id !== message.id));
                  } catch {
                    Alert.alert("Error", "Failed to delete message");
                  }
                },
              },
            ]);
            break;
          case "Report":
            setReportMessageId(message.id);
            break;
        }
      }
    );
  };

  const handleReport = async (reason: string, details: string) => {
    if (!reportMessageId) return;
    await api.reports.reportMessage(reportMessageId, { reason, details });
  };
  
  const handleForward = async (targetGroupId: string) => {
    if (!forwardMessage) return;
    await api.groups.sendMessage(targetGroupId, {
      content: forwardMessage.content,
      type: forwardMessage.type,
      mediaUrl: forwardMessage.mediaUrl,
      clientMessageId: `client-fwd-${Date.now()}`,
    });
    if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Sent", "Message forwarded successfully.");
  };

  const openImage = (url: string) => {
    setViewerImage(url);
    setViewerVisible(true);
  };

  const send = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    const replyRef = replyTo;
    setReplyTo(null);
    try {
      const saved = await api.groups.sendMessage(id!, {
        content,
        type: "text",
        replyToId: replyRef?.id,
        clientMessageId: `client-${Date.now()}`,
      });
      setMessages((m) => [...m, normalizeMessage(saved, id!, user?.id)]);
      if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      setText(content);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || colors.chatBg }} edges={["top"]} testID="group-chat-screen">
      <View style={[styles.header, { backgroundColor: colors.background || colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={15} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary || colors.onSurface} />
        </Pressable>
        <Pressable
          onPress={() => router.push(`/group/info/${group.id}`)}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
        >
          <Avatar uri={group.avatarUrl} name={group.name} size={42} verified={group.official} />
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={{ color: colors.textPrimary || colors.onSurface, fontWeight: "700", letterSpacing: -0.3 }} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontWeight: "500", marginTop: 1 }} numberOfLines={1}>
              {(group.memberCount || 0).toLocaleString()} members
            </Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push(`/group/search/${group.id}`)}
            testID="chat-search-btn"
          >
            <Ionicons name="search" size={22} color={colors.textPrimary || colors.onSurface} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push(`/group/info/${group.id}`)}
            testID="chat-info-btn"
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.textPrimary || colors.onSurface} />
          </Pressable>
        </View>
      </View>

      {pinned && (
        <View style={[styles.pinnedBar, { backgroundColor: colors.surfaceSecondary || colors.surface }]}>
          <View style={{ width: 4, height: 36, backgroundColor: colors.brandPrimary, borderRadius: 2 }} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={{ color: colors.brandPrimary, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" }}>Pinned Message</Text>
            <Text style={{ color: colors.textPrimary || colors.onSurface, marginTop: 2, ...typography.body }} numberOfLines={1}>
              {pinned.content}
            </Text>
          </View>
          <Ionicons name="pin" size={18} color={colors.brandPrimary} />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList 
          showsVerticalScrollIndicator={false}
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const showDate = !prev || prev.dateString !== item.dateString;
            const showAvatar = !item.own && (!prev || prev.senderId !== item.senderId || showDate);
            const showName = !item.own && (!prev || prev.senderId !== item.senderId || showDate);
            const isLastInGroup = !next || next.senderId !== item.senderId || next.dateString !== item.dateString;
            
            return (
              <View>
                {showDate && item.dateString && (
                  <View style={styles.dateSeparator}>
                    <View style={[styles.dateBubble, { backgroundColor: colors.surfaceTertiary }]}>
                      <Text style={{ color: colors.onSurfaceTertiary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {item.dateString}
                      </Text>
                    </View>
                  </View>
                )}
                <Bubble 
                  msg={item} 
                  showAvatar={showAvatar} 
                  showName={showName} 
                  isLastInGroup={isLastInGroup}
                  onReply={() => setReplyTo(item)} 
                  onLongPress={() => handleLongPress(item)} 
                  onImagePress={openImage} 
                />
              </View>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 4 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState icon="chatbubble-outline" title="Say Hello 👋" message="Start the conversation in this group." />
          }
          ListFooterComponent={
            isTyping ? (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ color: colors.textSecondary || colors.muted, marginLeft: spacing.lg, marginBottom: 2, fontWeight: "500" }}>
                  {typingUser} is typing...
                </Text>
                <TypingIndicator />
              </View>
            ) : null
          }
        />

        {replyTo && (
          <View style={[styles.replyPreview, { backgroundColor: colors.surfaceSecondary || colors.surfaceTertiary }]}>
            <View style={{ width: 4, height: 36, backgroundColor: colors.brandSecondary, borderRadius: 2 }} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={{ color: colors.brandSecondary, fontWeight: "700" }}>
                Replying to {replyTo.senderName}
              </Text>
              <Text style={{ color: colors.textSecondary || colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 }} numberOfLines={1}>
                {replyTo.content}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={15} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={24} color={colors.textSecondary || colors.onSurfaceTertiary} />
            </Pressable>
          </View>
        )}

        <View style={[
          styles.composer, 
          { 
            backgroundColor: colors.background || colors.surface, 
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, spacing.sm) : spacing.sm 
          }
        ]}>
          <TouchableOpacity 
            onPress={handleImagePick} 
            disabled={sendingImage}
            style={[styles.attachBtn, { opacity: sendingImage ? 0.5 : 1, backgroundColor: colors.surfaceTertiary || "#eee" }]}
          >
            {sendingImage ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : (
              <Ionicons name="add" size={24} color={colors.brandPrimary} />
            )}
          </TouchableOpacity>
          
          <View style={[styles.inputWrap, { backgroundColor: colors.surfaceTertiary || "#eee", borderColor: "transparent" }]}>
            <TextInput
              testID="chat-input"
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              multiline
              style={{ flex: 1, color: colors.textPrimary || colors.onSurface, maxHeight: 120, paddingTop: Platform.OS === 'ios' ? 10 : 8, paddingBottom: Platform.OS === 'ios' ? 10 : 8 }}
            />
          </View>
          
          <Animated.View style={{ transform: [{ scale: text.trim() ? 1 : 0.8 }], opacity: text.trim() ? 1 : 0.5 }}>
            <Pressable
              onPress={send}
              disabled={!text.trim()}
            >
              <LinearGradient
                colors={[colors.brandPrimary || "#2E5C4E", colors.brandSecondary || "#1a362d"]}
                style={styles.sendBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="arrow-up" size={20} color="#fff" style={{ marginTop: -1 }} />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      
      <ImageViewer
        visible={viewerVisible}
        imageUrl={viewerImage}
        onClose={() => setViewerVisible(false)}
      />

      <ReportModal
        visible={!!reportMessageId}
        onClose={() => setReportMessageId(null)}
        onSubmit={handleReport}
        title="Report Message"
      />
      
      <ForwardModal
        visible={!!forwardMessage}
        messageContent={forwardMessage?.content || null}
        onClose={() => setForwardMessage(null)}
        onForward={handleForward}
      />
    </SafeAreaView>
  );
}

function Bubble({ msg, showAvatar, showName, isLastInGroup, onReply, onLongPress, onImagePress }: { 
  msg: Message; 
  showAvatar: boolean; 
  showName: boolean; 
  isLastInGroup: boolean;
  onReply: () => void; 
  onLongPress: () => void;
  onImagePress: (url: string) => void;
}) {
  const { colors } = useTheme();
  const own = msg.own;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <View style={{ 
      flexDirection: "row", 
      justifyContent: own ? "flex-end" : "flex-start", 
      alignItems: "flex-end", 
      gap: 6, 
      marginTop: showName ? spacing.md : 2,
      marginBottom: isLastInGroup ? spacing.xs : 0
    }}>
      {!own && (
        <View style={{ width: 28, alignItems: "center" }}>
          {showAvatar && <Avatar uri={msg.senderAvatar} name={msg.senderName} size={28} />}
        </View>
      )}
      <Pressable
        onLongPress={onLongPress}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        delayLongPress={250}
        style={{ maxWidth: "78%" }}
      >
        <Animated.View
          style={[
            styles.bubble,
            {
              backgroundColor: own ? colors.brandPrimary : colors.surfaceSecondary || "#f0f0f0",
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              borderBottomLeftRadius: own ? radius.lg : (isLastInGroup ? 4 : radius.lg),
              borderBottomRightRadius: own ? (isLastInGroup ? 4 : radius.lg) : radius.lg,
              transform: [{ scale: scaleAnim }],
              ...(own ? {
                shadowColor: colors.brandPrimary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2,
              } : {}),
            },
          ]}
        >
          {showName && !own && (
            <Text style={{ color: colors.brandPrimary, fontWeight: "700", marginBottom: 4, letterSpacing: -0.2 }}>
              {msg.senderName}
            </Text>
          )}
          
          {msg.replyTo && (
            <View style={[
              styles.replyQuote, 
              { 
                backgroundColor: own ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.05)", 
                borderLeftColor: own ? "#fff" : colors.brandSecondary 
              }
            ]}>
              <Text style={{ color: own ? "#fff" : colors.brandSecondary, fontWeight: "700", marginBottom: 2 }}>
                {msg.replyTo.senderName}
              </Text>
              <Text style={{ color: own ? "rgba(255,255,255,0.9)" : colors.textSecondary || colors.onSurfaceTertiary, fontSize: 13 }} numberOfLines={2}>
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
            <Text style={{ color: own ? "#fff" : colors.textPrimary || colors.onSurface, ...typography.body }}>
              {msg.content}
            </Text>
          )}
          
          <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-end", marginTop: 4, gap: 4 }}>
            <Text style={{ color: own ? "rgba(255,255,255,0.7)" : colors.muted, fontWeight: "500" }}>{msg.createdAt}</Text>
            {own && (
              <Ionicons
                name={msg.status === "read" ? "checkmark-done" : "checkmark"}
                size={14}
                color={msg.status === "read" ? "#6ee7b7" : "rgba(255,255,255,0.7)"}
              />
            )}
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 64,
  },
  backBtn: {
    marginRight: 4,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pinnedBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 1,
  },
  bubble: {
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.lg,
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  replyQuote: {
    borderLeftWidth: 3, paddingLeft: spacing.sm, paddingVertical: 6,
    borderRadius: 6, marginBottom: spacing.sm, paddingRight: spacing.sm,
  },
  replyPreview: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composer: {
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachBtn: { 
    width: 38, height: 38, borderRadius: 19, 
    alignItems: "center", justifyContent: "center",
    marginBottom: 4
  },
  inputWrap: {
    flex: 1, minHeight: 40, borderRadius: 20,
    paddingHorizontal: spacing.md,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1,
    marginBottom: 4
  },
  sendBtn: { 
    width: 38, height: 38, borderRadius: 19, 
    alignItems: "center", justifyContent: "center",
    marginBottom: 4
  },
  dateSeparator: {
    alignItems: "center", marginVertical: spacing.md,
  },
  dateBubble: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill,
  },
});
