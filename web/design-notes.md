# UI component contract
App owns navigation, selected level, GameEngine and modal focus.
Palette tokens defined on :root: --bg #090b16; --panel #111420; --ink #edf0ff; --muted #9497ad; --line rgba(174,180,219,.14); --violet #b7a1ff; --cyan #8ee7f0; --amber #f8b78c.
Global classes: .eyebrow, .button (with .primary/.secondary), .icon-button, .mono, .muted.
Typography: Space Grotesk + PingFang SC; JetBrains Mono captions.
Modal components can use ordinary semantic DOM; App wraps in a native dialog.
