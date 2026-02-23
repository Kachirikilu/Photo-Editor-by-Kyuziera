# Debug & Fix Summary - Manual Watermark Feature

## Overview
Comprehensive debugging infrastructure implemented to fix the "watermark doesn't change when given manual input" issue.

## Critical Bug Fixed
**Location**: `ensureWMReady()` function (lines 845-875)

**Problem**: The `ensureWMReady()` function was being called during render and would call `selectWM()` again for brand-specific watermarks, overwriting the user's manual selection.

**Solution**: Added guard condition to skip brand-specific watermark selection when `manualWatermarkMode` is active:

```javascript
if (manualWatermarkMode && imageWmReady) {
  console.log("   → Skipping brand-specific selection (manual mode active)");
  const fallbackWM = new Image();
  fallbackWM.src = imageWmReady;
  fallbackWM.onload = () => {
    wmImageFile = fallbackWM;
    console.log("   → Manual WM image loaded");
    resolve();
  };
  return;
}
```

## Debug Logging Infrastructure

### 1. **selectWM() Function** (line 643)
```javascript
console.log("🔵 selectWM() called with:", imageSrc, "| loadingWatermarkForBrand:", loadingWatermarkForBrand);
```
**Purpose**: Track when watermark selection is triggered

### 2. **Manual Mode Activation** (around line 770)
```javascript
console.log("✅ Manual WM mode SET | manualWatermarkMode:", manualWatermarkMode, "| manualWatermarkImage exists:", !!manualWatermarkImage);
```
**Purpose**: Confirm manual mode was set successfully

### 3. **applyManualData() Call Decision** (lines 779-789)
```javascript
console.log("🟡 applyManualData will be called (manual mode active)");
// OR
console.log("⚠️ applyManualData skipped - single file and no manual mode");
```
**Purpose**: Track whether data application is triggered

### 4. **applyManualData() Entry** (lines 908-927)
```javascript
console.log("📊 applyManualData called");
console.log("   → manualWatermarkMode:", manualWatermarkMode);
console.log("   → manualWatermarkImage exists:", !!manualWatermarkImage);
console.log("   → imageWmReady length:", imageWmReady?.length);
console.log("   → Multi file mode / Single file mode");
```
**Purpose**: Detailed state tracking at entry point

### 5. **drawFrameContent() Logic Decision** (lines 1087-1090)
```javascript
if (manualWatermarkMode && manualWatermarkImage) {
  console.log("   → Using MANUAL watermark for all photos");
} else {
  console.log("   → Using AUTO per-brand watermark for:", data.brandName);
}
```
**Purpose**: Track which watermark mode is being used

### 6. **ensureWMReady() Guard** (line 848)
```javascript
console.log("🔷 ensureWMReady called | brandName:", brandName, "| manualWatermarkMode:", manualWatermarkMode);
// Then either:
console.log("   → Skipping brand-specific selection (manual mode active)");
// OR continues with auto brand selection
```
**Purpose**: Track guard condition and prevent override

### 7. **drawWM() Execution** (line 1368)
```javascript
console.log("🟢 drawWM called | wm exists:", !!wm, "| wm dimensions:", wm?.width, "x", wm?.height);
```
**Purpose**: Track watermark rendering phase

### 8. **Before drawWM Call** (line 1338)
```javascript
console.log("🟠 Before drawWM | brandWatermark exists:", !!brandWatermark, "| wmImageFile exists:", !!wmImageFile, "| watermarkToUse exists:", !!watermarkToUse);
```
**Purpose**: Track watermark source availability

## Global State Variables (lines 106-111)

```javascript
let loadingWatermarkForBrand = false;  // Prevents circular dependency
let manualWatermarkMode = false;       // Tracks if user is in manual mode
let manualWatermarkImage = null;       // Stores selected watermark data URL
```

## Execution Flow (After Fixes)

1. **User clicks watermark button** → `selectWM(imageSrc)` called
   - Logs: 🔵 entry

2. **Manual mode is set** → `manualWatermarkMode = true`
   - Logs: ✅ mode activation

3. **applyManualData() is called**
   - Logs: 🟡 call decision, 📊 entry details

4. **createFramedImage() processes**
   - Calls `drawFrameContent()`
   - Logs: 🟣 entry with state

5. **drawFrameContent() decides which watermark**
   - Checks `if (manualWatermarkMode && manualWatermarkImage)`
   - Logs: conditional branch (manual vs auto)

6. **ensureWMReady() respects manual mode**
   - Checks manual mode FIRST
   - Logs: 🔷 decision with guard
   - **SKIPS** brand-specific selectWM() calls

7. **Watermark is rendered**
   - Logs: 🟠 source tracking, 🟢 execution

## Testing Console Output

When user tests the feature, they should see console logs in order:

```
🔵 selectWM() called with: Google | loadingWatermarkForBrand: false
✅ Manual WM mode SET | manualWatermarkMode: true | manualWatermarkImage exists: true
🟡 applyManualData will be called (manual mode active)
📊 applyManualData called
   → manualWatermarkMode: true
   → manualWatermarkImage exists: true
   → imageWmReady length: 5432
   → Multi file mode
🟣 drawFrameContent called | manualWatermarkMode: true | manualWatermarkImage exists: true
   → Using MANUAL watermark for all photos
🔷 ensureWMReady called | brandName: Apple | manualWatermarkMode: true
   → Skipping brand-specific selection (manual mode active)
   → Manual WM image loaded
🟠 Before drawWM | brandWatermark exists: true | wmImageFile exists: true | watermarkToUse exists: true
🟢 drawWM called | wm exists: true | wm dimensions: 1072 x 1568
```

## If Manual Watermark Still Doesn't Work

Use the console logs to identify where the flow breaks:

| Symptom | Likely Cause |
|---------|--------------|
| 🔵 appears but ✅ doesn't | selectWM() not setting manual mode |
| ✅ appears but 🟡 doesn't | applyManualData() not being called |
| 🟣 shows manualWatermarkMode: false | Manual mode lost between selectWM() and drawFrameContent() |
| 🔷 shows but doesn't skip | Guard condition check failing |
| 🟢 shows wm: false | wmImageFile not loaded |
| All logs appear but no visual change | Canvas rendering or DOM update issue |

## Files Modified

- **y-3.js**: Added comprehensive debug logging throughout watermark pipeline + critical bug fix in ensureWMReady()

## Success Criteria

✅ User clicks watermark button
✅ Console shows full execution path
✅ ensureWMReady() skips brand selection when manual mode is active
✅ Canvas updates with new watermark
✅ User sees watermark change in preview