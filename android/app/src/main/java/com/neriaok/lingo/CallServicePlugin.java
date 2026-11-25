package com.neriaok.lingo;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS bridge for the call service:
 *   CallService.start({ title, text, muted, muteLabel, unmuteLabel, hangupLabel })  (call again to update)
 *   CallService.stop()
 *   CallService.addListener('action', ({ action }) => ...)   // 'mute' | 'hangup' from the notification
 */
@CapacitorPlugin(name = "CallService")
public class CallServicePlugin extends Plugin {
    private static CallServicePlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    static void emit(String action) {
        if (instance != null) {
            instance.notifyListeners("action", new JSObject().put("action", action), true);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            // The service runs either way; this permission makes its notification and buttons visible.
            ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, 4712);
        }
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Microphone permission not granted yet");
            return;
        }
        Intent intent = new Intent(getContext(), CallService.class);
        intent.putExtra("title", call.getString("title", "Lingo"));
        intent.putExtra("text", call.getString("text", ""));
        intent.putExtra("muted", Boolean.TRUE.equals(call.getBoolean("muted", false)));
        intent.putExtra("muteLabel", call.getString("muteLabel", "Mute"));
        intent.putExtra("unmuteLabel", call.getString("unmuteLabel", "Unmute"));
        intent.putExtra("hangupLabel", call.getString("hangupLabel", "End"));
        try {
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve(new JSObject().put("running", true));
        } catch (Exception e) {
            call.reject("Could not start call service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), CallService.class));
        call.resolve(new JSObject().put("running", false));
    }
}
