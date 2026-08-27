package com.oncampus.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process

/**
 * Runs in a tiny, isolated process so a downloaded Expo update can be activated
 * with a real cold start instead of tearing down the New Architecture runtime
 * in-process. The main process starts this activity, then exits; this process
 * relaunches the normal launcher activity after the old process is gone.
 */
class OnCampusOtaRestartActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    Handler(Looper.getMainLooper()).postDelayed({
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
      if (launchIntent != null) {
        launchIntent.addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_CLEAR_TASK or
            Intent.FLAG_ACTIVITY_CLEAR_TOP
        )
        startActivity(launchIntent)
      }
      finishAndRemoveTask()
      Process.killProcess(Process.myPid())
    }, 450L)
  }
}
