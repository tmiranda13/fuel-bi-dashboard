# How to Setup Selenium Automation for Report Downloads

## Step 1: Install Selenium

```bash
pip install selenium
```

## Step 2: Download ChromeDriver

1. Check your Chrome version: Open Chrome → Settings → About Chrome
2. Download matching ChromeDriver from: https://chromedriver.chromium.org/downloads
3. Extract chromedriver.exe to a folder (e.g., `C:\chromedriver\`)
4. Add that folder to your Windows PATH, or put chromedriver.exe in the same folder as your script

## Step 3: Find the Correct Selectors

This is the most important step! You need to identify the HTML elements on your export page.

### How to Find Selectors:

1. **Open your export page in Chrome**
2. **Right-click on the date input field → "Inspect"**
3. The Developer Tools will open and highlight the HTML element
4. Look for attributes like:
   - `id="date-input"` → Use: `#date-input`
   - `name="report_date"` → Use: `[name="report_date"]`
   - `class="date-picker"` → Use: `.date-picker`

### Example:

If you see:
```html
<input type="text" id="reportDate" name="date" class="form-control">
```

You can use any of these selectors:
- `#reportDate` (by ID - most reliable)
- `[name="date"]` (by name attribute)
- `.form-control` (by class - least reliable)

### Common Selectors to Look For:

**Date Input Field:**
- `#date`
- `#reportDate`
- `[name="date"]`
- `input[type="date"]`
- `.date-input`

**Export/Download Button:**
- `#export`
- `#download`
- `button[type="submit"]`
- `.btn-export`
- Text-based: `//button[contains(text(), 'Export')]` (XPath)

## Step 4: Update the Script

Open `download_reports.py` and update these lines:

```python
# Line 21: Your system's URL
EXPORT_URL = "https://your-actual-system.com/reports"

# Line 25: The date input selector you found
DATE_INPUT_SELECTOR = "#reportDate"  # Update with your selector

# Line 26: The export button selector you found
EXPORT_BUTTON_SELECTOR = "#btnExport"  # Update with your selector

# Line 33-34: Date range you want
START_DATE = datetime(2025, 9, 1)
END_DATE = datetime(2025, 11, 23)
```

## Step 5: Test with One Date First

Before running for 84 days, test with just one date:

```python
# Temporarily change to:
START_DATE = datetime(2025, 9, 1)
END_DATE = datetime(2025, 9, 1)  # Same date = only 1 report
```

Run: `python download_reports.py`

Watch it work! If it fails:
- Check your selectors again
- Add `time.sleep(5)` after page loads to see what's happening
- Remove `headless` mode to watch the browser

## Step 6: Handle Login (if needed)

If your system requires login, add this before the download loop:

```python
def login(driver):
    driver.get("https://your-system.com/login")

    username_field = driver.find_element(By.ID, "username")
    password_field = driver.find_element(By.ID, "password")

    username_field.send_keys("your_username")
    password_field.send_keys("your_password")

    login_button = driver.find_element(By.ID, "login-button")
    login_button.click()

    time.sleep(3)  # Wait for login to complete

# Then in main(), before the loop:
login(driver)
```

## Alternative: Manual + Batch Rename

If automation seems too complex:

1. **Download manually** (yes, it's tedious but works)
2. **Use this script to rename** all files at once to proper format:

```python
import os
from datetime import datetime, timedelta

# Put all downloaded files in one folder
folder = r"C:\Downloads\Reports"

# Get all Excel files
files = sorted([f for f in os.listdir(folder) if f.endswith('.xlsx')])

# Generate date list
start = datetime(2025, 9, 1)
dates = [start + timedelta(days=i) for i in range(84)]

# Rename files to match dates
for i, file in enumerate(files):
    if i < len(dates):
        new_name = f"RESUMO DO DIA_{dates[i].strftime('%m_%d_%y')}.xlsx"
        old_path = os.path.join(folder, file)
        new_path = os.path.join(folder, new_name)
        os.rename(old_path, new_path)
        print(f"Renamed: {file} → {new_name}")
```

## Recommendation

- **Try Selenium first** - 5 minutes to set up, saves hours of manual work
- **If Selenium fails** - Manual download is still faster than you think if you're fast with keyboard shortcuts
- **Either way** - You'll have all files ready for batch import!
