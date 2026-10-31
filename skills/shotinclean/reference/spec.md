# Render spec reference

The spec passed to `--spec` (for `capture` and `annotate`):

```ts
interface RenderSpec {
  crop?: Rect;                       // applied first; annotations stay in uncropped coordinates
  background?: true | Background;    // true = defaults
  annotations?: Annotation[];        // drawn in order (later ones on top)
}

type Point = [x, y] | { selector: string; anchor?: Anchor; offset?: [dx, dy] }; // selector form: capture only
type Rect  = [x, y, width, height] | { selector: string; pad?: number }; // pad defaults to 6
type Anchor = 'center' | 'top' | 'bottom' | 'left' | 'right'
            | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
```

`offset` nudges a selector point, e.g. put a label beside a button with
`{"selector":"#rotate","anchor":"right","offset":[140,10]}`.

Units are CSS pixels. `capture` multiplies by `--scale` for you. For `annotate`, units
are the image's own pixels.

## Annotations

| `type` | Fields | Notes |
| --- | --- | --- |
| `arrow` | `to`, optional `from`, optional `direction` | Without `from`, the tail goes out along `direction` (`up`, `down`, `left`, `right`, `up-left`, …). When `to` is a selector, `direction` comes from its `anchor`. The tail is shortened or mirrored to stay inside the image. |
| `line` | `from`, `to` | |
| `rect`, `ellipse` | `rect` | Outline |
| `highlight` | `rect` | Translucent marker (default color yellow) |
| `pixelate` | `rect` | Redaction; block size grows with `size` |
| `blur` | `rect` | Redaction; radius grows with `size` |
| `text` | `at` (top-left), `text` | `\n` for line breaks. Outlined for contrast on any background |
| `counter` | `at` (center), optional `n` | Numbered badge. Without `n`: previous + 1, starting at 1 |

Every annotation also accepts `color` (`#rrggbb`, default `#ff3b30`) and `size`
(stroke weight, default 6). Font size is `14 + size × 4` px.

## Background

```json
{ "fill": "gradient:2", "padding": 64, "radius": 12, "shadow": 30, "aspect": "auto" }
```

- `fill`: `gradient` / `gradient:1`–`gradient:6` (sunset, sky, lavender, mint, deep sea, rose),
  `#hex`, or `transparent`.
- `aspect`: `auto`, `16:9`, `4:3`, `1:1`, or `9:16`. The canvas grows to the ratio; the
  screenshot is never scaled.
- The CLI shorthand `--background gradient:3` merges into `spec.background`.

## Errors

Validation errors name the exact path, for example:

```
SpecError: annotations[2] (arrow).to must be [x, y], got [1,2,3]
--selector "#missing" matched nothing
```
