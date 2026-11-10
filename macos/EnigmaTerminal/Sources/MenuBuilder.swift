import AppKit

enum MenuBuilder {
    static func buildMainMenu(appName: String) -> NSMenu {
        let mainMenu = NSMenu()

        // 1. Application Menu
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        appMenu.addItem(withTitle: "About \(appName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Hide \(appName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthersItem = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthersItem.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthersItem)
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit \(appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // 2. File Menu
        let fileMenuItem = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        fileMenuItem.submenu = fileMenu
        mainMenu.addItem(fileMenuItem)
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")

        // 3. Edit Menu (standard clipboard actions for terminal and text inputs)
        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redoItem = NSMenuItem(title: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        redoItem.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(redoItem)
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // 4. View Menu
        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)

        viewMenu.addItem(withTitle: "Reload", action: #selector(MainWindowController.reloadContent(_:)), keyEquivalent: "r")
        let forceReloadItem = NSMenuItem(title: "Force Reload", action: #selector(MainWindowController.forceReloadContent(_:)), keyEquivalent: "R")
        forceReloadItem.keyEquivalentModifierMask = [.command, .shift]
        viewMenu.addItem(forceReloadItem)
        viewMenu.addItem(NSMenuItem.separator())
        viewMenu.addItem(withTitle: "Actual Size", action: #selector(MainWindowController.resetZoom(_:)), keyEquivalent: "0")
        viewMenu.addItem(withTitle: "Zoom In", action: #selector(MainWindowController.zoomIn(_:)), keyEquivalent: "+")
        viewMenu.addItem(withTitle: "Zoom Out", action: #selector(MainWindowController.zoomOut(_:)), keyEquivalent: "-")
        viewMenu.addItem(NSMenuItem.separator())
        let fullScreenItem = NSMenuItem(title: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fullScreenItem.keyEquivalentModifierMask = [.command, .control]
        viewMenu.addItem(fullScreenItem)

        // 5. Daylight Menu (control game theme directly from macOS menu)
        let daylightMenuItem = NSMenuItem()
        let daylightMenu = NSMenu(title: "Daylight")
        daylightMenuItem.submenu = daylightMenu
        mainMenu.addItem(daylightMenuItem)

        let liveItem = NSMenuItem(title: "Live (Follows Time)", action: #selector(MainWindowController.setDaylightLive(_:)), keyEquivalent: "l")
        liveItem.keyEquivalentModifierMask = [.command, .option]
        daylightMenu.addItem(liveItem)

        let dayItem = NSMenuItem(title: "Day (Ivory)", action: #selector(MainWindowController.setDaylightDay(_:)), keyEquivalent: "d")
        dayItem.keyEquivalentModifierMask = [.command, .option]
        daylightMenu.addItem(dayItem)

        let nightItem = NSMenuItem(title: "Night (Dark)", action: #selector(MainWindowController.setDaylightNight(_:)), keyEquivalent: "n")
        nightItem.keyEquivalentModifierMask = [.command, .option]
        daylightMenu.addItem(nightItem)

        // 6. Window Menu
        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")

        // 7. Help Menu
        let helpMenuItem = NSMenuItem()
        let helpMenu = NSMenu(title: "Help")
        helpMenuItem.submenu = helpMenu
        mainMenu.addItem(helpMenuItem)

        helpMenu.addItem(withTitle: "Enigma Terminal Repository", action: #selector(MainWindowController.openRepositoryHelp(_:)), keyEquivalent: "")

        return mainMenu
    }
}
