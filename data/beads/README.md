# Bead catalogues

One JSON file per bead line, plus `specs.json` for geometry and weight.

Each colour entry:

| field | meaning |
|---|---|
| `code` | the manufacturer's colour number as printed on the tube (`41`, `45F`, `146`) |
| `name` | the manufacturer's colour name as retailers list it |
| `finish` | `opaque`, `matte` (Toho "frosted"/F), `ceylon`, `luster`, `transparent`, `silver-lined`, `ab`, `metallic` |
| `hex` | reference sRGB colour used for matching |
| `michaelsCommon` | commonly stocked in Michaels stores (maintained by hand) |
| `source` | where the name and colour came from |

Colour values marked `approx` were estimated from the colour name and typical swatches and
should be replaced by values sampled from real swatch photos. Pull requests that correct a
colour should cite the swatch used.
