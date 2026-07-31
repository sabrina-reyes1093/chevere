# Chévere Design System

## Product context

Chévere is an editorial lifestyle publication covering culture, style, life, and guides. The redesign preserves the clarity and photography of a magazine while giving the brand a distinct dreamy digital world.

## Direction

- **Aesthetic:** dreamy editorial futurism
- **Balance:** 60% polished editorial, 25% pastel futurism, 15% Y2K play
- **Layout:** disciplined editorial grids with selective overlap and floating decoration
- **Decoration:** expressive in brand and discovery surfaces, restrained in long-form reading

## Typography

- **Display/editorial:** Playfair Display, Georgia fallback
- **Body/UI:** Inter, system sans-serif fallback
- **Labels:** Inter, uppercase, 0.08–0.16em tracking
- **Scale:** 12, 14, 16, 18, 24, 36, 56, 88px, fluid where appropriate

## Color

- **Ink:** `#17131c`
- **Muted ink:** `#6f6777`
- **Paper:** `#fffdfb`
- **Soft white:** `#faf8ff`
- **Lavender:** `#e8d8ff`
- **Lilac:** `#d7c0ff`
- **Orchid:** `#edcfff`
- **Blush:** `#f6d9f3`
- **Sky:** `#dcecff`
- **Mint:** `#e3f6e9`
- **Soft yellow:** `#fff1c8`

Culture uses lilac/orchid, Style soft yellow/mint, Life sky/blush, Guides lavender/icy blue. Text stays ink-on-paper. Pastels define surfaces and atmosphere, never body-copy color.

## Shape and depth

- Small radius: 12px
- Controls: 999px
- Cards: 24px
- Feature panels: 36px
- Shadows use cool lilac-gray at 10–20% opacity
- Glass effects always retain a visible border and opaque fallback

## Spacing and layout

- Base unit: 4px
- Content width: 1240px
- Reading width: 760px
- Desktop: 12 columns; tablet: 8; mobile: 4
- Section spacing: 72–120px desktop, 48–72px mobile

## Motion

- Micro: 180ms
- Component: 320ms
- Ambient: 6–12s
- Easing: `cubic-bezier(.22, 1, .36, 1)`
- Motion supports hierarchy only: card lift, slow gradient drift, gentle ornament float.
- All decorative motion stops under `prefers-reduced-motion: reduce`.

## Rules

1. Photography remains the focal point of editorial cards.
2. Use no more than two decorative motifs in one viewport.
3. Article pages stay calm, neutral, and readable.
4. Preserve the accented wordmark: Chévere.
5. Decorative elements are hidden from assistive technology and never carry meaning.
