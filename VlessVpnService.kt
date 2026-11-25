package __PACKAGE__

import android.app.Service
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import java.io.File

/**
 * Creates the TUN interface, starts Xray (libxray.so) as the proxy core and
 * tun2socks (libtun2socks.so) to pipe the TUN traffic into Xray's SOCKS inbound.
 * Both binaries are shipped as jniLibs so Android unpacks them into nativeLibraryDir.
 */
class VlessVpnService : VpnService() {

    companion object {
        const val ACTION_STOP = "__PACKAGE__.VLESS_STOP"
        const val SOCKS_PORT = 10808
        @Volatile var running = false
    }

    private var tun: ParcelFileDescriptor? = null
    private val procs = mutableListOf<Process>()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopVpn()
            stopSelf()
            return START_NOT_STICKY
        }
        val cfg = File(filesDir, "config.json")
        if (!cfg.exists()) {
            stopSelf()
            return START_NOT_STICKY
        }
        startVpn(cfg)
        return START_STICKY
    }

    private fun startVpn(cfg: File) {
        stopVpn()
        val builder = Builder()
            .setSession("VLESS VPN")
            .setMtu(1500)
            .addAddress("10.8.0.2", 24)
            .addRoute("0.0.0.0", 0)
            .addDnsServer("1.1.1.1")
            .addDnsServer("8.8.8.8")
        try {
            builder.addAddress("fd00:8::2", 126).addRoute("::", 0)
        } catch (_: Exception) {
        }
        // Keep the VPN app itself out of the tunnel so Xray's own connection is not looped back.
        try {
            builder.addDisallowedApplication(packageName)
        } catch (_: Exception) {
        }
        val fd = try {
            builder.establish()
        } catch (_: Exception) {
            null
        }
        if (fd == null) {
            stopSelf()
            return
        }
        tun = fd

        val libDir = applicationInfo.nativeLibraryDir
        try {
            val xray = ProcessBuilder(File(libDir, "libxray.so").absolutePath, "run", "-config", cfg.absolutePath)
                .redirectErrorStream(true)
                .redirectOutput(File(filesDir, "xray.log"))
                .start()
            procs.add(xray)

            // tun2socks reads the TUN fd through /proc/self/fd and forwards to Xray's SOCKS port.
            val t2s = ProcessBuilder(
                File(libDir, "libtun2socks.so").absolutePath,
                "-device", "fd://${fd.fd}",
                "-proxy", "socks5://127.0.0.1:$SOCKS_PORT",
                "-mtu", "1500",
                "-loglevel", "warning"
            ).redirectErrorStream(true)
                .redirectOutput(File(filesDir, "tun2socks.log"))
                .start()
            procs.add(t2s)
            running = true
        } catch (e: Exception) {
            stopVpn()
            stopSelf()
        }
    }

    private fun stopVpn() {
        procs.forEach { it.destroy() }
        procs.clear()
        try {
            tun?.close()
        } catch (_: Exception) {
        }
        tun = null
        running = false
    }

    override fun onRevoke() {
        stopVpn()
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }
}
