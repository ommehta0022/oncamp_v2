import os

api_client_code = """import 'package:dio/dio.dart';
import '../security/token_store.dart';

class ApiClient {
  ApiClient({
    required String baseUrl,
    required this.tokenStore,
    String? deviceId,
  }) : _dio = Dio(
          BaseOptions(
            baseUrl: baseUrl,
            connectTimeout: const Duration(seconds: 12),
            receiveTimeout: const Duration(seconds: 20),
            headers: {
              if (deviceId != null) 'X-Device-Id': deviceId,
              'X-Client': 'oncampus-mobile',
            },
          ),
        ) {
          _dio.interceptors.add(InterceptorsWrapper(
            onRequest: (options, handler) async {
              final token = await tokenStore.accessToken();
              if (token != null) {
                options.headers['Authorization'] = 'Bearer $token';
              }
              handler.next(options);
            }
          ));
        }

  final Dio _dio;
  final TokenStore tokenStore;

  Future<Response<dynamic>> get(String path, {Map<String, dynamic>? query}) {
    return _dio.get(path, queryParameters: query);
  }

  Future<Response<dynamic>> post(
    String path, {
    Object? data,
    String? idempotencyKey,
  }) {
    return _dio.post(
      path,
      data: data,
      options: Options(headers: {
        if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
      }),
    );
  }

  Future<Response<dynamic>> patch(String path, {Object? data}) {
    return _dio.patch(path, data: data);
  }

  Future<Response<dynamic>> delete(String path) {
    return _dio.delete(path);
  }
}
"""

providers_code = """import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/network/api_client.dart';
import '../core/security/token_store.dart';
import '../core/updates/app_update_service.dart';
import '../data/repositories/phase1_repository.dart';

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage();
});

final tokenStoreProvider = Provider<TokenStore>((ref) {
  return TokenStore(ref.read(secureStorageProvider));
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    baseUrl: 'http://127.0.0.1:4000', // Localhost for dev
    tokenStore: ref.read(tokenStoreProvider),
  );
});

final phase1RepositoryProvider = ChangeNotifierProvider<Phase1Repository>((ref) {
  return Phase1Repository(ref.read(apiClientProvider));
});

final appUpdateServiceProvider = Provider<AppUpdateService>((ref) {
  return AppUpdateService();
});
"""

repo_code = """import 'package:flutter/foundation.dart';
import '../../core/network/api_client.dart';
import '../models/group.dart';
import '../models/group_message.dart';
import '../models/join_request.dart';
import '../models/notification_item.dart';
import '../models/user_profile.dart';

class Phase1Repository extends ChangeNotifier {
  Phase1Repository(this.apiClient);
  final ApiClient apiClient;

  UserProfile? currentUser;

  Future<void> initUser() async {
    try {
      final res = await apiClient.get('/v1/auth/me');
      currentUser = UserProfile(
        id: res.data['id'],
        name: res.data['name'] ?? 'Unknown',
        phone: '', // Not returned by me
        institution: res.data['institution'] ?? '',
        city: res.data['city'] ?? '',
        course: res.data['course'] ?? '',
        role: UserRole.student,
        verified: res.data['verified'] ?? false,
        badges: [],
      );
      notifyListeners();
    } catch (e) {
      currentUser = null;
      notifyListeners();
    }
  }

  Future<List<CampusGroup>> getJoinedGroups() async {
    try {
      final res = await apiClient.get('/v1/groups');
      return (res.data as List).map((e) => CampusGroup(
        id: e['id'],
        name: e['name'],
        institution: e['institution_id'] ?? '',
        city: e['city'],
        category: GroupCategory.values.firstWhere((c) => c.name == e['category'], orElse: () => GroupCategory.academic),
        visibility: GroupVisibility.public,
        joinPolicy: JoinPolicy.requestToJoin,
        memberCount: 1,
        onlineCount: 0,
        createdByUserId: '',
        currentUserRole: GroupMemberRole.member,
        isJoined: true,
        isChannel: false,
      )).toList();
    } catch (e) {
      return [];
    }
  }

  Future<List<CampusGroup>> discover({String? institution, String? city}) async {
    try {
      final res = await apiClient.get('/v1/discovery/groups', query: {
        if (institution != null) 'q': institution,
        if (city != null) 'city': city,
      });
      return (res.data['groups'] as List).map((e) => CampusGroup(
        id: e['id'],
        name: e['name'],
        institution: e['institution_id'] ?? '',
        city: e['city'],
        category: GroupCategory.values.firstWhere((c) => c.name == e['category'], orElse: () => GroupCategory.academic),
        visibility: GroupVisibility.public,
        joinPolicy: JoinPolicy.requestToJoin,
        memberCount: 1,
        onlineCount: 0,
        createdByUserId: '',
        currentUserRole: null,
        isJoined: false,
        isChannel: false,
      )).toList();
    } catch (e) {
      return [];
    }
  }

  Future<CampusGroup> groupById(String id) async {
    return (await discover()).firstWhere((g) => g.id == id);
  }

  Future<List<GroupMessage>> messagesFor(String groupId) async {
    try {
      final res = await apiClient.get('/v1/groups/$groupId/messages');
      return (res.data as List).map((e) => GroupMessage(
        id: e['id'],
        groupId: e['group_id'],
        senderId: e['sender_id'],
        senderName: 'User',
        type: GroupMessageType.text,
        content: e['content'],
        createdAt: DateTime.parse(e['created_at']),
        clientMessageId: '',
      )).toList();
    } catch (e) {
      return [];
    }
  }

  Future<List<JoinRequest>> pendingRequests(String groupId) async {
    try {
      final res = await apiClient.get('/v1/groups/$groupId/join-requests');
      return (res.data as List).map((e) => JoinRequest(
        id: e['id'],
        groupId: e['group_id'],
        userId: e['user_id'],
        userName: 'User',
        status: JoinRequestStatus.pending,
        requestedAt: DateTime.parse(e['created_at']),
      )).toList();
    } catch (e) {
      return [];
    }
  }

  Future<List<NotificationItem>> notifications() async {
    try {
      final res = await apiClient.get('/v1/notifications');
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> verifyOtp({required String phone, required String code}) async {
    throw UnimplementedError("Auth flows need refactoring");
  }

  Future<void> saveProfile({
    required String name,
    required String institution,
    required String city,
    required String course,
  }) async {
    await apiClient.patch('/v1/auth/me', data: {
      'name': name,
      'city': city,
      'course': course,
    });
    await initUser();
  }

  Future<void> createGroup({
    required String name,
    required String institution,
    required String city,
    required GroupCategory category,
    required JoinPolicy joinPolicy,
  }) async {
    await apiClient.post('/v1/groups', data: {
      'name': name,
      'institutionId': institution,
      'city': city,
      'category': category.name,
      'joinPolicy': joinPolicy.name,
    });
  }

  Future<void> requestToJoin(String groupId) async {
    await apiClient.post('/v1/groups/$groupId/join');
  }

  Future<void> leaveGroup(String groupId) async {
    await apiClient.post('/v1/groups/$groupId/leave');
  }

  Future<void> sendGroupMessage(String groupId, String content) async {
    await apiClient.post('/v1/groups/$groupId/messages', data: {'content': content});
  }

  Future<void> decideJoinRequest(String groupId, String requestId, JoinRequestStatus status) async {
    if (status == JoinRequestStatus.approved) {
      await apiClient.post('/v1/groups/$groupId/join-requests/$requestId/approve');
    } else {
      await apiClient.post('/v1/groups/$groupId/join-requests/$requestId/reject');
    }
  }
}
"""

with open(r"d:\2026-06-30\oncampus-mobile-app\lib\core\network\api_client.dart", "w", encoding="utf-8") as f:
    f.write(api_client_code)

with open(r"d:\2026-06-30\oncampus-mobile-app\lib\app\providers.dart", "w", encoding="utf-8") as f:
    f.write(providers_code)

with open(r"d:\2026-06-30\oncampus-mobile-app\lib\data\repositories\phase1_repository.dart", "w", encoding="utf-8") as f:
    f.write(repo_code)

print("Core networking and repository files updated.")
