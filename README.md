# DexHOT project page

Project website for **DexHOT: Learning Hand--Object Configuration Transfer for Dexterous Manipulation**.

Served via GitHub Pages at **https://zheweigui.github.io/dexhot/** — a project Pages site, so the
repository must be named `dexhot` (not `dexhot.github.io`) under the `ZheweiGui` account, and Pages
must be enabled in Settings → Pages with source `main` / `/ (root)`.

All asset paths in `index.html` are relative (`./static/...`), so the sub-path URL works unchanged.

Built on the [Nerfies](https://github.com/nerfies/nerfies.github.io) project page template
(CC BY-SA 4.0).

## Layout

```
index.html              # the whole page (title, authors, teaser, abstract, method, benchmark, bibtex)
static/css, static/js   # Bulma + FontAwesome assets from the template
static/images/*.jpg     # figures exported from the paper (teaser, pipeline, object benchmark)
```

## TODO before going public

- Fill in author homepage links and affiliations in `index.html` (currently `#` placeholders).
- Replace the `#` hrefs of the Paper / arXiv / Video buttons.
- Add result videos (`static/videos/`) — real-robot rollouts and long-horizon tasks.
- Update the BibTeX entry once the paper has a venue / arXiv id.

## Regenerating the figures

```bash
FIG=../6a0d7e74a29a0a17858192bc/Figures
pdftocairo -png -r 160 -singlefile $FIG/teaser.pdf static/images/teaser
# then downscale to width 1800 and save as .jpg
```
