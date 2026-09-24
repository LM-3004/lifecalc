# LifeCalc

Simple calculators for real-life decisions.

## GitHub Pages

This is a static HTML, CSS and vanilla JavaScript website. To publish it, open **Settings → Pages** in this repository, choose **Deploy from a branch**, select `main` and the `/ (root)` folder, then save. The site will be available at `https://lm-3004.github.io/lifecalc/` after GitHub Pages deploys.

## Files

- `index.html` — homepage
- `calculator.html` — Can I Afford It? calculator and explanatory content
- `about.html` — About page
- `privacy.html` — Privacy policy
- `terms.html` — Terms and disclaimer
- `styles.css` — responsive site styling
- `script.js` — client-side navigation and calculator logic

The calculator uses weekly equivalents: fortnightly amounts are multiplied by 26 / 52, monthly amounts by 12 / 52, and yearly amounts by 1 / 52. It was manually checked against these scenarios: a covered purchase reports zero weeks; a $500 gap with a $100 weekly surplus reports 5 weeks; a zero or negative surplus reports that no timeline can be estimated; and additional-saving scenarios add $25, $50, $100 or $200 to the weekly surplus.
