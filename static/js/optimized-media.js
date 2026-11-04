'use strict';

window.DexMedia = (() => {
  const paths = {
  "static/any2any-final-grasps/tape-measure-s1.png": "static/optimized-media/any2any-final-grasps/tape-measure-s1.webp",
  "static/any2any-final-grasps/flashlight-s1.png": "static/optimized-media/any2any-final-grasps/flashlight-s1.webp",
  "static/any2any-final-grasps/hammer-s1.png": "static/optimized-media/any2any-final-grasps/hammer-s1.webp",
  "static/any2any-final-grasps/screwdriver-s1.png": "static/optimized-media/any2any-final-grasps/screwdriver-s1.webp",
  "static/any2any-final-grasps/medicine-bottle-s1.png": "static/optimized-media/any2any-final-grasps/medicine-bottle-s1.webp",
  "static/any2any-final-grasps/facial-cream-s1.png": "static/optimized-media/any2any-final-grasps/facial-cream-s1.webp",
  "static/any2any-final-grasps/shampoo-bottle-s1.png": "static/optimized-media/any2any-final-grasps/shampoo-bottle-s1.webp",
  "static/any2any-final-grasps/tennis-ball-s1.png": "static/optimized-media/any2any-final-grasps/tennis-ball-s1.webp",
  "static/any2any-final-grasps/mouse-s1.png": "static/optimized-media/any2any-final-grasps/mouse-s1.webp",
  "static/any2any-final-grasps/banana-s1.png": "static/optimized-media/any2any-final-grasps/banana-s1.webp",
  "static/stage-goals/salt-shaking-s3.png": "static/optimized-media/stage-goals/salt-shaking-s3.webp",
  "static/stage-goals/salt-shaking-s4.png": "static/optimized-media/stage-goals/salt-shaking-s4.webp",
  "static/stage-goals/salt-shaking-s2.png": "static/optimized-media/stage-goals/salt-shaking-s2.webp",
  "static/stage-goals/water-pouring-s1.png": "static/optimized-media/stage-goals/water-pouring-s1.webp",
  "static/stage-goals/barcode-scanning-s1.png": "static/optimized-media/stage-goals/barcode-scanning-s1.webp",
  "static/stage-goals/screw-driving-s2.png": "static/optimized-media/stage-goals/screw-driving-s2.webp",
  "static/stage-goals/barcode-scanning-s3.png": "static/optimized-media/stage-goals/barcode-scanning-s3.webp",
  "static/stage-goals/screw-driving-s4.png": "static/optimized-media/stage-goals/screw-driving-s4.webp",
  "static/stage-goals/screw-driving-s3.png": "static/optimized-media/stage-goals/screw-driving-s3.webp",
  "static/stage-goals/barcode-scanning-s4.png": "static/optimized-media/stage-goals/barcode-scanning-s4.webp",
  "static/stage-goals/salt-shaking-s1.png": "static/optimized-media/stage-goals/salt-shaking-s1.webp",
  "static/stage-goals/barcode-scanning-s2.png": "static/optimized-media/stage-goals/barcode-scanning-s2.webp",
  "static/stage-goals/block-assembly-s2.png": "static/optimized-media/stage-goals/block-assembly-s2.webp",
  "static/stage-goals/shelf-placement-s2.png": "static/optimized-media/stage-goals/shelf-placement-s2.webp",
  "static/stage-goals/water-pouring-s2.png": "static/optimized-media/stage-goals/water-pouring-s2.webp",
  "static/stage-goals/shelf-placement-s4.png": "static/optimized-media/stage-goals/shelf-placement-s4.webp",
  "static/stage-goals/shelf-placement-s3.png": "static/optimized-media/stage-goals/shelf-placement-s3.webp",
  "static/stage-goals/shelf-placement-s1.png": "static/optimized-media/stage-goals/shelf-placement-s1.webp",
  "static/stage-goals/water-pouring-s3.png": "static/optimized-media/stage-goals/water-pouring-s3.webp",
  "static/stage-goals/screw-driving-s1.png": "static/optimized-media/stage-goals/screw-driving-s1.webp",
  "static/stage-goals/block-assembly-s1.png": "static/optimized-media/stage-goals/block-assembly-s1.webp",
  "static/stage-goals/block-assembly-s3.png": "static/optimized-media/stage-goals/block-assembly-s3.webp",
  "static/stage-goals/block-assembly-s4.png": "static/optimized-media/stage-goals/block-assembly-s4.webp",
  "static/stage-goals/water-pouring-s4.png": "static/optimized-media/stage-goals/water-pouring-s4.webp"
};
  const url = (source) => {
    if (!source || /^(?:[a-z]+:|\/\/)/i.test(source)) return source;
    const [path, suffix = ''] = source.split(/(?=[?#])/);
    const optimized = paths[path.replace(/^\.\//, '')];
    return optimized ? `./${optimized}${suffix}` : source;
  };
  return Object.freeze({url});
})();
