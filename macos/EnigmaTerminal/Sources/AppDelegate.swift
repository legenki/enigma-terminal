import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var mainWindowController: MainWindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let appName = Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String ?? "Enigma Terminal"
        NSApplication.shared.mainMenu = MenuBuilder.buildMainMenu(appName: appName)

        let controller = MainWindowController()
        self.mainWindowController = controller
        controller.showWindow(nil)
        controller.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }
}
