package __PACKAGE__

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class VlessVpnModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx), ActivityEventListener {

    private var pending: Promise? = null

    init {
        ctx.addActivityEventListener(this)
    }

    override fun getName() = "VlessVpn"

    @ReactMethod
    fun start(configJson: String, promise: Promise) {
        File(ctx.filesDir, "config.json").writeText(configJson)
        val act = ctx.currentActivity
        if (act == null) {
            promise.reject("NO_ACTIVITY", "No foreground activity")
            return
        }
        val prep = VpnService.prepare(act)
        if (prep == null) {
            launch()
            promise.resolve(true)
        } else {
            pending = promise
            act.startActivityForResult(prep, REQ_VPN)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        val i = Intent(ctx, VlessVpnService::class.java).setAction(VlessVpnService.ACTION_STOP)
        ctx.startService(i)
        promise.resolve(true)
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(VlessVpnService.running)
    }

    @ReactMethod
    fun loadPrefs(promise: Promise) {
        promise.resolve(ctx.getSharedPreferences("vless", 0).getString("state", null))
    }

    @ReactMethod
    fun savePrefs(json: String) {
        ctx.getSharedPreferences("vless", 0).edit().putString("state", json).apply()
    }

    private fun launch() {
        ctx.startService(Intent(ctx, VlessVpnService::class.java))
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQ_VPN) return
        val p = pending
        pending = null
        if (resultCode == Activity.RESULT_OK) {
            launch()
            p?.resolve(true)
        } else {
            p?.reject("DENIED", "VPN permission denied")
        }
    }

    override fun onNewIntent(intent: Intent) {}

    companion object {
        private const val REQ_VPN = 7002
    }
}
