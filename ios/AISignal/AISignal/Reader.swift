import SwiftUI
import WebKit

struct NewsletterReader: View {
    let newsletter: Newsletter
    @Environment(\.dismiss) private var dismiss
    @State private var showImages = false
    var body: some View {
        NavigationStack {
            EmailWebView(html: newsletter.html, text: newsletter.text, showImages: showImages)
                .navigationTitle(newsletter.sender)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { showImages.toggle() } label: { Image(systemName: showImages ? "photo.fill" : "photo") }
                            .accessibilityLabel(showImages ? "Hide remote images" : "Load remote images")
                    }
                }
        }
    }
}
struct EmailWebView: UIViewRepresentable {
    let html: String?
    let text: String
    let showImages: Bool
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        let view = WKWebView(frame: .zero, configuration: config)
        view.navigationDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = .white
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {
        let images = showImages ? "https: data:" : "data:"
        let content = html ?? "<pre style='white-space:pre-wrap'>\(escape(text))</pre>"
        let doc = """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src \(images); style-src 'unsafe-inline'; font-src data:; form-action 'none'; frame-src 'none'; base-uri 'none'">
        <style>body{margin:20px;font:17px/1.65 -apple-system,sans-serif;color:#202124;background:#fff;overflow-wrap:anywhere}img,table{max-width:100%!important}img{height:auto}pre{font:inherit}a{color:#5d44c4}</style>
        </head><body>\(content)</body></html>
        """
        guard context.coordinator.document != doc else { return }
        context.coordinator.document = doc
        view.loadHTMLString(doc, baseURL: nil)
    }
    private func escape(_ value: String) -> String {
        value.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
    }
    class Coordinator: NSObject, WKNavigationDelegate {
        var document = ""
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if action.navigationType == .linkActivated {
                if let url = action.request.url, ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") { UIApplication.shared.open(url) }
                decisionHandler(.cancel)
            } else if action.request.url?.scheme == "about" { decisionHandler(.allow) }
            else { decisionHandler(.cancel) }
        }
    }
}
