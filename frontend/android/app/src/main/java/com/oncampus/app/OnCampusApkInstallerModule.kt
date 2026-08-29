package com.oncampus.app

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Process
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
    private const val PREFS = "oncampus_native_update_v2"
    private const val KEY_DOWNLOAD_ID = "download_id"
    private const val KEY_URL = "url"
    private const val KEY_SHA256 = "sha256"
    private const val KEY_TARGET_VERSION = "target_version"
    private const val KEY_TARGET_VERSION_CODE = "target_version_code"
    private const val KEY_TRACE_ID = "trace_id"
    private const val KEY_VERIFIED = "verified"
    private const val KEY_PERMISSION_PROMPTED = "permission_prompted"
    private const val KEY_INSTALLER_LAUNCHED_AT = "installer_launched_at"
    private const val APK_FILE_NAME = "OnCampus-update-v2.apk"
    private const val TRUSTED_HOST = "oncampus-backend-production.up.railway.app"
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
  fun startInstall(
    url: String,
    sha256: String,
    targetVersionCode: Double,
    targetVersion: String,
    traceId: String,
    promise: Promise,
  ) {
    if (!isTrustedV2Url(url, targetVersion)) {
      promise.reject("UNTRUSTED_URL", "Update URL is not an approved OnCampus Update Engine v2 URL")
      return
    }
    if (!sha256.matches(Regex("^[A-Fa-f0-9]{64}$"))) {
      promise.reject("INVALID_CHECKSUM", "Update checksum is invalid")
      return
    }
    val expectedVersionCode = targetVersionCode.toLong()
    if (expectedVersionCode <= installedVersionCode()) {
      promise.reject("INVALID_VERSION", "Update versionCode must be higher than the installed app")
      return
    }
    if (!targetVersion.matches(Regex("^\\d+\\.\\d+\\.\\d+$"))) {
      promise.reject("INVALID_VERSION", "Update version is invalid")
      return
    }
    if (!traceId.matches(Regex("^[A-Za-z0-9._:-]{8,160}$"))) {
      promise.reject("INVALID_TRACE", "Update trace ID is invalid")
      return
    }

    try {
      prefs.edit().putBoolean(KEY_PERMISSION_PROMPTED, false).apply()
      startOrResumeSystemDownload(url, sha256.lowercase(), expectedVersionCode, targetVersion, traceId)
      promise.resolve(statusMap(if (prefs.getBoolean(KEY_VERIFIED, false)) "ready" else "downloading"))
    } catch (error: Exception) {
      promise.reject("DOWNLOAD_START_FAILED", error.message ?: "Unable to start Android background download", error)
    }
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    try {
      if (reconcileInstalledTarget()) {
        promise.resolve(statusMap("installed", 100))
        return
      }
      if (prefs.getBoolean(KEY_VERIFIED, false)) {
        promise.resolve(statusMap("ready", 100))
        return
      }
      val downloadId = prefs.getLong(KEY_DOWNLOAD_ID, -1L)
      if (downloadId <= 0L) {
        promise.resolve(statusMap("idle", 0))
        return
      }
      val state = queryDownload(downloadId)
      if (state == null) {
        clearPendingDownload(removeFile = true)
        promise.resolve(statusMap("idle", 0))
        return
      }
      when (state.status) {
        DownloadManager.STATUS_SUCCESSFUL -> {
          verifyDownloadedApk(downloadId)
          promise.resolve(statusMap("verifying", 100))
        }
        DownloadManager.STATUS_FAILED -> {
          val reason = state.reason
          clearPendingDownload(removeFile = true)
          promise.resolve(statusMap("error", 0).apply { putString("errorCode", "DOWNLOAD_$reason") })
        }
        else -> promise.resolve(statusMap("downloading", progressFor(state)).apply {
          if (state.downloaded >= 0L) putDouble("downloadedBytes", state.downloaded.toDouble())
          if (state.total > 0L) putDouble("totalBytes", state.total.toDouble())
        })
      }
    } catch (error: Exception) {
      promise.reject("STATUS_FAILED", error.message ?: "Unable to recover update status", error)
    }
  }

  // Kept only for backward JS compatibility. Update Engine v2 does not use
  // Expo's remote-update database or process restart path.
  @ReactMethod
  fun restartForOta(promise: Promise) {
    if (!hostResumed) {
      promise.reject("APP_NOT_ACTIVE", "OnCampus must be active to restart")
      return
    }
    val intent = Intent(reactContext, OnCampusOtaRestartActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
    }
    reactContext.runOnUiQueueThread {
      try {
        reactContext.startActivity(intent)
        promise.resolve(Arguments.createMap().apply { putString("status", "restarting") })
        Handler(Looper.getMainLooper()).postDelayed({ Process.killProcess(Process.myPid()) }, 180L)
      } catch (error: Exception) {
        promise.reject("OTA_RESTART_FAILED", error.message ?: "Unable to restart OnCampus", error)
      }
    }
  }

  private fun isTrustedV2Url(value: String, targetVersion: String): Boolean {
    return try {
      val uri = Uri.parse(value)
      uri.scheme == "https" &&
        uri.host == TRUSTED_HOST &&
        uri.query.isNullOrEmpty() &&
        uri.fragment.isNullOrEmpty() &&
        uri.path == "/v1/updates/v2/apk/$targetVersion"
    } catch (_: Exception) {
      false
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
    reactContext.runOnUiQueueThread { reactContext.startActivity(intent) }
  }

  private fun updateFile(): File {
    val directory = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
      ?: throw IllegalStateException("Android download storage is unavailable")
    if (!directory.exists()) directory.mkdirs()
    return File(directory, APK_FILE_NAME)
  }

  private fun startOrResumeSystemDownload(
    url: String,
    expectedSha256: String,
    expectedVersionCode: Long,
    targetVersion: String,
    traceId: String,
  ) {
    val existingId = prefs.getLong(KEY_DOWNLOAD_ID, -1L)
    val sameRelease = existingId > 0L &&
      prefs.getString(KEY_URL, null) == url &&
      prefs.getString(KEY_SHA256, null) == expectedSha256 &&
      prefs.getLong(KEY_TARGET_VERSION_CODE, -1L) == expectedVersionCode &&
      prefs.getString(KEY_TARGET_VERSION, null) == targetVersion

    if (sameRelease) {
      prefs.edit().putString(KEY_TRACE_ID, traceId).apply()
      if (prefs.getBoolean(KEY_VERIFIED, false)) {
        finishVerifiedInstall()
        return
      }
      val state = queryDownload(existingId)
      if (state?.status == DownloadManager.STATUS_FAILED || state == null) {
        clearPendingDownload(removeFile = true)
      } else {
        emit("downloading", progressFor(state), "Downloading OnCampus update", "Android is resuming the verified update transfer.", state.downloaded, state.total)
        monitorDownload(existingId)
        return
      }
    }

    if (existingId > 0L) runCatching { downloadManager.remove(existingId) }
    runCatching { updateFile().delete() }

    val request = DownloadManager.Request(Uri.parse(url)).apply {
      setTitle("OnCampus update $targetVersion")
      setDescription("Downloading a verified OnCampus Android update")
      setMimeType("application/vnd.android.package-archive")
      setAllowedOverMetered(true)
      setAllowedOverRoaming(false)
      setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
      setDestinationInExternalFilesDir(reactContext, Environment.DIRECTORY_DOWNLOADS, APK_FILE_NAME)
      addRequestHeader("Accept", "application/vnd.android.package-archive, application/octet-stream")
      addRequestHeader("User-Agent", "OnCampus-Android-UpdateEngine/2.0")
      addRequestHeader("X-OnCampus-Trace-Id", traceId)
    }

    val downloadId = downloadManager.enqueue(request)
    prefs.edit()
      .putLong(KEY_DOWNLOAD_ID, downloadId)
      .putString(KEY_URL, url)
      .putString(KEY_SHA256, expectedSha256)
      .putString(KEY_TARGET_VERSION, targetVersion)
      .putLong(KEY_TARGET_VERSION_CODE, expectedVersionCode)
      .putString(KEY_TRACE_ID, traceId)
      .putBoolean(KEY_VERIFIED, false)
      .putBoolean(KEY_PERMISSION_PROMPTED, false)
      .putLong(KEY_INSTALLER_LAUNCHED_AT, 0L)
      .apply()

    emit("downloading", 1, "Downloading OnCampus update", "Android DownloadManager owns this transfer and can resume it after network or process interruptions.")
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
      return DownloadState(
        cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)),
        cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)),
        cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)),
        cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)),
      )
    }
    return null
  }

  private fun progressFor(state: DownloadState?): Int {
    if (state == null || state.total <= 0L) return 1
    return ((state.downloaded * 100L) / state.total).toInt().coerceIn(1, 100)
  }

  private fun monitorDownload(downloadId: Long) {
    if (monitoredDownloadId == downloadId) return
    monitoredDownloadId = downloadId

    thread(name = "oncampus-v2-download-monitor") {
      var lastProgress = -1
      try {
        while (true) {
          val state = queryDownload(downloadId)
          if (state == null) {
            clearPendingDownload(removeFile = true)
            emit("error", 0, "Update download unavailable", "Android lost the background transfer record.", errorCode = "DOWNLOAD_MISSING")
            return@thread
          }

          when (state.status) {
            DownloadManager.STATUS_SUCCESSFUL -> {
              emit("download_complete", 100, "Download complete", "The APK transfer completed. OnCampus is verifying it before install.", state.downloaded, state.total)
              verifyDownloadedApk(downloadId)
              return@thread
            }
            DownloadManager.STATUS_FAILED -> {
              val reason = state.reason
              clearPendingDownload(removeFile = true)
              emit("error", 0, "Update download failed", "Android DownloadManager stopped the transfer (reason $reason).", state.downloaded, state.total, "DOWNLOAD_$reason")
              return@thread
            }
            DownloadManager.STATUS_RUNNING,
            DownloadManager.STATUS_PAUSED,
            DownloadManager.STATUS_PENDING -> {
              val progress = progressFor(state)
              if (progress != lastProgress) {
                lastProgress = progress
                emit("downloading", progress, "Downloading OnCampus update", "$progress% downloaded • safe to minimize OnCampus", state.downloaded, state.total)
              }
            }
          }
          Thread.sleep(750)
        }
      } catch (error: Exception) {
        if (hostResumed) {
          emit("downloading", progressFor(queryDownload(downloadId)), "Download continuing", "Android still owns the update transfer after the app monitor was interrupted.")
        }
      } finally {
        if (monitoredDownloadId == downloadId) monitoredDownloadId = -1L
      }
    }
  }

  private fun verifyDownloadedApk(downloadId: Long) {
    if (verifying) return
    verifying = true

    thread(name = "oncampus-v2-apk-verify") {
      try {
        val expectedSha256 = prefs.getString(KEY_SHA256, null)
          ?: throw IllegalStateException("Update checksum metadata is missing")
        val expectedVersionCode = prefs.getLong(KEY_TARGET_VERSION_CODE, -1L)
        if (expectedVersionCode <= installedVersionCode()) {
          throw SecurityException("Downloaded update is not newer than the installed app")
        }
        val apkFile = updateFile()
        if (!apkFile.exists() || apkFile.length() < 1024L * 1024L) {
          throw IllegalStateException("Downloaded APK is incomplete")
        }

        emit("verify_hash", 100, "Verifying update", "Checking SHA-256 integrity before inspecting the Android package…")
        val actualSha256 = sha256(apkFile)
        if (!actualSha256.equals(expectedSha256, ignoreCase = true)) {
          throw SecurityException("APK checksum verification failed")
        }

        emit("verify_package", 100, "Verifying Android package", "Checking package identity and versionCode…")
        val archive = archivePackageInfo(apkFile)
          ?: throw SecurityException("Android could not inspect the downloaded APK")
        if (archive.packageName != reactContext.packageName) {
          throw SecurityException("Downloaded APK package does not match OnCampus")
        }
        val archiveVersionCode = packageVersionCode(archive)
        if (archiveVersionCode != expectedVersionCode || archiveVersionCode <= installedVersionCode()) {
          throw SecurityException("Downloaded APK versionCode does not match the approved upgrade")
        }

        emit("verify_signature", 100, "Verifying app signature", "Checking that the update is signed by the same Android certificate as this installed app…")
        val installedCertificate = packageSigningCertificateSha256(installedPackageInfo())
        val archiveCertificate = packageSigningCertificateSha256(archive)
        if (installedCertificate.isBlank() || archiveCertificate.isBlank() || installedCertificate != archiveCertificate) {
          throw SecurityException("APK signing certificate does not match the installed OnCampus app")
        }

        prefs.edit()
          .putBoolean(KEY_VERIFIED, true)
          .putBoolean(KEY_PERMISSION_PROMPTED, false)
          .putLong(KEY_INSTALLER_LAUNCHED_AT, 0L)
          .apply()
        emit("ready", 100, "Update verified", "Hash, package, versionCode and signing certificate all passed. Android can now install it.")
        if (hostResumed) finishVerifiedInstall()
      } catch (error: Exception) {
        runCatching { downloadManager.remove(downloadId) }
        clearPendingDownload(removeFile = true)
        emit("error", 0, "Update verification failed", error.message ?: "Unable to verify the downloaded update", errorCode = "VERIFY_FAILED")
      } finally {
        verifying = false
      }
    }
  }

  private fun packageFlags(): Int = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
    PackageManager.GET_SIGNING_CERTIFICATES
  } else {
    @Suppress("DEPRECATION")
    PackageManager.GET_SIGNATURES
  }

  private fun archivePackageInfo(apkFile: File): PackageInfo? {
    val packageManager = reactContext.packageManager
    val flags = packageFlags()
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.getPackageArchiveInfo(apkFile.absolutePath, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageArchiveInfo(apkFile.absolutePath, flags)
    }
  }

  private fun installedPackageInfo(): PackageInfo {
    val packageManager = reactContext.packageManager
    val flags = packageFlags()
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.getPackageInfo(reactContext.packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageInfo(reactContext.packageName, flags)
    }
  }

  private fun packageVersionCode(info: PackageInfo): Long = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
    info.longVersionCode
  } else {
    @Suppress("DEPRECATION")
    info.versionCode.toLong()
  }

  private fun installedVersionCode(): Long = runCatching { packageVersionCode(installedPackageInfo()) }.getOrDefault(0L)

  private fun packageSigningCertificateSha256(info: PackageInfo): String {
    val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val signingInfo = info.signingInfo ?: return ""
      if (signingInfo.hasMultipleSigners()) signingInfo.apkContentsSigners else signingInfo.signingCertificateHistory
    } else {
      @Suppress("DEPRECATION")
      info.signatures
    }
    val certificate = signatures?.firstOrNull()?.toByteArray() ?: return ""
    return MessageDigest.getInstance("SHA-256").digest(certificate).joinToString("") { "%02x".format(it) }
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { input ->
      val buffer = ByteArray(256 * 1024)
      while (true) {
        val read = input.read(buffer)
        if (read <= 0) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun reconcileInstalledTarget(): Boolean {
    val expected = prefs.getLong(KEY_TARGET_VERSION_CODE, -1L)
    if (expected <= 0L || installedVersionCode() < expected) return false
    val targetVersion = prefs.getString(KEY_TARGET_VERSION, null)
    val traceId = prefs.getString(KEY_TRACE_ID, null)
    clearPendingDownload(removeFile = true)
    emit("installed", 100, "Update installed", "OnCampus $targetVersion is now installed.", targetVersion = targetVersion, traceId = traceId)
    return true
  }

  private fun finishVerifiedInstall() {
    if (!prefs.getBoolean(KEY_VERIFIED, false)) return
    if (reconcileInstalledTarget()) return
    val apkFile = runCatching { updateFile() }.getOrNull() ?: return
    if (!apkFile.exists()) {
      clearPendingDownload(removeFile = false)
      return
    }

    if (!canInstallPackages()) {
      emit("permission", 100, "Allow app installation", "The APK is already verified. Enable Allow from this source; installation can continue when you return.")
      val alreadyPrompted = prefs.getBoolean(KEY_PERMISSION_PROMPTED, false)
      if (hostResumed && !alreadyPrompted) {
        prefs.edit().putBoolean(KEY_PERMISSION_PROMPTED, true).apply()
        openUnknownSourcesSettings()
      }
      return
    }
    if (!hostResumed) return

    // If Android just returned from the package installer without upgrading,
    // do not trap the user in a reopen loop. Keep the verified APK and surface
    // a Ready state so they can explicitly try installation again.
    val lastLaunch = prefs.getLong(KEY_INSTALLER_LAUNCHED_AT, 0L)
    if (lastLaunch > 0L && System.currentTimeMillis() - lastLaunch < 4000L) {
      emit("ready", 100, "Update is still ready", "Android did not complete the installation. The verified APK is kept safely; tap Install update to try again.")
      return
    }

    launchInstaller(apkFile)
  }

  private fun launchInstaller(apkFile: File) {
    val uri = FileProvider.getUriForFile(
      reactContext,
      "${reactContext.packageName}.apkprovider",
      apkFile,
    )
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    if (intent.resolveActivity(reactContext.packageManager) == null) {
      emit("error", 100, "Android installer unavailable", "The APK is verified, but Android could not resolve its package installer.", errorCode = "INSTALLER_UNAVAILABLE")
      return
    }
    reactContext.runOnUiQueueThread {
      try {
        prefs.edit().putLong(KEY_INSTALLER_LAUNCHED_AT, System.currentTimeMillis()).apply()
        emit("installer_opened", 100, "Opening Android installer", "All OnCampus verification checks passed. Confirm Install on the Android system screen.")
        reactContext.startActivity(intent)
      } catch (error: Exception) {
        emit("error", 100, "Android installer could not open", error.message ?: "Return to OnCampus and try Install update again.", errorCode = "INSTALLER_OPEN_FAILED")
      }
    }
  }

  private fun statusMap(phase: String, progress: Int = -1) = Arguments.createMap().apply {
    putString("phase", phase)
    putString("traceId", prefs.getString(KEY_TRACE_ID, null))
    putString("targetVersion", prefs.getString(KEY_TARGET_VERSION, null))
    val code = prefs.getLong(KEY_TARGET_VERSION_CODE, -1L)
    if (code > 0L) putDouble("targetVersionCode", code.toDouble())
    if (progress >= 0) putInt("progress", progress)
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

  private fun emit(
    phase: String,
    progress: Int,
    message: String,
    detail: String,
    downloadedBytes: Long = -1L,
    totalBytes: Long = -1L,
    errorCode: String? = null,
    targetVersion: String? = prefs.getString(KEY_TARGET_VERSION, null),
    traceId: String? = prefs.getString(KEY_TRACE_ID, null),
  ) {
    reactContext.runOnUiQueueThread {
      val event = Arguments.createMap().apply {
        putString("phase", phase)
        putInt("progress", progress)
        putString("message", message)
        putString("detail", detail)
        putString("traceId", traceId)
        putString("targetVersion", targetVersion)
        if (errorCode != null) putString("errorCode", errorCode)
        if (downloadedBytes >= 0L) putDouble("downloadedBytes", downloadedBytes.toDouble())
        if (totalBytes > 0L) putDouble("totalBytes", totalBytes.toDouble())
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("OnCampusApkInstall", event)
    }
  }

  override fun onHostResume() {
    hostResumed = true
    if (reconcileInstalledTarget()) return
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
        emit("error", 0, "Update download failed", "Android stopped the background transfer. Start the update again.", errorCode = "DOWNLOAD_FAILED")
      }
      else -> monitorDownload(downloadId)
    }
  }

  override fun onHostPause() {
    hostResumed = false
  }

  override fun onHostDestroy() {
    hostResumed = false
    // DownloadManager owns in-progress work. SharedPreferences + getStatus()
    // recover the transfer after React or the entire app process is recreated.
  }
}
