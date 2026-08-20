package com.oncampus.app

import android.content.Intent
import android.net.Uri
import android.os.Build
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
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.concurrent.thread

class OnCampusApkInstallerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

  private var pendingUrl: String? = null
  private var pendingSha256: String? = null
  @Volatile private var downloading = false

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

    pendingUrl = url
    pendingSha256 = sha256.lowercase()

    if (!canInstallPackages()) {
      emit("permission", 0, "Allow app installation", "Enable Allow from this source for OnCampus. The download will continue when you return.")
      openUnknownSourcesSettings()
      promise.resolve(Arguments.createMap().apply { putString("status", "permission_required") })
      return
    }

    beginDownload(url, sha256.lowercase())
    promise.resolve(Arguments.createMap().apply { putString("status", "downloading") })
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

  private fun beginDownload(url: String, expectedSha256: String) {
    if (downloading) return
    downloading = true
    pendingUrl = null
    pendingSha256 = null

    thread(name = "oncampus-apk-update") {
      val updateDir = File(reactContext.cacheDir, "updates")
      val apkFile = File(updateDir, "OnCampus-update.apk")
      var connection: HttpURLConnection? = null
      try {
        updateDir.mkdirs()
        if (apkFile.exists()) apkFile.delete()

        emit("downloading", 1, "Downloading OnCampus update", "Downloading securely inside the app…")
        connection = (URL(url).openConnection() as HttpURLConnection).apply {
          connectTimeout = 15_000
          readTimeout = 45_000
          instanceFollowRedirects = true
          requestMethod = "GET"
          setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream")
          setRequestProperty("User-Agent", "OnCampus-Android-Updater/1.0")
        }
        connection.connect()
        if (connection.responseCode !in 200..299) {
          throw IllegalStateException("Update download failed with HTTP ${connection.responseCode}")
        }

        val total = connection.contentLengthLong
        var received = 0L
        var lastProgress = -1
        connection.inputStream.use { input ->
          apkFile.outputStream().buffered().use { output ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
              val read = input.read(buffer)
              if (read <= 0) break
              output.write(buffer, 0, read)
              received += read
              if (total > 0L) {
                val progress = ((received * 82L) / total).toInt().coerceIn(1, 82)
                if (progress != lastProgress) {
                  lastProgress = progress
                  emit("downloading", progress, "Downloading OnCampus update", "$progress% downloaded securely inside the app")
                }
              }
            }
            output.flush()
          }
        }

        if (!apkFile.exists() || apkFile.length() < 1024L * 1024L) {
          throw IllegalStateException("Downloaded APK is incomplete")
        }

        emit("verifying", 90, "Verifying update", "Checking APK integrity before installation…")
        val actualSha256 = sha256(apkFile)
        if (!actualSha256.equals(expectedSha256, ignoreCase = true)) {
          apkFile.delete()
          throw SecurityException("APK checksum verification failed")
        }

        emit("installing", 100, "Opening Android installer", "APK verified. Confirm Install on the Android system screen.")
        launchInstaller(apkFile)
      } catch (error: Exception) {
        if (apkFile.exists()) apkFile.delete()
        emit("error", 0, "Update installation failed", error.message ?: "Unable to install the update")
      } finally {
        connection?.disconnect()
        downloading = false
      }
    }
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
    val url = pendingUrl ?: return
    val checksum = pendingSha256 ?: return
    if (canInstallPackages() && !downloading) {
      beginDownload(url, checksum)
    }
  }

  override fun onHostPause() = Unit
  override fun onHostDestroy() = Unit
}
