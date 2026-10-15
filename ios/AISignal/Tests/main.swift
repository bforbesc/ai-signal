import Foundation

func encoded(_ value: String) -> String {
    Data(value.utf8).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}
assert(Part.decode(encoded("AI news 🧠 — olá")) == "AI news 🧠 — olá")
assert(Part.decode("%%invalid") == nil)
let json: [String: Any] = [
    "id": "message1", "labelIds": ["Label_123"], "internalDate": "1700000000000", "snippet": "A short preview",
    "payload": ["mimeType": "multipart/mixed", "headers": [["name":"fRoM", "value":"AI Weekly <hello@example.com>"], ["name":"Subject", "value":"This week in AI"]], "parts": [
        ["mimeType":"text/plain", "filename":"attachment.txt", "body":["data":encoded("Wrong attachment")]],
        ["mimeType":"multipart/alternative", "parts":[
            ["mimeType":"text/plain", "body":["data":encoded("Actual newsletter")]],
            ["mimeType":"text/html", "body":["data":encoded("<p>Rich newsletter</p>")]]
        ]]
    ]]
]
let message = try JSONDecoder().decode(GmailMessage.self, from: JSONSerialization.data(withJSONObject: json))
let newsletter = Newsletter(message)
assert(newsletter.sender == "AI Weekly")
assert(newsletter.subject == "This week in AI")
assert(newsletter.preview == "Actual newsletter")
assert(newsletter.html == "<p>Rich newsletter</p>")
assert(newsletter.date.timeIntervalSince1970 == 1700000000)
assert(message.header("missing") == "")
let empty = try JSONDecoder().decode(GmailMessage.self, from: Data(#"{"id":"empty","snippet":"Fallback"}"#.utf8))
assert(Newsletter(empty).subject == "Untitled newsletter")
assert(Newsletter(empty).text == "Fallback")
let labels = try JSONDecoder().decode(LabelList.self, from: Data(#"{"labels":[{"id":"wrong","name":"AI_SIGNAL"},{"id":"right","name":"_AI_SIGNAL"}]}"#.utf8))
assert(labels.labels?.first { $0.name == "_AI_SIGNAL" }?.id == "right")
print("11 checks passed: MIME nesting, attachment exclusion, Unicode/base64url, headers, dates, fallback, exact label.")
