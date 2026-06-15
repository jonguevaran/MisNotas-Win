package com.example.misnotas

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var imageCallbackId: String? = null
    private var currentInsets: WindowInsetsCompat? = null

    private fun injectInsets() {
        currentInsets?.let { windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            val density = resources.displayMetrics.density
            val top = insets.top / density
            val bottom = insets.bottom / density
            val left = insets.left / density
            val right = insets.right / density

            val js = """
                document.documentElement.style.setProperty('--status-bar-height', '${top}px');
                document.documentElement.style.setProperty('--nav-bar-height', '${bottom}px');
                document.documentElement.style.setProperty('--safe-area-left', '${left}px');
                document.documentElement.style.setProperty('--safe-area-right', '${right}px');
            """.trimIndent()
            webView.evaluateJavascript(js, null)
        }
    }

    private val selectImageLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val uri: Uri? = result.data?.data
            if (uri != null && imageCallbackId != null) {
                try {
                    val imgDir = File(filesDir, "img")
                    if (!imgDir.exists()) imgDir.mkdirs()
                    val targetFile = File(imgDir, "img_${System.currentTimeMillis()}.jpg")
                    
                    contentResolver.openInputStream(uri)?.use { input ->
                        FileOutputStream(targetFile).use { output ->
                            input.copyTo(output)
                        }
                    }
                    val resultUrl = "file://${targetFile.absolutePath}"
                    webView.evaluateJavascript("$imageCallbackId('$resultUrl');", null)
                } catch (e: Exception) {
                    e.printStackTrace()
                    webView.evaluateJavascript("$imageCallbackId(null);", null)
                }
            } else {
                webView.evaluateJavascript("$imageCallbackId(null);", null)
            }
        } else {
            imageCallbackId?.let { webView.evaluateJavascript("$it(null);", null) }
        }
    }

    private var dataToExport: String? = null
    private var changeImageDirCallbackId: String? = null
    private var changeDbDirCallbackId: String? = null
    private var filePathCallback: android.webkit.ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val resultData = result.data
            if (resultData != null) {
                val uris = if (resultData.data != null) {
                    arrayOf(resultData.data!!)
                } else if (resultData.clipData != null) {
                    val count = resultData.clipData!!.itemCount
                    Array(count) { i -> resultData.clipData!!.getItemAt(i).uri }
                } else {
                    null
                }
                filePathCallback?.onReceiveValue(uris)
            } else {
                filePathCallback?.onReceiveValue(null)
            }
        } else {
            filePathCallback?.onReceiveValue(null)
        }
        filePathCallback = null
    }

    private val changeImageDirLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )
                val prefs = getSharedPreferences("MisNotasPrefs", android.content.Context.MODE_PRIVATE)
                prefs.edit().putString("custom_image_dir", uri.toString()).apply()
                
                changeImageDirCallbackId?.let {
                    webView.evaluateJavascript("$it('$uri');", null)
                }
            } ?: run {
                changeImageDirCallbackId?.let { webView.evaluateJavascript("$it(null);", null) }
            }
        } else {
            changeImageDirCallbackId?.let { webView.evaluateJavascript("$it(null);", null) }
        }
        changeImageDirCallbackId = null
    }

    private val changeDbDirLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )
                val prefs = getSharedPreferences("MisNotasPrefs", android.content.Context.MODE_PRIVATE)
                prefs.edit().putString("custom_db_dir", uri.toString()).apply()
                
                changeDbDirCallbackId?.let {
                    webView.evaluateJavascript("$it('$uri');", null)
                }
            } ?: run {
                changeDbDirCallbackId?.let { webView.evaluateJavascript("$it(null);", null) }
            }
        } else {
            changeDbDirCallbackId?.let { webView.evaluateJavascript("$it(null);", null) }
        }
        changeDbDirCallbackId = null
    }

    private val exportDataLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.data?.let { uri ->
                try {
                    contentResolver.openOutputStream(uri)?.use { output ->
                        dataToExport?.let { output.write(it.toByteArray()) }
                    }
                    webView.evaluateJavascript("alert('Datos exportados correctamente.');", null)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
        dataToExport = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, windowInsets ->
            currentInsets = windowInsets
            injectInsets()
            windowInsets
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
        }
        
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectInsets()
            }

            override fun shouldInterceptRequest(view: WebView?, request: android.webkit.WebResourceRequest?): android.webkit.WebResourceResponse? {
                val url = request?.url?.toString() ?: return super.shouldInterceptRequest(view, request)
                if (url.contains("/img/") && url.startsWith("file://")) {
                    val prefs = getSharedPreferences("MisNotasPrefs", android.content.Context.MODE_PRIVATE)
                    val customDirUriStr = prefs.getString("custom_image_dir", null)
                    
                    if (customDirUriStr != null) {
                        try {
                            val treeUri = Uri.parse(customDirUriStr)
                            val docTree = androidx.documentfile.provider.DocumentFile.fromTreeUri(this@MainActivity, treeUri)
                            val fileName = url.substringAfterLast("/")
                            val fileDoc = docTree?.findFile(fileName)
                            if (fileDoc != null && fileDoc.exists()) {
                                val mimeType = contentResolver.getType(fileDoc.uri) ?: "image/jpeg"
                                val inputStream = contentResolver.openInputStream(fileDoc.uri)
                                return android.webkit.WebResourceResponse(mimeType, "UTF-8", inputStream)
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: android.webkit.ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                
                val intent = fileChooserParams?.createIntent()
                if (intent != null) {
                    try {
                        fileChooserLauncher.launch(intent)
                    } catch (e: Exception) {
                        this@MainActivity.filePathCallback = null
                        return false
                    }
                } else {
                    this@MainActivity.filePathCallback = null
                    return false
                }
                return true
            }
        }
        
        webView.addJavascriptInterface(WebAppInterface(this, webView, this), "AndroidNative")
        
        setContentView(webView)
        
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    fun launchImageSelection(callbackId: String) {
        imageCallbackId = callbackId
        val intent = Intent(Intent.ACTION_PICK)
        intent.type = "image/*"
        selectImageLauncher.launch(intent)
    }

    fun launchChangeImageDir(callbackId: String) {
        changeImageDirCallbackId = callbackId
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        changeImageDirLauncher.launch(intent)
    }

    fun launchChangeDbDir(callbackId: String) {
        changeDbDirCallbackId = callbackId
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        changeDbDirLauncher.launch(intent)
    }

    fun launchExportData(data: String) {
        dataToExport = data
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, "misnotas_export.json")
        }
        exportDataLauncher.launch(intent)
    }

    fun setStatusBarIconColor(isDarkIcons: Boolean) {
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        windowInsetsController.isAppearanceLightStatusBars = isDarkIcons
    }

    override fun onBackPressed() {
        if (webView.url?.endsWith("settings.html") == true) {
            webView.loadUrl("file:///android_asset/www/index.html")
        } else if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
