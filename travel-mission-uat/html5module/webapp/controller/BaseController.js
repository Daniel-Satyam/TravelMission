sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent",
    "sap/ui/core/Fragment",
    "sap/ui/util/Storage",
    "sap/ui/model/json/JSONModel",
    "ui5appuat/model/formatter",
  ],
  function (
    Controller,
    History,
    UIComponent,
    Fragment,
    Storage,
    JSONModel,
    Formatter
  ) {
    "use strict";

    return Controller.extend("ui5appuat.controller.BaseController", {
      AESKEY: "u/Gu5posvwDsXUnV5Zaq4g==",
      AESIV: "5D9r9ZVzEYYgha93/aUK2w==",
      userIcon: "assets/images/icons/user.gif",

      getRouter: function () {
        return UIComponent.getRouterFor(this);
      },

      onNavBack: function () {
        var oHistory, sPreviousHash;

        oHistory = History.getInstance();
        sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
          window.history.go(-1);
        } else {
          this.getRouter().navTo("home", {}, true /*no history*/);
        }
      },
      /**
       * Getter for the resource bundle.
       * @public
       * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
       */
      getResourceBundle: function () {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
      },

      getText: function (sText, aParam = []) {
        return this.getModel("i18n").getResourceBundle().getText(sText, aParam);
      },

      getModel: function (sModelName) {
        return this.getView().getModel(sModelName ? sModelName : "");
      },
      setModel: function (oModel, sModelName) {
        return this.getView().setModel(oModel, sModelName ? sModelName : "");
      },

      openBusyFragment: async function (sTextCode, aMessageParameters) {
        const oDialog = await this.getBusyFragment();
        if (oDialog) {
          if (sTextCode) {
            oDialog.setText(this.getText(sTextCode, aMessageParameters));
          } else {
            oDialog.setText(this.getText("pleaseWait", []));
          }

          oDialog.open ? oDialog.open() : null;
        }
      },

      closeBusyFragment: async function () {
        if (this.oBusyDialog) {
          setTimeout(() => {
            this.oBusyDialog.close ? this.oBusyDialog.close() : null;
          }, 1000);
        }
      },

      finishLoading: function () {
        this.closeBusyFragment();
      },

      startLoading: function () {
        this.finishMainLoader();
        this.openBusyFragment();
      },

      startMainLoader: function () {
        document
          .getElementById("busyIndicator")
          .classList.remove("displayNone");
      },
      finishMainLoader: function () {
        setTimeout(() => {
          document.getElementById("busyIndicator").classList.add("displayNone");
        }, 500);
      },

      /* Convenience method for get generic Busy fragment
       * @private
       * @returns {ui5appuat.ui.BusyDialog} the router for this component
       */
      getBusyFragment: async function () {
        if (!this.oBusyDialog) {
          this.oBusyDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "ui5appuat.view.fragments.GenericBusyDialog",
            controller: this,
          });
          this.getView().addDependent(this.oBusyDialog);
        }
        return this.oBusyDialog;
      },
      handleBusyDialogClosed: function () {
        if (this.oBusyDialog) {
          this.oBusyDialog.destroy();
          this.oBusyDialog = null;
        }
      },
      alertMessage: function (
        sType,
        sTitle,
        sMessage,
        aMessageParam,
        opts = {}
      ) {
        var sIcon;

        switch (sType) {
          case "W":
            sIcon = "warning";
            break;
          case "E":
            sIcon = "error";
            break;
          case "S":
            sIcon = "success";
            break;
          case "I":
            sIcon = "info";
            break;
          case "Q":
            sIcon = "question";
            break;
          default:
            sIcon = "success";
        }

        this.showMessage({
          text: this.getText(sMessage, aMessageParam),
          title: this.getText(sTitle),
          icon: sIcon,
          showConfirmButton: true,
          timer: undefined,
          toast: false,
          position: "center",
          ...opts,
        });
      },

      toastMessage: function (
        sType,
        sTitle,
        sMessage,
        aMessageParam,
        opts = {}
      ) {
        var sIcon;

        switch (sType) {
          case "W":
            sIcon = "warning";
            break;
          case "E":
            sIcon = "error";
            break;
          case "S":
            sIcon = "success";
            break;
          case "I":
            sIcon = "info";
            break;
          case "Q":
            sIcon = "question";
            break;
          default:
            sIcon = "success";
        }

        this.showMessage({
          text: this.getText(sMessage, aMessageParam),
          title: sTitle ? this.getText(sTitle) : null,
          icon: sIcon,
          showConfirmButton: sIcon !== "success",
          ...opts,
        });
      },

      showMessage: function (opts) {
        var options = {
          title: null,
          text: null,
          html: null,
          icon: "info",
          position: "bottom",
          showConfirmButton: false,
          confirmButtonText: this.getText("OK_ACTION", []),
          confirmButtonColor: "#3085d6",
          showCancelButton: false,
          cancelButtonText: this.getText("CANCEL_ACTION", []),
          cancelButtonColor: "#d33",
          showCloseButton: false,
          toast: true,
          timer: 5000,
          timerProgressBar: false,
          backdrop: false,
        };

        for (var k in options) {
          if (opts.hasOwnProperty(k)) {
            options[k] = opts[k];
          }
        }

        Swal.fire({ ...options }).then(function (result) {
          if (result.isConfirmed) {
            if (opts.confirmCallbackFn !== undefined) {
              try {
                opts.confirmCallbackFn();
              } catch (e) {}
            }
          }
          if (result.isCancelled) {
            if (opts.cancelCallbackFn !== undefined) {
              try {
                opts.cancelCallbackFn();
              } catch (e) {}
            }
          }
        });
      },
      confirmDialog: function (opts) {
        var options = {
          title: null,
          html: null,
          icon: "info",
          position: "center",
          timer: undefined,
          timerProgressBar: false,
          showConfirmButton: true,
          confirmButtonText: this.getText("OK_ACTION", []),
          confirmButtonColor: "#3085d6",

          showCancelButton: true,
          cancelButtonText: this.getText("CANCEL_ACTION", []),
          cancelButtonColor: "#d33",
          showCloseButton: false,
          focusConfirm: true,
          toast: false,
          timer: undefined,
          timerProgressBar: false,
          allowOutsideClick: false,
          allowEscapeKey: false,
          allowEnterKey: true,
          input: undefined,
          inputLabel: "",
          inputPlaceholder: "",
          inputAttributes: {},
          preConfirm: null,
        };

        for (var k in options) {
          if (opts.hasOwnProperty(k)) {
            options[k] = opts[k];
          }
        }

        Swal.fire({ ...options }).then(function (result) {
          if (result.isConfirmed) {
            if (opts.confirmCallbackFn !== undefined) {
              try {
                opts.confirmCallbackFn();
              } catch (e) {}
            }
          }
          if (result.isCancelled) {
            if (opts.cancelCallbackFn !== undefined) {
              try {
                opts.cancelCallbackFn();
              } catch (e) {}
            }
          }
        });
      },
      /* Shared event handlers
       * @public
       */
      initializeAppSettings: async function (bUser = true) {
        const oAppModel =
          this.getModel("appModel") ||
          this.getOwnerComponent().getModel("appModel");
        oAppModel.setProperty(
          "/language",
          sap.ui.getCore().getConfiguration().getLanguage().includes("en")
            ? "en"
            : sap.ui.getCore().getConfiguration().getLanguage()
        );

        if (bUser) {
          let userId = oAppModel.getProperty("/user/id");
          const decryptedDataParsed = await this.getTravelStorage();

          if (decryptedDataParsed.keyVault.user.id === null) {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("index");
            return;
          }

          if (!userId && decryptedDataParsed.keyVault.user.id) {
            oAppModel.setProperty("/user", {
              ...decryptedDataParsed.keyVault.user,
            });
            oAppModel.setProperty(
              "/masterUser",
              decryptedDataParsed.keyVault.masterUser.id
                ? { ...decryptedDataParsed.keyVault.masterUser }
                : { ...decryptedDataParsed.keyVault.user }
            );
            const delegateOf = decryptedDataParsed.keyVault.delegateOf
              ? JSON.parse(decryptedDataParsed.keyVault.delegateOf)
              : [];
            oAppModel.setProperty("/delegateOf", delegateOf);
          }
        }
      },
      onLanguageChange: function (evt) {
        const oAppModel = this.getModel("appModel");
        if (sap.ui.getCore().getConfiguration().getLanguage().includes("en")) {
          sap.ui.getCore().getConfiguration().setLanguage("ar");
        } else {
          sap.ui.getCore().getConfiguration().setLanguage("en");
        }
        oAppModel.setProperty(
          "/language",
          sap.ui.getCore().getConfiguration().getLanguage().includes("en")
            ? "en"
            : sap.ui.getCore().getConfiguration().getLanguage()
        );
      },
      onOverflowMenuOpen: function () {
        var oView = this.getView(),
          oButton = oView.byId("menuButton");
        if (!this._oMenuFragment) {
          this._oMenuFragment = Fragment.load({
            id: oView.getId(),
            name: "ui5appuat.view.fragments.HeaderOverflowMenuPopover",
            controller: this,
          }).then(function (oMenu) {
            oView.addDependent(oMenu);
            return oMenu;
          });
        }
        this._oMenuFragment.then(function (oMenu) {
          oMenu.openBy(oButton);
        });
      },
      getTravelStorage: async function () {
        const storageData = Storage.get("travel_mission_storage");
        const decryptedData = await this.getDecryptedData(storageData);

        return JSON.parse(decryptedData);
      },
      getDecryptedData: function (data) {
        const that = this;
        return new Promise(async function (resolve, reject) {
          var decipher = forge.cipher.createDecipher("AES-CBC", that.AESKEY);
          decipher.start({ iv: that.AESIV });
          decipher.update(forge.util.createBuffer(forge.util.hexToBytes(data)));
          decipher.finish();
          resolve(decipher.output.toString());
        });
      },

      getEncryptedData: async function (data) {
        const that = this;
        return new Promise(async function (resolve, reject) {
          var cipher = forge.cipher.createCipher("AES-CBC", that.AESKEY);
          cipher.start({ iv: that.AESIV });
          cipher.update(forge.util.createBuffer(JSON.stringify(data)));
          cipher.finish();
          var encrypted = cipher.output;
          resolve(encrypted.toHex());
        });
      },

      getEnvInfo: async function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          let envInfo = null;
          const decryptedDataParsed = await that.getTravelStorage();
          envInfo = decryptedDataParsed.keyVault.envInfo;
          resolve(envInfo);
        });
      },
      refreshToken: async function () {
        const that = this;
        const envInfo = await this.getEnvInfo();
        return new Promise(async function (resolve, reject) {
          try {
            if (envInfo != null) {
              const url = envInfo.CF.url + "/oauth/token?";
              jQuery.ajax({
                type: "GET",
                url: url,
                data: {
                  client_id: envInfo.CF.clienId,
                  grant_type: "refresh_token",
                  client_secret: envInfo.CF.clientSecret,
                  refresh_token: envInfo.CF.refreshToken,
                },
                beforeSend: function (xhr) {
                  xhr.setRequestHeader("Accept", "application/json");
                  xhr.setRequestHeader(
                    "Content-Type",
                    "application/x-www-form-urlencoded"
                  );
                },
                success: async function (data, textStatus, jqXHR) {
                  envInfo.CF.accessToken = data.access_token;
                  envInfo.CF.refreshToken = data.refresh_token;
                  envInfo.CF.expiryDate = data.expires_in;

                  const decryptedDataParsed = await that.getTravelStorage();
                  if (decryptedDataParsed && decryptedDataParsed.keyVault) {
                    decryptedDataParsed.keyVault.envInfo = envInfo;
                  }
                  var getEncriptedData = await that.getEncryptedData(
                    decryptedDataParsed
                  );
                  Storage.put("travel_mission_storage", getEncriptedData);

                  resolve(200);
                },
                error: function (jqXHR, textStatus, errorDesc) {
                  reject(500);
                },
              });
            } else {
              that.alertMessage(
                "E",
                "errorDuringUpdate",
                "sessionExpired",
                [],
                {
                  confirmCallbackFn: () => {
                    that.closeMission();
                  },
                }
              );
            }
          } catch (e) {
            reject(500);
          }
        });
      },

      getCurrentRoute: function (
        router = this.getOwnerComponent().getRouter()
      ) {
        const currentHash = router.getHashChanger().getHash();
        const { name } = router.getRouteInfoByHash(currentHash); // API available since 1.75
        return router.getRoute(name);
      },

      filterDecreeTypeBySector: function (sSectorId) {
        const oSectorModel = this.getModel("sectorsModel");
        const oDecreeModel = this.getModel("decreeTypesModel");
        const oMissionModel = this.getModel("missionInfoModel");

        const aSectors = oSectorModel.getProperty("/availableSectors");
        const aDecrees = oDecreeModel.getProperty("/allDecreeTypes");
        let aAvailableDecrees = [];
        const oSector = _.find(aSectors, ["externalCode", sSectorId]);

        if (
          oSector.cust_Decree_Type === null ||
          oSector.cust_Decree_Type === undefined
        ) {
          oDecreeModel.setProperty("/decreeTypes", aDecrees);
          return null;
        }

        let sDecreeFilter = "";
        if (oSector.cust_Decree_Type === "1") {
          sDecreeFilter = "Administrative";
        } else if (oSector.cust_Decree_Type === "2") {
          sDecreeFilter = "Ministerial";
        }

        aAvailableDecrees = aDecrees.filter((d) =>
          d.localeLabel.includes(sDecreeFilter)
        );

        oDecreeModel.setProperty("/decreeTypes", aAvailableDecrees);
        if (oMissionModel) {
          oMissionModel.setProperty("/info/decreeType", null);
        }
        return oSector.cust_Decree_Type;
      },

      getMasters: async function () {
        const envInfo = await this.getEnvInfo();
        const decryptedDataParsed = await this.getTravelStorage();
        const oScreenModel = this.getModel("screenModel");
        const oScreenModelData = oScreenModel.getProperty("/info");

        return new Promise(async (resolve, reject) => {
          try {
            const headers = {
              "Content-Type": "application/json",
              "x-csrf-token": envInfo.CSRF,
              "x-approuter-authorization": `Bearer ${envInfo.CF.accessToken}`,
            };

            const url = "/getValueListsBatch";
            const response = await fetch(url, {
              method: "POST",
              credentials: "include",
              headers: headers,
              body: JSON.stringify({
                userId: decryptedDataParsed.keyVault.user.id,
              }),
            });

            if (!response.ok) {
              throw new Error("Error occured");
            }
            const encryptedResult = new TextDecoder().decode(
              new Uint8Array(await response.arrayBuffer())
            );
            const resultString = await this.getDecryptedData(encryptedResult);
            const result = JSON.parse(resultString);
            // cities: [],
            // hospitalityOptions: [],
            // sectors: [],
            // decreeTypes: [],
            // flightTypes: [],
            // ticketTypes: [],
            // dynamicGroups: [],
            // statuses: [],
            // multicities: [],
            // headOfMission: [],

            //--Set value lists
            let destinationsModel = new JSONModel({
              destinations: _.cloneDeep(result.cities),
            });
            this.setModel(destinationsModel, "destinationsModel");

            let hospitalityOptionsModel = new JSONModel({
              hospitalityOptions: _.cloneDeep(result.hospitalityOptions),
            });
            this.setModel(hospitalityOptionsModel, "hospitalityOptionsModel");

            let sectorsModel = new JSONModel({
              sectors: _.cloneDeep(result.sectors),
              availableSectors: _.filter(result.sectors, [
                "cust_Visible",
                true,
              ]),
            });
            this.setModel(sectorsModel, "sectorsModel");

            let decreeTypesModel = new JSONModel({
              decreeTypes: _.cloneDeep(result.decreeTypes),
              allDecreeTypes: _.cloneDeep(result.decreeTypes),
            });
            this.setModel(decreeTypesModel, "decreeTypesModel");

            let externalEntityModel = new JSONModel({
              externalEntitySet: _.cloneDeep(result.externalEntity),
            });
            this.setModel(externalEntityModel, "externalEntityModel");

            let ticketTypesModel = new JSONModel({
              ticketTypes: _.cloneDeep(result.ticketTypes),
            });
            this.setModel(ticketTypesModel, "ticketTypesModel");

            let flightTypesModel = new JSONModel({
              flightTypes: _.cloneDeep(result.flightTypes),
            });
            this.setModel(flightTypesModel, "flightTypesModel");

            let multicitiesModel = new JSONModel({
              multicities: _.cloneDeep(result.multicities),
            });
            this.setModel(multicitiesModel, "multicitiesModel");

            let headOfMissionModel = new JSONModel({
              headOfMission: _.cloneDeep(result.headOfMission),
            });
            this.setModel(headOfMissionModel, "headOfMissionModel");

            oScreenModelData.pageErrorMessage = null;
            oScreenModelData.pageError = false;

            oScreenModel.setProperty("/info", oScreenModelData);

            resolve(200);
          } catch (e) {
            oScreenModelData.pageErrorMessage = this.getText("serverError");
            oScreenModelData.pageError = true;

            oScreenModel.setProperty("/info", oScreenModelData);

            reject("500", "getMasters");
          }
        });
      },

      refreshSectors: async function () {
        const envInfo = await this.getEnvInfo();
        const oSectorsModel = this.getModel("sectorsModel");

        return new Promise(async (resolve, reject) => {
          try {
            const headers = {
              "Content-Type": "application/json",
              "x-csrf-token": envInfo.CSRF,
              "x-approuter-authorization": `Bearer ${envInfo.CF.accessToken}`,
            };

            const url = "/fetchSectors";
            const response = await fetch(url, {
              method: "POST",
              credentials: "include",
              headers: headers,
            });

            if (!response.ok) {
              throw new Error("Error occured");
            }
            const encryptedResult = new TextDecoder().decode(
              new Uint8Array(await response.arrayBuffer())
            );
            const resultString = await this.getDecryptedData(encryptedResult);
            const result = JSON.parse(resultString);

            //--Set value lists
            oSectorsModel.setProperty("/sectors", _.cloneDeep(result.sectors));
            oSectorsModel.setProperty(
              "/availableSectors",
              _.filter(result.sectors, ["cust_Visible", true])
            );
            resolve(200);
          } catch (e) {
            reject(500);
          }
        });
      },

      getMasters_v1: async function () {
        const that = this;

        const envInfo = await this.getEnvInfo();

        return new Promise(async function (resolve, reject) {
          jQuery.ajax({
            type: "POST",
            url: "/getMasters",
            contentType: "application/json",
            xhrFields: { withCredentials: true },
            beforeSend: function (xhr) {
              if (envInfo != null) {
                xhr.setRequestHeader("x-csrf-token", envInfo.CSRF);
                xhr.setRequestHeader(
                  "x-approuter-authorization",
                  "Bearer " + envInfo.CF.accessToken
                );
              }
            },
            success: async function (data, textStatus, jqXHR) {
              let maData = await that.getDecryptedData(data);

              let masterData = JSON.parse(maData);

              let destinationArr = [];

              for (
                let d = 0;
                d <
                masterData.cities.d.results[0].picklistOptions.results.length;
                d++
              ) {
                let enLbl = null;
                let arLbl = null;
                for (
                  let dt = 0;
                  dt <
                  masterData.cities.d.results[0].picklistOptions.results[d]
                    .picklistLabels.results.length;
                  dt++
                ) {
                  if (
                    masterData.cities.d.results[0].picklistOptions.results[d]
                      .picklistLabels.results[dt].locale == "ar_SA"
                  ) {
                    arLbl =
                      masterData.cities.d.results[0].picklistOptions.results[d]
                        .picklistLabels.results[dt].label;
                  } else {
                    enLbl =
                      masterData.cities.d.results[0].picklistOptions.results[d]
                        .picklistLabels.results[dt].label;
                  }
                }
                destinationArr.push({
                  externalCode:
                    masterData.cities.d.results[0].picklistOptions.results[d]
                      .externalCode,
                  localeLabel: enLbl,
                  localeARLabel: arLbl,
                });
              }

              let destinationsModel = new JSONModel({
                destinations: destinationArr,
              });

              that.setModel(destinationsModel, "destinationsModel");

              let hospitalityOptionsArr = [];

              for (
                let h = 0;
                h <
                masterData.hospitalityOptions.d.results[0].picklistOptions
                  .results.length;
                h++
              ) {
                let enLbl = null;
                let arLbl = null;
                for (
                  let hp = 0;
                  hp <
                  masterData.hospitalityOptions.d.results[0].picklistOptions
                    .results[h].picklistLabels.results.length;
                  hp++
                ) {
                  if (
                    masterData.hospitalityOptions.d.results[0].picklistOptions
                      .results[h].picklistLabels.results[hp].locale == "ar_SA"
                  ) {
                    arLbl =
                      masterData.hospitalityOptions.d.results[0].picklistOptions
                        .results[h].picklistLabels.results[hp].label;
                  } else {
                    enLbl =
                      masterData.hospitalityOptions.d.results[0].picklistOptions
                        .results[h].picklistLabels.results[hp].label;
                  }
                }
                hospitalityOptionsArr.push({
                  externalCode:
                    masterData.hospitalityOptions.d.results[0].picklistOptions
                      .results[h].externalCode,
                  localeLabel: enLbl,
                  localeARLabel: arLbl,
                });
              }

              let hospitalityOptionsModel = new JSONModel({
                hospitalityOptions: hospitalityOptionsArr,
              });

              that
                .getView()
                .setModel(hospitalityOptionsModel, "hospitalityOptionsModel");

              let sectorsModel = new JSONModel({
                sectors: masterData.sectors.d.results,
                availableSectors: _.filter(masterData.sectors.d.results, [
                  "cust_Visible",
                  true,
                ]),
              });

              that.setModel(sectorsModel, "sectorsModel");

              let decreeTypesArr = [];

              for (
                let d = 0;
                d <
                masterData.decreeTypes.d.results[0].picklistOptions.results
                  .length;
                d++
              ) {
                let enLbl = null;
                let arLbl = null;
                for (
                  let dt = 0;
                  dt <
                  masterData.decreeTypes.d.results[0].picklistOptions.results[d]
                    .picklistLabels.results.length;
                  dt++
                ) {
                  if (
                    masterData.decreeTypes.d.results[0].picklistOptions.results[
                      d
                    ].picklistLabels.results[dt].locale == "ar_SA"
                  ) {
                    arLbl =
                      masterData.decreeTypes.d.results[0].picklistOptions
                        .results[d].picklistLabels.results[dt].label;
                  } else {
                    enLbl =
                      masterData.decreeTypes.d.results[0].picklistOptions
                        .results[d].picklistLabels.results[dt].label;
                  }
                }
                decreeTypesArr.push({
                  externalCode:
                    masterData.decreeTypes.d.results[0].picklistOptions.results[
                      d
                    ].externalCode,
                  localeLabel: enLbl,
                  localeARLabel: arLbl,
                });
              }

              let decreeTypesModel = new JSONModel({
                decreeTypes: decreeTypesArr,
              });

              that.setModel(decreeTypesModel, "decreeTypesModel");

              let ticketTypesArr = [];

              for (
                let t = 0;
                t <
                masterData.ticketTypes.d.results[0].picklistOptions.results
                  .length;
                t++
              ) {
                let enLbl = null;
                let arLbl = null;
                for (
                  let tt = 0;
                  tt <
                  masterData.ticketTypes.d.results[0].picklistOptions.results[t]
                    .picklistLabels.results.length;
                  tt++
                ) {
                  if (
                    masterData.ticketTypes.d.results[0].picklistOptions.results[
                      t
                    ].picklistLabels.results[tt].locale == "ar_SA"
                  ) {
                    arLbl =
                      masterData.ticketTypes.d.results[0].picklistOptions
                        .results[t].picklistLabels.results[tt].label;
                  } else {
                    enLbl =
                      masterData.ticketTypes.d.results[0].picklistOptions
                        .results[t].picklistLabels.results[tt].label;
                  }
                }
                ticketTypesArr.push({
                  externalCode:
                    masterData.ticketTypes.d.results[0].picklistOptions.results[
                      t
                    ].externalCode,
                  localeLabel: enLbl,
                  localeARLabel: arLbl,
                });
              }

              let ticketTypesModel = new JSONModel({
                ticketTypes: ticketTypesArr,
              });

              that.setModel(ticketTypesModel, "ticketTypesModel");

              let flightTypesArr = [];

              for (
                let f = 0;
                f <
                masterData.flightTypes.d.results[0].picklistOptions.results
                  .length;
                f++
              ) {
                let enLbl = null;
                let arLbl = null;
                for (
                  let ft = 0;
                  ft <
                  masterData.flightTypes.d.results[0].picklistOptions.results[f]
                    .picklistLabels.results.length;
                  ft++
                ) {
                  if (
                    masterData.flightTypes.d.results[0].picklistOptions.results[
                      f
                    ].picklistLabels.results[ft].locale == "ar_SA"
                  ) {
                    arLbl =
                      masterData.flightTypes.d.results[0].picklistOptions
                        .results[f].picklistLabels.results[ft].label;
                  } else {
                    enLbl =
                      masterData.flightTypes.d.results[0].picklistOptions
                        .results[f].picklistLabels.results[ft].label;
                  }
                }
                flightTypesArr.push({
                  externalCode:
                    masterData.flightTypes.d.results[0].picklistOptions.results[
                      f
                    ].externalCode,
                  localeLabel: enLbl,
                  localeARLabel: arLbl,
                });
              }

              let flightTypesModel = new JSONModel({
                flightTypes: flightTypesArr,
              });

              that.setModel(flightTypesModel, "flightTypesModel");

              let multicityOptionsArr = [];

              for (
                let m = 0;
                m <
                masterData.multicities.d.results[0].picklistOptions.results
                  .length;
                m++
              ) {
                let enLbl = null;
                let arLbl = null;
                for (
                  let mc = 0;
                  mc <
                  masterData.multicities.d.results[0].picklistOptions.results[m]
                    .picklistLabels.results.length;
                  mc++
                ) {
                  if (
                    masterData.multicities.d.results[0].picklistOptions.results[
                      m
                    ].picklistLabels.results[mc].locale == "ar_SA"
                  ) {
                    arLbl =
                      masterData.multicities.d.results[0].picklistOptions
                        .results[m].picklistLabels.results[mc].label;
                  } else {
                    enLbl =
                      masterData.multicities.d.results[0].picklistOptions
                        .results[m].picklistLabels.results[mc].label;
                  }
                }
                multicityOptionsArr.push({
                  externalCode:
                    masterData.multicities.d.results[0].picklistOptions.results[
                      m
                    ].externalCode,
                  localeLabel: enLbl,
                  localeARLabel: arLbl,
                });
              }

              let multicitiesModel = new JSONModel({
                multicities: multicityOptionsArr,
              });

              that.setModel(multicitiesModel, "multicitiesModel");

              let headofmissionOptionsArr = [];

              for (
                let h = 0;
                h <
                masterData.headOfMission.d.results[0].picklistOptions.results
                  .length;
                h++
              ) {
                let enLbl = null;
                let arLbl = null;
                for (
                  let hm = 0;
                  hm <
                  masterData.headOfMission.d.results[0].picklistOptions.results[
                    h
                  ].picklistLabels.results.length;
                  hm++
                ) {
                  if (
                    masterData.headOfMission.d.results[0].picklistOptions
                      .results[h].picklistLabels.results[hm].locale == "ar_SA"
                  ) {
                    arLbl =
                      masterData.headOfMission.d.results[0].picklistOptions
                        .results[h].picklistLabels.results[hm].label;
                  } else {
                    enLbl =
                      masterData.headOfMission.d.results[0].picklistOptions
                        .results[h].picklistLabels.results[hm].label;
                  }
                }
                headofmissionOptionsArr.push({
                  externalCode:
                    masterData.headOfMission.d.results[0].picklistOptions
                      .results[h].externalCode,
                  localeLabel: enLbl,
                  localeARLabel: arLbl,
                });
              }

              let headOfMissionModel = new JSONModel({
                headOfMission: headofmissionOptionsArr,
              });

              that.setModel(headOfMissionModel, "headOfMissionModel");

              resolve(200);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              const oScreenModel = that.getModel("screenModel");
              const screenModelData = oScreenModel.getProperty("/info");

              screenModelData.pageErrorMessage = that.getText("serverError");
              screenModelData.pageError = false;

              oScreenModel.setProperty("/info", screenModelData);

              reject(jqXHR.status, "getMasters");
            },
          });
        });
      },

      getLoggedinInfo: async function () {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oScreenModel = this.getModel("screenModel");
        const decryptedDataParsed = await this.getTravelStorage();

        return new Promise(async function (resolve, reject) {
          const encryptedData = await that.getEncryptedData({
            user: decryptedDataParsed.keyVault.user.email,
          });
          jQuery.ajax({
            type: "POST",
            url: "/getLoggedinInfo",
            contentType: "application/json",
            xhrFields: { withCredentials: true },
            data: JSON.stringify({
              data: encryptedData,
            }),
            beforeSend: function (xhr) {
              if (envInfo != null) {
                xhr.setRequestHeader("x-csrf-token", envInfo.CSRF);
                xhr.setRequestHeader(
                  "x-approuter-authorization",
                  "Bearer " + envInfo.CF.accessToken
                );
              }
            },
            success: async function (data, textStatus, jqXHR) {
              const userData = await that.getDecryptedData(data);
              const userInfo = JSON.parse(userData);

              const storageData = Storage.get("travel_mission_storage");
              const getDecryptedData = await that.getDecryptedData(storageData);
              const decryptedDataParsed = JSON.parse(getDecryptedData);
              decryptedDataParsed.keyVault.user.id = userInfo.id;
              decryptedDataParsed.keyVault.user.firstName = userInfo.firstName;
              decryptedDataParsed.keyVault.user.lastName = userInfo.lastName;
              if (userInfo.isCreateMissionPossible == true) {
                decryptedDataParsed.keyVault.permission.create = true;
              } else {
                decryptedDataParsed.keyVault.permission.create = false;
              }
              if (userInfo.isPayrollAdmin == true) {
                decryptedDataParsed.keyVault.permission.payrollGroup = true;
                decryptedDataParsed.keyVault.permission.list = false;
              } else {
                decryptedDataParsed.keyVault.permission.payrollGroup = false;
                decryptedDataParsed.keyVault.permission.list = true;
              }

              const oAppModel = that.getModel("appModel");

              //--Set master model for delegate
              if (!decryptedDataParsed.keyVault.masterUser.id) {
                //--Set storage
                decryptedDataParsed.keyVault.masterUser = {
                  ...decryptedDataParsed.keyVault.user,
                };

                decryptedDataParsed.keyVault.delegateOf = JSON.stringify(
                  userInfo.delegateOf.map((o) => {
                    return {
                      empId: o.empId,
                      empName_en: o.empName_en,
                      empPosition_en: o.empPosition_en,
                      empEmail: o.empEmail,
                      empSector: o.empSector,
                    };
                  })
                );
                //--Set storage

                //--Set global data
                oAppModel.setProperty("/masterUser", {
                  ...decryptedDataParsed.keyVault.user,
                });
                oAppModel.setProperty("/delegateOf", [...userInfo.delegateOf]);

                if (userInfo.delegateOf && userInfo.delegateOf.length > 0) {
                  that.getPhotoOfDelegatorsAsync();
                }

                //--Set global data
              }
              //--Set master model for delegate

              //--Set user info for header
              oAppModel.setProperty("/user", {
                ...decryptedDataParsed.keyVault.user,
                proxy:
                  decryptedDataParsed.keyVault.user.id !==
                  decryptedDataParsed.keyVault.masterUser.id,
              });
              //--Set user info for header

              const getEncryptedData = await that.getEncryptedData(
                decryptedDataParsed
              );
              Storage.put("travel_mission_storage", getEncryptedData);

              const oScreenModelData = oScreenModel.getProperty("/info");

              if (userInfo.isCreateMissionPossible == true) {
                oScreenModelData.create = true;
              } else {
                oScreenModelData.create = false;
              }
              if (userInfo.isPayrollAdmin == true) {
                oScreenModelData.payrollGroup = true;
                oScreenModelData.list = false;
                oScreenModelData.claimsTab = true;
                oScreenModelData.advanceTab = false;
              } else {
                oScreenModelData.payrollGroup = false;
                oScreenModelData.list = true;
                oScreenModelData.claimsTab = false;
                oScreenModelData.advanceTab = false;
              }

              oScreenModelData.pageErrorMessage = null;
              oScreenModelData.pageError = false;
              oScreenModelData.tableLoader = true;

              oScreenModel.setProperty("/info", oScreenModelData);

              resolve(200);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              const oScreenModelData = oScreenModel.getProperty("/info");

              oScreenModelData.create = false;
              oScreenModelData.list = false;
              oScreenModelData.payrollGroup = false;
              if (jqXHR.status == 400) {
                oScreenModelData.pageErrorMessage = that
                  .getView()
                  .getModel("i18n")
                  .getResourceBundle()
                  .getText("userNotFound");
              } else {
                oScreenModelData.pageErrorMessage = that
                  .getView()
                  .getModel("i18n")
                  .getResourceBundle()
                  .getText("serverError");
              }
              oScreenModelData.pageError = true;
              oScreenModelData.tableLoader = false;
              oScreenModelData.claimsTab = false;
              oScreenModelData.advanceTab = false;

              oScreenModel.setProperty("/info", oScreenModelData);

              reject({ status: jqXHR.status, callback: "getLoggedinInfo" });
            },
          });
        });
      },

      onAfterCloseErrorPane: function () {
        this._oErrorPane.destroy();
        this._oErrorPane = null;
      },

      onCloseErrorPane: function () {
        this._oErrorPane.close();
      },
      onOpenErrorPane: async function () {
        const oView = this.getView();

        const oErrorModel = this.getModel("errorModel");
        const aErrors = oErrorModel.getProperty("/missionErrors") || [];

        if (aErrors.length === 0) {
          return;
        }

        if (!this._oErrorPane) {
          this._oErrorPane = await Fragment.load({
            id: oView.getId(),
            name: "ui5appuat.view.fragments.ErrorPane",
            controller: this,
          });
          oView.addDependent(this._oErrorPane);
        }
        this._oErrorPane.open();
      },
      checkMission: async function (missionRequest) {
        const that = this;
        const envInfo = await this.getEnvInfo();

        const url = "/checkMission";

        return new Promise(async (resolve, reject) => {
          const oErrorModel = this.getModel("errorModel");
          oErrorModel.setProperty("/missionErrors", []);

          jQuery.ajax({
            type: "POST",
            url: url,
            contentType: "application/json",
            xhrFields: { withCredentials: true },
            data: JSON.stringify(missionRequest),
            beforeSend: function (xhr) {
              if (envInfo != null) {
                xhr.setRequestHeader("x-csrf-token", envInfo.CSRF);
                xhr.setRequestHeader(
                  "x-approuter-authorization",
                  "Bearer " + envInfo.CF.accessToken
                );
              }
            },
            success: async function (data, textStatus, jqXHR) {
              const decryptedData = await that.getDecryptedData(data);
              const missionCheckData = JSON.parse(decryptedData);
              const aErrors = [];

              if (
                missionCheckData &&
                missionCheckData.results &&
                missionCheckData.results.length > 0
              ) {
                const oDestinationModel = that.getModel("destinationsModel");
                const aDestinations =
                  oDestinationModel.getProperty("/destinations");

                missionCheckData.results.forEach((c) => {
                  if (c && c.d && c.d.results && c.d.results.length > 0) {
                    c.d.results.forEach((r) => {
                      if (r["cust_Mission_Start_Date"]) {
                        //--Duplicate missions - destinations
                        const d = _.find(aDestinations, [
                          "externalCode",
                          r.cust_Destination,
                        ]);

                        let oError = {
                          category: that.getText("missionCategory", []),
                          message: that.getText("missionDuplicate", [
                            r.externalCode,
                            Formatter.formatIsoDate(r.cust_Mission_Start_Date),
                            Formatter.formatIsoDate(r.cust_Mission_End_Date),
                            d.localeLabel,
                          ]),
                        };
                        aErrors.push(oError);
                      } else if (r["cust_Members"]) {
                        r.cust_Members.results.forEach((m) => {
                          m.cust_itinerary_details_child.results.forEach(
                            (p) => {
                              //--Duplicate members
                              //--Mission member {0} ({1}) is also assigned to another mission {2} between {3} and {4} is also to {5}
                              const d = _.find(aDestinations, [
                                "externalCode",
                                p.cust_city,
                              ]);
                              let oError = {
                                category: that.getText("memberCategory", []),
                                message: that.getText("memberNotAvailable", [
                                  m.cust_First_Name,
                                  m.cust_Employee_ID,
                                  m.cust_Mission_ID,
                                  Formatter.formatIsoDate(p.cust_start_date),
                                  Formatter.formatIsoDate(p.cust_end_date),
                                  d.localeLabel,
                                ]),
                              };
                              aErrors.push(oError);
                            }
                          );
                        });
                      }
                    });
                  }
                });

                if (aErrors.length > 0) {
                  oErrorModel.setProperty("/missionErrors", aErrors);
                  resolve(false);
                }
              }

              resolve(true);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              resolve(false);
            },
          });
        });
      },

      validateMissionForDecreeType:function(sDecreeType, aMissionMembers){
        const oAppModel =
          this.getModel("appModel") ||
          this.getOwnerComponent().getModel("appModel");
        const sLang = oAppModel.getProperty("/language");
        
        const aValidationRules = [
          {
            "externalCode": "01",
            "localeLabel": "One Employee Mission - Administrative",
            "localeARLabel": "مهمة رسمية لموظف - إداري",
            "maxMembersCount": 1,
            "headOfMissionExists":false
          },
           {
            "externalCode": "02",
            "localeLabel": "Group with Head Mission - Administrative",
            "localeARLabel": "مهمة رسمية لوفد مع رئيس للوفد - إداري",
            "maxMembersCount": 999,
            "headOfMissionExists":true
          },
          {
            "externalCode": "03",
            "localeLabel": "Group without Head Mission - Administrative",
            "localeARLabel": "مهمة رسمية لمجموعة موظفين - إداري",
            "maxMembersCount": 999,
            "headOfMissionExists":false
          },
          {
            "externalCode": "04",
            "localeLabel": "One Employee with Head of Mission - Administrative",
            "localeARLabel": "بمهمة رسمية لموظف مع رئيس وفد - إداري",
            "maxMembersCount": 2,
            "headOfMissionExists":true
          },
        
           {
            "externalCode": "05",
            "localeLabel": "One Employee Mission - Ministerial",
            "localeARLabel": "مهمة رسمية لموظف - وزاري",
            "maxMembersCount": 1,
            "headOfMissionExists":false
          },
          {
            "externalCode": "06",
            "localeLabel": "Group with Head of Mission - Ministerial",
            "localeARLabel": "مهمة رسمية لوفد مع رئيس للوفد - وزاري",
            "maxMembersCount": 999,
            "headOfMissionExists":true
          },
          {
            "externalCode": "07",
            "localeLabel": "Group without Head Mission - Ministerial",
            "localeARLabel": "مهمة رسمية لمجموعة موظفين - وزاري",
            "maxMembersCount": 999,
            "headOfMissionExists":false
          },
          {
            "externalCode": "08",
            "localeLabel": "One Employee with Head of Mission - Ministerial",
            "localeARLabel": "بمهمة رسمية لموظف مع رئيس وفد - وزاري",
            "maxMembersCount": 2,
            "headOfMissionExists":true
          },
           {
            "externalCode": "09",
            "localeLabel": "Head of Mission without Members - Ministerial ",
            "localeARLabel": "لا يوجد",
            "maxMembersCount": 1,
            "headOfMissionExists":true
          },
          {
            "externalCode": "10",
            "localeLabel": "Head of Mission without Members - Administrative",
            "localeARLabel": "لا يوجد",
            "maxMembersCount": 1,
            "headOfMissionExists":true
          }
        ];

        const oRule = _.find(aValidationRules, ["externalCode", sDecreeType]);

        if(!oRule){
          return null;
        }

        const aMembers = []; // -- Total members count
        const aHOM = []; // --Head of missions

        aMissionMembers.forEach((oMember)=>{
          aMembers.push(oMember.employeeID);

          const hom = _.findIndex(oMember.itinerary, ["headOfMission", "Y"]);
          
          if(hom !== -1){
            aHOM.push(oMember.employeeID);
          }
        });

        //--Validations
        //1--Max Members Count
        if(aMembers.length === 0){
          return {message: "noMembersFound", params:[]};
        }  

        if(aMembers.length > oRule.maxMembersCount){
          return {message:"tooManyMembersFound", params:[oRule[sLang === "en" ? "localeLabel" : "localArLabel"],oRule.maxMembersCount, aMembers.length]};
        }  
        //1--Max Members Count

        //2--Head Of Mission Check
        if(aHOM.length === 0 && oRule.headOfMissionExists){
          return {message:"noHeadOfMissionFound", params:[oRule[sLang === "en" ? "localeLabel" : "localArLabel"]]};
        }

        if(aHOM.length > 1 && oRule.headOfMissionExists){
          return {message:"tooManyHeadOfMissionFound", params:[oRule[sLang === "en" ? "localeLabel" : "localArLabel"]]};
        }

        if(aHOM.length > 0 && !oRule.headOfMissionExists){
          return  {message:"noHeadOfMissionShouldExist", params:[oRule[sLang === "en" ? "localeLabel" : "localArLabel"]]};
        }
        //2--Head Of Mission Check
        //--Validations



      },


      checkIsArabic: function (sContent) {
        const text = sContent.trim();

        if (text.length === 0) {
          return true;
        }

        // Arabic letters + Arabic digits + Western digits + whitespace + symbols
        const arabicWithSymbolsAndDigitsRegex =
          /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0660-\u0669\u0030-\u0039\s.,;:'"?!@#$%^&*()_\-+=\[\]{}<>\/\\|`~ـ]+$/;

        const result = arabicWithSymbolsAndDigitsRegex.test(text);

        return result;
      },
      onMissionDescriptionInputLiveChange: function (oEvent) {
        const sText = oEvent.getParameter("value");
        const oDescrField = oEvent.getSource();
        const bArabic = this.checkIsArabic(sText);
        oDescrField && oDescrField.setValueState("None");
        oDescrField && oDescrField.setValueStateText("");

        if (!bArabic) {
          oDescrField && oDescrField.setValueState("Error");
          oDescrField &&
            oDescrField.setValueStateText(
              this.getText("arabicDescriptionOnly", [])
            );
        }
      },
      getDefaultHeadOfMission: function(sDecreeType){
         switch (sDecreeType) {
          case "01": //One Employee Mission - Administrative
          case "05": //One Employee Mission - Ministerial
          case "03": //Group Without Head of Mission - Administrative
          case "07": //Group Without Head of Mission - Ministerial
            return "N";
          case "09": //Head of Mission Without Members - Ministerial
          case "10": //Head of Mission Without Members - Administrative
            return "Y"; 
          default:
            return "";
        }
      },
      isHeadOfMissionEditable: function (sDecreeType) {
        switch (sDecreeType) {
          case "01": //One Employee Mission - Administrative
          case "05": //One Employee Mission - Ministerial
          case "03": //Group Without Head of Mission - Administrative
          case "07": //Group Without Head of Mission - Ministerial
          case "09": //Head of Mission Without Members - Ministerial
          case "10": //Head of Mission Without Members - Administrative
          case "":
          case null:
          case undefined:
            return false;
          default:
            return true;
        }
      },
      isAddMemberPossible: function (sDecreeType) {
        switch (sDecreeType) {
          case "01": //One Employee Mission - Administrative
          case "05": //One Employee Mission - Ministerial
          case "09": //Head of Mission Without Members - Ministerial
          case "10": //Head of Mission Without Members - Administrative
          case "":
          case null:
          case undefined:
            return false;
          default:
            return true;
        }
      },

      onDecreeTypeChanged: function () {
        const oMembersModel = this.getModel("membersModel");
        const oMissionModel = this.getModel("missionInfoModel");
        const aMembers = oMembersModel.getProperty("/members");
        const sDecreeType = oMissionModel.getProperty("/info/decreeType");

        if (sDecreeType !== "09" && sDecreeType !== "10") {
          oMissionModel.setProperty("/info/externalEntity", "");
        }

        switch (sDecreeType) {
          case "01": //One Employee Mission - Administrative
          case "05": //One Employee Mission - Ministerial
          case "03": //Group Without Head of Mission - Administrative
          case "07": //Group Without Head of Mission - Ministerial
            aMembers.forEach((oMember) => {
              if (
                oMember &&
                oMember.itinerary &&
                oMember.itinerary.length > 0
              ) {
                oMember.itinerary.forEach((oItinerary) => {
                  oItinerary && oItinerary.hasOwnProperty("headOfMission")
                    ? (oItinerary.headOfMission = "N")
                    : null;
                });
              }
            });

            oMembersModel.setProperty("/members", aMembers);
            return;

          case "09": //Head of Mission Without Members - Ministerial
          case "10": //Head of Mission Without Members - Administrative
            aMembers.forEach((oMember) => {
              if (
                oMember &&
                oMember.itinerary &&
                oMember.itinerary.length > 0
              ) {
                oMember.itinerary.forEach((oItinerary) => {
                  oItinerary && oItinerary.hasOwnProperty("headOfMission")
                    ? (oItinerary.headOfMission = "Y")
                    : null;
                });
              }
            });

            oMembersModel.setProperty("/members", aMembers);
            return;
          default:
            return;
        }
      },
      checkAtLeastOneItinerary: function () {
        const oMembersModel = this.getModel("membersModel");
        const aMembers = oMembersModel.getProperty("/members");

        const bValid = aMembers.every((oMember) => {
          if (!oMember.itinerary || oMember.itinerary.length === 0) {
            this.alertMessage(
              "E",
              "errorOperation",
              "itineraryShouldBeEntered",
              [oMember.employeeName],
              null
            );
            return false;
          }
          return true;
        });

        return bValid;
      },
    });
  }
);
