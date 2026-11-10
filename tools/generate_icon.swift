import AppKit

func renderIcon(size: Int) -> NSImage {
    let img = NSImage(size: NSSize(width: size, height: size))
    img.lockFocus()

    guard let ctx = NSGraphicsContext.current?.cgContext else {
        img.unlockFocus()
        return img
    }

    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let cornerRadius = CGFloat(size) * 0.2237 // Apple standard macOS squircle approximation

    // Background squircle
    let clipPath = CGPath(roundedRect: rect.insetBy(dx: CGFloat(size) * 0.04, dy: CGFloat(size) * 0.04),
                          cornerWidth: cornerRadius,
                          cornerHeight: cornerRadius,
                          transform: nil)
    ctx.addPath(clipPath)
    ctx.clip()

    // Background gradient: dark carbon to deep obsidian
    let colors = [
        NSColor(calibratedRed: 0.10, green: 0.12, blue: 0.15, alpha: 1.0).cgColor,
        NSColor(calibratedRed: 0.04, green: 0.05, blue: 0.07, alpha: 1.0).cgColor
    ] as CFArray
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    if let gradient = CGGradient(colorsSpace: colorSpace, colors: colors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(gradient,
                               start: CGPoint(x: 0, y: CGFloat(size)),
                               end: CGPoint(x: 0, y: 0),
                               options: [])
    }

    // Border glow
    ctx.setStrokeColor(NSColor(calibratedRed: 0.25, green: 0.78, blue: 0.65, alpha: 0.8).cgColor)
    ctx.setLineWidth(CGFloat(size) * 0.02)
    ctx.addPath(clipPath)
    ctx.strokePath()

    // Inner terminal screen frame
    let screenInset = CGFloat(size) * 0.18
    let screenRect = rect.insetBy(dx: screenInset, dy: screenInset)
    let screenPath = CGPath(roundedRect: screenRect, cornerWidth: CGFloat(size) * 0.06, cornerHeight: CGFloat(size) * 0.06, transform: nil)

    ctx.setFillColor(NSColor(calibratedRed: 0.02, green: 0.03, blue: 0.04, alpha: 1.0).cgColor)
    ctx.addPath(screenPath)
    ctx.fillPath()

    ctx.setStrokeColor(NSColor(calibratedRed: 0.15, green: 0.25, blue: 0.22, alpha: 0.9).cgColor)
    ctx.setLineWidth(CGFloat(size) * 0.015)
    ctx.addPath(screenPath)
    ctx.strokePath()

    // Terminal prompt symbol: ">_" in bright phosphor green/amber
    let text = ">_"
    let fontSize = CGFloat(size) * 0.32
    let font = NSFont.monospacedSystemFont(ofSize: fontSize, weight: .bold)
    let textColor = NSColor(calibratedRed: 0.35, green: 0.95, blue: 0.70, alpha: 1.0)

    let shadow = NSShadow()
    shadow.shadowColor = NSColor(calibratedRed: 0.20, green: 0.90, blue: 0.60, alpha: 0.6)
    shadow.shadowBlurRadius = CGFloat(size) * 0.04
    shadow.shadowOffset = NSSize.zero

    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: textColor,
        .shadow: shadow
    ]

    let str = NSAttributedString(string: text, attributes: attrs)
    let strSize = str.size()
    let textOrigin = CGPoint(
        x: screenRect.midX - strSize.width / 2.0,
        y: screenRect.midY - strSize.height / 2.0
    )
    str.draw(at: textOrigin)

    img.unlockFocus()
    return img
}

func savePNG(image: NSImage, path: String, pixelSize: Int) throws {
    guard let tiff = image.tiffRepresentation,
          let _ = NSBitmapImageRep(data: tiff) else {
        fatalError("Failed to get image representation")
    }

    let exactRep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixelSize,
        pixelsHigh: pixelSize,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: exactRep)
    image.draw(in: NSRect(x: 0, y: 0, width: pixelSize, height: pixelSize),
               from: NSRect(x: 0, y: 0, width: image.size.width, height: image.size.height),
               operation: .copy,
               fraction: 1.0)
    NSGraphicsContext.restoreGraphicsState()

    guard let pngData = exactRep.representation(using: .png, properties: [:]) else {
        fatalError("Failed to convert to PNG")
    }

    try pngData.write(to: URL(fileURLWithPath: path))
}

let fileManager = FileManager.default
let iconsetDir = "/tmp/AppIcon.iconset"
try? fileManager.removeItem(atPath: iconsetDir)
try fileManager.createDirectory(atPath: iconsetDir, withIntermediateDirectories: true)

let specs: [(String, Int)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

for (filename, size) in specs {
    let img = renderIcon(size: size)
    let filePath = (iconsetDir as NSString).appendingPathComponent(filename)
    try savePNG(image: img, path: filePath, pixelSize: size)
}

print("Iconset created at \(iconsetDir)")
