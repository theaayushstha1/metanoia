"""Visible end-to-end checkout, receipt, ownership, subscription, and lab tour."""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import Page, sync_playwright

from demo_common import BASE_URL, fail_visible, hold, launch_context, log, phase, screenshot, scroll_page, wait_for_result


IFRAME_ID = "#orca-payment-element-iframeRef-orca-elements-payment-element-unified-checkout"


def fill_checkout(page: Page) -> None:
    page.wait_for_selector(IFRAME_ID, state="attached", timeout=90_000)
    frame = page.frame_locator(IFRAME_ID)
    frame.locator('[name="cardNoInput"]').wait_for(state="visible", timeout=90_000)

    checkboxes = frame.locator('input[type="checkbox"]')
    for index in range(checkboxes.count()):
        checkbox = checkboxes.nth(index)
        if checkbox.is_visible() and not checkbox.is_checked():
            checkbox.check(force=True)

    frame.locator('[name="cardNoInput"]').fill("4242424242424242")
    frame.locator('[name="expiryInput"]').fill("1233")
    frame.locator('[name="cvvInput"]').fill("123")

    consent = page.locator('label:has-text("I authorize Metanoia") input[type="checkbox"]')
    consent.check()


def payment_error(page: Page) -> str:
    paragraphs = page.locator("form p")
    messages = []
    for index in range(paragraphs.count()):
        text = paragraphs.nth(index).inner_text().strip()
        if text:
            messages.append(text)
    return " | ".join(messages[-2:]) or "Checkout did not return a succeeded payment."


def run() -> None:
    with sync_playwright() as playwright:
        owner = launch_context(playwright)
        page = owner.new_page()
        page.set_default_timeout(150_000)
        try:
            log(f"Visible payment tour: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=120_000)
            page.get_by_role("button", name="email", exact=True).click()
            phase(
                page,
                "1/8",
                "Procure a service before paying",
                "The agent ranks eligible email providers, then the user explicitly confirms the server-final choice.",
            )
            page.get_by_role("button", name="Run Metanoia").click()
            outcome = wait_for_result(page)
            if outcome != "approved":
                raise RuntimeError(f"Expected an approved result, got {outcome}.")
            page.get_by_role("button", name="Confirm subscription").click()
            page.wait_for_url(re.compile(r"/checkout\?plan="), timeout=90_000)

            phase(
                page,
                "2/8",
                "Hyperswitch Unified Checkout",
                "Card data stays inside the hosted iframe. Metanoia receives payment state and safe masked details, never PAN or CVC.",
            )
            fill_checkout(page)
            screenshot(page, "payment-01-checkout-ready")
            hold(5)

            phase(
                page,
                "3/8",
                "Submit exactly once",
                "The checkout consent is explicit. A deterministic payment ID protects retries from creating a second charge.",
                "amber",
            )
            pay_button = page.get_by_role("button", name=re.compile(r"^Pay \$"))
            pay_button.click()
            try:
                page.wait_for_url(re.compile(r"/checkout/complete\?payment_id=pay_"), timeout=90_000)
            except Exception as error:
                raise RuntimeError(payment_error(page)) from error

            payment_id = parse_qs(urlparse(page.url).query).get("payment_id", [""])[0]
            if not payment_id.startswith("pay_"):
                raise RuntimeError(f"Receipt URL did not contain a real payment ID: {page.url}")

            phase(
                page,
                "4/8",
                "Authoritative payment receipt",
                "The receipt retrieves the real Hyperswitch payment, records the subscription, issues a credential, and proves the capability endpoint returns 200.",
                "green",
            )
            scroll_page(page, (0.0, 0.28, 0.55, 0.8, 1.0), 2.3)
            screenshot(page, "payment-02-receipt")

            phase(
                page,
                "5/8",
                "Signed webhook delivered",
                "Hyperswitch emitted the event; the ingress and Cloud Run verified its HMAC; Cloud SQL recorded it for this payment.",
                "green",
            )
            page.reload(wait_until="domcontentloaded", timeout=120_000)
            page.get_by_text("Signed webhook delivered", exact=True).scroll_into_view_if_needed()
            hold(6)

            page.goto(f"{BASE_URL}/subscriptions", wait_until="domcontentloaded", timeout=120_000)
            phase(
                page,
                "6/8",
                "Subscription lifecycle controls",
                "The active plan consumes the monthly cap. Cancellation has an explicit confirmation and revokes budget and capability access.",
            )
            cancel = page.get_by_role("button", name="Cancel", exact=True)
            if cancel.count() > 0:
                cancel.first.click()
            screenshot(page, "payment-03-subscriptions")
            hold(5)

            foreign = owner.browser.new_context(viewport={"width": 1440, "height": 900})
            outsider = foreign.new_page()
            outsider.set_default_timeout(120_000)
            outsider.goto(f"{BASE_URL}/checkout/complete?payment_id={payment_id}", wait_until="domcontentloaded", timeout=120_000)
            phase(
                outsider,
                "7/8",
                "Cross-session receipt access is blocked",
                "A fresh browser knows the payment ID but does not own it, so masked card and connector data are not disclosed.",
                "green",
            )
            outsider.get_by_text("No payment for this session", exact=False).wait_for(timeout=60_000)
            screenshot(outsider, "payment-04-session-isolation")
            hold(6)
            foreign.close()

            page.goto(f"{BASE_URL}/lab", wait_until="domcontentloaded", timeout=120_000)
            phase(
                page,
                "8/8",
                "Live payment operations lab",
                "Only this session's payments appear. Status refresh retrieves one payment at a time; refunds require a second confirmation.",
            )
            refresh = page.get_by_role("button", name="Refresh status", exact=True)
            if refresh.count() > 0:
                refresh.first.click()
                page.get_by_role("button", name="Refresh status", exact=True).first.wait_for(state="visible", timeout=60_000)
                hold(3)
            refund = page.get_by_role("button", name="Refund", exact=True)
            if refund.count() > 0:
                refund.first.click()
                page.get_by_role("button", name="Confirm refund", exact=True).wait_for(timeout=30_000)
            scroll_page(page, (0.0, 0.45, 0.85), 2.0)
            screenshot(page, "payment-05-lab")
            log(f"PAYMENT TOUR PASSED: {payment_id}")
            hold(15)
        except BaseException as error:
            fail_visible(page, "payment-tour", error)
        finally:
            owner.browser.close()


if __name__ == "__main__":
    run()
