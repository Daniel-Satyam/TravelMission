sap.ui.define(
  [
    "ui5app/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/util/Storage",
    "sap/m/MessageBox",
    "ui5app/model/formatter",
  ],
  function (
    BaseController,
    JSONModel,
    Fragment,
    Storage,
    MessageBox,
    formatter
  ) {
    "use strict";

    return BaseController.extend("ui5app.controller.Home", {
      formatter: formatter,

      onInit: function () {
        this.initializeAppSettings(false);
        this.setStorage();

        const oRouter = this.getRouter();
        oRouter.getRoute("home").attachMatched(this._onRouteMatched, this);
        oRouter.getRoute("index").attachMatched(this._onRouteMatched, this);

        const claimAdvanceFilterModel = new JSONModel({
          approvalStatusFilters: [
            { externalCode: "2", selected: true }, //--Pending
            { externalCode: "1", selected: false }, //--Approved
            // { externalCode: "3", selected: false }, //--Rejected
            { externalCode: "5", selected: false }, //--Sent back
          ],
          dateSelection: {
            beginDate: null,
            endDate: null,
            presetKey: "01",
          },
        });

        this.setModel(claimAdvanceFilterModel, "claimAdvanceFilterModel");
      },

      setStorage: async function () {
        var permissionData = {
          keyVault: {
            user: {
              id: null,
              firstName: null,
              lastName: null,
              email: null,
              proxy: false,
            },
            masterUser: {
              id: null,
              firstName: null,
              lastName: null,
              email: null,
            },
            delegateOf: null,
            permission: {
              create: false,
              list: false,
              payrollGroup: false,
              mission: {
                id: null,
                view: false,
                approve: false,
                itinerayUpdate: false,
                isClaimable: false,
                isAdvance: false,
                isEditable: false,
              },
            },
            envInfo: null,
          },
        };
        const getEncryptedData = await this.getEncryptedData(permissionData);
        Storage.put("travel_mission_storage", getEncryptedData);
      },
      _checkIsAuthorized: async function () {
        const envInfo = await this.getEnvInfo();
        const decryptedDataParsed = await this.getTravelStorage();
        const oAppModel = this.getModel("appModel");
        try {
          const headers = {
            "Content-Type": "application/json",
            "x-csrf-token": envInfo.CSRF,
            "x-approuter-authorization": `Bearer ${envInfo.CF.accessToken}`,
          };

          oAppModel.setProperty("/isAdmin", false);
          const url = "/checkIsAdmin";
          const response = await fetch(url, {
            method: "POST",
            credentials: "include", // Equivalent to `xhrFields: { withCredentials: true }`
            headers: headers,
            body: JSON.stringify({
              userId: decryptedDataParsed.keyVault.user.id,
            }),
          });

          if (!response.ok) {
            throw new Error("Not authorized!");
          }

          const result = await response.json();
          if (result && result.isAuthorized) {
            oAppModel.setProperty("/isAdmin", true);
          } else {
            throw new Error("Not authorized!");
          }
        } catch (error) {
          //--Do nothing
          oAppModel.setProperty("/isAdmin", false);
        }
      },
      onNavToAdminPage: function () {
        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("adminpage");
      },
      checkS4Connection: async function () {
        const url = "/fetchS4Metadata";
        const envInfo = await this.getEnvInfo();

        return new Promise(async (resolve, reject) => {
          try {
            const headers = {
              "Content-Type": "application/json",
              "x-csrf-token": envInfo.CSRF,
              "x-approuter-authorization": `Bearer ${envInfo.CF.accessToken}`,
            };

            const response = await fetch(url, {
              method: "POST",
              credentials: "include", // Equivalent to `xhrFields: { withCredentials: true }`
              headers: headers,
              body: JSON.stringify({
                odataServiceName: "ZFMFR_CREATE_ODATA_SRV",
              }),
            });

            if (!response.ok) {
              console.log(response);
              resolve(false);
              return;
            }

            const result = await response.text();
            console.log(JSON.parse(result));

            resolve(false);
          } catch (error) {
            console.error("Fetch error:", error);
            resolve(false);
          }
        });
      },

      _onRouteMatched: function (oEvent) {
        this.initialize();
      },

      initialize: async function () {
        const oAppModel = this.getModel("appModel");
        const oUser = oAppModel.getProperty("/user");

        if (oUser && oUser.proxy) {
          try {
            this.openBusyFragment("gettingDataAsDelegate", [
              oUser.firstName + " " + oUser.lastName,
            ]);
            await this.getLoggedinInfo();

            await this.getClaimMasters();

            await this.getList();

            this.closeBusyFragment();
          } catch (e) {
            this.closeBusyFragment();
            if (e.status == 401) {
              window.location.reload(true);
            }
          }
          return;
        }

        this.byId("searchField").setValue("");
        this.byId("searchFieldClaims").setValue("");
        this.byId("searchFieldAdvances").setValue("");

        const screenModelData = {
          create: false,
          list: false,
          payrollGroup: false,
          pageError: false,
          pageErrorMessage: null,
          tableLoader: true,
          claimsTab: false,
          advanceTab: false,
        };

        const payrollGroup = {
          showMissions: false,
        };
        const oScreenModel = new JSONModel({
          info: screenModelData,
          payrollGroup: payrollGroup,
        });

        this.setModel(oScreenModel, "screenModel");

        const missionModelData = [];
        const oMissionsModel = new JSONModel({
          missions: missionModelData,
        });
        this.setModel(oMissionsModel, "missionsModel");
        this.setModel(oMissionsModel, "originalMissionsModel");

        const claimModelData = [];
        const oClaimsModel = new JSONModel({
          claims: claimModelData,
        });
        this.setModel(oClaimsModel, "claimsModel");
        this.setModel(oClaimsModel, "originalClaimsModel");

        const advanceModelData = [];
        const oAdvancesModel = new JSONModel({
          advances: advanceModelData,
        });
        this.setModel(oAdvancesModel, "advancesModel");
        this.setModel(oAdvancesModel, "originalAdvancesModel");

        this.startLoading();

        await this.initializeModel();

        try {
          await this.getEnvironmentInfo();

          try {
            await this.getUserInfo();

            try {
              await this.getLoggedinInfo();

              await this.getClaimMasters();

              await this.getList();

              //--Check is admin
              this._checkIsAuthorized();
              //--Check is admin

              var oRBGroup = this.getView().byId("payRollButtons");
              var oButtonSelectedText = oRBGroup.getSelectedButton().getText();
              this.tabSwitch(oButtonSelectedText.toLowerCase());
              this.finishLoading();
            } catch (e) {
              this.finishLoading();
              if (e.status == 401) {
                window.location.reload(true);
              }
            }
          } catch (e) {
            this.finishLoading();
            if (e.status == 401) {
              window.location.reload(true);
            }
          }
        } catch (e) {
          this.finishLoading();
          if (e.status == 401) {
            window.location.reload(true);
          }
        }
      },

      initializeModel: function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          const oScreenModel = that.getModel("screenModel");
          const oScreenModelData = {
            create: false,
            list: false,
            payrollGroup: false,
            pageError: false,
            pageErrorMessage: null,
            tableLoader: true,
            claimsTab: true,
            advanceTab: false,
          };
          oScreenModel.setProperty("/info", oScreenModelData);
          resolve(true);
        });
      },

      getEnvironmentInfo: async function () {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oScreenModel = this.getModel("screenModel");
        return new Promise(function (resolve, reject) {
          var envInfoApi = jQuery.ajax({
            type: "GET",
            url: "/getEnvironmentInfo",
            beforeSend: function (xhr) {
              xhr.setRequestHeader("x-csrf-token", "fetch");
              if (envInfo != null)
                xhr.setRequestHeader(
                  "x-approuter-authorization",
                  "Bearer " + envInfo.CF.accessToken
                );
            },
            success: async function (data, textStatus, jqXHR) {
              let decryptedData = await that.getDecryptedData(data);
              decryptedData = JSON.parse(decryptedData);
              decryptedData["CSRF"] =
                envInfoApi.getResponseHeader("x-csrf-token");

              const decryptedDataParsed = await that.getTravelStorage();
              decryptedDataParsed.keyVault.envInfo = decryptedData;
              const getEncryptedData = await that.getEncryptedData(
                decryptedDataParsed
              );
              Storage.put("travel_mission_storage", getEncryptedData);

              const oScreenModelData = oScreenModel.getProperty("/info");
              oScreenModelData.create = false;
              oScreenModelData.list = false;
              oScreenModelData.payrollGroup = false;
              oScreenModelData.pageErrorMessage = null;
              oScreenModelData.pageError = false;
              oScreenModelData.tableLoader = true;
              oScreenModelData.claimsTab = true;
              oScreenModelData.advanceTab = false;
              oScreenModel.setProperty("/info", oScreenModelData);

              resolve(200);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              const oScreenModelData = oScreenModel.getProperty("/info");
              oScreenModelData.create = false;
              oScreenModelData.list = false;
              oScreenModelData.payrollGroup = false;
              oScreenModelData.pageErrorMessage = that
                .getView()
                .getModel("i18n")
                .getResourceBundle()
                .getText("serverError");
              oScreenModelData.pageError = true;
              oScreenModelData.tableLoader = false;
              oScreenModelData.claimsTab = false;
              oScreenModelData.advanceTab = false;
              oScreenModel.setProperty("/info", oScreenModelData);

              reject({ status: jqXHR.status, callback: "getEnvironmentInfo" });
            },
          });
        });
      },

      getUserInfo: async function () {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oScreenModel = this.getModel("screenModel");
        const sEmail = jQuery.sap.getUriParameters().get("userEmail") || null;

        return new Promise(function (resolve, reject) {
          jQuery.ajax({
            type: "GET",
            url: "/user-api/currentUser",
            beforeSend: function (xhr) {
              if (envInfo != null)
                xhr.setRequestHeader(
                  "x-approuter-authorization",
                  "Bearer " + envInfo.CF.accessToken
                );
            },
            contentType: "application/json",
            success: async function (data, textStatus, jqXHR) {
              const decryptedDataParsed = await that.getTravelStorage();
              decryptedDataParsed.keyVault.user.email = data.email; //JSON.parse(data).email;
              const getEncryptedData = await that.getEncryptedData(
                decryptedDataParsed
              );
              Storage.put("travel_mission_storage", getEncryptedData);

              resolve(200);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              const oScreenModelData = oScreenModel.getProperty("/info");

              oScreenModelData.create = false;
              oScreenModelData.list = false;
              oScreenModelData.payrollGroup = false;
              oScreenModelData.pageErrorMessage = that
                .getView()
                .getModel("i18n")
                .getResourceBundle()
                .getText("serverError");
              oScreenModelData.pageError = true;
              oScreenModelData.tableLoader = false;
              oScreenModelData.claimsTab = false;
              oScreenModelData.advanceTab = false;

              oScreenModel.setProperty("/info", oScreenModelData);

              reject({ status: jqXHR.status, callback: "getUserInfo" });
            },
          });
        });
      },

      getPhotoOfDelegatorsAsync: async function () {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oAppModel = this.getModel("appModel");
        let delegateOf = _.cloneDeep(oAppModel.getProperty("/delegateOf"));
        let users = "";
        for (let i = 0; i < delegateOf.length; i++) {
          users += "'" + delegateOf[i].empId + "'";
          if (i < delegateOf.length - 1) {
            users += ",";
          }
        }
        const oPayload = {
          users: users,
        };
        const oEncPayload = await that.getEncryptedData(oPayload);

        jQuery.ajax({
          type: "POST",
          url: "/getPhoto",
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
          data: JSON.stringify({
            data: oEncPayload,
          }),
          success: async function (data, textStatus, jqXHR) {
            const decryptedData = await that.getDecryptedData(data);
            let photoData = JSON.parse(decryptedData).d.results;

            for (let i = 0; i < delegateOf.length; i++) {
              for (let j = 0; j < photoData.length; j++) {
                if (delegateOf[i].empId == photoData[j].userId) {
                  if (photoData[j].photo) {
                    delegateOf[i].photo =
                      "data:" +
                      photoData[j].mimeType +
                      ";base64," +
                      photoData[j].photo;
                  } else {
                    delegateOf[i].photo = that.userIcon;
                  }
                }
              }
            }

            for (var k = 0; k < delegateOf.length; k++) {
              if (!delegateOf[k].photoNav) {
                delegateOf[k].photoNav = that.userIcon;
              }
            }

            oAppModel.setProperty("/delegateOf", delegateOf);
          },
          error: async function (jqXHR, textStatus, errorDesc) {},
        });
      },

      refreshList: async function () {
        try {
          this.openBusyFragment();
          const listResponse = await this.getList();
          this.closeBusyFragment();
        } catch (e) {
          this.closeBusyFragment();
        }
      },

      selectFromPresets: async function (oEvent) {
        var oView = this.getView(),
          oButton = oEvent.getSource();

        if (!this._oPresetMenuFragment) {
          this._oPresetMenuFragment = await Fragment.load({
            id: oView.getId(),
            name: "ui5app.view.fragments.PresetDateSelection",
            controller: this,
          });

          oView.addDependent(this._oPresetMenuFragment);
        }
        this._oPresetMenuFragment.openBy(oButton);
      },

      handlePresetDateSelection: function (oEvent) {
        const oItem = oEvent.getParameter("item");
        const oClaimAdvanceFilterModel = this.getModel(
          "claimAdvanceFilterModel"
        );
        let today = new Date(new Date().setHours(9));
        let beginDate = null;
        let endDate = null;

        switch (oItem.getKey()) {
          case "01": //key="01" text="Custom range"
            break;
          case "02": // key="02" text="Last week"
            endDate = _.clone(today);
            beginDate = _.clone(today);
            beginDate.setDate(beginDate.getDate() - 7);
            break;
          case "03": //key="03" text="Last two weeks"
            endDate = _.clone(today);
            beginDate = _.clone(today);
            beginDate.setDate(beginDate.getDate() - 14);
            break;
          case "04": // key="04" text="Last month"
            endDate = _.clone(today);
            beginDate = _.clone(today);
            beginDate.setMonth(beginDate.getMonth() - 1);
            break;
          case "05": // key="05" text="Last two months"
            endDate = _.clone(today);
            beginDate = _.clone(today);
            beginDate.setMonth(beginDate.getMonth() - 2);
            break;
          case "06": // key="06" text="Last three months"
            endDate = _.clone(today);
            beginDate = _.clone(today);
            beginDate.setMonth(beginDate.getMonth() - 3);
            break;
          case "07": // key="07" text="Last six months"
            endDate = _.clone(today);
            beginDate = _.clone(today);
            beginDate.setMonth(beginDate.getMonth() - 6);
            break;
          case "08": // key="08" text="Year to date"
            endDate = _.clone(today);
            beginDate = new Date(today.getFullYear(), 0, 1); // January 1st
            break;
          case "09": // key="09" text="Last one year"
            endDate = _.clone(today);
            beginDate = new Date(
              today.getFullYear() - 1,
              today.getMonth(),
              today.getDate()
            );
            break;
          default:
            oClaimAdvanceFilterModel.setProperty("/dateSelection", {
              beginDate: beginDate,
              endDate: endDate,
              presetKey: "01",
            });
            return;
        }

        oClaimAdvanceFilterModel.setProperty("/dateSelection", {
          beginDate: beginDate,
          endDate: endDate,
          presetKey: oItem.getKey(),
        });
      },
      callClaimsAndAdvances: function () {
        const oScreenModel = this.getModel("screenModel");
        const oScreenPayrollData = oScreenModel.getProperty("/payrollGroup");

        oScreenPayrollData.showMissions = false;

        oScreenModel.setProperty("/payrollGroup", oScreenPayrollData);

        this.refreshList();
      },
      callMyMissions: function () {
        const oScreenModel = this.getModel("screenModel");
        const oScreenPayrollData = oScreenModel.getProperty("/payrollGroup");

        oScreenPayrollData.showMissions = true;

        oScreenModel.setProperty("/payrollGroup", oScreenPayrollData);

        this.refreshList();
      },

      getList: async function () {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oScreenModel = this.getModel("screenModel");
        const oScreenModelData = oScreenModel.getProperty("/info");
        const oScreenPayrollData = oScreenModel.getProperty("/payrollGroup");

        oScreenModelData.tableLoader = true;

        oScreenModel.setProperty("/info", oScreenModelData);

        if (
          oScreenModelData.payrollGroup == true &&
          oScreenPayrollData.showMissions !== true
        ) {
          var claimModelData = [];
          var claimsModel = new JSONModel({
            claims: claimModelData,
          });
          this.setModel(claimsModel, "claimsModel");
          this.setModel(claimsModel, "originalClaimsModel");

          var advanceModelData = [];
          var advancesModel = new JSONModel({
            advances: advanceModelData,
          });
          this.setModel(advancesModel, "advancesModel");
          this.setModel(advancesModel, "originalAdvancesModel");

          const oClaimAdvanceFilterModel = this.getModel(
            "claimAdvanceFilterModel"
          );
          const aStatusFilters = oClaimAdvanceFilterModel.getProperty(
            "/approvalStatusFilters"
          );
          const oDateSelection =
            oClaimAdvanceFilterModel.getProperty("/dateSelection");

          return new Promise(async function (resolve, reject) {
            var obj = {
              statusFilters: [...aStatusFilters],
              dateSelection: { ...oDateSelection },
            };
            var encryptedData = await that.getEncryptedData(obj);
            jQuery.ajax({
              type: "POST",
              //url: "/fetchPendingClaimsAdvances",
              url: "/fetchClaimsAdvances",
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
                var listData = JSON.parse(data);
                var claimsModel = new JSONModel({
                  claims: listData.claims.d.results,
                });
                that.setModel(claimsModel, "claimsModel");
                that.setModel(claimsModel, "originalClaimsModel");

                var advancesModel = new JSONModel({
                  advances: listData.advances.d.results,
                });
                that.setModel(advancesModel, "advancesModel");
                that.setModel(advancesModel, "originalAdvancesModel");

                var employeesArr = [];
                var employeesUniqueArr = [];
                for (var i = 0; i < listData.claims.d.results.length; i++) {
                  employeesArr.push(
                    listData.claims.d.results[i].cust_EmployeeID
                  );
                }

                for (var i = 0; i < listData.advances.d.results.length; i++) {
                  employeesArr.push(
                    listData.advances.d.results[i].cust_EmployeeID
                  );
                }

                employeesUniqueArr = employeesArr.filter(
                  (item, index) => employeesArr.indexOf(item) === index
                );

                that.findMemberInfo(employeesUniqueArr.toString());

                oScreenModelData.tableLoader = false;
                oScreenModel.setProperty("/info", oScreenModelData);

                resolve(true);
              },
              error: async function (jqXHR, textStatus, errorDesc) {
                var claimsModel = new JSONModel({
                  claims: [],
                });
                that.setModel(claimsModel, "claimsModel");
                that.setModel(claimsModel, "originalClaimsModel");

                var advancesModel = new JSONModel({
                  advances: [],
                });
                that.setModel(advancesModel, "advancesModel");
                that.setModel(advancesModel, "originalAdvancesModel");

                oScreenModelData.tableLoader = false;
                oScreenModel.setProperty("/info", oScreenModelData);

                reject(false);
                if (jqXHR.status == 401) {
                  window.location.reload(true);
                }
              },
            });
          });
        } else {
          var missionModelData = [];
          var missionsModel = new JSONModel({
            missions: missionModelData,
          });
          this.setModel(missionsModel, "missionsModel");
          this.setModel(missionsModel, "originalMissionsModel");

          const decryptedDataParsed = await this.getTravelStorage();

          return new Promise(async function (resolve, reject) {
            var obj = {
              user: decryptedDataParsed.keyVault.user.id,
            };
            var encryptedData = await that.getEncryptedData(obj);
            jQuery.ajax({
              type: "POST",
              url: "/findMissions",
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
                var missionsData = JSON.parse(data).findMissions;
                for (var i = 0; i < missionsData.length; i++) {
                  var dtSplit = missionsData[i].startDate.split("(");
                  var formattedDate = new Date(
                    Number(dtSplit[1].split(")")[0])
                  ).valueOf();
                  var todayDt = new Date().valueOf();
                  if (
                    missionsData[i].isviewable == true &&
                    decryptedDataParsed.keyVault.permission.create == true

                    //&&
                    // formattedDate > todayDt &&
                    //missionsData[i].status.externalCode == "1"
                  ) {
                    missionsData[i]["isCancellable"] = true;
                  } else {
                    missionsData[i]["isCancellable"] = false;
                  }

                  if (
                    missionsData[i].isviewable == true &&
                    decryptedDataParsed.keyVault.permission.create == true &&
                    // formattedDate > todayDt &&
                    (missionsData[i].status.externalCode == "2" ||
                      missionsData[i].status.externalCode == "5")
                  ) {
                    missionsData[i]["isEditable"] = true;
                  } else {
                    missionsData[i]["isEditable"] = false;
                  }

                  if (
                    missionsData[i].pendingWith.empId ==
                      decryptedDataParsed.keyVault.user.id &&
                    missionsData[i].status.externalCode == "6"
                  ) {
                    missionsData[i]["isCancelApprovable"] = true;
                    missionsData[i]["isApprovable"] = false;
                  } else {
                    missionsData[i]["isCancelApprovable"] = false;
                  }
                }

                var missionsModel = new JSONModel({
                  missions: missionsData,
                });
                that.setModel(missionsModel, "missionsModel");
                that.setModel(missionsModel, "originalMissionsModel");

                oScreenModelData.tableLoader = false;
                oScreenModel.setProperty("/info", oScreenModelData);

                resolve(true);
              },
              error: async function (jqXHR, textStatus, errorDesc) {
                var missionsModel = new JSONModel({
                  missions: [],
                });
                that.setModel(missionsModel, "missionsModel");
                that.setModel(missionsModel, "originalMissionsModel");

                oScreenModelData.tableLoader = false;
                oScreenModel.setProperty("/info", oScreenModelData);

                reject(false);
                if (jqXHR.status == 401) {
                  window.location.reload(true);
                }
              },
            });
          });
        }
      },

      naveToCreateMission: function () {
        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("createmission");
      },

      getMission: async function (mission) {
        const decryptedDataParsed = await this.getTravelStorage();

        decryptedDataParsed.keyVault.permission.mission.id = mission;
        decryptedDataParsed.keyVault.permission.mission.view = true;
        decryptedDataParsed.keyVault.permission.mission.approve = false;

        var missionData = this.getView()
          .getModel("missionsModel")
          .getData().missions;

        for (var i = 0; i < missionData.length; i++) {
          if (missionData[i].missionId == mission) {
            if (missionData[i].isApprovable == true) {
              decryptedDataParsed.keyVault.permission.mission.approve = true;
            }
          }
        }

        const getEncryptedData = await this.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("viewmission", {
          mission: mission,
        });
      },

      approveMission: async function (mission) {
        const decryptedDataParsed = await this.getTravelStorage();

        decryptedDataParsed.keyVault.permission.mission.id = mission;
        decryptedDataParsed.keyVault.permission.mission.approve = true;

        const getEncryptedData = await this.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("approvemission", {
          mission: mission,
        });
      },

      approveCancel: async function (mission) {
        const decryptedDataParsed = await this.getTravelStorage();

        decryptedDataParsed.keyVault.permission.mission.id = mission;
        decryptedDataParsed.keyVault.permission.mission.approve = true;

        const getEncryptedData = await this.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("approvecancel", {
          mission: mission,
        });
      },

      updateItineraryMission: async function (mission) {
        const decryptedDataParsed = await this.getTravelStorage();

        decryptedDataParsed.keyVault.permission.mission.id = mission;
        decryptedDataParsed.keyVault.permission.mission.itinerayUpdate = true;

        const getEncryptedData = await this.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("itinerarymission", {
          mission: mission,
        });
      },

      claimMission: async function (mission) {
        const decryptedDataParsed = await this.getTravelStorage();

        decryptedDataParsed.keyVault.permission.mission.id = mission;
        decryptedDataParsed.keyVault.permission.mission.isClaimable = true;

        const getEncryptedData = await this.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("claimmission", {
          mission: mission,
        });
      },

      editMission: async function (mission) {
        const decryptedDataParsed = await this.getTravelStorage();

        decryptedDataParsed.keyVault.permission.mission.id = mission;
        decryptedDataParsed.keyVault.permission.mission.isEditable = true;

        const getEncryptedData = await this.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("editmission", {
          mission: mission,
        });
      },

      advanceMission: async function (mission) {
        const decryptedDataParsed = await this.getTravelStorage();

        decryptedDataParsed.keyVault.permission.mission.id = mission;
        decryptedDataParsed.keyVault.permission.mission.isAdvance = true;

        const getEncryptedData = await this.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("advancemission", {
          mission: mission,
        });
      },
      tableFilter: function (type, oEvent) {
        if (type == "mission") {
          var filteredModelData = [];
          var originalMissionsModelData = this.getView()
            .getModel("originalMissionsModel")
            .getData().missions;
          var sQuery = oEvent.getSource().getValue();
          if (sQuery && sQuery.length > 0) {
            for (var i = 0; i < originalMissionsModelData.length; i++) {
              if (
                originalMissionsModelData[i].missionId.indexOf(sQuery) > -1 ||
                originalMissionsModelData[i].destination.localeLabel
                  .toLowerCase()
                  .indexOf(sQuery.toLowerCase()) > -1 ||
                originalMissionsModelData[i].destination.labelAr
                  .toLowerCase()
                  .indexOf(sQuery.toLowerCase()) > -1
              ) {
                filteredModelData.push(originalMissionsModelData[i]);
              }
            }

            var missionsModel = new JSONModel({
              missions: filteredModelData,
            });
            this.setModel(missionsModel, "missionsModel");
          } else {
            var missionsModel = new JSONModel({
              missions: originalMissionsModelData,
            });
            this.setModel(missionsModel, "missionsModel");
          }
        } else if (type == "claims") {
          const filteredModelData = [];
          const originalClaimsModelData = this.getView()
            .getModel("originalClaimsModel")
            .getData().claims;
          const aDestination =
            this.getModel("destinationsModel").getProperty("/destinations");
          const sQuery = oEvent.getSource().getValue();
          if (sQuery && sQuery.length > 0) {
            for (var i = 0; i < originalClaimsModelData.length; i++) {
              const oLocation = _.find(aDestination, [
                "externalCode",
                originalClaimsModelData[i].cust_Location,
              ]);
              const sMissionId = originalClaimsModelData[i].cust_MissionID;
              const sEmployeeName =
                (originalClaimsModelData[i].cust_EmployeeIDNav &&
                  originalClaimsModelData[i].cust_EmployeeIDNav
                    .defaultFullName) ||
                null;
              const sEmployeeId = originalClaimsModelData[i].cust_EmployeeID;

              if (
                (sMissionId && sMissionId.indexOf(sQuery) > -1) ||
                (sEmployeeName && sEmployeeName.indexOf(sQuery) > -1) ||
                (sEmployeeId && sEmployeeId.indexOf(sQuery) > -1) ||
                (oLocation &&
                  (oLocation.localeLabel.indexOf(sQuery) > -1 ||
                    oLocation.localeARLabel.indexOf(sQuery) > -1))
              ) {
                filteredModelData.push(originalClaimsModelData[i]);
              }
            }

            var claimsModel = new JSONModel({
              claims: filteredModelData,
            });
            this.setModel(claimsModel, "claimsModel");
          } else {
            var claimsModel = new JSONModel({
              claims: originalClaimsModelData,
            });
            this.setModel(claimsModel, "claimsModel");
          }
        } else if (type == "advances") {
          const filteredModelData = [];
          const originalAdvancesModelData = this.getView()
            .getModel("originalAdvancesModel")
            .getData().advances;
          const aDestination =
            this.getModel("destinationsModel").getProperty("/destinations");
          const sQuery = oEvent.getSource().getValue();
          if (sQuery && sQuery.length > 0) {
            for (var i = 0; i < originalAdvancesModelData.length; i++) {
              const oLocation = _.find(aDestination, [
                "externalCode",
                originalAdvancesModelData[i].cust_location,
              ]);
              const sMissionId = originalAdvancesModelData[i].cust_MissionID;
              const sEmployeeName =
                (originalAdvancesModelData[i].cust_EmployeeIDNav &&
                  originalAdvancesModelData[i].cust_EmployeeIDNav
                    .defaultFullName) ||
                null;
              const sEmployeeId = originalAdvancesModelData[i].cust_EmployeeID;

              if (
                (sMissionId && sMissionId.indexOf(sQuery) > -1) ||
                (sEmployeeName && sEmployeeName.indexOf(sQuery) > -1) ||
                (sEmployeeId && sEmployeeId.indexOf(sQuery) > -1) ||
                (oLocation &&
                  (oLocation.localeLabel.indexOf(sQuery) > -1 ||
                    oLocation.localeARLabel.indexOf(sQuery) > -1))
              ) {
                filteredModelData.push(originalAdvancesModelData[i]);
              }
            }

            var advancesModel = new JSONModel({
              advances: filteredModelData,
            });
            this.setModel(advancesModel, "advancesModel");
          } else {
            var advancesModel = new JSONModel({
              advances: originalAdvancesModelData,
            });
            this.setModel(advancesModel, "advancesModel");
          }
        }
      },
      // tableFilter_v1: function (type, oEvent) {
      //   if (type == "mission") {
      //     var filteredModelData = [];
      //     var originalMissionsModelData = this.getView()
      //       .getModel("originalMissionsModel")
      //       .getData().missions;
      //     var sQuery = oEvent.getSource().getValue();
      //     if (sQuery && sQuery.length > 0) {
      //       for (var i = 0; i < originalMissionsModelData.length; i++) {
      //         if (originalMissionsModelData[i].missionId.indexOf(sQuery) > -1) {
      //           filteredModelData.push(originalMissionsModelData[i]);
      //         }
      //       }

      //       var missionsModel = new JSONModel({
      //         missions: filteredModelData,
      //       });
      //       this.setModel(missionsModel, "missionsModel");
      //     } else {
      //       var missionsModel = new JSONModel({
      //         missions: originalMissionsModelData,
      //       });
      //       this.setModel(missionsModel, "missionsModel");
      //     }
      //   } else if (type == "claims") {
      //     var filteredModelData = [];
      //     var originalClaimsModelData = this.getView()
      //       .getModel("originalClaimsModel")
      //       .getData().claims;
      //     var sQuery = oEvent.getSource().getValue();
      //     if (sQuery && sQuery.length > 0) {
      //       for (var i = 0; i < originalClaimsModelData.length; i++) {
      //         if (
      //           originalClaimsModelData[i].cust_MissionID.indexOf(sQuery) >
      //             -1 ||
      //           originalClaimsModelData[
      //             i
      //           ].cust_EmployeeIDNav.defaultFullName.indexOf(sQuery) > -1
      //           ||
      //           originalClaimsModelData[
      //             i
      //           ].cust_EmployeeID.indexOf(sQuery) > -1
      //         ) {
      //           filteredModelData.push(originalClaimsModelData[i]);
      //         }
      //       }

      //       var claimsModel = new JSONModel({
      //         claims: filteredModelData,
      //       });
      //       this.setModel(claimsModel, "claimsModel");
      //     } else {
      //       var claimsModel = new JSONModel({
      //         claims: originalClaimsModelData,
      //       });
      //       this.setModel(claimsModel, "claimsModel");
      //     }
      //   } else if (type == "advances") {
      //     var filteredModelData = [];
      //     var originalAdvancesModelData = this.getView()
      //       .getModel("originalAdvancesModel")
      //       .getData().advances;
      //     var sQuery = oEvent.getSource().getValue();
      //     if (sQuery && sQuery.length > 0) {
      //       for (var i = 0; i < originalAdvancesModelData.length; i++) {
      //         if (
      //           originalAdvancesModelData[i].cust_MissionID.indexOf(sQuery) >
      //             -1 ||
      //           originalAdvancesModelData[
      //             i
      //           ].cust_EmployeeIDNav.defaultFullName.indexOf(sQuery) > -1
      //           ||
      //           originalClaimsModelData[
      //             i
      //           ].cust_EmployeeID.indexOf(sQuery) > -1
      //         ) {
      //           filteredModelData.push(originalAdvancesModelData[i]);
      //         }
      //       }

      //       var advancesModel = new JSONModel({
      //         advances: filteredModelData,
      //       });
      //       this.setModel(advancesModel, "advancesModel");
      //     } else {
      //       var advancesModel = new JSONModel({
      //         advances: originalAdvancesModelData,
      //       });
      //       this.setModel(advancesModel, "advancesModel");
      //     }
      //   }
      // },

      getClaimMasters: async function () {
        const that = this;

        const envInfo = await this.getEnvInfo();

        return new Promise(async function (resolve, reject) {
          jQuery.ajax({
            type: "POST",
            url: "/claimMasters",
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
              var maData = await that.getDecryptedData(data);

              var masterData = JSON.parse(maData);

              var statusArr = [];

              for (
                var s = 0;
                s <
                masterData.status.d.results[0].picklistOptions.results.length;
                s++
              ) {
                var enLbl = null;
                var arLbl = null;
                for (
                  var st = 0;
                  st <
                  masterData.status.d.results[0].picklistOptions.results[s]
                    .picklistLabels.results.length;
                  st++
                ) {
                  if (
                    masterData.status.d.results[0].picklistOptions.results[s]
                      .picklistLabels.results[st].locale == "ar_SA"
                  ) {
                    arLbl =
                      masterData.status.d.results[0].picklistOptions.results[s]
                        .picklistLabels.results[st].label;
                  } else {
                    enLbl =
                      masterData.status.d.results[0].picklistOptions.results[s]
                        .picklistLabels.results[st].label;
                  }
                }
                statusArr.push({
                  externalCode:
                    masterData.status.d.results[0].picklistOptions.results[s]
                      .externalCode,
                  localeLabel: enLbl,
                  localeARLabel: arLbl,
                });
              }

              var claimStatusModel = new JSONModel({
                status: statusArr,
              });

              that.setModel(claimStatusModel, "claimStatusModel");

              var destinationArr = [];

              for (
                var d = 0;
                d <
                masterData.cities.d.results[0].picklistOptions.results.length;
                d++
              ) {
                var enLbl = null;
                var arLbl = null;
                for (
                  var dt = 0;
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

              var destinationsModel = new JSONModel({
                destinations: destinationArr,
              });

              that.setModel(destinationsModel, "destinationsModel");

              resolve(true);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              reject(true);
            },
          });
        });
      },

      findMemberInfo: async function (ids) {
        const that = this;
        const envInfo = await this.getEnvInfo();

        var obj = {
          filter: ids,
        };

        var url = "/findMemberInfo";
        jQuery.ajax({
          type: "POST",
          url: url,
          contentType: "application/json",
          xhrFields: { withCredentials: true },
          data: JSON.stringify({
            data: obj,
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
            var employeesModel = new JSONModel({
              employees: JSON.parse(data).d.results,
            });

            that.setModel(employeesModel, "employeesModel");
          },
          error: async function (jqXHR, textStatus, errorDesc) {},
        });
      },

      approveClaim: async function (claim) {
        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("approveclaim", {
          claim: claim,
        });
      },

      approveAdvance: async function (advance) {
        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("approveadvance", {
          advance: advance,
        });
      },

      tabSwitch: async function (type) {
        const oScreenModel = this.getModel("screenModel");
        const oScreenModelData = oScreenModel.getProperty("/info");

        if (type == "claims") {
          oScreenModelData.claimsTab = true;
          oScreenModelData.advanceTab = false;
          oScreenModel.setProperty("/info", oScreenModelData);
        } else {
          oScreenModelData.claimsTab = false;
          oScreenModelData.advanceTab = true;
          oScreenModel.setProperty("/info", oScreenModelData);
        }
      },


      cancelMission: async function (mission) {
        const that = this;
        //MessageBox.confirm("Do you want to cancel this mission?", {
        MessageBox.confirm(this.getText("cancelMissionConfirmation", []), {
          title: "Confirm",
          actions: [MessageBox.Action.CANCEL, MessageBox.Action.OK],
          onClose: async function (sAction) {
            if (sAction == "OK") {
              that.openBusyFragment("missionCancelInProgress", []);
              const envInfo = await that.getEnvInfo();

              const decryptedDataParsed = await that.getTravelStorage();

              return new Promise(async function (resolve, reject) {
                var obj = {
                  missionId: mission,
                  employeeId: decryptedDataParsed.keyVault.user.id,
                  date: "/Date(" + new Date().getTime() + ")/",
                };
                var encryptedData = await that.getEncryptedData(obj);
                jQuery.ajax({
                  type: "POST",
                  url: "/cancelMission",
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
                    that.closeBusyFragment();
                    that.alertMessage(
                      "S",
                      "successfulOperation",
                      "missionCancelled",
                      [],
                      {
                        showConfirmButton: true,
                        confirmCallbackFn: () => {
                          that.refreshList();
                        },
                      }
                    );

                    // MessageBox.success("The mission has been cancelled", {
                    //   actions: [MessageBox.Action.CLOSE],
                    //   onClose: async function (sAction) {
                    //     that.refreshList();
                    //   },
                    //   dependentOn: that.getView(),
                    // });
                  },
                  error: async function (jqXHR, textStatus, errorDesc) {
                    that.closeBusyFragment();
                    that.alertMessage(
                      "E",
                      "errorOperation",
                      "serverError",
                      [],
                      null
                    );
                    // MessageBox.error(errorMessage.message, {
                    //   actions: [MessageBox.Action.CLOSE],
                    //   onClose: async function (sAction) {
                    //     that.refreshList();
                    //   },
                    //   dependentOn: that.getView(),
                    // });
                    if (jqXHR.status == 401) {
                      window.location.reload(true);
                    }
                  },
                });
              });
            }
          },
          dependentOn: that.getView(),
        });
      },

      callClaimAdvanceFilter: async function () {
        if (!this._oClaimAdvanceFilterDialog) {
          this._oClaimAdvanceFilterDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "ui5app.view.fragments.ClaimAdvanceFilterDialog",
            controller: this,
          });

          this.getView().addDependent(this._oClaimAdvanceFilterDialog);
        }

        this._oClaimAdvanceFilterDialog.open();
      },
      cancelClaimAdvanceFilter: function () {
        if (this._oClaimAdvanceFilterDialog) {
          this._oClaimAdvanceFilterDialog.close();
        }
      },
      applyClaimAdvanceFilter: async function () {
        if (this._oClaimAdvanceFilterDialog) {
          this._oClaimAdvanceFilterDialog.close();
        }
        try {
          this.openBusyFragment();
          const listResponse = await this.getList();
          this.closeBusyFragment();
        } catch (e) {
          this.closeBusyFragment();
        }
      },
      clearDateSelection: function () {
        const oClaimAdvanceFilterModel = this.getModel(
          "claimAdvanceFilterModel"
        );
        oClaimAdvanceFilterModel.setProperty("/dateSelection", {
          beginDate: null,
          endDate: null,
          presetKey: "01",
        });
      },
      onDelegatorSelected: async function (oEvent) {
        const that = this;
        const oItem = oEvent.getParameter("listItem");

        const storageData = Storage.get("travel_mission_storage");
        const getDecryptedData = await this.getDecryptedData(storageData);
        const decryptedDataParsed = JSON.parse(getDecryptedData);
        decryptedDataParsed.keyVault.user.email = oItem.data("empEmail");
        const getEncryptedData = await that.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        try {
          this.openBusyFragment("gettingDataAsDelegate", [oItem.getTitle()]);
          await this.getLoggedinInfo();

          await this.getClaimMasters();

          await this.getList();

          this.closeBusyFragment();
        } catch (e) {
          this.closeBusyFragment();
          if (e.status == 401) {
            window.location.reload(true);
          }
        }
      },
      onSelectDelegator: async function (oEvent) {
        const oSource = oEvent.getSource();
        if (!this._oDelegatorSelectDialog) {
          this._oDelegatorSelectDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "ui5app.view.fragments.SelectDelegator",
            controller: this,
          });

          this.getView().addDependent(this._oDelegatorSelectDialog);
        }

        this._oDelegatorSelectDialog &&
          this._oDelegatorSelectDialog.openBy(oSource);
      },
      onResetDelegator: async function () {
        const that = this;
        const oAppModel = this.getModel("appModel");
        const oMasterUser = oAppModel.getProperty("/masterUser");
        const storageData = Storage.get("travel_mission_storage");
        const getDecryptedData = await this.getDecryptedData(storageData);
        const decryptedDataParsed = JSON.parse(getDecryptedData);
        decryptedDataParsed.keyVault.user.email = oMasterUser.email;
        const getEncryptedData = await that.getEncryptedData(
          decryptedDataParsed
        );
        Storage.put("travel_mission_storage", getEncryptedData);

        try {
          this._oDelegatorSelectDialog && this._oDelegatorSelectDialog.close();
          this.openBusyFragment("gettingDataAsSelf");
          await this.getLoggedinInfo();

          await this.getList();

          this.closeBusyFragment();
        } catch (e) {
          this.closeBusyFragment();
          if (e.status == 401) {
            window.location.reload(true);
          }
        }
      },
    });
  }
);
