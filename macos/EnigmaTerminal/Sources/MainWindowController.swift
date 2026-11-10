import AppKit
import WebKit

final class MainWindowController: NSWindowController, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private var schemeHandler: EnigmaSchemeHandler?

    convenience init() {
        let windowRect = NSRect(x: 0, y: 0, width: 1280, height: 860)
        let window = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        self.init(window: window)
        setupWindow()
        setupWebView()
    }

    private func setupWindow() {
        guard let window = self.window else { return }

        window.title = "ENIGMA TERMINAL"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.backgroundColor = NSColor(calibratedRed: 0.06, green: 0.07, blue: 0.08, alpha: 1.0)
        window.minSize = NSSize(width: 960, height: 640)
        window.center()
        window.setFrameAutosaveName("EnigmaTerminalMainWindow")
        window.delegate = self
    }

    private func setupWebView() {
        guard let window = self.window else { return }

        let config = WKWebViewConfiguration()

        // Locate web assets inside Resources/web
        let bundleURL = Bundle.main.resourceURL ?? Bundle.main.bundleURL
        var webRoot = bundleURL.appendingPathComponent("web")

        // Fallback for direct development/CLI execution where resources might sit beside binary or in docs/
        if !FileManager.default.fileExists(atPath: webRoot.path) {
            let directDocs = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("docs")
            if FileManager.default.fileExists(atPath: directDocs.path) {
                webRoot = directDocs
            }
        }

        let handler = EnigmaSchemeHandler(webRootURL: webRoot)
        self.schemeHandler = handler
        config.setURLSchemeHandler(handler, forURLScheme: "enigma")

        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        let webView = WKWebView(frame: window.contentView?.bounds ?? .zero, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window.contentView?.addSubview(webView)
        self.webView = webView

        loadApp()
    }

    func loadApp() {
        if let initialURL = URL(string: "enigma://app/index.html") {
            webView.load(URLRequest(url: initialURL))
        }
    }

    // MARK: - Menu Actions

    @objc func reloadContent(_ sender: Any?) {
        webView.reload()
    }

    @objc func forceReloadContent(_ sender: Any?) {
        webView.reloadFromOrigin()
    }

    @objc func resetZoom(_ sender: Any?) {
        webView.pageZoom = 1.0
    }

    @objc func zoomIn(_ sender: Any?) {
        webView.pageZoom += 0.1
    }

    @objc func zoomOut(_ sender: Any?) {
        webView.pageZoom = max(0.5, webView.pageZoom - 0.1)
    }

    @objc func setDaylightLive(_ sender: Any?) {
        webView.evaluateJavaScript("document.getElementById('light-live')?.click();", completionHandler: nil)
    }

    @objc func setDaylightDay(_ sender: Any?) {
        webView.evaluateJavaScript("document.getElementById('light-day')?.click();", completionHandler: nil)
    }

    @objc func setDaylightNight(_ sender: Any?) {
        webView.evaluateJavaScript("document.getElementById('light-night')?.click();", completionHandler: nil)
    }

    @objc func openRepositoryHelp(_ sender: Any?) {
        if let url = URL(string: "https://github.com/legenki/enigma-terminal") {
            NSWorkspace.shared.open(url)
        }
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // Allow app internal navigation
        if url.scheme == "enigma" || url.scheme == "data" || url.scheme == "blob" {
            decisionHandler(.allow)
            return
        }

        // Open external links (e.g. explorer links, help) in default macOS browser
        if url.scheme == "http" || url.scheme == "https" {
            if navigationAction.navigationType == .linkActivated {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
            return
        }

        decisionHandler(.allow)
    }
}
