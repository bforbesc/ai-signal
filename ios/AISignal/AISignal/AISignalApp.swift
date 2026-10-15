import SwiftUI
import GoogleSignIn

@main
struct AISignalApp: App {
    @StateObject private var session = GoogleSession()
    var body: some Scene {
        WindowGroup {
            FeedView().environmentObject(session)
                .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
        }
    }
}
