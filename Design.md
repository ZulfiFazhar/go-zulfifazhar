---
version: alpha
name: Cloudflare
description: A bright, high-contrast enterprise web system with a confident orange accent and minimal visual clutter.
colors:
  primary: "#ff5e1f"
  secondary: "#262626"
  tertiary: "#f0f0f0"
  neutral: "#ffffff"
  surface: "#ffffff"
  on-surface: "#262626"
  error: "#e5484d"
  primary-contrast: "#ffffff"
  primary-soft: "#ffefe8"
  neutral-100: "#ffffff"
  neutral-200: "#f7f7f7"
  neutral-300: "#f0f0f0"
  neutral-900: "#1f1f1f"
typography:
  headline-display:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "56px"
    fontWeight: 500
    lineHeight: "67px"
    letterSpacing: "-1.4px"
  headline-lg:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "43px"
    fontWeight: 500
    lineHeight: "48px"
    letterSpacing: "-1.2px"
  headline-md:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "33px"
    fontWeight: 500
    lineHeight: "40px"
    letterSpacing: "-0.45px"
  headline-sm:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "25px"
    fontWeight: 500
    lineHeight: "32px"
    letterSpacing: "-0.8px"
  body-lg:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: "29px"
    letterSpacing: "-0.48px"
  body-md:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "-0.2px"
  body-sm:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.1px"
  label-lg:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "-0.15px"
  label-md:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
    letterSpacing: "-0.1px"
  label-sm:
    fontFamily: "FT Kunst Grotesk"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0px"
  mono-sm:
    fontFamily: "Apercu Mono Pro"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.02em"
rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "12px"
  md: "24px"
  lg: "48px"
  xl: "80px"
  gutter: "24px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.neutral-900}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.neutral-200}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.full}"
  button-secondary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
    height: "50px"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: "0px"
  card:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.sm}"
    padding: "32px"
  input:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
---

# Cloudflare

## Overview
Cloudflare’s visual system feels fast, direct, and enterprise-grade, with a distinctly upbeat energy driven by the vivid orange accent. The interface is spacious and highly legible, using minimal ornamentation so content and calls to action stay dominant. It balances technical confidence with a friendly, modern tone.

## Colors
- **Primary (#ff5e1f):** The signature Cloudflare orange, used for hero panels, accent surfaces, badges, and energetic emphasis. It carries the brand voice and gives the system its warm, high-visibility character.
- **Secondary (#262626):** A deep near-black used for primary text, navigation, and strong contrast against white surfaces. It keeps the UI crisp and professional without feeling harsh.
- **Tertiary (#f0f0f0):** A light neutral for borders, subtle separation, and low-emphasis chrome. It supports the layout without competing with the brand color.
- **Neutral / Surface (#ffffff):** The main canvas color for pages, controls, and readable content areas. White space is a major part of the brand’s clarity.
- **On-surface (#262626):** The default text color on white backgrounds, matching the strong editorial contrast seen in the screenshot.
- **Primary contrast (#ffffff):** Used for text and icons on orange cards and filled accent areas to preserve legibility.
- **Primary soft (#ffefe8):** A gentle tint for highlights, glows, and supportive accent backgrounds when the full orange would be too intense.
- **Error (#e5484d):** Reserved for alerts and urgent states; it should stay distinct from the brand orange so warnings remain unambiguous.

## Typography
Cloudflare uses FT Kunst Grotesk as the primary voice: clean, modern, and slightly condensed in appearance, with a confident editorial rhythm. Headings are medium weight and tightly tracked, especially at large sizes, which gives the page a bold, product-led personality. Body text stays readable at 16px–19px with restrained negative letter spacing, while labels and buttons lean into 500 weight for clarity and utility.

Headlines should follow a clear hierarchy:
- `headline-display` for major hero statements
- `headline-lg` and `headline-md` for section introductions
- `headline-sm` for supporting module titles

Body and label styles should stay measured:
- `body-lg` for hero subcopy and prominent explanatory text
- `body-md` for general content and form copy
- `body-sm` for secondary notes and dense UI text
- `label-lg`, `label-md`, and `label-sm` for buttons, chips, and navigation

The system does not rely on uppercase branding text as a core rule; instead, it uses weight, size, and spacing to create emphasis. Mono text may be used sparingly for technical metadata or system-like annotations, but it should remain secondary.

## Layout & Spacing
The layout is fluid and wide, with a large central hero card that sits within generous page margins. Content is centered and vertically stacked, making the marketing message immediately legible. Spacing follows a simple rhythm based on 4px, 12px, 24px, 48px, and 80px increments, with 24px and 48px doing most of the work in content separation.

Use broad section padding and comfortable internal card padding:
- Small inline gaps for icon/text pairings and dense nav items
- Medium spacing for grouped content and form rows
- Large spacing for hero sections, stacked marketing blocks, and page transitions

Containers should feel expansive rather than boxed-in. Cards and panels should have enough breathing room to let the orange background and typography carry the composition.

## Elevation & Depth
The system is intentionally flat in structure, with almost no traditional shadow-based layering. Hierarchy is achieved through strong color contrast, large type, and clear spacing rather than heavy elevation. When depth appears, it is subtle and atmospheric: soft glow-like effects, faint inset treatment, and gentle tonal transitions on the hero card.

Borders are minimal and light, used only to define pills, chips, or subtle UI edges. Avoid dramatic drop shadows; the brand’s polish comes from clarity, not material illusion.

## Shapes
The shape language is friendly and polished, with a strong preference for rounded pills on interactive elements. Buttons, chips, and search controls use `rounded.full` to feel approachable and modern. Larger panels use light rounding such as `rounded.sm` so the interface keeps a clean architectural structure without becoming soft or playful.

Overall, shapes should read as simple and confident:
- Pills for actions and badges
- Small radius for cards and feature surfaces
- No decorative corner treatments or irregular geometry

## Components
### Buttons
Primary buttons use `button-primary`: white fill, dark text, pill radius, and a 50px height. They should feel prominent but not loud, with generous horizontal padding (`12px 24px`) and medium-weight text. Secondary buttons use `button-secondary` and carry the orange accent surface with dark text for a more branded action. Tertiary buttons use `button-tertiary` and should remain text-like, transparent, and minimally framed.

Button guidance:
- Keep min-height around 50px for all prominent actions
- Use pill rounding consistently
- Preserve comfortable horizontal padding for desktop readability
- Hover states should change tone subtly, not structurally
- Disabled states should reduce contrast without introducing new colors

### Cards
Cards use the `card` token: orange background, white text, `rounded.sm`, and `32px` padding. They function as the main hero and promotional surfaces, so they should feel expansive, high-energy, and uncluttered. Cards may include subtle inset glows or soft lighting, but should not rely on borders or shadows for definition.

### Inputs
Inputs should follow the same pill language as buttons, with white backgrounds, dark text, and moderate internal padding. Keep form controls visually calm and easy to scan. Focus states should be clear and accessible, ideally using the primary orange as an outline or glow rather than a heavy border.

### Chips and Badges
Chips use the `chip` token: filled orange, white text, pill radius, and compact padding. They work well for announcements, tags, and status labels such as the “Connect 2026” badge in the hero. Keep them compact, legible, and never overly dense.

### Navigation and Links
Navigation is simple and text-forward, with small separators and occasional icon indicators. Links should remain understated, using the `button-tertiary` treatment or a similar underline-based style where necessary. The top bar should stay lightweight so the hero remains the focal point.

### Search / Icon Buttons
Circular or pill-shaped icon controls should stay minimal, with white backgrounds and thin neutral borders. Use them sparingly and keep icon weight consistent with the rest of the system.

## Do's and Don'ts
- Do keep orange reserved for high-value emphasis, hero surfaces, and branded actions.
- Do use large type sizes and tight tracking for headlines to match the editorial feel.
- Do preserve generous whitespace around major marketing sections and primary CTAs.
- Do rely on contrast and spacing, not heavy shadows, to establish hierarchy.
- Don't introduce saturated secondary colors that compete with the primary orange.
- Don't use overly decorative borders, gradients, or complex shadows on common UI elements.
- Don't make buttons small or cramped; keep pill CTAs roomy and legible.
- Don't let text drift into low-contrast gray-on-white combinations that weaken the clean enterprise tone.
