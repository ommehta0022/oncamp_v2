package com.oncampus.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import androidx.core.app.NotificationCompat
import java.io.File

object OnCampusInstallState {
  const val PREFS = "oncampus_native_update"
  const val KEY_DOWNLOAD_ID = "download_id"
  const val KEY_URL = "url"
  const val KEY_SHA256 = "sha256"
  const val KEY_VERIFIED = "verified"
  const val KEY_PERMISSION_PROMPTED = "permission_prompted"
  const val KEY_SESSION_ID = "package_installer_session_id"
  const val KEY_INSTALL_STATE = "package_install_state"
  const val KEY_INSTALL_MESSAGE = "package_install_message"
  const val KEY_HOST_ACTIVE = "host_active"
  const val KEY_TARGET_VERSION = "target_version"
  const val APK_FILE_NAME = "OnCampus-update.apk"
  const val ACTION_INSTALL_STATUS = "com.oncampus.app.PACKAGE_INSTALL_STATUS"
  const val CHANNEL_ID = "oncampus_app_updates"
  const val INSTALL_NOTIFICATION_ID = 6018
  const val RESULT_NOTIFICATION_ID = 6019

  fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun updateFile(context: Context): File {
    val directory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
      ?: throw IllegalStateException("Android download storage is unavailable")
    if (!directory.exists()) directory.mkdirs()
    return File(directory, APK_FILE_NAME)
  }

  fun ensureNotificationChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
      CHANNEL_ID,
      "OnCampus app updates",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Download and installation status for OnCampus updates"
    }
    manager.createNotificationChannel(channel)
  }

  fun appLaunchIntent(context: Context): Intent? {
    return context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
  }

  fun activityPendingIntent(context: Context, requestCode: Int, intent: Intent): PendingIntent {
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun notify(context: Context, id: Int, title: String, text: String, action: PendingIntent? = null) {
    ensureNotificationChannel(context)
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .apply { if (action != null) setContentIntent(action) }
      .build()
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(id, notification)
  }

  fun cancelInstallNotification(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.cancel(INSTALL_NOTIFICATION_ID)
  }
}
