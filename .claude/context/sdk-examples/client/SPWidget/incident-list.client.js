api.controller = function($scope) {
  var c = this;
  c.refresh = function() {
    c.server.refresh();
  };
};
