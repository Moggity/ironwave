# UI icon sources

These SVGs are the source for every icon in the app. The app does not load
them: it loads `app/icons.js`, which `scripts/build-icons.js` generates from
this folder. They are not published to GitHub Pages.

## Adding or changing an icon

1. Export the SVG here. Rules:
   - `viewBox="0 0 24 24"`. Draw on a 24 x 24 canvas, 1.8 stroke.
   - One colour. Whatever colour the file uses becomes `currentColor`, so the
     app tints it (grey idle, blue active, red for remove). A second colour is
     lost.
   - Plain shapes only: `path`, `circle`, `rect`, `line`. No text, images,
     masks, filters or `<use>`. Clip-path wrappers from Figma are stripped.
2. The icon's name is the file name in lower case with `_` turned into `-`:
   `Drag_grip.svg` is `drag-grip`. Sub-folders only organise the sources, so a
   name must be unique across all of them.
3. From the repo root run `node scripts/build-icons.js` and commit the changed
   `app/icons.js` with the SVG. `test/icons.test.js` fails if they disagree.
4. Use it in `app.js` with `icon('drag-grip')`.

## Not used yet

`calendar`, `report` and `timer` are in the set but no screen uses them.

## Still a text symbol

No matching icon was supplied for these, so they keep their character: the
linked-superset chain, the readiness and deload bolt, the gear on "Select
exercise", the short-sleep warning inside a sentence, the up and down trend
arrows, day status marks, the timeline technique marks, and the plus and minus
on the weight, reps and plate steppers.
