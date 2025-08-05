sap.ui.define(["sap/ui/core/Control"], function (Control) {
  "use strict";

  return Control.extend("ui5appstage.ui.BusyIndicator", {
    renderer: function (oRM, oControl) {
      oRM
        .openStart("div", oControl)
        .class("bi-busy-ripple")
        .openEnd()
        .openStart("div")
        .openEnd()
        .close("div")
        .openStart("div")
        .openEnd()
        .close("div")
        .close("div");
    },
  });
});
