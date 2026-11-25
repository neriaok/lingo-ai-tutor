package com.neriaok.lingo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Shader;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

import java.io.InputStream;

/**
 * Foreground service that keeps the microphone and audio alive while a tutor call runs in the
 * background (Android blocks background mic access without it). Its notification uses the
 * system call style — tutor photo, running timer, red "End" and a "Mute" button — like a phone call.
 */
public class CallService extends Service {
    static final String CHANNEL_ID = "lingo_call_v2";
    static final int NOTIFICATION_ID = 4711;
    static final String ACTION_MUTE = "com.neriaok.lingo.MUTE";
    static final String ACTION_HANGUP = "com.neriaok.lingo.HANGUP";

    private long startedAt = 0;
    private String avatarFor = null;
    private Bitmap avatar = null;

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
        String tutor = extra(intent, "tutor", "maya");
        boolean muted = intent != null && intent.getBooleanExtra("muted", false);
        String muteLabel = extra(intent, muted ? "unmuteLabel" : "muteLabel", muted ? "Unmute" : "Mute");
        String hangupLabel = extra(intent, "hangupLabel", "End");
        if (startedAt == 0) startedAt = System.currentTimeMillis();

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Tutor calls", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Shown while a call with your tutor is running");
            channel.setSound(null, null);
            channel.enableVibration(false);
            nm.createNotificationChannel(channel);
        }

        int pi = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, open, pi);
        PendingIntent muteIntent = PendingIntent.getService(this, 1, new Intent(this, CallService.class).setAction(ACTION_MUTE), pi);
        PendingIntent hangupIntent = PendingIntent.getService(this, 2, new Intent(this, CallService.class).setAction(ACTION_HANGUP), pi);

        Person.Builder caller = new Person.Builder().setName(title).setImportant(true);
        Bitmap photo = loadAvatar(tutor);
        if (photo != null) caller.setIcon(IconCompat.createWithBitmap(photo));

        NotificationCompat.Action muteAction = new NotificationCompat.Action.Builder(
            IconCompat.createWithResource(this, muted ? android.R.drawable.ic_lock_silent_mode : android.R.drawable.ic_btn_speak_now),
            muteLabel,
            muteIntent
        ).build();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(contentIntent)
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(caller.build(), hangupIntent))
            .addAction(muteAction)
            .setUsesChronometer(true)
            .setWhen(startedAt)
            .setShowWhen(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH);
        if (photo != null) builder.setLargeIcon(photo);
        // Hang-up label is set by the system ("End call" / localized), kept here for older Android versions.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, hangupLabel, hangupIntent);
        }
        Notification notification = builder.build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE | ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        return START_NOT_STICKY;
    }

    /** The tutor's portrait ships with the app's web assets; cropped to a circle for the call card. */
    private Bitmap loadAvatar(String tutor) {
        if (tutor.equals(avatarFor) && avatar != null) return avatar;
        try (InputStream in = getAssets().open("public/avatars/" + tutor + "-poster.jpg")) {
            Bitmap src = BitmapFactory.decodeStream(in);
            if (src == null) return null;
            int size = Math.min(src.getWidth(), src.getHeight());
            int top = Math.max(0, (int) (src.getHeight() * 0.08));
            Bitmap square = Bitmap.createBitmap(src, (src.getWidth() - size) / 2, Math.min(top, src.getHeight() - size), size, size);
            Bitmap out = Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(out);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            Bitmap scaled = Bitmap.createScaledBitmap(square, 256, 256, true);
            paint.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            canvas.drawCircle(128, 128, 128, paint);
            avatar = out;
            avatarFor = tutor;
            return out;
        } catch (Exception e) {
            return null;
        }
    }

    private static String extra(Intent intent, String key, String fallback) {
        String v = intent != null ? intent.getStringExtra(key) : null;
        return v != null ? v : fallback;
    }

    @Override
    public void onDestroy() {
        startedAt = 0;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
