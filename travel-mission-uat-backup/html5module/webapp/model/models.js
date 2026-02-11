sap.ui.define(
  ["sap/ui/model/json/JSONModel", "sap/ui/Device"],
  /**
   * provide app-view type models (as in the first "V" in MVVC)
   *
   * @param {typeof sap.ui.model.json.JSONModel} JSONModel
   * @param {typeof sap.ui.Device} Device
   *
   * @returns {Function} createDeviceModel() for providing runtime info for the device the UI5 app is running on
   */
  function (JSONModel, Device) {
    "use strict";
    
    return {
      englishLogo: "assets/images/logo.png",
	    arabicLogo: "assets/images/logo-ar.png",
      createDeviceModel: function () {
        var oModel = new JSONModel(Device);
        oModel.setDefaultBindingMode("OneWay");
        return oModel;
      },
      createAppModel: function () {
        var oModel = new JSONModel({
          user:{
            id: null,
            firstName: null,
            lastName: null,
            email: null,
            proxy: false
          },
          masterUser: {
            id: null,
            firstName: null,
            lastName: null,
            email: null,
          },
          delegateOf: [],
          pageInfo: {
            logo: {
              en: this.englishLogo,
              ar: this.arabicLogo,
            },
          },
          activeRoute: null,
          language: sap.ui.getCore().getConfiguration().getLanguage().includes("en") ? "en" : sap.ui.getCore().getConfiguration().getLanguage(),
          isAdmin:false
        });
        oModel.setDefaultBindingMode("TwoWay");
        return oModel;
      },
    };
  }
);
