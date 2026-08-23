# Implementation Plan: ID Card Size Presets

## Overview

Refactor the ID Card to PDF tool to replace hardcoded IC card dimensions with a configurable preset system. Users will select from predefined sizes (IC, Passport) via a dropdown or enter custom dimensions. The implementation modifies `src/js/logic/id-card-to-pdf.ts` for logic and `src/js/ui.ts` for the template, with property-based and unit tests validating correctness.

## Tasks

- [x] 1. Refactor constants into SIZE_PRESETS configuration
  - [x] 1.1 Define SizePreset interface and SIZE_PRESETS constant map
    - In `src/js/logic/id-card-to-pdf.ts`, add the `SizePreset` interface with `label`, `width_mm`, and `height_mm` fields
    - Add the `SIZE_PRESETS` constant with entries for `ic`, `passport`, and `custom`
    - Add `MM_TO_PT` constant (2.8346) to replace inline usage
    - Remove the old `IC_WIDTH_PT` and `IC_HEIGHT_PT` constants
    - _Requirements: 1.4, 1.5_

- [x] 2. Add UI template with dropdown and custom size fields
  - [x] 2.1 Update the id-card-to-pdf template in ui.ts
    - Add `<label>` for "Document Size" with classes `block mb-2 text-sm font-medium text-gray-300` and `for="ic-size-preset"`
    - Add `<select id="ic-size-preset">` with classes `w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5`
    - Add options: "IC (85.60 × 53.98 mm)" (value="ic"), "Passport (125 × 88 mm)" (value="passport"), "Custom" (value="custom")
    - Add `<div id="ic-custom-size-fields" class="hidden">` containing two labelled number inputs for width and height
    - Each custom input gets classes matching existing style, placeholder values "85.60" and "53.98"
    - Add `<p id="ic-custom-validation-msg" class="hidden text-red-400 text-xs mt-1">` for validation error
    - Position the entire block before the existing label text input
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 4.1, 4.2, 4.3, 4.4_

- [x] 3. Implement validation and dimension resolution functions
  - [x] 3.1 Implement `validateCustomInputs` function
    - Create function that reads `#ic-custom-width` and `#ic-custom-height` input values
    - Validate: non-empty, numeric, within [10.00, 300.00] range
    - Enable/disable the process button based on validation result
    - Show/hide validation message element with text "Please enter valid dimensions between 10 and 300 mm."
    - _Requirements: 2.3, 2.5_

  - [x] 3.2 Implement `getSelectedDimensions` function
    - Read dropdown value from `#ic-size-preset`
    - If named preset (ic, passport): return preset's width_mm and height_mm
    - If custom: parse and return values from custom input fields
    - Return `null` if custom values are invalid (safety fallback)
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 3.3 Implement `checkDimensionsFitA4` function
    - Convert mm to points using MM_TO_PT factor
    - Check `(width_pt + 80) <= 595.28` for horizontal fit
    - Check `(2 * height_pt + 30 + 80) <= 841.89` for vertical fit
    - Return boolean indicating whether layout fits on A4
    - _Requirements: 3.4_

- [x] 4. Wire up setupIdCardUI with event listeners
  - [x] 4.1 Enhance `setupIdCardUI` to handle dropdown and custom inputs
    - Add `change` event listener on `#ic-size-preset` to toggle visibility of `#ic-custom-size-fields`
    - When "custom" is selected, show custom fields and run validation
    - When a named preset is selected, hide custom fields and enable process button (if files are uploaded)
    - Add `input` event listeners on `#ic-custom-width` and `#ic-custom-height` to call `validateCustomInputs()`
    - Retain custom field values when switching away and back to "Custom"
    - _Requirements: 1.6, 2.1, 2.2, 2.6, 4.4_

- [x] 5. Checkpoint - Verify UI and validation logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update idCardToPdf to use selected dimensions
  - [x] 6.1 Integrate dimension resolution and overflow check into PDF generation
    - Replace hardcoded `IC_WIDTH_PT`/`IC_HEIGHT_PT` usage with call to `getSelectedDimensions()`
    - Convert returned mm values to points using `MM_TO_PT`
    - Call `checkDimensionsFitA4()` before generating — if false, call `showAlert('Size Too Large', ...)` and return early
    - Use computed width/height points for `frontW`, `frontH`, `backW`, `backH`
    - Preserve all existing behaviour (centering, gap, diagonal lines, filename)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7. Add property-based tests with fast-check
  - [ ]* 7.1 Write property test for preset dimension conversion (Property 1)
    - **Property 1: Preset dimensions are correctly converted to points**
    - For any preset key, verify `width_mm * 2.8346` and `height_mm * 2.8346` match computed values within ±0.01
    - **Validates: Requirements 1.4, 1.5, 3.1**

  - [ ]* 7.2 Write property test for invalid custom input rejection (Property 2)
    - **Property 2: Validation rejects all invalid custom inputs**
    - Generate arbitrary strings (empty, non-numeric, out-of-range numbers) and verify validation returns false
    - **Validates: Requirements 2.5**

  - [ ]* 7.3 Write property test for overflow check formula (Property 3)
    - **Property 3: Overflow check correctly identifies oversized dimensions**
    - For any width/height in mm, verify the overflow function returns false iff `(w*2.8346+80 > 595.28)` OR `(2*h*2.8346+30+80 > 841.89)`
    - **Validates: Requirements 3.4**

  - [ ]* 7.4 Write property test for preset resolution identity (Property 4)
    - **Property 4: Preset resolution identity**
    - For any named preset key, verify `getSelectedDimensions()` returns the exact values from `SIZE_PRESETS`
    - **Validates: Requirements 1.4, 1.5, 1.6**

  - [ ]* 7.5 Write property test for custom value preservation (Property 5)
    - **Property 5: Custom values are preserved across preset switching**
    - For any valid custom width/height pair, set values, switch to a preset, switch back to custom, verify values unchanged
    - **Validates: Requirements 2.6**

- [x] 8. Add unit tests
  - [ ]* 8.1 Write unit tests for getSelectedDimensions, validateCustomInputs, and checkDimensionsFitA4
    - Test `getSelectedDimensions()` returns correct values for ic, passport, and valid custom inputs
    - Test `validateCustomInputs()` with edge cases: 10, 300, 9.99, 300.01, empty, "abc", "12.345"
    - Test `checkDimensionsFitA4()` with boundary cases (max fitting size, just-over-limit)
    - Test mm-to-points conversion arithmetic
    - _Requirements: 1.4, 1.5, 2.3, 2.5, 3.1, 3.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code is TypeScript; tests use Vitest + fast-check
- The feature modifies only `src/js/ui.ts` and `src/js/logic/id-card-to-pdf.ts` (plus new test files)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "8.1"] }
  ]
}
```
