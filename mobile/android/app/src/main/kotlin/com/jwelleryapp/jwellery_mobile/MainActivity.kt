package com.jwelleryapp.jwellery_mobile

import android.content.ContentValues
import android.media.AudioManager
import android.media.MediaScannerConnection
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream

class MainActivity : FlutterActivity() {
    private val storageChannelName = "sales_report_pdf_storage"
    private val feedbackChannelName = "scan_session_feedback"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, storageChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "savePdfToDownloads" -> {
                        try {
                            val bytes = call.argument<ByteArray>("bytes")
                            val fileName = call.argument<String>("fileName")
                            if (bytes == null || fileName.isNullOrBlank()) {
                                result.error("INVALID_ARGUMENT", "Missing PDF bytes or file name", null)
                                return@setMethodCallHandler
                            }

                            val savedLocation = savePdfToDownloads(bytes, fileName)
                            result.success(savedLocation)
                        } catch (error: Exception) {
                            result.error("SAVE_FAILED", error.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, feedbackChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "playSuccessTone" -> {
                        try {
                            playSuccessTone()
                            result.success(null)
                        } catch (error: Exception) {
                            result.error("TONE_FAILED", error.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun playSuccessTone() {
        val notificationUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val ringtone = if (notificationUri != null) {
            RingtoneManager.getRingtone(applicationContext, notificationUri)
        } else {
            null
        }

        if (ringtone != null) {
            ringtone.play()
            return
        }

        val toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
        toneGenerator.startTone(ToneGenerator.TONE_PROP_ACK, 180)
        toneGenerator.release()
    }

    private fun savePdfToDownloads(bytes: ByteArray, fileName: String): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val relativePath = Environment.DIRECTORY_DOWNLOADS
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }

            val resolver = contentResolver
            val uri = resolver.insert(
                MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
                values,
            ) ?: throw IllegalStateException("Unable to create download entry")

            resolver.openOutputStream(uri)?.use { output ->
                output.write(bytes)
                output.flush()
            } ?: throw IllegalStateException("Unable to open output stream")

            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            uri.toString()
        } else {
            val downloadsRoot = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsRoot.exists()) {
                downloadsRoot.mkdirs()
            }
            val file = File(downloadsRoot, fileName)
            FileOutputStream(file).use { output ->
                output.write(bytes)
                output.flush()
            }
            MediaScannerConnection.scanFile(
                this,
                arrayOf(file.absolutePath),
                arrayOf("application/pdf"),
                null,
            )
            file.absolutePath
        }
    }
}




