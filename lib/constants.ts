/**
 * Server-fixed demo identity. The browser cannot vary this — an unauthenticated
 * client must never be able to choose whose mandate/subscriptions it spends against.
 * A real app would derive the customer from an authenticated session.
 */
export const DEMO_CUSTOMER = "metanoia_demo_customer";
