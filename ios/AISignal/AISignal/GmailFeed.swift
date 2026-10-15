import Foundation
import Combine

@MainActor
final class GmailFeed: ObservableObject {
    @Published var items: [Newsletter] = []
    @Published var loading = false
    @Published var error: String?
    @Published var lastUpdated: Date?
    private var labelID: String?
    private var pageToken: String?
    private var generation = UUID()
    private let decoder = JSONDecoder()
    private let network: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 30
        return URLSession(configuration: config)
    }()
    var hasMore: Bool { pageToken != nil }

    private func request<T: Decodable>(_ path: String, query: [URLQueryItem] = [], token: String) async throws -> T {
        var url = URLComponents(string: "https://gmail.googleapis.com/gmail/v1/users/me/" + path)!
        url.queryItems = query
        var req = URLRequest(url: url.url!)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await network.data(for: req)
        guard let response = response as? HTTPURLResponse else { throw SignalError.message("No response from Gmail.") }
        guard (200...299).contains(response.statusCode) else {
            switch response.statusCode {
            case 401: throw SignalError.message("Google access expired. Sign out and reconnect.")
            case 403: throw SignalError.message("Gmail access was refused. Check that the Gmail API is enabled and read-only access was granted.")
            case 429: throw SignalError.message("Gmail is busy. Wait a moment, then refresh.")
            default: throw SignalError.message("Gmail returned an error (\(response.statusCode)). Try again.")
            }
        }
        return try decoder.decode(T.self, from: data)
    }
    func reset() {
        generation = UUID(); items = []; pageToken = nil; labelID = nil
        loading = false; error = nil; lastUpdated = nil
    }
    func load(session: GoogleSession, refresh: Bool = false) async {
        guard !loading else { return }
        guard refresh || items.isEmpty || pageToken != nil else { return }
        let run = generation
        loading = true; error = nil
        defer { if generation == run { loading = false } }
        do {
            let token = try await session.token()
            var label = labelID
            if label == nil || refresh {
                let result: LabelList = try await request("labels", token: token)
                label = result.labels?.first(where: { $0.name == "_AI_SIGNAL" })?.id
            }
            guard let label else { throw SignalError.message("No _AI_SIGNAL label found. Create it in Gmail and add some newsletters, then refresh.") }
            var query = [URLQueryItem(name: "labelIds", value: label), URLQueryItem(name: "maxResults", value: "15")]
            if !refresh, let pageToken { query.append(URLQueryItem(name: "pageToken", value: pageToken)) }
            let page: MessageList = try await request("messages", query: query, token: token)
            var loaded: [Newsletter] = []
            // Small sequential batches avoid a burst of Gmail requests and keep pagination predictable.
            for ref in page.messages ?? [] {
                try Task.checkCancellation()
                do {
                    let message: GmailMessage = try await request("messages/" + ref.id, query: [URLQueryItem(name: "format", value: "full")], token: token)
                    // Recheck membership in case Gmail removed the label after listing.
                    if message.labelIds?.contains(label) == true { loaded.append(Newsletter(message)) }
                } catch {
                    // A failed body fetch keeps the cursor unchanged so retry cannot skip an email.
                    throw error
                }
            }
            guard generation == run, session.signedIn else { return }
            let combined = refresh ? loaded : items + loaded
            var seen = Set<String>()
            items = combined.filter { seen.insert($0.id).inserted }.sorted { $0.date > $1.date }
            labelID = label; pageToken = page.nextPageToken; lastUpdated = .now
        } catch is CancellationError { }
        catch { if generation == run { self.error = error.localizedDescription } }
    }
}
