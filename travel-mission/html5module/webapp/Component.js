sap.ui.define([
	"sap/ui/core/UIComponent",
	"ui5app/model/models",
	"./utils/swal",
	"./utils/lodash"
], function (UIComponent, models, SwalJS, LodashJS) {
	"use strict";

	return UIComponent.extend("ui5app.Component", {
		
		metadata: {
			manifest: "json",
			properties: {
				"currentRouteName": {}
			}
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			//call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			this.getRouter() 
			.attachBeforeRouteMatched(this.onBeforeRouteMatched, this)
			.initialize();

			// set the device model
			const oAppModel = models.createAppModel();
			const sRoute = this.getCurrentRoute();
			oAppModel.setProperty("/activeRoute", sRoute === "index" ? "home" : sRoute);
			this.setModel(oAppModel, "appModel");
		},

		onBeforeRouteMatched: function(event) {
			const sRoute = event.getParameter("name");
			this.setCurrentRouteName(sRoute);
			const oAppModel = this.getModel("appModel");
			if(oAppModel){
				oAppModel.setProperty("/activeRoute", sRoute === "index" ? "home" : sRoute);
			}
		},
		
		getCurrentRoute: function() {
			return this.getCurrentRouteName();
		}
	});
});