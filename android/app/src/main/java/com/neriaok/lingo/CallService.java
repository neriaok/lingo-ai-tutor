package com.neriaok.lingo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that keeps the microphone and audio alive while a tutor call runs
 * in the background (Android blocks background mic access without it). Its ongoing
 * notification has Mute / End buttons that are forwarded to the web app.
 */
public class CallService extends Service {
    static final String CHANNEL_ID = "lingo_call";
    static final int NOTIFICATION_ID = 4711;
    static final String ACTION_MUTE = "com.neriaok.lingo.MUTE";
    static final String ACTION_HANGUP = "com.neriaok.lingo.HANGUP";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_MUTE.equals(action)) {
            CallServicePlugin.emit("mute");
            return START_NOT_STICKY;
        }
        if (ACTION_HANGUP.equals(action)) {
            CallServicePlugin.emit("hangup");
            return START_NOT_STICKY;
        }

        String title = extra(intent, "title", "Lingo");
        String text = extra(intent, "text", "");
        boolean muted = intent != null && intent.getBooleanExtra("muted", false);
        String muteLabel = extra(intent, muted ? "unmuteLabel" : "muteLabel", muted ? "Unmute" : "Mute");
        String hangupLabel = extra(intent, "hangupLabel", "End");

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Tutor calls", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shown while a call with your tutor is running");
            nm.createNotificationChannel(channel);
        }

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pi = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, open, pi);
        PendingIntent muteIntent = PendingIntent.getService(this, 1, new Intent(this, CallService.class).setAction(ACTION_MUTE), pi);
        PendingIntent hangupIntent = PendingIntent.getService(this, 2, new Intent(this, CallService.class).setAction(ACTION_HANGUP), pi);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(muted ? android.R.drawable.ic_lock_silent_mode : android.R.drawable.ic_btn_speak_now)
            .setContentIntent(contentIntent)
            .addAction(android.R.drawable.ic_lock_silent_mode, muteLabel, muteIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, hangupLabel, hangupIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE | ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_NOT_STICKY;
    }

    private static String extra(Intent intent, String key, String fallback) {
        String v = intent != null ? intent.getStringExtra(key) : null;
        return v != null ? v : fallback;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
