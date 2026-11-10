import SwiftUI

public struct AppTheme {
    public let isLight: Bool

    public let bgDeep: Color
    public let bgPlum: Color
    public let sidebarBg: Color
    public let cardBg: Color
    public let cardInner: Color
    public let inputBg: Color

    public let border: Color
    public let borderSubtle: Color
    public let borderGlow: Color

    public let purple: Color
    public let purpleSoft: Color
    public let cyan: Color
    public let green: Color
    public let amber: Color
    public let red: Color

    public let textPrimary: Color
    public let textSecondary: Color
    public let textMuted: Color

    public var backgroundGradient: LinearGradient {
        LinearGradient(
            colors: [bgPlum, bgDeep],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    public static func make(isLight: Bool) -> AppTheme {
        if isLight {
            // Warm ivory daylight palette from the game spec (ivory at noon, crisp dark text)
            return AppTheme(
                isLight: true,
                bgDeep: Color(red: 0.93, green: 0.91, blue: 0.86),
                bgPlum: Color(red: 0.90, green: 0.88, blue: 0.82),
                sidebarBg: Color(red: 0.88, green: 0.86, blue: 0.80),
                cardBg: Color(red: 0.98, green: 0.97, blue: 0.94),
                cardInner: Color(red: 0.92, green: 0.90, blue: 0.85),
                inputBg: Color(red: 0.99, green: 0.99, blue: 0.98),
                border: Color.black.opacity(0.12),
                borderSubtle: Color.black.opacity(0.06),
                borderGlow: Color(red: 0.45, green: 0.20, blue: 0.85).opacity(0.5),
                purple: Color(red: 0.45, green: 0.20, blue: 0.85),
                purpleSoft: Color(red: 0.45, green: 0.20, blue: 0.85).opacity(0.12),
                cyan: Color(red: 0.02, green: 0.50, blue: 0.75),
                green: Color(red: 0.05, green: 0.55, blue: 0.35),
                amber: Color(red: 0.85, green: 0.50, blue: 0.05),
                red: Color(red: 0.85, green: 0.20, blue: 0.25),
                textPrimary: Color(red: 0.12, green: 0.12, blue: 0.14),
                textSecondary: Color(red: 0.35, green: 0.35, blue: 0.40),
                textMuted: Color(red: 0.55, green: 0.55, blue: 0.60)
            )
        } else {
            // Deep obsidian / plum night palette
            return AppTheme(
                isLight: false,
                bgDeep: Color(red: 0.06, green: 0.04, blue: 0.07),
                bgPlum: Color(red: 0.10, green: 0.07, blue: 0.12),
                sidebarBg: Color(red: 0.08, green: 0.06, blue: 0.10),
                cardBg: Color(red: 0.12, green: 0.09, blue: 0.14),
                cardInner: Color(red: 0.08, green: 0.07, blue: 0.10),
                inputBg: Color(red: 0.14, green: 0.11, blue: 0.17),
                border: Color.white.opacity(0.08),
                borderSubtle: Color.white.opacity(0.04),
                borderGlow: Color(red: 0.65, green: 0.40, blue: 0.98).opacity(0.5),
                purple: Color(red: 0.65, green: 0.40, blue: 0.98),
                purpleSoft: Color(red: 0.45, green: 0.25, blue: 0.70).opacity(0.35),
                cyan: Color(red: 0.30, green: 0.80, blue: 0.95),
                green: Color(red: 0.20, green: 0.85, blue: 0.55),
                amber: Color(red: 0.95, green: 0.70, blue: 0.30),
                red: Color(red: 0.95, green: 0.35, blue: 0.40),
                textPrimary: Color(red: 0.92, green: 0.92, blue: 0.95),
                textSecondary: Color(red: 0.65, green: 0.65, blue: 0.72),
                textMuted: Color(red: 0.45, green: 0.45, blue: 0.52)
            )
        }
    }
}

public enum Theme {
    public static var defaultDark: AppTheme { AppTheme.make(isLight: false) }
    public static var defaultLight: AppTheme { AppTheme.make(isLight: true) }

    public static let bgDeep = defaultDark.bgDeep
    public static let bgPlum = defaultDark.bgPlum
    public static let sidebarBg = defaultDark.sidebarBg
    public static let cardBg = defaultDark.cardBg
    public static let cardInner = defaultDark.cardInner
    public static let inputBg = defaultDark.inputBg

    public static let border = defaultDark.border
    public static let borderSubtle = defaultDark.borderSubtle
    public static let borderGlow = defaultDark.borderGlow

    public static let purple = defaultDark.purple
    public static let purpleSoft = defaultDark.purpleSoft
    public static let cyan = defaultDark.cyan
    public static let green = defaultDark.green
    public static let amber = defaultDark.amber
    public static let red = defaultDark.red

    public static let textPrimary = defaultDark.textPrimary
    public static let textSecondary = defaultDark.textSecondary
    public static let textMuted = defaultDark.textMuted

    public static var backgroundGradient: LinearGradient { defaultDark.backgroundGradient }
}
