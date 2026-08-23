# Requirements Document

## Introduction

Enhance the existing "ID Card to PDF" tool in BentoPDF with document size presets. Currently the tool uses hardcoded IC card dimensions (85.60 × 53.98 mm). This feature adds a dropdown allowing users to select from predefined document sizes (IC, Passport) or enter custom dimensions, so the generated PDF scales images to the correct physical size.

## Glossary

- **Size_Preset_Dropdown**: A `<select>` UI element that lets the user choose a predefined document size or the Custom option.
- **ID_Card_Tool**: The existing "ID Card to PDF" tool that generates an A4 PDF with front and back images of an identity document.
- **Custom_Size_Input**: A pair of numeric input fields (width and height in millimetres) that appear when the user selects the Custom option.
- **IC_Preset**: The default preset representing standard ID card dimensions: 85.60 mm × 53.98 mm.
- **Passport_Preset**: A preset representing standard passport photo page dimensions: 125 mm × 88 mm.

## Requirements

### Requirement 1: Size Preset Dropdown

**User Story:** As a user, I want to choose a document size from a dropdown, so that the PDF output matches the physical size of my document.

#### Acceptance Criteria

1. THE ID_Card_Tool SHALL display a Size_Preset_Dropdown within the options area, positioned before the label text input.
2. THE Size_Preset_Dropdown SHALL contain the following options in order: "IC (85.60 × 53.98 mm)", "Passport (125 × 88 mm)", "Custom".
3. WHEN the page loads, THE Size_Preset_Dropdown SHALL default to the IC_Preset option.
4. WHEN the user triggers PDF generation while the IC_Preset is selected, THE ID_Card_Tool SHALL scale the front and back images to 85.60 mm width and 53.98 mm height in the generated PDF.
5. WHEN the user triggers PDF generation while the Passport_Preset is selected, THE ID_Card_Tool SHALL scale the front and back images to 125 mm width and 88 mm height in the generated PDF.
6. WHEN the user changes the Size_Preset_Dropdown selection, THE ID_Card_Tool SHALL apply the newly selected dimensions to the next PDF generation without requiring a page reload.

### Requirement 2: Custom Size Input

**User Story:** As a user, I want to enter custom width and height values, so that I can generate PDFs for document sizes not covered by the presets.

#### Acceptance Criteria

1. WHEN the user selects the "Custom" option from the Size_Preset_Dropdown, THE ID_Card_Tool SHALL display the Custom_Size_Input fields for width and height.
2. WHILE a preset other than "Custom" is selected, THE ID_Card_Tool SHALL hide the Custom_Size_Input fields.
3. THE Custom_Size_Input fields SHALL accept numeric values in millimetres within the range of 10.00 mm to 300.00 mm, with up to 2 decimal places of precision.
4. THE Custom_Size_Input width field SHALL have a placeholder value of "85.60" and the height field SHALL have a placeholder value of "53.98".
5. IF the user leaves the Custom_Size_Input width or height field empty, enters a non-numeric value, or enters a value outside the range of 10.00 to 300.00, THEN THE ID_Card_Tool SHALL disable the process button and display a validation message indicating valid dimensions between 10 and 300 mm are required.
6. WHEN the user switches from the "Custom" option to a preset option in the Size_Preset_Dropdown, THE ID_Card_Tool SHALL retain the previously entered Custom_Size_Input values so they are restored if the user selects "Custom" again.

### Requirement 3: PDF Generation with Selected Dimensions

**User Story:** As a user, I want the generated PDF to use the dimensions I selected, so that the front and back images are scaled to the correct physical size.

#### Acceptance Criteria

1. WHEN the user triggers PDF generation, THE ID_Card_Tool SHALL convert the selected width and height from millimetres to PDF points using the factor 1 mm = 2.8346 points.
2. THE ID_Card_Tool SHALL draw both the front and back images stretched to exactly the computed width and height in points, without preserving the original aspect ratio.
3. THE ID_Card_Tool SHALL centre both images horizontally on the A4 page and stack them vertically with a fixed gap of 30 points between the bottom edge of the front image and the top edge of the back image.
4. IF the computed dimensions result in total required height (two image heights plus 30-point gap plus 80 points of vertical margin) exceeding the A4 page height of 841.89 points, or the computed width plus 80 points of horizontal margin exceeding the A4 page width of 595.28 points, THEN THE ID_Card_Tool SHALL display an error message indicating the selected size is too large for A4 and SHALL NOT generate the PDF.
5. WHEN PDF generation fails due to oversized dimensions, THE ID_Card_Tool SHALL keep the user's selected preset and input values unchanged so the user can adjust them.

### Requirement 4: UI Consistency

**User Story:** As a user, I want the new dropdown to fit visually into the existing ID Card tool UI, so that the experience remains cohesive.

#### Acceptance Criteria

1. THE Size_Preset_Dropdown SHALL use the CSS classes `w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-2.5` matching the existing label text input styling.
2. THE Size_Preset_Dropdown SHALL include a `<label>` element with the text "Document Size", styled with the classes `block mb-2 text-sm font-medium text-gray-300`, and programmatically associated to the dropdown via matching `for` and `id` attributes.
3. THE Custom_Size_Input fields SHALL each include a `<label>` element programmatically associated via matching `for` and `id` attributes, with text "Width (mm)" and "Height (mm)" respectively, styled with the classes `block mb-2 text-sm font-medium text-gray-300`.
4. THE Size_Preset_Dropdown and Custom_Size_Input fields SHALL be reachable and operable via keyboard Tab navigation in logical order (Size_Preset_Dropdown, then Custom_Size_Input width, then Custom_Size_Input height, then label text input).
