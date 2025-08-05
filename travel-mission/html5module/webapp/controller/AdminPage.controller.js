sap.ui.define(
  [
    "ui5app/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/core/date/UI5Date",
    "sap/ui/util/Storage",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "ui5app/model/formatter",
  ],
  function (BaseController, JSONModel, Fragment, UI5Date, Storage, Filter, FilterOperator, Formatter) {
    "use strict";

    return BaseController.extend("ui5app.controller.AdminPage", {
      formatter: Formatter,
      onInit: function () {
        this.initializeAppSettings(false);

        const oRouter = this.getRouter();
        oRouter.getRoute("adminpage").attachMatched(this._onRouteMatched, this);

        const oPageModel = new JSONModel({
          filters: this._initializeFilterData(),
          valueLists: {},
          report: {
            columns: [],
            rows: [],
          },
          isSectorVisible: false
        });

        this.setModel(oPageModel, "adminPageModel");

        //--Set last 6 months as default
        this.setDateSelectionFromPreset("07");


        const oFilterBar = this.byId("reportPageFilterBar");
				
        oFilterBar.addEventDelegate({
          "onAfterRendering": (oEvent)=>{
            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const oButton = oEvent.srcControl.getAggregation("_searchButton");
            if(oButton){
              oButton.setText(oResourceBundle.getText("REFRESH_ACTION"));
              oButton.setIcon("sap-icon://synchronize");
              oButton.addStyleClass("customButtonEmphasized");
            }
          }
			  });
        
      },
      onExit: function () {
        const oPageModel = this.getModel("adminPageModel");
        oPageModel.setProperty("/filters", this._initializeFilterData());
        oPageModel.setProperty("/valueLists", {});
      },
      /*--------------------------------------------------*/
      /* Event handlers                                   */
      /*--------------------------------------------------*/
      onNavBack: function () {
        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("home", null, null, true);
      },
      onRefreshData: async function () {
        const oPageModel = this.getModel("adminPageModel");
        const oFilters = oPageModel.getProperty("/filters");
        const envInfo = await this.getEnvInfo();
        const decryptedDataParsed = await this.getTravelStorage();

        try {
          const headers = {
            "Content-Type": "application/json",
            "x-csrf-token": envInfo.CSRF,
            "x-approuter-authorization": `Bearer ${envInfo.CF.accessToken}`,
          };

          oPageModel.setProperty("/report", {
            rows: [],
            columns: [],
          });
          this.invalidateContent();
          this.openBusyFragment("reportIsBeingFetched", []);
          const url = "/getAdminMissionReport";
          const response = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: headers,
            body: JSON.stringify({
              userId: decryptedDataParsed.keyVault.user.id,
              filters: _.cloneDeep(oFilters),
            }),
          });

          if (!response.ok) {
            throw new Error("Error occured");
          }
          const encryptedResult = new TextDecoder().decode(
            new Uint8Array(await response.arrayBuffer())
          );
          const result = await this.getDecryptedData(encryptedResult);

          oPageModel.setProperty("/report", {
            rows: JSON.parse(result).rows,
            columns: JSON.parse(result).columns,
          });
          this.generateDynamicTable();
          this.closeBusyFragment();
        } catch (error) {
          this.closeBusyFragment();
          console.error("Fetch error:", error);
        }
      },

      invalidateContent: function () {
        const oPage = this.byId("idAdminReportDynamicPage");

        //--Set content before loading
        const oHBox = new sap.m.HBox({
          width: "100%",
          height: "20rem",
          alignItems: "Center",
          justifyContent: "Center",
          items: [
            new sap.m.BusyIndicator({
              size: "1.5em",
              text: "Creating report. Please wait...",
              busyIndicatorDelay: 0,
            }),
          ],
        }).addStyleClass("sapUiSmallMarginTop");
        oPage.destroyContent();
        oPage.setContent(oHBox);
        //--Set content before loading
      },
      onFilterChange: function () {
        const oTable = this.byId("idAdminMissionReportTable") || sap.ui.getCore().byId("idAdminMissionReportTable");
        if (oTable && oTable.setShowOverlay) {
          if(oTable.getShowOverlay() !== true){
            oTable.setShowOverlay(true);
            this.toastMessage("I", null, "filtersChangedRefresh", [], {
              showConfirmButton: false,
              position: "top-end"
            });
          }
        }
      },

      searchThroughTable: function(oEvent) {
        const sQuery = oEvent.getParameter("query");
        let oFilter = null;

        if (sQuery) {
          oFilter = new Filter([
            new Filter("missionId", FilterOperator.Contains, sQuery),
            new Filter("missionDescription", FilterOperator.Contains, sQuery),
            new Filter("pendingWith", FilterOperator.Contains, sQuery),
            new Filter("employeeId", FilterOperator.Contains, sQuery),
            new Filter("employeeName", FilterOperator.Contains, sQuery),
            new Filter("employeeTitle", FilterOperator.Contains, sQuery)
          ], false);
        }

        const oTable = this.byId("idAdminMissionReportTable") || sap.ui.getCore().byId("idAdminMissionReportTable");
        if(oTable){
          oTable.getBinding().filter(oFilter, "Application");
        }
      },

      handleExportToExcel: async function () {
        const oPageModel = this.getModel("adminPageModel");
        const oFilters = oPageModel.getProperty("/filters");
        const envInfo = await this.getEnvInfo();
        const decryptedDataParsed = await this.getTravelStorage();

        try {
          const headers = {
            "Content-Type": "application/json",
            "x-csrf-token": envInfo.CSRF,
            "x-approuter-authorization": `Bearer ${envInfo.CF.accessToken}`,
          };

          this.openBusyFragment("reportIsBeingDownloaded", []);
          const url = "/exportAdminMissionReport";
          const response = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: headers,
            body: JSON.stringify({
              userId: decryptedDataParsed.keyVault.user.id,
              filters: _.cloneDeep(oFilters),
            }),
          });

          /* Download Excel File */
          if(!response.ok){
            throw new Error("File could not be downloaded");
          }
          let filename = 'Mission Report.xlsx'; // fallback
          const contentDisposition = response.headers.get('Content-Disposition') || '';
          const dispositionMatch = contentDisposition.match(/filename="(.+)"/);
          if (dispositionMatch && dispositionMatch[1]) {
            filename = dispositionMatch[1];
          }
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = filename; // Desired file name
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          /* Download Excel File */

          this.closeBusyFragment();
        } catch (error) {
          this.closeBusyFragment();
          console.error("Fetch error:", error);
        }
      },
      generateDynamicTable: function () {
        const oPage = this.byId("idAdminReportDynamicPage");
        const oAdminPageModel = this.getModel("adminPageModel");

        oPage.destroyContent();

        const oReport = oAdminPageModel.getProperty("/report");

        if (oReport.rows.length > 0) {
          const oTable = new sap.ui.table.Table("idAdminMissionReportTable", {
            selectionMode: "None",
            rowMode: "Auto",
            fixedColumnCount: 2,
            alternateRowColors: true,
            extension: [
              new sap.m.OverflowToolbar({
                content: [
                  new sap.m.Title({
                    text: "{i18n>missionReport} (" + oReport.rows.length + " records found)" ,
                  }),
                  new sap.m.ToolbarSpacer(),
                  new sap.m.SearchField({
                    placeholder:"{i18n>searchThroughResults}",
                    value:"{adminPageModel>/filters/searchValue}",
                    search: this.searchThroughTable.bind(this),
                    width:"20rem"
                  }),
                  new sap.m.Button({
                    icon: "sap-icon://excel-attachment",
                    tooltip: "Export report to Excel",
                    text: "{i18n>exportToExcel}",
                    press: this.handleExportToExcel.bind(this),
                  }).addStyleClass("customButtonEmphasized"),
                ],
              }),
            ],
          });
          oTable.setModel(oAdminPageModel);
          oTable.bindColumns({
            path: "/report/columns",
            factory: function (sId, oContext) {
              let template;
              let columnId = oContext.getObject().Colid;
              let label = oContext.getObject().Coltx;
              let width = oContext.getObject().Colwd || "9rem";
              let datatype = oContext.getObject().Coldt || "string";
              let celltype = "string";

              switch (celltype) {
                case "amount":
                  template = new sap.m.Text({
                    text: {
                      path: columnId,
                      type: "sap.ui.model.type.Float",
                      formatOptions: {
                        decimals: 2,
                        groupingEnabled: true,
                        groupingSeparator: ",",
                        decimalSeparator: ".",
                        maxFractionDigits: 2,
                        minFractionDigits: 2,
                      },
                    },
                  });
                  break;
                case "date":
                  template = new sap.m.Text({
                    text: {
                      path: columnId,
                      formatter: (d) => {
                        return Formatter.formatDate(d);
                      },
                    },
                  });
                  break;
                default:
                  template = new sap.m.Text({
                    text: {
                      path: columnId,
                    },
                    tooltip: {
                      path: columnId,
                    },
                  }).addStyleClass("adminReportCellContent");
                //template = columnId;
              }

              return new sap.ui.table.Column({
                label: label,
                template: template,
                width: width,
                hAlign:
                  datatype === "amount" || datatype === "number"
                    ? "Right"
                    : "Begin",
              });
            },
          });
          oTable.bindRows({ path: "/report/rows" });
          oPage.setContent(oTable);
        } else {
          const oNoResult = new sap.m.IllustratedMessage({
            description:
              "No results found for the selected criteria. Please revise your search criteria and hit refresh.",
            title: "No Results",
            illustrationType: sap.m.IllustratedMessageType.NoSearchResults,
          });
          oPage.setContent(oNoResult);
        }
        //oSC.addContent(oTable);
      },

      selectFromPresets: async function (oEvent) {
        let oView = this.getView(),
          oButton = oEvent.getSource(),
          oAdminPageModel = this.getModel("adminPageModel");

        if (!this._oPresetMenuFragment) {
          this._oPresetMenuFragment = await Fragment.load({
            id: oView.getId(),
            name: "ui5app.view.fragments.ReportDateSelection",
            controller: this,
          });

          oView.addDependent(this._oPresetMenuFragment);
        }
        this._oPresetMenuFragment.setModel(oAdminPageModel);
        this._oPresetMenuFragment.openBy(oButton);
      },

      setDateSelectionFromPreset: function (sKey) {
        const oAdminPageModel = this.getModel("adminPageModel");
        let today = new Date(new Date().setHours(9));
        let beginDate = null;
        let endDate = null;
        switch (sKey) {
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
            oAdminPageModel.setProperty("/filters/dateSelection", {
              beginDate: beginDate,
              endDate: endDate,
              presetKey: "01",
            });
            return;
        }

        oAdminPageModel.setProperty("/filters/dateSelection", {
          beginDate: beginDate,
          endDate: endDate,
          presetKey: sKey
        });

        this.onFilterChange();
      },

      handleReportDateSelection: function (oEvent) {
        const oItem = oEvent.getParameter("item");
        this.setDateSelectionFromPreset(oItem.getKey());
      },
      clearDateSelection: function () {
        const oAdminPageModel = this.getModel("adminPageModel");
        oAdminPageModel.setProperty("/filters/dateSelection", {
          beginDate: null,
          endDate: null,
          presetKey: "01",
        });
        this.onFilterChange();
      },

      onPerformSearch: function () {
        this.onRefreshData();
      },

      onNavHome: function(){
        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("home", null, null, true);
      },
      /*--------------------------------------------------*/
      /* Private methods                                  */
      /*--------------------------------------------------*/
      _initializeFilterData: function () {
        return {
          dateSelection: {
            beginDate: null,
            endDate: null,
            presetKey: "01",
          },
          destinationSelection: [],
          sectorSelection: [],
          statusSelection: [],
          missionSelection: "",
          searchValue: ""
        };
      },

      _loadData: async function () {
        this.openBusyFragment();
        const bAuth = await this._checkIsAuthorized();
        this.closeBusyFragment();

        if (bAuth !== true) {
          const oRouter = this.getOwnerComponent().getRouter();
          oRouter.navTo("unauthorized", null, null, true);
          return;
        }

        const bValueLists = await this._getPickLists();
        if (!bValueLists) {
          this.toastMessage("E", "errorOperation", "serverError", null, {});
          this.onNavBack();
          return;
        }
        this.onRefreshData();
      },
      _onRouteMatched: function () {
        this.finishMainLoader();
        this._loadData();
      },
      _getPickLists: async function () {
        const oPageModel = this.getModel("adminPageModel");
        const envInfo = await this.getEnvInfo();
        const decryptedDataParsed = await this.getTravelStorage();

        return new Promise(async (resolve, reject) => {
          try {
            const headers = {
              "Content-Type": "application/json",
              "x-csrf-token": envInfo.CSRF,
              "x-approuter-authorization": `Bearer ${envInfo.CF.accessToken}`,
            };

            oPageModel.setProperty("/valueLists", {});
            this.openBusyFragment("gettingValueLists", []);
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
            const result = await this.getDecryptedData(encryptedResult);

            let oValueLists = JSON.parse(result);
            oPageModel.setProperty("/valueLists", oValueLists);
            this.closeBusyFragment();
            resolve(true);
          } catch (error) {
            this.closeBusyFragment();
            resolve(false);
          }
        });
      },
      _checkIsAuthorized: async function () {
        const envInfo = await this.getEnvInfo();
        const decryptedDataParsed = await this.getTravelStorage();
        const oAdminPageModel = this.getModel("adminPageModel");
        oAdminPageModel.setProperty("/isSectorVisible",false);

        return new Promise(async (resolve, reject) => {
          try {
            const headers = {
              "Content-Type": "application/json",
              "x-csrf-token": envInfo.CSRF,
              "x-approuter-authorization": `Bearer ${envInfo.CF.accessToken}`,
            };

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

            if(result && result.isAuthorized && result.hasOwnProperty("isHOS")){
              oAdminPageModel.setProperty("/isSectorVisible", !result.isHOS );
            }

            resolve(result ? result.isAuthorized : false);
          } catch (error) {
            console.log("Fetch error:", error);
            resolve(false);
          }
        });
      },
    });
  }
);
