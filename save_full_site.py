"""
Полный краулер всех разделов SeedAim Cloud:
- Dashboard (dashboard.php / index.php)
- Scanner (scanner.php)
- Upgrade (tariffs.php)
- Payment (payment.php)
- FAQ (faq.php)
- Сохраняет только чистый HTML и перелинковывает все ссылки и формы локально.
"""

import os
import re
from playwright.sync_api import sync_playwright

LOGIN_URL = "https://cloud.seedaim.com/index.php"
BASE_URL = "https://cloud.seedaim.com"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

EMAIL = "asdfsbgsdg@sdf.de"
PASSWORD = "r6G-tQB-FB7-XyG"

TARGET_PAGES = [
    ("dashboard", f"{BASE_URL}/dashboard.php", "dashboard.html"),
    ("scanner", f"{BASE_URL}/scanner.php", "scanner.html"),
    ("upgrade", f"{BASE_URL}/tariffs.php", "upgrade.html"),
    ("payment", f"{BASE_URL}/payment.php", "payment.html"),
    ("faq", f"{BASE_URL}/faq.php", "faq.html"),
]

def clean_and_relink(html):
    # Очистка путей к локальным ассетам
    html = re.sub(r'href="assets/css/app\.css\?[^"]+"', 'href="assets/css/app.css"', html)
    html = re.sub(r'href="assets/css/header\.css\?[^"]+"', 'href="assets/css/header.css"', html)
    html = re.sub(r'href="/assets/css/', 'href="assets/css/', html)
    html = re.sub(r'href="/assets/fonts/', 'href="assets/fonts/', html)
    html = re.sub(r'src="/img/', 'src="img/', html)

    # Перелинковка навигации и форм
    html = re.sub(r'href="(?:https://cloud\.seedaim\.com/)?(?:dashboard\.php|index\.php)"', 'href="dashboard.html"', html)
    html = re.sub(r'href="(?:https://cloud\.seedaim\.com/)?scanner\.php"', 'href="scanner.html"', html)
    html = re.sub(r'href="(?:https://cloud\.seedaim\.com/)?tariffs\.php"', 'href="upgrade.html"', html)
    html = re.sub(r'href="(?:https://cloud\.seedaim\.com/)?payment\.php"', 'href="payment.html"', html)
    html = re.sub(r'action="(?:https://cloud\.seedaim\.com/)?payment\.php"', 'action="payment.html"', html)
    html = re.sub(r'href="(?:https://cloud\.seedaim\.com/)?faq\.php"', 'href="faq.html"', html)

    return html

def main():
    print("=" * 60)
    print("  SeedAim Cloud — Сохранение страниц (включая payment.php)")
    print("=" * 60)

    with sync_playwright() as p:
        print("\n[1/3] Запуск системного браузера...")
        browser = None
        for channel in ["chrome", "msedge"]:
            try:
                browser = p.chromium.launch(channel=channel, headless=False)
                print(f"  -> Браузер запущен: {channel}")
                break
            except Exception:
                continue

        if not browser:
            print("Ошибка запуска Chrome / Edge.")
            return

        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        print("\n[2/3] Авторизация на сайте...")
        page.goto(LOGIN_URL, wait_until="networkidle")

        try:
            page.fill("#login-email", EMAIL)
            page.fill("#login-password", PASSWORD)
            page.click("button[data-auth-submit]")
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(2500)
            print("  -> Авторизация выполнена.")
        except Exception as e:
            print(f"  -> Внимание при входе: {e}")

        print("\n[3/3] Выкачивание страниц...")
        saved_files = []

        for name, url, filename in TARGET_PAGES:
            print(f"\n  [>] Загрузка: {name.upper()} ({url})...")
            try:
                page.goto(url, wait_until="networkidle", timeout=20000)
                page.wait_for_timeout(2000)
            except Exception as e:
                print(f"      Ошибка загрузки {name}: {e}")
                continue

            raw_html = page.content()
            processed_html = clean_and_relink(raw_html)

            out_path = os.path.join(OUTPUT_DIR, filename)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(processed_html)

            if filename == "upgrade.html":
                with open(os.path.join(OUTPUT_DIR, "tariffs.html"), "w", encoding="utf-8") as f:
                    f.write(processed_html)

            saved_files.append(filename)
            print(f"      [OK] Сохранено: {filename}")

        browser.close()

        print("\n" + "=" * 60)
        print("  ГОТОВО! Сохранены страницы:")
        for f in saved_files:
            print(f"   ✓ {f}")
        print("=" * 60)

if __name__ == "__main__":
    main()
