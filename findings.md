# PizzaStore UI overhaul findings and implementation brief

## 1. Audit scope and current-state summary

1. This brief covers UI/UX only: visual identity, composition, component styling, responsive behavior, interaction feedback, accessibility, and content presentation.
2. The audited frontend is React 19 + Mantine 7 + Tailwind 3. The customer storefront and admin portal share a codebase but currently do not share a coherent visual system.
3. The storefront currently starts directly with a generic "Our Menu" grid. It lacks a brand-led hero, value proposition, promotional content, discovery aids, or a clear first action.
4. Most screens use default white cards, gray backgrounds, medium shadows, and whichever red/orange/blue utility was convenient locally. This makes the product feel assembled from components instead of intentionally designed.
5. Visual styling is split between Mantine props, Tailwind utilities, inline styles, and the Mantine theme. The same semantic action can be red, orange, `brand`, `myColor`, or blue depending on the screen.
6. Typography has no defined family or scale. Headings, labels, prices, and body copy rely on framework defaults, so hierarchy is weak.
7. Spacing, radius, border, shadow, empty-state, loading-state, and page-width conventions are inconsistent.
8. The desktop storefront, mobile storefront, profile area, checkout, chat, admin dashboard, forms, and tables all need a common foundation before individual page polish.
9. Visual inspection through the in-app preview could not be completed because the preview connection was unavailable. Findings are based on a complete source-level audit of the routed pages, layouts, and shared UI components.

## 2. Recommended design direction

1. Position the product as a warm, modern neighborhood pizzeria rather than a generic food-delivery dashboard.
2. Use the creative direction **"Wood-fired warmth, modern convenience"**: editorial food imagery, warm off-white surfaces, tomato red as the main action color, basil green as a supporting signal, and charcoal typography.
3. Avoid the common "bright orange gradient everywhere" look. Food photography should provide most of the visual richness; interface chrome should stay calm and premium.
4. Storefront personality should feel appetizing, friendly, tactile, and energetic. Admin should use the same tokens but feel denser, quieter, and operational.
5. Use subtle pizza-inspired details only where useful: a round brand mark, lightly speckled warm background, curved image crops, ingredient micro-icons, or a restrained checker/accent motif. Do not use novelty pizza graphics throughout the UI.

## 3. Foundation: tokens and global styling

1. Replace the current competing red/orange palettes with one semantic palette:
   - `canvas`: `#F8F4EC` (warm page background)
   - `surface`: `#FFFDF8` (cards and panels)
   - `surface-muted`: `#F1EADF`
   - `ink`: `#201A17` (primary text)
   - `ink-muted`: `#6F665F`
   - `border`: `#E5DACE`
   - `brand`: `#C83E2B` (primary actions)
   - `brand-hover`: `#A92F20`
   - `brand-soft`: `#F9E4DE`
   - `basil`: `#39734E` (vegetarian/success)
   - `basil-soft`: `#E4F0E7`
   - `gold`: `#D69A2D` (ratings/highlights only)
   - `danger`: `#B42318`
2. Reserve semantic colors consistently: tomato for primary calls to action, basil for success/vegetarian state, amber for pending, blue for informational state, and red only for destructive/error state.
3. Configure these colors once in `src/main.tsx` and `tailwind.config.js`. Remove page-level color improvisation such as orange product actions, red checkout actions, blue support actions, and pink profile gradients.
4. Use one display typeface with warmth and character for major marketing headings, paired with a clean sans-serif for all controls and body text. Suggested pairing: `DM Serif Display` for large storefront headings and `Inter` for UI/body. Admin should use `Inter` exclusively.
5. Define a responsive type scale instead of arbitrary `text-xl`, `text-2xl`, and `text-3xl` choices:
   - display: 48/54 desktop, 36/42 tablet, 32/38 mobile
   - page title: 32/38 desktop, 26/32 mobile
   - section title: 24/30
   - card title: 18/24
   - body: 16/24
   - supporting text: 14/20
   - microcopy: 12/16
6. Set the global body background, foreground color, font smoothing, selection style, focus ring, link behavior, and reduced-motion handling in `src/index.css`.
7. Adopt a spacing system based on 4 px. Standard page gutters: 20 px mobile, 32 px tablet, 48 px desktop. Standard section rhythm: 48 px mobile and 72–88 px desktop.
8. Standardize maximum widths: storefront content 1200–1280 px; reading/form content 720–880 px; admin content 1440 px.
9. Standardize geometry: controls 10–12 px radius, cards 16–20 px radius, pills 999 px, modal/drawer panels 20–24 px radius where supported.
10. Replace strong generic shadows with subtle elevation: a soft base shadow for cards and a slightly larger hover shadow only on interactive cards. Use borders to structure admin surfaces.
11. Add reusable utility/component classes for `page-shell`, `section-heading`, `surface-card`, `primary-button`, `secondary-button`, `icon-button`, `status-pill`, and `empty-state` rather than repeating long utility strings.

## 4. Shared component system

1. Expand the Mantine theme in `src/main.tsx` to cover Button, Card/Paper, Input, Select, Modal, Drawer, Badge, Table, Pagination, Tooltip, Skeleton, and Notification defaults.
2. Define button hierarchy:
   - primary: solid tomato, white text
   - secondary: warm surface, dark text, visible border
   - tertiary: text/ghost action
   - destructive: danger styling, used only for delete/cancel
   - icon button: square 40–44 px touch target with tooltip/accessible label
3. Every async submit button should show a spinner and stable loading label, not only become disabled.
4. Inputs should have consistent label weight, 44–48 px height, warm-white background, clear focus ring, contextual helper/error text, and no decorative icons unless they improve scanning.
5. Create one page-header pattern: eyebrow/breadcrumb, title, concise supporting text, and right-aligned action area. Reuse across profile and admin pages.
6. Create one empty-state pattern with icon/illustration, specific message, and one next action. Replace bare text such as "Your cart is empty" and "No products available".
7. Create one skeleton strategy that mirrors final layouts. Avoid isolated centered loaders and literal "Loading..." text.
8. Create a standardized feedback layer for success, error, warning, and information notifications. The current one-second auto-close is too short; use roughly 4–6 seconds and keep messages actionable.
9. Replace `window.confirm` in the cart with a styled confirmation modal or undo toast.
10. Add tooltips and `aria-label` text to icon-only cart, profile, menu, close, settings, pagination, and table actions.
11. Ensure all interactive cards are semantic buttons/links and visibly keyboard-focusable. Menu category cards are currently clickable `div` elements.

## 5. Storefront shell and navigation

**Implementation status: Completed (2026-08-16).** The storefront now has a sticky branded header with a promotional strip, shared PizzaStore logo lockup and favicon, catalogue/order navigation, a compact cart-count pill, an account dropdown with role-aware admin access, and a full-height mobile drawer that closes after navigation. The main layout now exposes a skip link and stable content landmark. The footer has been rebuilt into brand, ordering, customer-information, and contact groups; placeholder social URLs and the nonexistent `/contact` link were removed. Because the application has no deals, policy, or standalone search destinations, the implemented shell only exposes working routes and actions; the find affordance takes customers directly to the menu catalogue.

1. Rebuild `src/components/main/navbar.tsx` as a sticky, high-clarity header with a thin promotional strip above it.
2. Give PizzaStore a simple text + icon logo lockup. Replace the Vite favicon in `frontend/index.html` with the same brand mark.
3. Desktop header composition: logo left; Menu / Deals / Track order links center; search affordance, profile, and cart right; prominent "Order now" action for signed-out users.
4. Show cart as an icon plus item count in a compact pill. The current tiny absolutely positioned badge is visually fragile.
5. Use a user/avatar dropdown for account, orders, addresses, admin entry (when applicable), and logout. Do not make logout a primary header button.
6. Mobile navigation should be a full-height sheet with clear grouped destinations, account state, and a bottom primary action. Close it automatically on navigation.
7. Keep the header height predictable and account for it in sticky cart/checkout panels.
8. Rebuild `src/components/main/footer.tsx` with four useful groups: brand promise, ordering links, help/legal links, and contact/hours. Remove dead links and placeholder social links until real destinations exist.
9. The footer `/contact` link currently points to a nonexistent route; either implement the destination or remove it from the UI.

## 6. Home/menu discovery experience

**Implementation status: Completed (2026-08-16).** The home route now opens with a concise, brand-led hero using an original PizzaStore food image, two ordering calls to action, and three purchase-confidence points. A compact offer/trust strip follows the hero. The catalogue now uses a horizontally scrollable category rail with an explicit, strongly differentiated “All” state; its mobile treatment becomes sticky beneath the storefront header. Category and sort changes reset pagination, the product heading reflects the active category, and the responsive sort control remains compact. Product loading skeletons mirror the grid, while menu errors and zero-result states provide clear recovery actions. URL-based category, sort, and page state is preserved, and the product grid now scales from one to four columns instead of crowding five cards across.

1. Recompose `src/pages/main/home.tsx` into a real landing page rather than only returning `<Menu />`.
2. Add a hero section with an appetizing pizza image, a direct headline, one short value proposition, primary "Order now" CTA, secondary "View menu" CTA, and 2–3 trust points such as fresh dough, fast delivery, or cash on delivery.
3. Keep the hero concise enough that the first menu categories remain partially visible on a common laptop viewport.
4. Add a compact offer/trust strip below the hero. It should support purchase confidence, not become a carousel.
5. Replace the large category image-card grid in `src/components/main/products/menu.tsx` with a horizontally scrollable category rail/chip system. The current category grid competes with the product catalogue and pushes products too far down.
6. Include an explicit "All" category and make active state obvious through background, border, text, and icon/image treatment—not a one-pixel orange border alone.
7. Selecting a category should reset product pagination to page 1.
8. Add a sticky mobile category/filter bar when the user reaches the catalogue.
9. Rename the generic "Products" heading to contextual copy such as "Popular right now" or the active category name, with result count where available.
10. Keep sorting in a compact control on desktop; on mobile move sort/filter into a bottom sheet or compact toolbar.
11. Add a polished zero-results state with "View all pizzas" reset action.

## 7. Product cards and customization

**Implementation status: Completed (2026-08-16).** Product cards now use a stable 4:3 image area, consistent height, restrained hover/focus treatment, a one-to-four-column responsive grid, and a clear image-to-action hierarchy. Broken images receive a neutral fallback without shifting layout. Vegetarian and non-vegetarian products use the familiar Indian outlined-square-and-dot mark with a text label, unavailable products retain readable details beneath a subdued overlay and disabled “Sold out” action, and signed-out customers always see “Sign in to add.” Prices use `formatPrice`, customization hints remain secondary, and add requests expose stable loading feedback. Catalogue paging uses the shared Mantine pagination control while retaining URL state. The customization drawer is full-width on mobile and capped at 480 px on desktop, with a dedicated scroll region, built-in persistent close affordance, product/base-price header, correctly grouped required/optional choices, radios for single-select groups, checkboxes for multi-select groups, unavailable-option handling, required-choice validation, loading/error/empty states, and a sticky live-total/add footer.

1. Redesign `src/components/main/products/product-card.tsx` around a strong 4:3 or square food image, stable card height, and clear information hierarchy.
2. Use a responsive grid of 1 column on very narrow screens, 2 on normal mobile/tablet, 3 on medium desktop, and 4 on large desktop. Five columns currently makes food cards too narrow.
3. Card content order: image; dietary/status badges; name; short description; optional customization hint; price; add action.
4. Make the entire visual card feel interactive while keeping the add button a distinct action. Use a gentle image zoom/lift on hover and a strong keyboard focus state.
5. Keep image aspect ratio stable, use a neutral placeholder, and avoid layout shifts when images load or fail.
6. Use the conventional vegetarian/non-vegetarian mark familiar to Indian users (green/brown-red outlined square with dot) instead of a leaf icon, with text retained where clarity benefits.
7. Always show the purchase action. Signed-out users should see "Sign in to add" or clicking "Add" should open authentication; hiding the action makes products look unavailable.
8. Show unavailable items with a subdued image overlay and disabled "Sold out" button while retaining readable content.
9. Use `formatPrice` everywhere for consistent Indian rupee formatting and remove ad hoc currency strings.
10. Replace raw Previous/Page/Next controls in `products.tsx` with the shared Mantine pagination pattern; preserve URL-based pagination.
11. Redesign `src/components/main/customize.tsx` as a structured product customizer with product name/base price header, grouped options, clear required/optional labels, radio controls for single-select groups, checkboxes for multi-select groups, and a sticky footer showing total + add action.
12. Do not represent single-select choices with checkboxes. Choice semantics must match the input control.
13. Make the customization drawer full-width on small mobile and 440–520 px on desktop, with its own scroll region and persistent close affordance.

## 8. Authentication and forms

**Implementation status: Completed (2026-08-16).** Login and registration now share a compact, brand-led authentication experience with welcoming task-specific copy and a clear sign-in/create-account switch. The redundant nested login Card was removed. `GlobalModal` now accepts optional per-use size, padding, radius, centering, outside-click, and full-screen presentation settings while retaining backward-compatible defaults; authentication uses a focused 440 px dialog. Password visibility is handled by Mantine’s accessible button control with explicit labels, registration names collapse to one column on narrow screens, submission loading labels remain stable, and reserved field space prevents validation messages from causing disruptive layout movement. Password-mismatch validation now appears beneath the confirmation field instead of at the form root. The same form grammar was applied to delivery addresses, support requests, and dashboard date selection: clear headings and explanations, associated labels, contextual placeholders, inline errors, responsive one/two-column groups, autocomplete/input-mode hints, disabled pending fields, and specific loading actions. Existing product/menu controls inherit the shared Mantine field defaults, while checkout coupon composition remains grouped with the checkout work in section 9.

1. Restyle login and registration as one coherent auth experience with brand context, welcoming title, concise supporting copy, and clear tab/switch behavior.
2. Remove the extra Card nested inside the login modal; it creates redundant surfaces and shadows.
3. Use a narrower auth modal than the global `lg` default. GlobalModal should accept per-use size and presentation options.
4. Password visibility controls must be proper buttons with accessible labels and adequate hit areas, not clickable icons.
5. Registration should collapse the two-column name row to one column on narrow mobile.
6. Keep validation messaging immediately below each field and preserve layout when errors appear.
7. Apply the same form grammar to `address-form.tsx`, admin product forms, menu forms, date selection, coupons, and support requests.

## 9. Cart and checkout

1. Redesign `src/pages/main/cart.tsx` as a clean commerce layout with a strong page header, editable item list, and sticky order summary on desktop.
2. On mobile, stack item content without squeezing quantity controls beside a 96 px image. Put quantity, edit/customize, and remove controls in a second row.
3. Make quantity a unified stepper with one border and 44 px touch targets rather than three visually separate small buttons.
4. Make remove a low-emphasis text/icon action and support undo after removal.
5. Group customization names beneath the item using quiet chips or inline text; current filled badges give minor options too much emphasis.
6. Add subtotal, delivery fee, discount, and total rows even if some are zero/free. The current summary only shows total and feels incomplete.
7. Add a persuasive empty-cart state with illustration/icon, "Your cart is waiting" copy, and "Browse the menu" CTA.
8. Add a mobile sticky checkout bar showing item count, total, and CTA so the next action is always reachable.
9. Recompose `src/pages/main/checkout.tsx` as a numbered three-step flow: contact, delivery address, and payment, with order summary on the right.
10. Remove the decorative gray gradient and translucent card. Use the same warm canvas and surface system as the storefront.
11. Make address cards selectable with a full-card radio pattern and visible selected check state. Add "Add new address" inline.
12. Coupon application belongs in the order-summary panel, not as a full equal-weight checkout card.
13. The order summary should list cart items or at least item count plus subtotal/discount/delivery/total; keep total visually dominant.
14. Rename "Proceed to Order" to a concrete action such as "Place cash-on-delivery order".
15. Add a back-to-cart link, order security/reassurance microcopy, disabled/loading state, and a clear error recovery state.

## 10. Profile, addresses, and order history

1. Make `ProfileLayout` responsive. The fixed 220 px sidebar should become a horizontal tab rail on tablet and a compact select/sheet on mobile.
2. Keep profile pages within one page shell; remove nested full-screen pink gradients that conflict with the parent layout and create double-height screens.
3. Replace the centered profile card with a practical account page: avatar/initials, identity details, account metadata, and editable sections.
4. Remove or implement the currently inert "Edit Profile" button. Never present dead UI as an available action.
5. Address cards should distinguish address type, primary address, edit, and delete actions. Present phone and postcode with meaningful labels/icons rather than undifferentiated text.
6. Add address creation as a clear page action and use a right-side drawer on desktop / full-screen sheet on mobile.
7. Give order history its own page header and status filters. The current request is fixed to `pending`, so the UI cannot communicate complete history.
8. On mobile, transform the order table into order cards instead of forcing horizontal table scrolling.
9. Order detail should use a visual status timeline, top summary, item list, delivery address, payment details, and coupon/total breakdown in a predictable order.
10. Standardize status spelling and display. The UI types currently use `delievered` while constants expose `delivered`; this will cause inconsistent labels/states.

## 11. Support/chat UI

1. Restyle the floating support action to match the tomato/basil system. It is currently blue while the chat window is orange and the rest of the brand is red.
2. On mobile, position the support control above the sticky checkout/cart action and respect safe-area insets.
3. Give the chat request modal a helpful explanation and a more specific field label such as "What do you need help with?".
4. Redesign chat bubbles based on message ownership, not sender type alone. The current color assignment can conflict between user and admin views.
5. Use localized timestamps, delivery/sending feedback, empty conversation text, and a disabled send state for blank/pending messages.
6. The settings icon currently has no visible function; remove it or implement a real menu.
7. Do not claim "Online" unless presence is known. Use "Support chat" or an accurate session status.
8. Constrain the chat to viewport dimensions; make it full-screen on small devices and a 420–480 px panel on desktop.

## 12. Admin shell and dashboard

1. Keep the storefront palette but shift admin composition to a neutral operational workspace: warm white/very light gray canvas, crisp borders, minimal shadows, and tomato used only for active/primary actions.
2. Rebuild `AdminLayout` with a persistent desktop sidebar, sticky top bar, page breadcrumbs/title, optional search, notifications, and admin avatar menu.
3. The sidebar needs a PizzaStore Admin brand lockup, clearer section grouping, bottom account/logout region, and compact/collapsed desktop state.
4. Mobile admin needs a top app bar and overlay drawer. Ensure the fixed menu button never overlaps page titles or controls.
5. Remove the Coupons navigation item unless a route/page is implemented; it currently points to `/admin/coupons`, which falls through to the global 404.
6. Dashboard composition should be: title/date control; KPI cards; primary trend chart; secondary chart/breakdown; recent orders or operational queue.
7. Stack dashboard charts below 1024 px. The current always-horizontal `flex` layout is too compressed on tablets/mobile.
8. KPI cards should use a small tinted icon container, concise label, large value, trend annotation, and comparison period. Avoid strong hover elevation on non-clickable cards.
9. Use consistent chart colors and accessible tooltips/legends. Revenue should use tomato; orders can use basil or ink; grid lines should be subtle.
10. Date filtering should be an obvious range control in the page toolbar, not a decorative gradient button that opens an untitled modal.
11. Replace dashboard "Loading..." with KPI and chart skeletons.

## 13. Admin tables, lists, and forms

1. Wrap all admin tables in a standard data-view surface with page header, search/filter toolbar, table, selection/bulk actions where relevant, and pagination footer.
2. Strengthen table hierarchy with quiet header background, 44–52 px rows, consistent alignment, tabular numerals for prices, and right-aligned row actions.
3. On smaller viewports either hide nonessential columns with a details drawer or switch to cards. Horizontal overflow alone is not a sufficient mobile treatment.
4. Search inputs need a visible label or accessible name and responsive width. Filters should show active state and offer "Clear all".
5. Use action menus for secondary row actions instead of multiple equally weighted buttons.
6. Standardize product image thumbnails, availability indicators, veg/non-veg marks, price formatting, and status pills across product/order/menu tables.
7. Product and menu create/edit forms should be divided into meaningful sections, use a responsive two-column grid, include image upload/preview guidance, and end with a sticky save/cancel action bar.
8. Customization management should use expandable groups or a master-detail layout. Current bordered blocks with scattered buttons are hard to scan as data grows.
9. Menu assignment/transfer UI should clearly communicate source and destination, selection count, disabled states, and success feedback.
10. Order detail should share the customer order-detail primitives but add admin-only status controls and audit/next-action context.
11. Support sessions should show queue priority, customer, topic, age/wait time, status, and a clear accept/open action.

## 14. Responsive and accessibility requirements

1. Treat 360 px as the minimum supported mobile width and test at 360, 390, 768, 1024, 1280, and 1440 px.
2. No primary action, table action, quantity control, drawer, modal, or floating support button may overflow or overlap at these widths.
3. Use minimum 44 × 44 px touch targets for mobile controls.
4. Maintain at least WCAG AA contrast for text and controls. Do not rely on color alone for active, vegetarian, error, or order-status meaning.
5. Every icon-only control needs an accessible name; every form control needs an associated label; every image needs meaningful alt text or empty alt when decorative.
6. Use visible `:focus-visible` rings with adequate offset on links, buttons, cards, fields, tabs, and menu items.
7. Respect reduced motion. Limit animation to short opacity/transform transitions, image hover, skeletons, and purposeful status feedback.
8. Modals and drawers must trap focus, restore focus on close, have descriptive titles, and remain dismissible unless an irreversible operation is in progress.
9. Use semantic headings in order, `nav`/`main`/`footer` landmarks, real buttons for actions, real links for navigation, and proper table markup.
10. Loading, error, success, unavailable, selected, disabled, and empty states must all have both visual and textual feedback.

## 15. Content and visual QA cleanup

1. Replace generic labels such as "Products", "Proceed to Order", and "Chat Title" with specific, task-oriented copy.
2. Keep capitalization consistent: sentence case for UI labels and title case only for brand/major headings.
3. Use one price formatter everywhere, with consistent decimals and Indian rupee formatting.
4. Validate the copyright character, rupee symbol, dash characters, and source-file encoding in the rendered UI; some terminal reads displayed mojibake even though direct searches found valid symbols in several files.
5. Remove dead or placeholder controls: footer social `#` links, nonexistent Contact and Coupons destinations, profile edit button, and chat settings icon unless implemented.
6. Give every page a designed loading, empty, error, and success state rather than a loader or one line of text floating on the page.
7. Replace array indexes as visual list keys where stable IDs exist; UI transitions and table updates should not jump unexpectedly.

## 16. Suggested implementation order

1. **P0 — Design foundation:** implement tokens, fonts, body styles, Mantine defaults, focus states, page shells, shared buttons, cards, inputs, badges, status pills, skeletons, empty states, and notifications.
2. **P0 — Storefront conversion path:** rebuild navbar, home hero, category rail, product grid/cards, customization drawer, cart, and checkout.
3. **P0 — Responsive/accessibility pass:** verify navigation, grids, cart controls, checkout, drawers, dialogs, and keyboard behavior at all target widths.
4. **P1 — Account journey:** redesign auth, profile layout, profile, addresses, order history, and order detail/status timeline.
5. **P1 — Admin shell/data views:** rebuild admin shell, dashboard, table toolbar/table/card patterns, and mobile layouts.
6. **P1 — Admin forms/workflows:** restyle product, menu, customization, order, and support interfaces.
7. **P2 — Delight/polish:** branded favicon/logo, tasteful motion, image loading/fallbacks, chat refinement, copy pass, and final visual regression review.

## 17. File-level implementation map

1. Global tokens/theme: `frontend/src/index.css`, `frontend/tailwind.config.js`, `frontend/src/main.tsx`, `frontend/index.html`.
2. Shared shells: `frontend/src/layouts/main-layout.tsx`, `frontend/src/layouts/profile-layout.tsx`, `frontend/src/layouts/admin-layout.tsx`.
3. Storefront navigation/brand: `frontend/src/components/main/navbar.tsx`, `frontend/src/components/main/footer.tsx`.
4. Home/catalogue: `frontend/src/pages/main/home.tsx`, `frontend/src/components/main/products/menu.tsx`, `products.tsx`, `product-card.tsx`, `frontend/src/components/main/customize.tsx`.
5. Conversion: `frontend/src/pages/main/cart.tsx`, `frontend/src/pages/main/checkout.tsx`.
6. Auth/account: `frontend/src/components/auth/*`, `frontend/src/components/main/profile/*`, `frontend/src/pages/main/profile/*`, `frontend/src/components/main/address-form.tsx`.
7. Reusable commerce/order UI: `frontend/src/components/common/order-*`, `global-modal.tsx`, `error-boundary.tsx`.
8. Admin shell/dashboard: `frontend/src/components/admin/sidebar.tsx`, `frontend/src/pages/admin/home.tsx`, `frontend/src/components/admin/dashboard/*`.
9. Admin data views/forms: `frontend/src/components/table/*`, `frontend/src/components/admin/products/*`, `menu/*`, `order/*`, `support/*`, `transfer.tsx`, and corresponding `frontend/src/pages/admin/*` pages.
10. Chat/support: `frontend/src/components/common/chat.tsx`, `frontend/src/components/main/chat/*`, `frontend/src/pages/admin/admin-chat.tsx`.

## 18. Definition of done for the UI overhaul

1. Storefront and admin clearly belong to the same brand while remaining appropriate to their different tasks.
2. One documented token system controls color, typography, spacing, radius, shadow, states, and component defaults.
3. The home page communicates the product and provides a clear route to ordering before the first scroll.
4. A user can discover a product, customize it, edit the cart, and place an order with a visually continuous experience.
5. All routes have intentional loading, empty, error, and success states.
6. All major layouts work without overlap or horizontal page scrolling at the target viewport widths.
7. All interactive elements are keyboard reachable, visibly focused, semantically correct, and large enough for touch.
8. No visible dead links, inert actions, placeholder controls, inconsistent status names, or competing brand colors remain.
9. The overhaul passes a final visual review at mobile, tablet, laptop, and wide desktop sizes, plus a keyboard-only and reduced-motion pass.
