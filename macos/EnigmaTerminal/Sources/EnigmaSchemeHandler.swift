import Foundation
import WebKit

final class EnigmaSchemeHandler: NSObject, WKURLSchemeHandler {
    private let webRootURL: URL

    init(webRootURL: URL) {
        self.webRootURL = webRootURL
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var path = url.path
        if path.isEmpty || path == "/" {
            path = "/index.html"
        }

        // Clean leading slash to avoid escaping root directory
        let relativePath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let fileURL = webRootURL.appendingPathComponent(relativePath).standardizedFileURL

        // Security check: ensure file is within webRootURL
        guard fileURL.path.hasPrefix(webRootURL.standardizedFileURL.path) else {
            let response = HTTPURLResponse(
                url: url,
                statusCode: 403,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "text/plain; charset=utf-8"]
            )!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(Data("Forbidden".utf8))
            urlSchemeTask.didFinish()
            return
        }

        guard FileManager.default.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL) else {
            let response = HTTPURLResponse(
                url: url,
                statusCode: 404,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "text/plain; charset=utf-8"]
            )!
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(Data("File Not Found: \(relativePath)".utf8))
            urlSchemeTask.didFinish()
            return
        }

        let mimeType = mimeTypeFor(pathExtension: fileURL.pathExtension.lowercased())
        let headers: [String: String] = [
            "Content-Type": mimeType,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache"
        ]

        guard let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: headers
        ) else {
            urlSchemeTask.didFailWithError(URLError(.cannotParseResponse))
            return
        }

        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // No asynchronous stream cleanup needed for local memory/disk data
    }

    private func mimeTypeFor(pathExtension: String) -> String {
        switch pathExtension {
        case "html", "htm":
            return "text/html; charset=utf-8"
        case "js", "mjs":
            return "application/javascript; charset=utf-8"
        case "css":
            return "text/css; charset=utf-8"
        case "json":
            return "application/json; charset=utf-8"
        case "txt":
            return "text/plain; charset=utf-8"
        case "svg":
            return "image/svg+xml"
        case "png":
            return "image/png"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "gif":
            return "image/gif"
        case "ico":
            return "image/x-icon"
        case "woff2":
            return "font/woff2"
        case "woff":
            return "font/woff"
        case "ttf":
            return "font/ttf"
        case "otf":
            return "font/otf"
        default:
            return "application/octet-stream"
        }
    }
}
