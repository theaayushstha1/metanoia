"""Shared helpers for Metanoia's visible Playwright demo tours."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from playwright.sync_api import BrowserContext, Page, Playwright


BASE_URL = os.environ.get("METANOIA_DEMO_URL", "http://localhost:3000").rstrip("/")
ARTIFACT_DIR = Path(os.environ.get("METANOIA_DEMO_ARTIFACTS", "/private/tmp/metanoia-demo"))
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def log(message: str) -> None:
    print(message, flush=True)


def launch_context(playwright: Playwright) -> BrowserContext:
    browser = playwright.chromium.launch(
        channel="chrome",
        headless=False,
        slow_mo=140,
        args=["--start-maximized"],
    )
    return browser.new_context(
        viewport={"width": 1440, "height": 900},
        reduced_motion="no-preference",
    )


def phase(page: Page, number: str, title: str, detail: str, tone: str = "blue") -> None:
    colors = {
        "blue": ("#2b6bf3", "#eef4ff"),
        "green": ("#148746", "#ecfbf2"),
        "amber": ("#9a6500", "#fff7df"),
        "red": ("#c62f36", "#fff0f1"),
    }
    foreground, background = colors[tone]
    payload = {
        "number": number,
        "title": title,
        "detail": detail,
        "foreground": foreground,
        "background": background,
    }
    page.evaluate(
        """
        (data) => {
          document.getElementById('metanoia-demo-guide')?.remove();
          const guide = document.createElement('div');
          guide.id = 'metanoia-demo-guide';
          Object.assign(guide.style, {
            position: 'fixed', top: '74px', right: '22px', zIndex: '2147483647',
            width: '360px', padding: '15px 17px', borderRadius: '10px',
            border: `1px solid ${data.foreground}55`, background: data.background,
            color: '#111827', boxShadow: '0 14px 40px rgba(20,40,90,.20)',
            fontFamily: 'system-ui, -apple-system, sans-serif', pointerEvents: 'none'
          });
          guide.innerHTML = `
            <div style="font:700 11px ui-monospace,monospace;letter-spacing:.12em;color:${data.foreground}">
              DEMO ${data.number}
            </div>
            <div style="font-size:17px;font-weight:750;margin-top:6px">${data.title}</div>
            <div style="font-size:13px;line-height:1.45;color:#536076;margin-top:5px">${data.detail}</div>`;
          document.body.appendChild(guide);
        }
        """,
        payload,
    )
    log(f"[{number}] {title}: {detail}")


def hold(seconds: float = 4.0) -> None:
    time.sleep(seconds)


def screenshot(page: Page, name: str) -> None:
    path = ARTIFACT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    log(f"    screenshot: {path}")


def wait_for_result(page: Page, timeout_ms: int = 150_000) -> str:
    page.wait_for_function(
        """
        () => {
          const text = document.body.innerText;
          return text.includes('Confirm subscription') ||
            text.includes('NO MATCH FOUND') ||
            text.includes('Denied.');
        }
        """,
        timeout=timeout_ms,
    )
    body = page.locator("body").inner_text()
    if "Confirm subscription" in body:
        return "approved"
    if "Denied." in body:
        return "denied"
    return "no-match"


def scroll_page(page: Page, stops: tuple[float, ...] = (0.0, 0.38, 0.72, 1.0), pause: float = 2.0) -> None:
    for stop in stops:
        page.evaluate(
            "fraction => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * fraction, behavior: 'smooth' })",
            stop,
        )
        hold(pause)


def fail_visible(page: Page, name: str, error: BaseException) -> None:
    log(f"FAILED: {error}")
    try:
        phase(page, "ERROR", "Tour stopped on a real error", str(error)[:240], "red")
        screenshot(page, f"{name}-error")
        hold(15)
    except Exception:
        pass
    sys.exit(1)
