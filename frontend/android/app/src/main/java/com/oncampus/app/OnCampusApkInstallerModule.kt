package com.oncampus.app

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.security.MessageDigest
import kotlin.concurrent.thread

class OnCampusApkInstallerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

  companion object {
    private const val PREFS = "oncampus_native_update"
    private const val KEY_DOWNLOAD_ID = "download_id"
    private const val KEY_URL = "url"
    private const val KEY_SHA256 = "sha256"
    private const val KEY_VERIFIED = "verified"
    private const val APK_FILE_NAME = "OnCampus-update.apk"
  }

  private val prefs = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private val downloadManager = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  @Volatile private var hostResumed = false
  @Volatile private var monitoredDownloadId = -1L
  @Volatile private var verifying = false

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = "OnCampusApkInstaller"

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  @ReactMethod
  fun startInstall(url: String, sha256: String, promise: Promise) {
    if (!isTrustedApiUrl(url)) {
      promise.reject("UNTRUSTED_URL", "Update URL is not an approved OnCampus API URL")
      return
    }
    if (!sha256.matches(Regex("^[A-Fa-f0-9]{64}$"))) {
      promise.reject("INVALID_CHECKSUM", "Update checksum is invalid")
      return
    }

    try {
      startOrResumeSystemDownload(url, sha256.lowercase())
      promise.resolve(Arguments.createMap().apply { putString("status", "downloading") })
    } catch (error: Exception) {
      promise.reject("DOWNLOAD_START_FAILED", error.message ?: "Unable to start Android background download", error)
    }
  }

  private fun canInstallPackages(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || reactContext.packageManager.canRequestPackageInstalls()
  }

  private fun openUnknownSourcesSettings() {
    val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
        data = Uri.parse("package:${reactContext.packageName}")
      }
    } else {
      Intent(Settings.ACTION_SECURITY_SETTINGS)
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.runOnUiQueueThread {
      reactContext.startActivity(intent)
    }
  }

  private fun isTrustedApiUrl(value: String): Boolean {
    return try {
      val uri = Uri.parse(value)
      uri.scheme == "https" &&
        uri.host == "oncampus-backend-production.up.railway.app" &&
        uri.path == "/v1/updates/native/apk" &&
        !uri.getQueryParameter("version").isNullOrBlank()
    } catch (_: Exception) {
      false
    }
  }

  private fun updateFile(): File {
    val directory = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
      ?: throw IllegalStateException("Android download storage is unavailable")
    if (!directory.exists()) directory.mkdirs()
    return File(directory, APK_FILE_NAME)
  }

  private fun startOrResumeSystemDownload(url: String, expectedSha256: String) {
    val existingId = prefs.getLong(KEY_DOWNLOAD_ID, -1L)
    val existingUrl = prefs.getString(KEY_URL, null)
    val existingSha = prefs.getString(KEY_SHA256, null)

    if (existingId > 0L && existingUrl == url && existingSha == expectedSha256) {
      emit("downloading", currentProgress(existingId).coerceAtLeast(1), "Downloading OnCampus update", "Android is continuing the verified update download in the background.")
      monitorDownload(existingId)
      return
    }

    if (existingId > 0L) {
      runCatching { downloadManager.remove(existingId) }
    }

    val apkFile = updateFile()
    if (apkFile.exists()) apkFile.delete()

    val request = DownloadManager.Request(Uri.parse(url)).apply {
      setTitle("OnCampus update")
      setDescription("Downloading a verified OnCampus Android update")
      setMimeType("application/vnd.android.package-archive")
      setAllowedOverMetered(true)
      setAllowedOverRoaming(false)
      setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
      setDestinationInExternalFilesDir(reactContext, Environment.DIRECTORY_DOWNLOADS, APK_FILE_NAME)
      addRequestHeader("Accept", "application/vnd.android.package-archive, application/octet-stream")
      addRequestHeader("User-Agent", "OnCampus-Android-Updater/2.0")
    }

    val downloadId = downloadManager.enqueue(request)
    prefs.edit()
      .putLong(KEY_DOWNLOAD_ID, downloadId)
      .putString(KEY_URL, url)
      .putString(KEY_SHA256, expectedSha256)
      .putBoolean(KEY_VERIFIED, false)
      .apply()

    emit("downloading", 1, "Downloading OnCampus update", "Android DownloadManager will continue this transfer if you minimize OnCampus.")
    monitorDownload(downloadId)
  }

  private data class DownloadState(
    val status: Int,
    val downloaded: Long,
    val total: Long,
    val reason: Int,
  )

  private fun queryDownload(downloadId: Long): DownloadState? {
    val query = DownloadManager.Query().setFilterById(downloadId)
    downloadManager.query(query)?.use { cursor ->
      if (!cursor.moveToFirst()) return null
      val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      val downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
      val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
      val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
      return DownloadState(status, downloaded, total, reason)
    }
    return null
  }

  private fun currentProgress(downloadId: Long): Int {
    val state = queryDownload(downloadId) ?: return 1
    if (state.total <= 0L) return 1
    return ((state.downloaded * 84L) / state.total).toInt().coerceIn(1, 84)
  }

  private fun monitorDownload(downloadId: Long) {
    if (monitoredDownloadId == downloadId) return
    monitoredDownloadId = downloadId

    thread(name = "oncampus-download-monitor") {
      var lastProgress = -1
      try {
        while (true) {
          val state = queryDownload(downloadId)
          if (state == null) {
            clearPendingDownload(removeFile = true)
            emit("error", 0, "Update download unavailable", "Android could not find the background download. Start the update again.")
            return@thread
          }

          when (state.status) {
            DownloadManager.STATUS_SUCCESSFUL -> {
              verifyDownloadedApk(downloadId)
              return@thread
            }
            DownloadManager.STATUS_FAILED -> {
              clearPendingDownload(removeFile = true)
              emit("error", 0, "Update download failed", "Android DownloadManager stopped the transfer (reason ${state.reason}). Try again when your connection is stable.")
              return@thread
            }
            DownloadManager.STATUS_RUNNING,
            DownloadManager.STATUS_PAUSED,
            DownloadManager.STATUS_PENDING -> {
              val progress = if (state.total > 0L) {
                ((state.downloaded * 84L) / state.total).toInt().coerceIn(1, 84)
              } else 1
              if (progress != lastProgress) {
                lastProgress = progress
                emit("downloading", progress, "Downloading OnCampus update", "$progress% downloaded • safe to minimize OnCampus")
              }
            }
          }
          Thread.sleep(750)
        }
      } catch (error: Exception) {
        // Do not cancel the system-owned download when the React process or
        // monitor is interrupted. onHostResume queries DownloadManager again.
        if (hostResumed) {
          emit("downloading", currentProgress(downloadId).coerceAtLeast(1), "Download continuing", "Android is still managing the update download in the background.")
        }
      } finally {
        if (monitoredDownloadId == downloadId) monitoredDownloadId = -1L
      }
    }
  }

  private fun verifyDownloadedApk(downloadId: Long) {
    if (verifying) return
    verifying = true

    thread(name = "oncampus-apk-verify") {
      try {
        val expectedSha256 = prefs.getString(KEY_SHA256, null)
          ?: throw IllegalStateException("Update checksum metadata is missing")
        val apkFile = updateFile()
        if (!apkFile.exists() || apkFile.length() < 1024L * 1024L) {
          throw IllegalStateException("Downloaded APK is incomplete")
        }

        emit("verifying", 90, "Verifying update", "Checking the completed APK before Android can install it…")
        val actualSha256 = sha256(apkFile)
        if (!actualSha256.equals(expectedSha256, ignoreCase = true)) {
          runCatching { downloadManager.remove(downloadId) }
          apkFile.delete()
          throw SecurityException("APK checksum verification failed")
        }

        prefs.edit().putBoolean(KEY_VERIFIED, true).apply()
        emit("verifying", 100, "Update ready", "APK verified. Installation will open when OnCampus is active.")
        if (hostResumed) finishVerifiedInstall()
      } catch (error: Exception) {
        clearPendingDownload(removeFile = true)
        emit("error", 0, "Update verification failed", error.message ?: "Unable to verify the downloaded update")
      } finally {
        verifying = false
      }
    }
  }

  private fun finishVerifiedInstall() {
    if (!prefs.getBoolean(KEY_VERIFIED, false)) return
    val apkFile = runCatching { updateFile() }.getOrNull() ?: return
    if (!apkFile.exists()) {
      clearPendingDownload(removeFile = false)
      return
    }

    if (!canInstallPackages()) {
      emit("permission", 100, "Allow app installation", "The APK is already downloaded and verified. Enable Allow from this source; installation will continue when you return.")
      if (hostResumed) openUnknownSourcesSettings()
      return
    }

    if (!hostResumed) return
    emit("installing", 100, "Opening Android installer", "APK verified. Confirm Install on the Android system screen.")
    launchInstaller(apkFile)
    clearPendingMetadata()
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { input ->
      val buffer = ByteArray(64 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read <= 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun launchInstaller(apkFile: File) {
    val uri = FileProvider.getUriForFile(
      reactContext,
      "${reactContext.packageName}.apkprovider",
      apkFile
    )
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext.runOnUiQueueThread {
      reactContext.startActivity(intent)
    }
  }

  private fun clearPendingMetadata() {
    prefs.edit().clear().apply()
    monitoredDownloadId = -1L
  }

  private fun clearPendingDownload(removeFile: Boolean) {
    val downloadId = prefs.getLong(KEY_DOWNLOAD_ID, -1L)
    if (downloadId > 0L) runCatching { downloadManager.remove(downloadId) }
    clearPendingMetadata()
    if (removeFile) runCatching { updateFile().delete() }
  }

  private fun emit(phase: String, progress: Int, message: String, detail: String) {
    reactContext.runOnUiQueueThread {
      val event = Arguments.createMap().apply {
        putString("phase", phase)
        putInt("progress", progress)
        putString("message", message)
        putString("detail", detail)
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("OnCampusApkInstall", event)
    }
  }

  override fun onHostResume() {
    hostResumed = true
    if (prefs.getBoolean(KEY_VERIFIED, false)) {
      finishVerifiedInstall()
      return
    }

    val downloadId = prefs.getLong(KEY_DOWNLOAD_ID, -1L)
    if (downloadId <= 0L) return
    when (queryDownload(downloadId)?.status) {
      DownloadManager.STATUS_SUCCESSFUL -> verifyDownloadedApk(downloadId)
      DownloadManager.STATUS_FAILED -> {
        clearPendingDownload(removeFile = true)
        emit("error", 0, "Update download failed", "Android stopped the background transfer. Start the update again.")
      }
      else -> monitorDownload(downloadId)
    }
  }

  override fun onHostPause() {
    hostResumed = false
  }

  override fun onHostDestroy() {
    hostResumed = false
    // Intentionally do not remove DownloadManager work. Android owns the
    // transfer and the next app process resumes verification from SharedPreferences.
  }
}
