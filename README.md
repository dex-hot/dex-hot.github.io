# DexHOT project website

Academic project page for **DexHOT: Learning Hand–Object Configuration Transfer for Dexterous Manipulation**.

Intended website address: https://zheweigui.github.io/dexhot/

## Website and research code

This repository contains only the static project website and presentation assets. It does not contain the training environment, evaluation implementation, model checkpoints, or research datasets. Research code is **coming soon** and will be linked separately when released.

The public page presents the authors and affiliations, real-world demonstrations, overview, method, DexHOTBench, experiments, citation, and acknowledgements. The Code notice is deliberately not a hyperlink while the implementation is unreleased.

## Structure

```text
index.html          Project page
static/css/         Styles
static/js/          Playback and page interactions
static/images/      Research figures
static/ppt-media/   Benchmark figures, video posters, and silent demonstrations
.nojekyll           Serve as a plain static website on GitHub Pages
```

## Publishing

In this repository's **Settings → Pages**, select **Deploy from a branch**, then **main** and **/ (root)**. After a successful Pages deployment, visitors should use the website address above, not the repository URL. Pushing commits alone does not enable Pages.

GitHub Free requires a public repository for Pages. If the website repository must stay private, use a plan supporting Pages from private repositories or a separate static hosting service. Regardless of repository visibility, any HTML, scripts, images, and videos served on a public website are accessible to visitors; do not put confidential assets in the published directory.

All asset paths are relative, so the project sub-path works without a custom domain or build step.

## Featured salt-shaking video

The updated demonstration uses source seconds 30–116, cropped to a 480 × 360 action window (4:3, origin x=220/y=180 in the original 960 × 544 source). This brings the hand and object 1.5× closer than the previous crop while retaining the grasp, lift, shaking over the plate, and return trajectory. The published file is 43 seconds long, encoded at 2× real time, and has no audio track. Both page placements play this file at the browser's normal playback rate to avoid applying the speed-up twice.

All published videos use H.264 with yuv420p pixels in MP4 containers. The simulation clips retain their original 1920 × 1080 resolution, frame rate, and duration; their original MPEG-4 Part 2 encoding was incompatible with browser playback. MP4 metadata is placed first for progressive loading.

## Credits

Adapted from the [Nerfies](https://github.com/nerfies/nerfies.github.io) project page template (CC BY-SA 4.0).
