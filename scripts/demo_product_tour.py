"""Visible tour of procurement, decision authority, refinement, and refusals."""

from playwright.sync_api import sync_playwright

from demo_common import BASE_URL, fail_visible, hold, launch_context, log, phase, screenshot, scroll_page, wait_for_result


def run() -> None:
    with sync_playwright() as playwright:
        context = launch_context(playwright)
        page = context.new_page()
        page.set_default_timeout(150_000)
        try:
            log(f"Visible product tour: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=120_000)
            phase(
                page,
                "1/7",
                "Set context and a spending mandate",
                "The user supplies project signals. Budget, per-charge cap, and service slots are server-enforced.",
            )
            scroll_page(page, (0.0, 0.32, 0.62, 1.0), 1.8)
            screenshot(page, "product-01-workbench")

            page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})")
            page.get_by_role("button", name="LLM", exact=True).click()
            phase(
                page,
                "2/7",
                "Ask for an LLM provider",
                "Gemini extracts requirements and four advisory scouts compare price, value, reliability, and market signals.",
            )
            page.get_by_role("button", name="Run Metanoia").click()
            outcome = wait_for_result(page)
            if outcome != "approved":
                raise RuntimeError(f"Expected an approved LLM result, got {outcome}.")

            phase(
                page,
                "3/7",
                "Model proposes; deterministic server decides",
                "The UI exposes the model proposal, server-final choice, score parts, and SpendGuard audit.",
                "green",
            )
            scroll_page(page, (0.0, 0.3, 0.58, 0.86), 2.0)
            screenshot(page, "product-02-decision-authority")

            phase(
                page,
                "4/7",
                "Refine without weakening the mandate",
                "The user asks for a cheaper option. The same deterministic ranker and SpendGuard run again.",
            )
            page.get_by_role("button", name="Find something cheaper", exact=True).click()
            page.wait_for_function(
                "() => document.body.innerText.includes('NOT QUITE? TELL THE AGENT') && !document.body.innerText.includes('FOUR SCOUTS ANALYZING IN PARALLEL')",
                timeout=150_000,
            )
            scroll_page(page, (0.0, 0.42, 0.76), 1.8)
            screenshot(page, "product-03-refinement")

            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=120_000)
            page.get_by_role("button", name="over-budget", exact=True).click()
            phase(
                page,
                "5/7",
                "Prove the card cannot override policy",
                "This request intentionally exceeds the mandate. SpendGuard must refuse before checkout exists.",
                "amber",
            )
            page.get_by_role("button", name="Run Metanoia").click()
            outcome = wait_for_result(page)
            if outcome != "denied":
                raise RuntimeError(f"Expected a mandate denial, got {outcome}.")
            screenshot(page, "product-04-spendguard-denial")
            hold(5)

            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=120_000)
            request = page.get_by_label("Describe what your agent should procure")
            request.fill("Please water my plants every Tuesday.")
            phase(
                page,
                "6/7",
                "Handle an out-of-market request honestly",
                "Metanoia should say the marketplace has no match, not force an unrelated service into checkout.",
            )
            page.get_by_role("button", name="Run Metanoia").click()
            outcome = wait_for_result(page)
            if outcome != "no-match":
                raise RuntimeError(f"Expected NO MATCH FOUND, got {outcome}.")
            screenshot(page, "product-05-no-match")
            hold(5)

            page.goto(f"{BASE_URL}/lab", wait_until="domcontentloaded", timeout=120_000)
            phase(
                page,
                "7/7",
                "Payment scenario laboratory",
                "Official sandbox cards cover success, decline, insufficient funds, and 3DS without faking processor buttons.",
                "green",
            )
            scroll_page(page, (0.0, 0.4, 0.8), 2.0)
            screenshot(page, "product-06-test-lab")
            log("PRODUCT TOUR PASSED")
            hold(12)
        except BaseException as error:
            fail_visible(page, "product-tour", error)
        finally:
            context.browser.close()


if __name__ == "__main__":
    run()
