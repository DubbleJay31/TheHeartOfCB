// Single source of truth for starting nightly rates, shared by app.js (public price estimator
// fallback, before cloud pricing loads) and admin.html (Pricing tab "Reset to defaults"). Actual
// live rates are managed in the admin Pricing tab and stored in the cloud - these are only the
// starting point / fallback values.
var _DEFAULT_RATES = {
  prop1: { wd: [100,120,140,180,210,300,350,280,190,160,140,120], we: [140,150,180,270,350,480,500,450,300,250,180,180] },
  prop2: { wd: [80,80,100,100,120,160,180,140,120,100,80,90],     we: [100,100,120,160,190,230,260,230,170,140,120,100] },
  prop3: { wd: [80,80,100,100,120,160,180,140,120,100,80,90],     we: [100,100,120,160,190,230,260,230,170,140,120,100] },
};
