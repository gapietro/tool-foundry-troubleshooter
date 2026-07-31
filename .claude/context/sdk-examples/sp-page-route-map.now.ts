/**
 * VALIDATED — Built and installed successfully against SDK 4.6.0 on
 * 2026-04-30. No code changes required from the original signature-grounded
 * draft.
 *
 * Golden Example: SPPageRouteMap — Page redirect rules within a portal
 *
 * SDK Docs: https://servicenow.github.io/sdk/api/service-portal/sp-page-route-map
 * Import:   import { SPPageRouteMap } from '@servicenow/sdk/core'
 * Requires: SDK >= 4.6.0
 *
 * Key concepts:
 *   - routeFromPage / routeToPage accept page sys_id strings, Record<'sp_page'>
 *     references, or SPPage() expressions — keep them stable across env.
 *   - portals (optional): scope the redirect to one or more portals. Omit to
 *     apply to ALL portals — usually not what you want.
 *   - roles  (optional): only redirect users with these roles. Omit to apply
 *     to all users.
 *   - order (default 10): when multiple route maps match the same source page,
 *     lower numbers run first. Use this to layer role-specific redirects above
 *     a default.
 *   - Common pitfall: redirect loops — make sure routeToPage isn't itself the
 *     source of another active route map for the same scope.
 */

import '@servicenow/sdk/global'
import { SPPageRouteMap } from '@servicenow/sdk/core'

// Replace the sys_ids below with the actual page/portal sys_ids on your
// target instance. (Or use Now.ref('sp_page', { id: 'home' }) to look up
// pages by slug at build time.)
const HOME_PAGE_OLD = 'a4e3c21047132100ba13a5554ee49001'
const HOME_PAGE_NEW = '07261a2147132100ba13a5554ee49092'
const ITIL_DASHBOARD = 'c6e5e42047132100ba13a5554ee49003'
const SP_PORTAL_SP = 'fe12dbbed14bd3f712f0787141c2f656'

// ---------------------------------------------------------------------------
// Example 1: Default redirect — old home → new home, all portals, all users
// ---------------------------------------------------------------------------
export const redirectOldHome = SPPageRouteMap({
  $id: Now.ID['route-old-home-to-new'],
  routeFromPage: HOME_PAGE_OLD,
  routeToPage: HOME_PAGE_NEW,
  shortDescription: 'Send legacy home-page URLs to the new home page',
  active: true,
  order: 100, // Lower-priority default — role-specific rules below override
})

// ---------------------------------------------------------------------------
// Example 2: ITIL-only override — redirect itil users to a richer dashboard
// ---------------------------------------------------------------------------
// Higher priority (lower `order`) than the default rule above, so itil users
// hitting the old home end up on their ops dashboard instead of the public
// home page. Scoped to the standard "sp" portal only.
export const redirectItilToDashboard = SPPageRouteMap({
  $id: Now.ID['route-itil-to-dashboard'],
  routeFromPage: HOME_PAGE_OLD,
  routeToPage: ITIL_DASHBOARD,
  shortDescription: 'Route itil users from the old home page to the ITIL dashboard',
  portals: [SP_PORTAL_SP],
  roles: ['itil'],
  active: true,
  order: 50,
})
