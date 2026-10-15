import SwiftUI
import GoogleSignInSwift

struct FeedView: View {
    @EnvironmentObject private var session: GoogleSession
    @StateObject private var feed = GmailFeed()
    @State private var demo = false
    @State private var selected: Newsletter?
    @Environment(\.scenePhase) private var scenePhase
    private let ink = Color(red: 0.11, green: 0.13, blue: 0.12)
    private let paper = Color(red: 0.96, green: 0.96, blue: 0.93)
    var body: some View {
        NavigationStack {
            Group {
                if session.restoring { ProgressView("Opening your signal…") }
                else if !session.signedIn && !demo { welcome }
                else { timeline }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(paper)
            .foregroundStyle(ink)
            .navigationTitle("AI Signal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if demo || session.signedIn {
                    ToolbarItem(placement: .topBarLeading) {
                        Menu {
                            if demo { Button("Exit preview") { demo = false } }
                            else { Button("Sign out", role: .destructive) { feed.reset(); session.signOut() } }
                        } label: { Image(systemName: "line.3.horizontal") }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button { Task { await feed.load(session: session, refresh: true) } } label: {
                            Image(systemName: "arrow.clockwise")
                        }.disabled(feed.loading || demo).accessibilityLabel("Refresh newsletters")
                    }
                }
            }
            .sheet(item: $selected) { NewsletterReader(newsletter: $0) }
            .task { await session.restore() }
            .task(id: session.signedIn) {
                if session.signedIn { demo = false; await feed.load(session: session, refresh: true) }
                else { feed.reset() }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active && session.signedIn && (feed.lastUpdated == nil || Date.now.timeIntervalSince(feed.lastUpdated!) > 300) {
                    Task { await feed.load(session: session, refresh: true) }
                }
            }
            .alert("Google connection", isPresented: Binding(get: { session.error != nil }, set: { if !$0 { session.error = nil } })) {
                Button("OK") { session.error = nil }
            } message: { Text(session.error ?? "") }
        }
        .tint(ink)
    }
    private var welcome: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()
            Image(systemName: "waveform.path").font(.system(size: 50, weight: .light)).foregroundStyle(.green)
            Text("Your daily\ndose of signal.").font(.system(size: 46, weight: .semibold, design: .serif)).minimumScaleFactor(0.7)
            Text("Your _AI_SIGNAL newsletters.\nOne quiet feed. Always yours.").font(.title3).foregroundStyle(.secondary)
            Spacer()
            GoogleSignInButton { Task { await session.connect() } }.disabled(session.busy)
            Button("Explore a sample feed") { demo = true }.font(.subheadline).frame(maxWidth: .infinity)
            Text("Read-only Gmail access. The app fetches only _AI_SIGNAL messages. Google’s permission covers your mailbox. Emails stay between your phone and Google.")
                .font(.caption).foregroundStyle(.secondary)
        }.padding(30).padding(.bottom, 20)
    }
    private var timeline: some View {
        VStack(spacing: 0) {
            HStack {
                Circle().fill(.green).frame(width: 6, height: 6)
                Text(demo ? "SAMPLE FEED" : "_AI_SIGNAL").tracking(2).font(.caption2.weight(.semibold))
                Spacer()
                Text("SWIPE TO EXPLORE").tracking(1).font(.caption2).foregroundStyle(.secondary)
            }.padding(.horizontal, 24).padding(.vertical, 14)
            if let error = feed.error, !demo {
                VStack(spacing: 8) {
                    Text(error).font(.callout)
                    Button("Retry") { Task { await feed.load(session: session, refresh: feed.items.isEmpty) } }
                }.padding().accessibilityElement(children: .contain)
            }
            if !demo && feed.items.isEmpty {
                Spacer()
                if feed.loading { ProgressView("Gathering your newsletters…") }
                else if feed.error == nil {
                    ContentUnavailableView("A little quiet here", systemImage: "tray", description: Text("Add newsletters to _AI_SIGNAL in Gmail, then refresh."))
                }
                Spacer()
            } else {
                ScrollView(.vertical) {
                    LazyVStack(spacing: 0) {
                        ForEach(demo ? Newsletter.samples : feed.items) { item in
                            card(item)
                                .containerRelativeFrame(.vertical)
                                .id(item.id)
                                .onAppear {
                                    if !demo && item.id == feed.items.last?.id && feed.hasMore {
                                        Task { await feed.load(session: session) }
                                    }
                                }
                        }
                        if !demo && feed.hasMore {
                            Button { Task { await feed.load(session: session) } } label: {
                                if feed.loading { ProgressView() } else { Text("Load more newsletters") }
                            }.padding(24).disabled(feed.loading)
                        }
                    }.scrollTargetLayout()
                }
                .scrollTargetBehavior(.paging)
                .scrollIndicators(.hidden)
                .refreshable { if !demo { await feed.load(session: session, refresh: true) } }
            }
        }
    }
    private func card(_ item: Newsletter) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text(String(item.sender.prefix(1)).uppercased()).font(.headline).frame(width: 38, height: 38).background(ink.opacity(0.08), in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.sender).font(.subheadline.weight(.semibold)).lineLimit(1)
                    Text(item.date, style: .date).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "sparkle").foregroundStyle(.green)
            }
            Rectangle().fill(ink.opacity(0.12)).frame(height: 1)
            Text(item.subject).font(.system(.largeTitle, design: .serif).weight(.medium)).lineLimit(4).minimumScaleFactor(0.7)
            Text(item.preview).font(.body).lineSpacing(6).foregroundStyle(ink.opacity(0.75)).lineLimit(9)
            Spacer(minLength: 8)
            Button { selected = item } label: {
                HStack { Text("Read newsletter"); Spacer(); Image(systemName: "arrow.up.right") }
                    .font(.subheadline.weight(.semibold)).padding(18).foregroundStyle(.white).background(ink, in: RoundedRectangle(cornerRadius: 16))
            }
            Text("↑  Next newsletter").font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity)
        }.padding(24).frame(maxWidth: 650).frame(maxWidth: .infinity)
    }
}
