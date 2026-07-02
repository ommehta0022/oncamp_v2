# -*- coding: utf-8 -*-
import os

repo_path = r"d:\2026-06-30\oncampus-mobile-app\lib\data\repositories\phase1_repository.dart"

with open(repo_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix messages mapping
old_msg = """      final newMsgs = (res.data as List).map((e) => GroupMessage(
        id: e['id'],
        groupId: e['group_id'],
        senderId: e['sender_id'],
        senderName: 'User',
        type: GroupMessageType.text,
        content: e['content'],
        createdAt: DateTime.parse(e['created_at']),
        clientMessageId: '',
      )).toList();"""
new_msg = """      final newMsgs = (res.data as List).map((e) => GroupMessage(
        id: e['id'],
        groupId: e['group_id'],
        senderId: e['sender_id'],
        senderName: (e['users'] as Map<String, dynamic>?)?['name'] ?? 'Unknown User',
        type: GroupMessageType.text,
        content: e['content'],
        createdAt: DateTime.parse(e['created_at']),
        clientMessageId: e['client_message_id'] ?? '',
      )).toList();"""
content = content.replace(old_msg, new_msg)

# Fix requests mapping
old_req = """      final newReqs = (res.data as List).map((e) => JoinRequest(
        id: e['id'],
        groupId: e['group_id'],
        userId: e['user_id'],
        userName: 'User',
        status: JoinRequestStatus.pending,
        requestedAt: DateTime.parse(e['created_at']),
      )).toList();"""
new_req = """      final newReqs = (res.data as List).map((e) => JoinRequest(
        id: e['id'],
        groupId: e['group_id'],
        userId: e['user_id'],
        userName: (e['users'] as Map<String, dynamic>?)?['name'] ?? 'Unknown User',
        status: JoinRequestStatus.pending,
        requestedAt: DateTime.parse(e['created_at']),
      )).toList();"""
content = content.replace(old_req, new_req)

# Fix sendGroupMessage
old_send = """  void sendGroupMessage(String groupId, String content) async {
    try {
      final now = DateTime.now();
      final tempMsg = GroupMessage(
        id: 'temp_${now.microsecondsSinceEpoch}',
        groupId: groupId,
        senderId: currentUser?.id ?? '',
        senderName: currentUser?.name ?? 'Me',
        type: GroupMessageType.text,
        content: content,
        createdAt: now,
        clientMessageId: 'client_${now.microsecondsSinceEpoch}',
      );
      _messages.add(tempMsg);
      notifyListeners();

      await apiClient.post('/v1/groups/$groupId/messages', data: {'content': content});"""
new_send = """  void sendGroupMessage(String groupId, String content) async {
    try {
      final now = DateTime.now();
      final clientId = 'client_${now.microsecondsSinceEpoch}';
      final tempMsg = GroupMessage(
        id: 'temp_${now.microsecondsSinceEpoch}',
        groupId: groupId,
        senderId: currentUser?.id ?? '',
        senderName: currentUser?.name ?? 'Me',
        type: GroupMessageType.text,
        content: content,
        createdAt: now,
        clientMessageId: clientId,
      );
      _messages.add(tempMsg);
      notifyListeners();

      await apiClient.post('/v1/groups/$groupId/messages', data: {'content': content, 'clientMessageId': clientId});"""
content = content.replace(old_send, new_send)

with open(repo_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Frontend patched for real data relationships.")
