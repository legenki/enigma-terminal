import SwiftUI

public enum Theme {
    // Background tones with deep plum/burgundy undertones matching the modern IDE screenshot
    public static let bgDeep = Color(red: 0.06, green: 0.04, blue: 0.07)
    public static let bgPlum = Color(red: 0.10, green: 0.07, blue: 0.12)
    public static let sidebarBg = Color(red: 0.08, green: 0.06, blue: 0.10)
    public static let cardBg = Color(red: 0.12, green: 0.09, blue: 0.14)
    public static let cardInner = Color(red: 0.08, green: 0.07, blue: 0.10)
    public static let inputBg = Color(red: 0.14, green: 0.11, blue: 0.17)

    // Borders & Hairlines
    public static let border = Color.white.opacity(0.08)
    public static let borderSubtle = Color.white.opacity(0.04)
    public static let borderGlow = Color(red: 0.65, green: 0.40, blue: 0.98).opacity(0.5)

    // Accents
    public static let purple = Color(red: 0.65, green: 0.40, blue: 0.98)
    public static let purpleSoft = Color(red: 0.45, green: 0.25, blue: 0.70).opacity(0.35)
    public static let cyan = Color(red: 0.30, green: 0.80, blue: 0.95)
    public static let green = Color(red: 0.20, green: 0.85, blue: 0.55)
    public static let amber = Color(red: 0.95, green: 0.70, blue: 0.30)
    public static let red = Color(red: 0.95, green: 0.35, blue: 0.40)

    // Text hierarchy
    public static let textPrimary = Color(red: 0.92, green: 0.92, blue: 0.95)
    public static let textSecondary = Color(red: 0.65, green: 0.65, blue: 0.72)
    public static let textMuted = Color(red: 0.45, green: 0.45, blue: 0.52)

    public static var backgroundGradient: LinearGradient {
        LinearGradient(
            colors: [bgPlum, bgDeep],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}
