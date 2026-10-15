import Foundation

struct GmailLabel: Decodable { let id: String; let name: String }
struct LabelList: Decodable { let labels: [GmailLabel]? }
struct MessageRef: Decodable { let id: String }
struct MessageList: Decodable { let messages: [MessageRef]?; let nextPageToken: String? }
struct Header: Decodable { let name: String; let value: String }
struct Body: Decodable { let data: String?; let attachmentId: String? }
struct Part: Decodable {
    let mimeType: String?
    let filename: String?
    let headers: [Header]?
    let body: Body?
    let parts: [Part]?

    func text(_ type: String) -> String? {
        // Never display text attachments as the newsletter body.
        if let filename, !filename.isEmpty { return nil }
        if mimeType == type, let data = body?.data, let decoded = Self.decode(data) { return decoded }
        return parts?.lazy.compactMap { $0.text(type) }.first
    }
    static func decode(_ value: String) -> String? {
        var encoded = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        encoded += String(repeating: "=", count: (4 - encoded.count % 4) % 4)
        guard let data = Data(base64Encoded: encoded) else { return nil }
        return String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1)
    }
}
struct GmailMessage: Decodable {
    let id: String
    let labelIds: [String]?
    let snippet: String?
    let internalDate: String?
    let payload: Part?
    func header(_ name: String) -> String {
        payload?.headers?.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }?.value ?? ""
    }
    var date: Date { Date(timeIntervalSince1970: (Double(internalDate ?? "") ?? 0) / 1000) }
}
struct Newsletter: Identifiable {
    let id: String
    let sender: String
    let subject: String
    let date: Date
    let preview: String
    let html: String?
    let text: String

    init(_ message: GmailMessage) {
        id = message.id
        let from = message.header("From")
        sender = from.components(separatedBy: "<").first?.trimmingCharacters(in: CharacterSet(charactersIn: " \"")) ?? from
        subject = message.header("Subject").isEmpty ? "Untitled newsletter" : message.header("Subject")
        date = message.date
        html = message.payload?.text("text/html")
        text = message.payload?.text("text/plain") ?? message.snippet ?? "No readable body was included in this email."
        preview = message.payload?.text("text/plain") ?? message.snippet ?? "Open to read this newsletter."
    }
    init(id: String, sender: String, subject: String, text: String) {
        self.id = id; self.sender = sender; self.subject = subject
        self.text = text; self.preview = text; self.html = nil; self.date = .now
    }
    static let samples = [
        Newsletter(id: "demo1", sender: "The AI Brief", subject: "A quieter place for your AI news.", text: "Your _AI_SIGNAL newsletters, together at last.\n\nSwipe up for the next email. Open a newsletter to read the full edition, with its original formatting.\n\nThis is sample content. Connect your Google account to load your real newsletters."),
        Newsletter(id: "demo2", sender: "Signal Notes", subject: "Less inbox. More reading.", text: "One label. One feed.\n\nAnything you label _AI_SIGNAL in Gmail appears here when you refresh. Your latest newsletters come first.\n\nNo summaries to generate, no folders to organize. Just the things you chose to read.")
    ]
}

enum SignalError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { return text }; return nil }
}
