import SwiftUI
import GoogleSignIn

@MainActor
final class GoogleSession: ObservableObject {
    static let scope = "https://www.googleapis.com/auth/gmail.readonly"
    @Published var signedIn = false
    @Published var restoring = true
    @Published var busy = false
    @Published var error: String?

    var configured: Bool {
        guard let client = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String else { return false }
        return !client.contains("YOUR_") && client.hasSuffix(".apps.googleusercontent.com")
    }
    func restore() async {
        defer { restoring = false }
        guard configured else { return }
        do {
            let user = try await GIDSignIn.sharedInstance.restorePreviousSignIn()
            signedIn = user.grantedScopes?.contains(Self.scope) == true
        } catch { signedIn = false }
    }
    func connect() async {
        guard !busy else { return }
        guard configured else {
            error = "Google sign-in needs your iOS OAuth client ID in Config.xcconfig. See the included setup guide."
            return
        }
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.activationState == .foregroundActive }),
              var presenter = scene.windows.first(where: \.isKeyWindow)?.rootViewController else { return }
        while let next = presenter.presentedViewController { presenter = next }
        busy = true
        defer { busy = false }
        do {
            if let user = GIDSignIn.sharedInstance.currentUser {
                if user.grantedScopes?.contains(Self.scope) != true {
                    _ = try await user.addScopes([Self.scope], presenting: presenter)
                }
            } else {
                _ = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter, hint: nil, additionalScopes: [Self.scope])
            }
            signedIn = GIDSignIn.sharedInstance.currentUser?.grantedScopes?.contains(Self.scope) == true
            if !signedIn { throw SignalError.message("Allow read-only Gmail access to load your newsletters.") }
        } catch { self.error = error.localizedDescription }
    }
    func token() async throws -> String {
        guard let user = GIDSignIn.sharedInstance.currentUser else { throw SignalError.message("Connect Google to continue.") }
        return try await user.refreshTokensIfNeeded().accessToken.tokenString
    }
    func signOut() { GIDSignIn.sharedInstance.signOut(); signedIn = false }
}
