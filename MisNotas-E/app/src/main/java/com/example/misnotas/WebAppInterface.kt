package com.example.misnotas

import android.content.Context
import android.content.SharedPreferences
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import kotlin.concurrent.thread

class WebAppInterface(private val context: Context, private val webView: WebView, private val activity: MainActivity) {

    private val prefs: SharedPreferences = context.getSharedPreferences("MisNotasPrefs", Context.MODE_PRIVATE)

    private fun getDataFile(): File {
        return File(context.filesDir, "app_data.json")
    }

    @JavascriptInterface
    fun getAppData(): String {
        val customDirUriStr = prefs.getString("custom_db_dir", null)
        if (customDirUriStr != null) {
            try {
                val treeUri = android.net.Uri.parse(customDirUriStr)
                val docTree = androidx.documentfile.provider.DocumentFile.fromTreeUri(context, treeUri)
                val fileDoc = docTree?.findFile("app_data.json")
                if (fileDoc != null && fileDoc.exists()) {
                    return context.contentResolver.openInputStream(fileDoc.uri)?.bufferedReader()?.use { it.readText() } ?: "[]"
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        
        val localFile = getDataFile()
        return if (localFile.exists()) {
            localFile.readText()
        } else {
            "[]"
        }
    }

    @JavascriptInterface
    fun saveAppData(json: String) {
        val customDirUriStr = prefs.getString("custom_db_dir", null)
        if (customDirUriStr != null) {
            try {
                val treeUri = android.net.Uri.parse(customDirUriStr)
                val docTree = androidx.documentfile.provider.DocumentFile.fromTreeUri(context, treeUri)
                var fileDoc = docTree?.findFile("app_data.json")
                if (fileDoc == null) {
                    fileDoc = docTree?.createFile("application/json", "app_data.json")
                }
                if (fileDoc != null) {
                    context.contentResolver.openOutputStream(fileDoc.uri, "w")?.use { output ->
                        output.write(json.toByteArray())
                    }
                    return
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        getDataFile().writeText(json)
    }

    @JavascriptInterface
    fun getUserConfig(): String {
        return prefs.getString("user_config", "{\"language\":\"es\",\"theme\":\"light\"}") ?: "{}"
    }

    @JavascriptInterface
    fun saveUserConfig(json: String) {
        prefs.edit().putString("user_config", json).apply()
    }

    @JavascriptInterface
    fun setStatusBarDarkIcons(darkIcons: Boolean) {
        activity.runOnUiThread {
            activity.setStatusBarIconColor(darkIcons)
        }
    }

    @JavascriptInterface
    fun getDbPath(): String {
        return prefs.getString("custom_db_dir", null) ?: "Memoria Interna (app_data.json)"
    }

    @JavascriptInterface
    fun changeDbPath(callbackId: String) {
        activity.runOnUiThread {
            activity.launchChangeDbDir(callbackId)
        }
    }

    @JavascriptInterface
    fun getImageDir(): String? {
        return prefs.getString("custom_image_dir", null)
    }

    @JavascriptInterface
    fun changeImageDir(callbackId: String) {
        activity.runOnUiThread {
            activity.launchChangeImageDir(callbackId)
        }
    }

    @JavascriptInterface
    fun selectImage(callbackId: String) {
        activity.launchImageSelection(callbackId)
    }

    @JavascriptInterface
    fun processImage(url: String, nbId: String, callbackId: String) {
        thread {
            try {
                val ext = url.substringAfterLast('.', "jpg").takeIf { it.length <= 4 } ?: "jpg"
                val filename = "img_${System.currentTimeMillis()}.$ext"
                
                val customDirUriStr = prefs.getString("custom_image_dir", null)
                var resultUrl = url
                
                if (customDirUriStr != null) {
                    val treeUri = android.net.Uri.parse(customDirUriStr)
                    val docTree = androidx.documentfile.provider.DocumentFile.fromTreeUri(context, treeUri)
                    val newFile = docTree?.createFile("image/$ext", filename)
                    if (newFile != null) {
                        if (url.startsWith("http")) {
                            URL(url).openStream().use { input ->
                                context.contentResolver.openOutputStream(newFile.uri)?.use { output ->
                                    input.copyTo(output)
                                }
                            }
                        }
                        resultUrl = "file://misnotas/img/$filename" // Pseudo URL para el interceptor
                    }
                } else {
                    val imgDir = File(context.filesDir, "img")
                    if (!imgDir.exists()) imgDir.mkdirs()
                    val targetFile = File(imgDir, filename)
    
                    if (url.startsWith("http")) {
                        URL(url).openStream().use { input ->
                            FileOutputStream(targetFile).use { output ->
                                input.copyTo(output)
                            }
                        }
                    }
                    resultUrl = "file://${targetFile.absolutePath}"
                }
                
                activity.runOnUiThread {
                    webView.evaluateJavascript("$callbackId('$resultUrl');", null)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                activity.runOnUiThread {
                    webView.evaluateJavascript("$callbackId('$url');", null) // fallback
                }
            }
        }
    }

    @JavascriptInterface
    fun deleteImage(fileUrl: String) {
        if (fileUrl.startsWith("file://")) {
            val path = fileUrl.removePrefix("file://")
            val file = File(path)
            if (file.exists() && file.absolutePath.startsWith(context.filesDir.absolutePath)) {
                file.delete()
            }
        }
    }

    @JavascriptInterface
    fun exportData(data: String) {
        activity.runOnUiThread {
            activity.launchExportData(data)
        }
    }

    @JavascriptInterface
    fun openSettingsWindow() {
        activity.runOnUiThread {
            webView.loadUrl("file:///android_asset/www/settings.html")
        }
    }

    @JavascriptInterface
    fun permanentDeleteNotebook(nbId: String) {
    }

    @JavascriptInterface
    fun relaunchApp() {
        activity.runOnUiThread {
            webView.loadUrl("file:///android_asset/www/index.html")
        }
    }
}
