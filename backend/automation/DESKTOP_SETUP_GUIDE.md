# Desktop Software Automation Guide

## For Local Software (Not Web-Based)

Since you're using local desktop software, we'll use **PyAutoGUI** to automate mouse clicks and keyboard input.

## Setup Steps:

### 1. Install PyAutoGUI

```bash
pip install pyautogui keyboard pillow
```

### 2. Record Mouse Positions

This is the KEY step! You need to find the exact pixel coordinates for:
- Date input field
- Export/Generate button
- Any confirmation buttons

**How to do it:**

1. Open your fuel software
2. Position the window consistently (same place every time - important!)
3. Run the script:
   ```bash
   cd C:\FRCNC_Local\Thiago\1strev\backend\automation
   python automate_desktop_software.py
   ```
4. Choose option **1** (Find mouse positions)
5. Move your mouse over each element and press **SPACE** to record:
   - First: Hover over date field → Press SPACE
   - Second: Hover over export button → Press SPACE
   - Third: Any other buttons you need to click
6. Press **ESC** when done
7. Copy the coordinates it printed

### 3. Update the Script

Edit `automate_desktop_software.py` around line 28-35:

```python
# Replace these with YOUR coordinates from step 2
DATE_FIELD_POS = (600, 300)      # Your date field position
EXPORT_BUTTON_POS = (800, 400)   # Your export button position
CONFIRM_BUTTON_POS = (700, 500)  # If needed
```

### 4. Adjust the Workflow

Around line 85-120, customize the steps to match your software:

**Common workflows:**

**Option A: Simple (most software)**
```python
1. Click date field
2. Clear field (Ctrl+A, Delete)
3. Type new date
4. Press Enter
5. Click Export button
6. Wait for file to save
```

**Option B: With Dialog**
```python
1. Click date field
2. Type date
3. Click Export button
4. Click OK on confirmation dialog
5. Type filename in Save dialog
6. Press Enter
```

### 5. Test with ONE Date

```bash
python automate_desktop_software.py
```

Choose option **2** (Test with one date)

**Watch it run!**
- Does it click the right places?
- Does the date get entered correctly?
- Does the export happen?

If not:
- Recheck coordinates (option 1)
- Adjust delays (if software is slow)
- Modify workflow steps

### 6. Run Full Batch

Once test works:

```bash
python automate_desktop_software.py
```

Choose option **3** (Run full batch)

It will export 84 reports automatically!

## Tips:

### Position Your Software Window Consistently
- Same location each time
- Same size
- Don't move it during automation!

### Adjust Delays if Needed
If your software is slow, increase these in the script:
```python
DELAY_AFTER_CLICK = 1.0    # Default: 0.5
DELAY_FOR_EXPORT = 5       # Default: 3
```

### Date Format
Line 100 - adjust to match your software:
```python
# MM/DD/YYYY format
date_str = report_date.strftime("%m/%d/%Y")

# DD/MM/YYYY format (common in Brazil)
date_str = report_date.strftime("%d/%m/%Y")

# YYYY-MM-DD format
date_str = report_date.strftime("%Y-%m-%d")
```

### Emergency Stop
**Press CTRL+C** to stop the automation anytime

### File Naming
If software lets you name files, uncomment lines 115-118 and adjust filename format

## Alternative: AutoHotkey Script

If Python seems complex, here's a 10-line AutoHotkey script (easier for some):

```autohotkey
#Persistent
SetKeyDelay, 100

^!r::  ; Press Ctrl+Alt+R to start
Loop, 84
{
    Click, 600, 300  ; Date field coordinates
    Send, ^a  ; Select all
    Send, 09/01/2025  ; Type date (increment this manually or use variables)
    Send, {Enter}
    Click, 800, 400  ; Export button
    Sleep, 3000
}
Return
```

Download AutoHotkey: https://www.autohotkey.com/

## Still Too Complex? Manual Shortcuts

**Fastest manual method:**
1. Use **Tab** key to navigate between fields (faster than mouse)
2. Use **Ctrl+A** to select date
3. Type new date
4. Press **Enter** (or whatever keyboard shortcut exports)
5. Use **keyboard shortcuts** throughout - can do 84 files in ~20 minutes

## My Recommendation:

**Try PyAutoGUI** (option in this folder). Setup takes 10 minutes, but saves hours. Even if you only use it once, it's worth it for 84 files!
