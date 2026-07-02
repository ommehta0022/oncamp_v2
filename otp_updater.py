# -*- coding: utf-8 -*-
import os

file_path = r"d:\2026-06-30\oncampus-mobile-app\lib\features\auth\otp_login_screen.dart"

new_code = """import 'dart:ui';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/theme/app_theme.dart';

class OtpLoginScreen extends ConsumerStatefulWidget {
  const OtpLoginScreen({super.key});

  @override
  ConsumerState<OtpLoginScreen> createState() => _OtpLoginScreenState();
}

class _OtpLoginScreenState extends ConsumerState<OtpLoginScreen> {
  final _phone = TextEditingController(text: '+91');
  final _code = TextEditingController();
  
  bool _isLoading = false;
  bool _otpSent = false;
  String? _challengeId;
  String? _errorMessage;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (_phone.text.isEmpty) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post(
        '/v1/auth/otp/start',
        data: {'phone': _phone.text.trim()},
      );
      
      _challengeId = response.data['challengeId'];
      
      if (response.data['devCode'] != null) {
        _code.text = response.data['devCode'];
      }
      
      if (mounted) {
        setState(() {
          _isLoading = false;
          _otpSent = true;
        });
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Backend Error: ${e.response?.data ?? e.message}';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Error hitting backend: $e';
        });
      }
    }
  }

  Future<void> _verifyOtpCode() async {
    if (_challengeId == null) return;
    
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post(
        '/v1/auth/otp/verify',
        data: {
          'challengeId': _challengeId,
          'code': _code.text.trim(),
          'platform': kIsWeb ? 'web' : 'mobile',
        },
      );

      final tokens = response.data;
      await ref.read(tokenStoreProvider).save(
        accessToken: tokens['accessToken'],
        refreshToken: tokens['refreshToken'],
      );
      
      await ref.read(phase1RepositoryProvider).initUser();
      
      _completeLogin();
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Verification Failed: ${e.response?.data ?? e.message}';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Error: $e';
        });
      }
    }
  }

  void _completeLogin() {
    final user = ref.read(phase1RepositoryProvider).currentUser;
    if (mounted) {
      if (user == null || user.name == 'Unknown' || user.institution.isEmpty) {
        context.go('/profile-setup');
      } else {
        context.go('/discover'); 
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppTheme.blue, AppTheme.navy],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.2),
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Center(
                          child: Text(
                            'OnCampus',
                            style: theme.textTheme.headlineMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(height: 32),
                        if (_errorMessage != null) ...[
                          Text(
                            _errorMessage!,
                            style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                          ),
                          const SizedBox(height: 16),
                        ],
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 300),
                          child: !_otpSent
                              ? _buildPhoneInput()
                              : _buildOtpInput(),
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: AppTheme.blue,
                            ),
                            onPressed: _isLoading
                                ? null
                                : () {
                                    if (!_otpSent) {
                                      _sendOtp();
                                    } else {
                                      _verifyOtpCode();
                                    }
                                  },
                            child: _isLoading
                                ? const CircularProgressIndicator()
                                : Text(!_otpSent ? 'Send OTP' : 'Verify OTP'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhoneInput() {
    return Column(
      key: const ValueKey('phone_input'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Phone Number', style: TextStyle(color: Colors.white)),
        const SizedBox(height: 8),
        TextField(
          controller: _phone,
          keyboardType: TextInputType.phone,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white.withOpacity(0.1),
            prefixIcon: const Icon(Icons.phone, color: Colors.white70),
          ),
        ),
      ],
    );
  }

  Widget _buildOtpInput() {
    return Column(
      key: const ValueKey('otp_input'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Enter OTP sent to ${_phone.text}', style: const TextStyle(color: Colors.white)),
        const SizedBox(height: 8),
        TextField(
          controller: _code,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white, fontSize: 24, letterSpacing: 8),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white.withOpacity(0.1),
            hintText: '* * * * * *',
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), letterSpacing: 8),
          ),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: _isLoading ? null : () {
              setState(() {
                _otpSent = false;
                _code.clear();
              });
            },
            child: const Text('Change Number', style: TextStyle(color: Colors.white70)),
          ),
        )
      ],
    );
  }
}
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_code)

print("OTP login screen refactored for proper API integration.")
