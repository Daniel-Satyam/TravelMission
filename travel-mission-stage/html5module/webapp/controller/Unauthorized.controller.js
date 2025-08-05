sap.ui.define([
	"sap/ui/core/mvc/Controller"
], function(
	Controller
) {
	"use strict";

	return Controller.extend("ui5appstage.controller.Unauthorized", {

        onNavHome: function(){
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("home", null, null, true);
        }
	});
});