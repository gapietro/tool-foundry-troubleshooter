// Stub: Change risk assessment utility for the script-include golden example.
// Replace with the actual ChangeRiskUtils implementation when adapting to a
// real project — this file just satisfies the Now.include() reference at
// build time so the example compiles.
var ChangeRiskUtils = Class.create();
ChangeRiskUtils.prototype = {
  initialize: function() {},

  assessRisk: function(changeGr) {
    var score = 0;
    if (changeGr.getValue('priority') === '1') score += 50;
    if (changeGr.getValue('risk') === 'high') score += 30;
    return score;
  },

  type: 'ChangeRiskUtils'
};
