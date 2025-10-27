sap.ui.define(
  [
    "ui5app/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/upload/Uploader",
    "ui5app/model/formatter",
    "sap/ui/core/date/UI5Date",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/util/Storage",
    "ui5app/model/formatter",
  ],
  function (
    BaseController,
    JSONModel,
    Fragment,
    Uploader,
    Formatter,
    UI5Date,
    MessageBox,
    MessageToast,
    Storage,
    formatter
  ) {
    "use strict";

    return BaseController.extend("ui5app.controller.ApproveAdvance", {


      missionTotalExpense: 0,

      onInit: function (evt) {
        this.initializeAppSettings(true);
        const oRouter = this.getRouter();
        oRouter
          .getRoute("approveadvance")
          .attachMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function (oEvent) {
        var oArgs = oEvent.getParameter("arguments");
        this.advanceId = oArgs.advance;
        this.initialize();
      },

      closeMission: async function () {
        await this.initializeModel();
        await this.initiateDynamicMembers();
        await this.initiateMissionAttachment();
        await this.initiateAdvanceModel();

        var approvalModel = new JSONModel({
          info: [],
        });
        this.setModel(approvalModel, "approvalModel");

        var auditModel = new JSONModel({
          info: [],
        });
        this.setModel(auditModel, "auditModel");

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("index");
      },

      editMission: function () {
        const oViewModel = this.getModel("approveAdvanceModel");
        oViewModel.setProperty("/edit", true);
        this.toastMessage("W", null, "editModeActive", [], {
          showConfirmButton: false,
        });
      },
      cancelEditMission: async function () {
        const oViewModel = this.getModel("approveAdvanceModel");
        oViewModel.setProperty("/edit", false);

        try {
          this.startLoading();
          await this.getAdvanceById();
          this.finishLoading();
        } catch (e) {
          this.finishLoading();
        }
      },

      prepareMissionForUpdate: async function () {
        const that = this;
        const oMissionInfoModel = this.getModel("missionInfoModel");
        const oMembersModel = this.getModel("membersModel");
        const oSectorsModel = this.getModel("sectorsModel");

        const oMission = oMissionInfoModel.getProperty("/info");
        const aMembers = oMembersModel.getProperty("/members");
        const aSectors = oSectorsModel.getProperty("/sectors");

        //--Prepare request body

        const travelStorageInfo = await this.getTravelStorage();
        //--Calculate budget options
        let sectorAvailableBudget = 0;
        let sectorParkedBudget = 0;
        let delegateApprover = null;

        let oSector = _.find(aSectors, ["externalCode", oMission.sector]);
        if (oSector) {
          if (
            oSector.cust_Delegate_Approver_for_Missions != null &&
            oSector.cust_Delegate_Approver_for_Missions != ""
          ) {
            delegateApprover = oSector.cust_Delegate_Approver_for_Missions;
          } else if (
            oSector.cust_Head_of_Sector != null &&
            oSector.cust_Head_of_Sector != ""
          ) {
            delegateApprover = oSector.cust_Head_of_Sector;
          }

          if (oSector.cust_Available_budget != null) {
            sectorAvailableBudget = parseFloat(oSector.cust_Available_budget);
          }

          if (oSector.cust_Parked_Amount != null) {
            sectorParkedBudget = parseFloat(oSector.cust_Parked_Amount);
          }
        }

        //--Control over budget scenarios
        let missionTotalExp = 0;

        if (!isNaN(oMission.totalExpense)) {
          missionTotalExp = parseFloat(oMission.totalExpense);
        } else {
          //--Recheck this code - may cause error - BD
          if (oMission.totalExpense.indexOf(",") > -1) {
            missionTotalExp = parseFloat(
              oMission.totalExpense.replace(/\,/g, "")
            );
          } else {
            missionTotalExp = parseFloat(oMission.totalExpense);
          }
        }

        let missionBudgetAvailable = parseFloat(sectorAvailableBudget);
        let missionParkedAmount = parseFloat(sectorParkedBudget);

        let missionTotalExpenseDifference =
          parseFloat(this.missionTotalExpense) - missionTotalExp;

        if (missionTotalExpenseDifference >= 0) {
          missionParkedAmount =
            missionParkedAmount -
            Math.abs(parseFloat(missionTotalExpenseDifference));
          missionBudgetAvailable =
            missionBudgetAvailable +
            Math.abs(parseFloat(missionTotalExpenseDifference));
        } else {
          missionParkedAmount =
            missionParkedAmount +
            Math.abs(parseFloat(missionTotalExpenseDifference));
          missionBudgetAvailable =
            missionBudgetAvailable -
            Math.abs(parseFloat(missionTotalExpenseDifference));
        }

        if (missionBudgetAvailable < 0) {
          this.alertMessage("E", "errorOperation", "sectorBudgetLowError", [],null);
          // MessageBox.error("The available budget of sector is low", {
          //   actions: [MessageBox.Action.CLOSE],
          //   onClose: async function (sAction) {},
          //   dependentOn: that.getView(),
          // });
          return null;
        }

        //--Prepare payload
        let oMissionRequest = {
          info: {
            missionId: oMission.missionID,
            budgetAvailable: missionBudgetAvailable.toString(),
            budgetParked: missionParkedAmount.toString(),
            decreeType: oMission.decreeType,
            externalEntity: oMission.externalEntity,
            destination: oMission.destination,
            flightType: oMission.flightType,
            hospitality_Type: oMission.hospitality_Type,
            missionStartDate: formatter.formatDatetoJSON(
              oMission.missionStartDate
            ),
            missionEndDate: formatter.formatDatetoJSON(oMission.missionEndDate),
            noOfDays: oMission.noOfDays.toString(),
            sector: oMission.sector,
            ticketAverage: oMission.ticketAverage.toString(),
            totalExpense: oMission.totalExpense.toString(),
            totalPerdiemMission: oMission.totalPerdiemMission.toString(),
            date: "/Date(" + new Date().getTime() + ")/",
            loggedInUser: travelStorageInfo.keyVault.user.id,
          },
          members: [],
        };

        aMembers.forEach((oMember) => {
          let oMemberRequest = {
            userID: oMember.userID,
            employeeID: oMember.employeeID,
            employeeTotalExpense: oMember.employeeTotalExpense.toString(),
            employeeTotalPerdiem: oMember.employeeTotalPerdiem.toString(),
            employeeTotalTicket: oMember.employeeTotalTicket.toString(),
            itinerary: [],
          };
          if (oMember.itinerary && oMember.itinerary.length > 0) {
            oMember.itinerary.forEach((oItinerary) => {
              let oItineraryRequest = {
                externalCode: oItinerary.externalCode,
                city: oItinerary.city,
                startDate: formatter.formatDatetoJSON(oItinerary.startDate),
                endDate: formatter.formatDatetoJSON(oItinerary.endDate),
                ticketType: oItinerary.ticketType,
                headOfMission: oItinerary.headOfMission,
                hospitalityDefault: oItinerary.hospitalityDefault,
                perDiemPerCity: oItinerary.perDiemPerCity.toString(),
                ticketActualCost: oItinerary.ticketActualCost
                  ? parseFloat(oItinerary.ticketActualCost)
                  : 0,
                ticketAverage: oItinerary.ticketAverage.toString(),
              };

              oMemberRequest.itinerary.push(oItineraryRequest);
            });
          }
          oMissionRequest.members.push(oMemberRequest);
        });

        return oMissionRequest;
      },

      saveMission: async function () {
        const that = this;
        const oViewModel = this.getModel("approveAdvanceModel");
        oViewModel.setProperty("/edit", false);

        const oMissionRequest = await this.prepareMissionForUpdate();

        if (!oMissionRequest) {
          return;
        }

        const requestBody = {
          params: oMissionRequest,
        };

        const envInfo = await this.getEnvInfo();
        const url = "/updateMissionPayroll";

        this.openBusyFragment("missionBeingUpdated");

        jQuery.ajax({
          type: "POST",
          url: url,
          contentType: "application/json",
          xhrFields: { withCredentials: true },
          data: JSON.stringify({
            data: requestBody,
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
            const decryptedData = await that.getDecryptedData(data);
            const serviceResult = JSON.parse(decryptedData);

            if (serviceResult && serviceResult.status === "OK") {
              that.alertMessage(
                "S",
                "successfulOperation",
                "missionUpdated",
                [],
                null
              );
            }
          },
          error: async function (jqXHR, textStatus, errorDesc) {
            that.closeBusyFragment();
            that.alertMessage("E", "errorDuringUpdate", "serverError", [], {
              confirmCallbackFn: () => {
                that.closeMission();
              },
            });
          },
        });
      },
      handleMissionDatesChange: function (type, oEvent) {
        const oMissionInfoModel = this.getModel("missionInfoModel");
        let aInfo = oMissionInfoModel.getProperty("/info");

        if (type == "start") {
          if (aInfo.missionEndDate != null) {
            var startDt = new Date(aInfo.missionStartDate);
            var endDt = new Date(aInfo.missionEndDate);
            if (startDt > endDt) {
              aInfo.missionEndDate = null;
            }
          }
        } else if (type == "end") {
          if (aInfo.missionStartDate != null) {
            var startDt = new Date(aInfo.missionStartDate);
            var endDt = new Date(aInfo.missionEndDate);
            if (startDt > endDt) {
              aInfo.missionStartDate = null;
            }
          }
        }

        aInfo.missionStartDateMaxDate =
          aInfo.missionEndDate != null
            ? UI5Date.getInstance(aInfo.missionEndDate)
            : null;
        aInfo.missionEndDateMinDate =
          aInfo.missionStartDate != null
            ? UI5Date.getInstance(aInfo.missionStartDate)
            : null;

        if (aInfo.missionStartDate != null && aInfo.missionEndDate != null) {
          var startDt = new Date(aInfo.missionStartDate);
          var endDt = new Date(aInfo.missionEndDate);

          const diffTime = Math.abs(endDt - startDt);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          aInfo.noOfDays = diffDays + 1;
        }

        // var missionInfoModel = new JSONModel({
        //   info: aInfo,
        // });

        // this.setModel(missionInfoModel, "missionInfoModel");
        oMissionInfoModel.setProperty("/info", aInfo);

        const oMembersModel = this.getModel("membersModel");
        let membersModelData = oMembersModel.getProperty("/members");

        for (var i = 0; i < membersModelData.length; i++) {
          var memberItinerary = membersModelData[i].itinerary;
          for (var j = 0; j < memberItinerary.length; j++) {
            if(memberItinerary.length === 1) {
            	if(aInfo.missionStartDate != null) {
            		memberItinerary[j].startDate = aInfo.missionStartDate;
            	}
            	if(aInfo.missionEndDate != null) {
            		memberItinerary[j].endDate = aInfo.missionEndDate;
            	}
            } else {
              memberItinerary[j].startDate = null;
              memberItinerary[j].endDate = null;
            }

            // if (aInfo.missionStartDate != null) {
            //   var startDt = new Date(aInfo.missionStartDate);
            //   startDt.setDate(startDt.getDate());
            //   memberItinerary[j].startDateMinDate =
            //     UI5Date.getInstance(startDt);
            //   memberItinerary[j].endDateMinDate = UI5Date.getInstance(startDt);
            // }

            // if (aInfo.missionEndDate != null) {
            //   var endDt = new Date(aInfo.missionEndDate);
            //   endDt.setDate(endDt.getDate());
            //   memberItinerary[j].startDateMaxDate = UI5Date.getInstance(endDt);
            //   memberItinerary[j].endDateMaxDate = UI5Date.getInstance(endDt);
            // }
          }
        }

        oMembersModel.setProperty("/members", membersModelData);

        this.toastMessage("I", null, "missionDatesChanged", [], {
          showConfirmButton: false,
        });
        // var membersModel = new JSONModel({
        // 	members: membersModelData,
        // });

        // this.setModel(membersModel,'membersModel');
      },

      animateSaveButton: function () {
        const oButton = this.byId("idUpdateAdvanceButton");
        if (oButton) {
          oButton.$().addClass("animate__tada");
          oButton.$().on("animationend", function () {
            oButton.$().removeClass("animate__tada");
            oButton.$().off("animationend");
          });
        }
      },

      handleItineraryDatesChange: function (type, guid, id, oEvent) {
        const that = this;
        const oMembersModel = this.getModel("membersModel");
        let aInfo = this.getModel("missionInfoModel").getData().info;
        let membersModelData = oMembersModel.getProperty("/members");
        let currentDt = null;
        let datesValid = true;

        if (type == "start") {
          for (var i = 0; i < membersModelData.length; i++) {
            if (membersModelData[i].guid == guid) {
              var memberItinerary = membersModelData[i].itinerary;

              for (var j = 0; j < memberItinerary.length; j++) {
                if (memberItinerary[j].id == id) {
                  currentDt = new Date(memberItinerary[j].startDate);
                }
              }
            }
          }

          for (var i = 0; i < membersModelData.length; i++) {
            if (membersModelData[i].guid == guid) {
              var memberItinerary = membersModelData[i].itinerary;

              for (var j = 0; j < memberItinerary.length; j++) {
                if (memberItinerary[j].id != id) {
                  var startDt = new Date(memberItinerary[j].startDate);
                  var endDt = new Date(memberItinerary[j].endDate);

                  var diffTime = Math.abs(endDt - startDt);
                  var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                  var noOfDays = diffDays + 1;

                  for (var k = 0; k < noOfDays; k++) {
                    var newDate = new Date(startDt.getTime());
                    newDate.setDate(newDate.getDate() + k);
                    if (currentDt.getTime() === newDate.getTime()) {
                      datesValid = false;
                      break;
                    }
                  }
                }
              }
            }
          }

          if (datesValid == false) {
            this.alertMessage("E", "errorsFound", "overlapItineraryError", [], null);
            // MessageBox.error(
            //   "Please select any other date which is not overlap with other cities dates",
            //   {
            //     actions: [MessageBox.Action.CLOSE],
            //     onClose: async function (sAction) {},
            //     dependentOn: that.getView(),
            //   }
            // );
            for (var i = 0; i < membersModelData.length; i++) {
              if (membersModelData[i].guid == guid) {
                var memberItinerary = membersModelData[i].itinerary;

                for (var j = 0; j < memberItinerary.length; j++) {
                  if (memberItinerary[j].id == id) {
                    memberItinerary[j].startDate = null;
                    break;
                  }
                }
              }
            }
          } else {
            for (var i = 0; i < membersModelData.length; i++) {
              if (membersModelData[i].guid == guid) {
                var memberItinerary = membersModelData[i].itinerary;

                for (var j = 0; j < memberItinerary.length; j++) {
                  if (memberItinerary[j].id == id) {
                    if (aInfo.missionStartDate != null) {
                      var startDt = new Date(aInfo.missionStartDate);
                      startDt.setDate(startDt.getDate());
                      if (new Date(memberItinerary[j].startDate) < startDt) {
                        memberItinerary[j].startDate = null;
                      }
                    }
                    if (aInfo.missionEndDate != null) {
                      var endDt = new Date(aInfo.missionEndDate);
                      endDt.setDate(endDt.getDate());
                      if (new Date(memberItinerary[j].startDate) > endDt) {
                        memberItinerary[j].startDate = null;
                      }
                    }

                    if (memberItinerary[j].endDate != null) {
                      var startDt = new Date(memberItinerary[j].startDate);
                      var endDt = new Date(memberItinerary[j].endDate);
                      if (startDt > endDt) {
                        memberItinerary[j].endDate = null;
                      }
                    }

                    if (memberItinerary[j].startDate != null) {
                      var startDt = new Date(memberItinerary[j].startDate);
                      memberItinerary[j].endDateMinDate =
                        UI5Date.getInstance(startDt);
                    }
                  }
                }
              }
            }
          }
        } else if (type == "end") {
          for (var i = 0; i < membersModelData.length; i++) {
            if (membersModelData[i].guid == guid) {
              var memberItinerary = membersModelData[i].itinerary;

              for (var j = 0; j < memberItinerary.length; j++) {
                if (memberItinerary[j].id == id) {
                  currentDt = new Date(memberItinerary[j].endDate);
                }
              }
            }
          }
          for (var i = 0; i < membersModelData.length; i++) {
            if (membersModelData[i].guid == guid) {
              var memberItinerary = membersModelData[i].itinerary;

              for (var j = 0; j < memberItinerary.length; j++) {
                if (memberItinerary[j].id != id) {
                  var startDt = new Date(memberItinerary[j].startDate);
                  var endDt = new Date(memberItinerary[j].endDate);

                  var diffTime = Math.abs(endDt - startDt);
                  var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                  var noOfDays = diffDays + 1;

                  for (var k = 0; k < noOfDays; k++) {
                    var newDate = new Date(startDt.getTime());
                    newDate.setDate(newDate.getDate() + k);
                    if (currentDt.getTime() === newDate.getTime()) {
                      datesValid = false;
                      break;
                    }
                  }
                }
              }
            }
          }

          if (datesValid == false) {
            this.alertMessage("E", "errorsFound", "overlapItineraryError", [], null);
            // MessageBox.error(
            //   "Please select any other date which is not overlap with other cities dates",
            //   {
            //     actions: [MessageBox.Action.CLOSE],
            //     onClose: async function (sAction) {},
            //     dependentOn: that.getView(),
            //   }
            // );
            for (var i = 0; i < membersModelData.length; i++) {
              if (membersModelData[i].guid == guid) {
                var memberItinerary = membersModelData[i].itinerary;

                for (var j = 0; j < memberItinerary.length; j++) {
                  if (memberItinerary[j].id == id) {
                    memberItinerary[j].endDate = null;
                    break;
                  }
                }
              }
            }
          } else {
            for (var i = 0; i < membersModelData.length; i++) {
              if (membersModelData[i].guid == guid) {
                var memberItinerary = membersModelData[i].itinerary;
                for (var j = 0; j < memberItinerary.length; j++) {
                  if (memberItinerary[j].id == id) {
                    if (aInfo.missionStartDate != null) {
                      var startDt = new Date(aInfo.missionStartDate);
                      startDt.setDate(startDt.getDate());
                      if (new Date(memberItinerary[j].endDate) < startDt) {
                        memberItinerary[j].endDate = null;
                      }
                    }
                    if (aInfo.missionEndDate != null) {
                      var endDt = new Date(aInfo.missionEndDate);
                      endDt.setDate(endDt.getDate());
                      if (new Date(memberItinerary[j].endDate) > endDt) {
                        memberItinerary[j].endDate = null;
                      }
                    }

                    if (memberItinerary[j].startDate != null) {
                      var startDt = new Date(memberItinerary[j].startDate);
                      var endDt = new Date(memberItinerary[j].endDate);
                      if (startDt > endDt) {
                        memberItinerary[j].startDate = null;
                      }
                    }

                    if (memberItinerary[j].endDate != null) {
                      var endDt = new Date(memberItinerary[j].endDate);
                      memberItinerary[j].startDateMaxDate =
                        UI5Date.getInstance(endDt);
                    }
                  }
                }
              }
            }
          }
        }

        // var membersModel = new JSONModel({
        // 	members: membersModelData,
        // });

        // this.setModel(membersModel,'membersModel');

        oMembersModel.setProperty("/members", membersModelData);

        this.findTicketAndPerDiemPerCity(guid, id, oEvent, null);
      },

      findTicketAndPerDiemPerCity: async function (guid, id, oEvent, type) {
        const that = this;
        const envInfo = await this.getEnvInfo();

        let obj = {
          employeeID: "",
          itineraryStartDate: "",
          itineraryEndDate: "",
          destination: "",
          headOfMission: "",
          hospitality: "",
          sector: "",
          paygradeLevel: "",
          payGrade: "",
          ticketType: "",
          flightType: "",
        };
        // var mModelData   = this.getModel("membersModel").getData().members;
        // var aInfo = this.getModel("missionInfoModel").getData().info;

        const oMissionInfoModel = this.getModel("missionInfoModel");
        let aInfo = oMissionInfoModel.getProperty("/info");

        const oMembersModel = this.getModel("membersModel");
        let mModelData = oMembersModel.getProperty("/members");

        for (var i = 0; i < mModelData.length; i++) {
          if (guid == mModelData[i].guid) {
            obj.employeeID = mModelData[i].employeeID;
            obj.paygradeLevel = mModelData[i].gradeLevel;
            obj.payGrade = mModelData[i].grade;
            obj.sector = aInfo.sector;
            obj.flightType = aInfo.flightType;
            var itineraryData = mModelData[i].itinerary;
            for (var j = 0; j < itineraryData.length; j++) {
              if (id == itineraryData[j].id) {
                obj.destination = itineraryData[j].city;
                obj.headOfMission = itineraryData[j].headOfMission;
                obj.hospitality = itineraryData[j].hospitalityDefault;
                //if (type != null && type == "ticketType") {
                obj.ticketType = itineraryData[j].ticketType;
                //} else {
                // obj.ticketType = null;
                //ssss }
                var itineraryStartDate = new Date(itineraryData[j].startDate);
                var itineraryEndDate = new Date(itineraryData[j].endDate);
                obj.itineraryStartDate =
                  "/Date(" + itineraryStartDate.getTime() + ")/";
                obj.itineraryEndDate =
                  "/Date(" + itineraryEndDate.getTime() + ")/";
              }
            }
          }
        }

        if (
          obj.employeeID != "" &&
          obj.itineraryStartDate != "" &&
          obj.itineraryStartDate != "/Date(0)/" &&
          obj.itineraryEndDate != "" &&
          obj.itineraryEndDate != "/Date(0)/" &&
          obj.destination != "" &&
          obj.headOfMission != "" &&
          obj.hospitality != "" &&
          obj.sector != "" &&
          obj.paygradeLevel != "" &&
          obj.payGrade != ""
        ) {
          var requestBody = {
            params: obj,
          };

          const encryptedData = await that.getEncryptedData(requestBody);

          const url = "/findTicketAndPerDiemPerCity";

          this.openBusyFragment("perdiemBeingRecalculated");

          jQuery.ajax({
            type: "POST",
            url: url,
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
              var decryptedData = await that.getDecryptedData(data);

              var ticketAndPerDiemData = JSON.parse(decryptedData);

              for (var i = 0; i < mModelData.length; i++) {
                if (guid == mModelData[i].guid) {
                  var itineraryData = mModelData[i].itinerary;
                  for (var j = 0; j < itineraryData.length; j++) {
                    if (id == itineraryData[j].id) {
                      if (
                        !isNaN(parseInt(ticketAndPerDiemData.perDiemPerCity))
                      ) {
                        itineraryData[j].perDiemPerCity = 0;

                        itineraryData[j].perDiemPerCity =
                          ticketAndPerDiemData.perDiemPerCity;
                      } else {
                        itineraryData[j].perDiemPerCity = 0;
                      }

                      if (
                        !isNaN(parseInt(ticketAndPerDiemData.ticketAverage))
                      ) {
                        itineraryData[j].ticketAverage = 0;

                        itineraryData[j].ticketAverage =
                          ticketAndPerDiemData.ticketAverage;
                      } else {
                        itineraryData[j].ticketAverage = 0;
                      }

                      itineraryData[j].ticketType =
                        ticketAndPerDiemData.ticketType;
                    }
                  }
                }
              }

              var memberTicketAverage = 0;
              var memberPerDiemPerCity = 0;
              var missionTicketAverage = 0;
              var missionPerDiemPerCity = 0;
              var missionTotalExpense = 0;

              for (var i = 0; i < mModelData.length; i++) {
                memberTicketAverage = 0;
                memberPerDiemPerCity = 0;
                if (guid == mModelData[i].guid) {
                  var itineraryData = mModelData[i].itinerary;
                  for (var j = 0; j < itineraryData.length; j++) {
                    memberPerDiemPerCity =
                      memberPerDiemPerCity + itineraryData[j].perDiemPerCity;
                    memberTicketAverage =
                      memberTicketAverage + itineraryData[j].ticketAverage;
                  }
                  mModelData[i].employeeTotalPerdiem = memberPerDiemPerCity;
                  mModelData[i].employeeTotalTicket = memberTicketAverage;
                  mModelData[i].employeeTotalExpense =
                    memberPerDiemPerCity + memberTicketAverage;
                  missionTicketAverage =
                    missionTicketAverage + memberTicketAverage;
                  missionPerDiemPerCity =
                    missionPerDiemPerCity + memberPerDiemPerCity;
                  missionTotalExpense =
                    missionTotalExpense +
                    missionTicketAverage +
                    missionPerDiemPerCity;
                } else {
                  var itineraryData = mModelData[i].itinerary;
                  for (var j = 0; j < itineraryData.length; j++) {
                    memberPerDiemPerCity =
                      memberPerDiemPerCity + itineraryData[j].perDiemPerCity;
                    memberTicketAverage =
                      memberTicketAverage + itineraryData[j].ticketAverage;
                  }

                  missionTicketAverage =
                    missionTicketAverage + memberTicketAverage;
                  missionPerDiemPerCity =
                    missionPerDiemPerCity + memberPerDiemPerCity;
                  missionTotalExpense =
                    missionTotalExpense +
                    missionTicketAverage +
                    missionPerDiemPerCity;
                }
              }

              aInfo.ticketAverage = missionTicketAverage;
              aInfo.totalPerdiemMission = missionPerDiemPerCity;
              aInfo.totalExpense = missionTicketAverage + missionPerDiemPerCity;

              // var membersModel = new JSONModel({
              // 	members: mModelData,
              // });
              // that.setModel(membersModel,'membersModel');
              oMembersModel.setProperty("/members", mModelData);

              // var missionInfoModel = new JSONModel({
              // 	info: aInfo,
              // });
              // that.setModel(missionInfoModel,'missionInfoModel');
              oMissionInfoModel.setProperty("/info", aInfo);

              that.closeBusyFragment();

              that.toastMessage(
                "I",
                null,
                "perdiemCalculatedSaveToUpdate",
                [],
                { showConfirmButton: true }
              );

              that.animateSaveButton();
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              that.closeBusyFragment();
              if (jqXHR.status == 401) {
                that.closeMission();
              }
            },
          });
        }
      },
      initialize: async function () {

        const oViewModel = new JSONModel({
          edit: false,
        });

        this.setModel(oViewModel, "approveAdvanceModel");

        const that = this;
        this.startLoading();
        try {
          var approvalModel = new JSONModel({
            info: [],
          });
          this.setModel(approvalModel, "approvalModel");

          var auditModel = new JSONModel({
            info: [],
          });
          this.setModel(auditModel, "auditModel");

          await this.preInitializeModel();

          await this.initializeModel();
          await this.initiateDynamicMembers();
          await this.initiateMissionAttachment();
          await this.initiateAdvanceModel();

          try {
            await this.getMasters();

            await this.getAdvanceById();

            this.finishLoading();
          } catch (e) {
            this.finishLoading();
            this.alertMessage("E", "errorOperation", "sessionExpired", [], null);
            // MessageBox.error("The session is expired. Please refresh.", {
            //   actions: [MessageBox.Action.CLOSE],
            //   onClose: async function (sAction) {
            //     that.closeMission();
            //   },
            //   dependentOn: that.getView(),
            // });
          }
        } catch (e) {
          this.finishLoading();
          var screenModelData = {
            pageError: true,
            pageErrorMessage: this.getView()
              .getModel("i18n")
              .getResourceBundle()
              .getText("userNotFound"),
          };

          var screenModel = new JSONModel({
            info: screenModelData,
          });

          this.setModel(screenModel, "screenModel");
        }
      },

      preInitializeModel: function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          const decryptedDataParsed = await that.getTravelStorage();
          if (decryptedDataParsed.keyVault.permission.payrollGroup != true) {
            reject(false);
          } else {
            var screenModelData = {
              pageError: false,
              pageErrorMessage: null,
            };

            var screenModel = new JSONModel({
              info: screenModelData,
            });

            that.setModel(screenModel, "screenModel");

            var approveModel = new JSONModel({
              approverId: null,
              approverName: null,
              action: null,
              comments: null,
            });
            that.setModel(approveModel, "approveModel");

            resolve(true);
          }
        });
      },

      initializeModel: function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          var missionInfoObj = {
            missionDescription: "",
            missionStartDate: null,
            missionEndDate: null,
            missionStartDateMaxDate: null,
            missionEndDateMinDate: null,
            sector: "",
            ticketAverage: 0,
            budgetAvailable: 0,
            destination: "",
            noOfDays: "",
            totalExpense: 0,
            totalPerdiemMission: 0,
            hospitality_Type: "",
            createdBy: "",
            pendingWithGroup: null,
            pendingWithUser: null,
            decreeType: "",
            externalEntity: "",
            flightType: "",
            budgetParked: 0,
            missionID: "",
          };

          var missionInfoModel = new JSONModel({
            info: missionInfoObj,
          });

          that.setModel(missionInfoModel, "missionInfoModel");

          resolve(true);
        });
      },

      initiateDynamicMembers: function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          var rows = [
            {
              user: "",
              userSuggest: "",
              employeeName: "",
              salutation: "",
              employeeID: "",
              grade: "",
              gradeLevel: "",
              department: "",
              title: "",
              multipleCities: "",
              noOfCities: "",
              employeeTotalExpense: 0,
              employeeTotalTicket: 0,
              employeeTotalPerdiem: 0,
              jobLevel: "",
              itinerary: [],
              attachments: [],
            },
          ];

          var membersModel = new JSONModel({
            members: rows,
          });

          that.setModel(membersModel, "membersModel");
          resolve(true);
        });
      },

      initiateMissionAttachment: function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          var attachmentRows = [];

          var missionAttachmentsModel = new JSONModel({
            attachments: attachmentRows,
          });

          that
            .getView()
            .setModel(missionAttachmentsModel, "missionAttachmentsModel");

          resolve(true);
        });
      },

      initiateAdvanceModel: function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          var advanceInfoModel = new JSONModel({
            info: {},
          });

          that.setModel(advanceInfoModel, "advanceInfoModel");

          resolve(true);
        });
      },

      getAdvanceById: async function () {
        const that = this;

        const envInfo = await this.getEnvInfo();

        const decryptedDataParsed = await that.getTravelStorage();

        return new Promise(async function (resolve, reject) {
          var obj = {
            advance: that.advanceId,
          };

          var encData = await that.getEncryptedData(obj);

          var url = "/fetchAdvanceInfo";

          jQuery.ajax({
            type: "POST",
            url: url,
            contentType: "application/json",
            xhrFields: { withCredentials: true },
            data: JSON.stringify({
              data: encData,
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
              var advanceDecryptedData = await that.getDecryptedData(data);

              var advanceData = JSON.parse(advanceDecryptedData);

              var advanceInfo = advanceData.d.results[0];

              advanceInfo.cust_StartDate = formatter.formatDateStr(
                advanceInfo.cust_StartDate
              );
              advanceInfo.cust_EndDate = formatter.formatDateStr(
                advanceInfo.cust_EndDate
              );

              var advanceInfoModel = new JSONModel({
                info: advanceInfo,
              });

              that.setModel(advanceInfoModel, "advanceInfoModel");

              var missionId = advanceInfo.cust_MissionID;
              var employeeId = advanceInfo.cust_EmployeeID;

              var missionObj = {
                mission: missionId,
                user: decryptedDataParsed.keyVault.user.id,
              };

              var encryptedInfo = await that.getEncryptedData(missionObj);

              jQuery.ajax({
                type: "POST",
                url: "/getMissionById",
                contentType: "application/json",
                xhrFields: { withCredentials: true },
                data: JSON.stringify({
                  data: encryptedInfo,
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
                  var missionData = JSON.parse(data);
                  var missionInfo = missionData.info;
                  var auditInfo = missionData.auditLogs;

                  for (var i = 0; i < auditInfo.length; i++) {
                    auditInfo[i]["photo"] = await that.getPhoto(
                      auditInfo[i].user
                    );
                  }

                  var auditModel = new JSONModel({
                    info: auditInfo,
                  });

                  that.setModel(auditModel, "auditModel");

                  that.missionTotalExpense = missionInfo.totalExpenseOnMission;

                  var missionInfoObj = {
                    missionDescription: missionInfo.description,
                    missionDetails: missionInfo.details,
                    missionStartDate: formatter.formatDateUI(
                      missionInfo.startDate
                    ),
                    missionEndDate: formatter.formatDateUI(missionInfo.endDate),
                    sector: missionInfo.sector,
                    ticketAverage: missionInfo.ticketAverage,
                    budgetAvailable: missionInfo.budgetAvailable,
                    destination: missionInfo.destination,
                    noOfDays: missionInfo.numberOfDays,
                    totalExpense: missionInfo.totalExpenseOnMission,
                    totalPerdiemMission: missionInfo.totalPerDiemMission,
                    hospitality_Type: missionInfo.hospitality,
                    createdBy: "",
                    pendingWithGroup: null,
                    pendingWithUser: null,
                    decreeType: missionInfo.decreeType,
                    externalEntity: missionInfo.externalEntity,
                    flightType: missionInfo.filightType,
                    budgetParked: missionInfo.budgetParked,
                    missionID: missionInfo.id,
                  };

                  // var startDtModified = null;
                  // var endDtModified = null;
                  // if (missionInfoObj.missionStartDate != null) {
                  //   startDtModified = new Date(missionInfoObj.missionStartDate);
                  //   startDtModified.setDate(startDtModified.getDate());
                  // }
                  // if (missionInfoObj.missionEndDate != null) {
                  //   endDtModified = new Date(missionInfoObj.missionEndDate);
                  //   endDtModified.setDate(endDtModified.getDate());
                  // }

                   //--Startdate - Enddate mix max
                   var mStartDtMin = null;
                   var mEndDtMin = null;
                   var mStartDtMax = null;
                   var mEndDtMax = null;
 
                   if (missionInfo["startDate"] != null) {
                     mStartDtMin = new Date(missionInfo["startDate"]);
                     mStartDtMax = new Date(missionInfo["startDate"]);
                     mStartDtMin.setDate(mStartDtMin.getDate() - 1);
                     mStartDtMax.setDate(mStartDtMax.getDate() + 1);
                   }
 
                   if (missionInfo["endDate"] != null) {
                     mEndDtMin = new Date(missionInfo["endDate"]);
                     mEndDtMax = new Date(missionInfo["endDate"]);
                     mEndDtMin.setDate(mEndDtMin.getDate() - 1);
                     mEndDtMax.setDate(mEndDtMax.getDate() + 1);
                   }
                   //--Startdate - Enddate mix max

                  var missionInfoModel = new JSONModel({
                    info: missionInfoObj,
                  });

                  that.setModel(missionInfoModel, "missionInfoModel");

                  var missionAttachmentsModelData = [];
                  var missionAttachments = missionData.attachments.attachments;

                  for (var a = 0; a < missionAttachments.length; a++) {
                    if (
                      missionAttachments[a].fileName != null &&
                      missionAttachments[a].fileName != ""
                    ) {
                      var missionAttachmentObj = {
                        fileName: missionAttachments[a].fileName,
                        mimetype: missionAttachments[a].mimeType,
                        fileSize:
                          Math.round(
                            (parseFloat(missionAttachments[a].fileSize) /
                              1024) *
                              100
                          ) /
                            100 +
                          " KB",
                        file: missionAttachments[a].file,
                      };
                      missionAttachmentsModelData.push(missionAttachmentObj);
                    }
                  }

                  var missionAttachmentsModel = new JSONModel({
                    attachments: missionAttachmentsModelData,
                  });

                  that
                    .getView()
                    .setModel(
                      missionAttachmentsModel,
                      "missionAttachmentsModel"
                    );

                  var membersArr = [];

                  for (var i = 0; i < missionData.members.length; i++) {
                    var memberInfo = missionData.members[i];

                    var randomID = Formatter.createAttachmentID();

                    if (memberInfo.id == employeeId) {
                      var memberObj = {
                        guid: randomID,
                        user: memberInfo.name,
                        employeeName: memberInfo.name,
                        salutation: memberInfo.salutation,
                        employeeID: memberInfo.id,
                        userID: memberInfo.userId,
                        grade: memberInfo.grade,
                        department: memberInfo.department,
                        title: memberInfo.title,
                        multipleCities: memberInfo.multicity,
                        employeeTotalExpense: memberInfo.totalExpense,
                        employeeTotalTicket: memberInfo.totalTicket,
                        employeeTotalPerdiem: memberInfo.totalPerDiem,
                        itinerary: [],
                        attachments: [],
                      };

                      for (var j = 0; j < memberInfo.itinerary.length; j++) {
                        var itineraryInfo = memberInfo.itinerary[j];
                        var randomItineraryID = Formatter.createAttachmentID();
                        var itinieraryObj = {
                          id: randomItineraryID,
                          memberGUID: randomID,
                          externalCode: itineraryInfo.externalCode,
                          city: itineraryInfo.city,
                          ticketType: itineraryInfo.ticketType,
                          startDate: formatter.formatDateUI(
                            itineraryInfo.startDate
                          ),
                          endDate: formatter.formatDateUI(
                            itineraryInfo.endDate
                          ),
                          headOfMission: itineraryInfo.isHeadOfMission,
                          hospitalityDefault: itineraryInfo.hospitality,
                          perDiemPerCity: itineraryInfo.perDiemPerCity,
                          ticketAverage: itineraryInfo.ticketAverage,
                          ticketActualCost: itineraryInfo.ticketActualCost,
                          startDateMinDate: mStartDtMin,
                          startDateMaxDate: mEndDtMax,
                          endDateMinDate: mStartDtMin,
                          endDateMaxDate: mEndDtMax,
                        };

                        memberObj.itinerary.push(itinieraryObj);
                      }

                      var memberAttachments = memberInfo.attachments;

                      for (var ma = 0; ma < memberAttachments.length; ma++) {
                        if (
                          memberAttachments[ma].fileName != null &&
                          memberAttachments[ma].fileName != ""
                        ) {
                          var memberAttachmentObj = {
                            fileName: memberAttachments[ma].fileName,
                            mimetype: memberAttachments[ma].mimeType,
                            fileSize:
                              Math.round(
                                (parseFloat(memberAttachments[ma].fileSize) /
                                  1024) *
                                  100
                              ) /
                                100 +
                              " KB",
                            file: memberAttachments[ma].file,
                          };
                          memberObj.attachments.push(memberAttachmentObj);
                        }
                      }
                      membersArr.push(memberObj);
                    }
                  }

                  var membersModel = new JSONModel({
                    members: membersArr,
                  });

                  that.setModel(membersModel, "membersModel");

                  var approvalInfo = missionData.approval;

                  var approvalModel = new JSONModel({
                    info: approvalInfo,
                  });

                  that.setModel(approvalModel, "approvalModel");

                  resolve(true);
                },

                error: async function (jqXHR, textStatus, errorDesc) {
                  resolve(false);
                  console.log(errorDesc);
                },
              });
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              var screenModelData = that
                .getView()
                .getModel("screenModel")
                .getData().info;

              screenModelData.pageErrorMessage = that
                .getView()
                .getModel("i18n")
                .getResourceBundle()
                .getText("serverError");

              screenModelData.pageError = false;

              var screenModel = new JSONModel({
                info: screenModelData,
              });

              that.setModel(screenModel, "screenModel");

              resolve(false);

              if (jqXHR.status == 401) {
                that.closeMission();
              }
            },
          });
        });
      },

      getPhoto: async function (user) {
        const that = this;

        return new Promise(async function (resolve, reject) {
          const envInfo = await that.getEnvInfo();

          var photo = that.userIcon;

          var obj = {
            users: user,
          };
          var encryptedData = await that.getEncryptedData(obj);

          jQuery.ajax({
            type: "POST",
            url: "/getPhotoForMember",
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
              data: encryptedData,
            }),
            success: async function (data, textStatus, jqXHR) {
              var decryptedData = await that.getDecryptedData(data);
              var photoData = JSON.parse(decryptedData).d.results;

              for (var j = 0; j < photoData.length; j++) {
                if (photoData[j].photo) {
                  photo =
                    "data:" +
                    photoData[j].mimeType +
                    ";base64," +
                    photoData[j].photo;
                }
              }

              resolve(photo);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              photo = that.userIcon;
              resolve(photo);
            },
          });
        });
      },

     
      onAttachmentOpen: function (oEvent) {
        oEvent.preventDefault();
        var item = oEvent.getSource();
        var a = document.createElement("a");
        a.href =
          "data:" +
          item.mProperties.mediaType +
          ";base64," +
          item.mProperties.url;
        a.download = item.mProperties.fileName;
        a.click();
      },

      approveAdvance: async function (oEvent) {
        const that = this;
        const envInfo = await that.getEnvInfo();
        const decryptedDataParsed = await that.getTravelStorage();

         //--Check employee is him/herself approves
         const oMembersModel = this.getModel("membersModel");
         const aMembers = oMembersModel.getProperty("/members");
 
         const oMe = _.find(aMembers, (m)=>{
          if (m.employeeID === decryptedDataParsed.keyVault.user.id || m.employeeID === decryptedDataParsed.keyVault.masterUser.id ) {
              return true;
          }
        });
 
         if (oMe && oMe.employeeID) {
           this.alertMessage("E", "errorOperation", "ownAdvanceCannotBeApproved", [],null);
           return;
         }
         //--Check employee is him/herself approves

        var aInfoCalculate = this.getView()
          .getModel("missionInfoModel")
          .getData().info;
        var advanceInfo = this.getView()
          .getModel("advanceInfoModel")
          .getData().info;

        var payload = that.getModel("approveModel").getData();

        var obj = {
          missionId: aInfoCalculate.missionID,
          missionDescription: aInfoCalculate.missionDescription,
          advance: advanceInfo.externalCode,
          date: "/Date(" + new Date().getTime() + ")/",
          action: "1",
          loggedInUser: decryptedDataParsed.keyVault.user.id,
          byDelegate: decryptedDataParsed.keyVault.masterUser.id !== decryptedDataParsed.keyVault.user.id ? `${decryptedDataParsed.keyVault.user.firstName} ${decryptedDataParsed.keyVault.user.lastName} (${decryptedDataParsed.keyVault.user.id})` : null,
          payload: payload,
        };

        var encryptedData = await that.getEncryptedData(obj);

        this.openBusyFragment();
        jQuery.ajax({
          type: "POST",
          url: "/approveRejectAdvance",
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
            data: encryptedData,
          }),
          success: async function (data, textStatus, jqXHR) {
            that.closeBusyFragment();
            
            that.alertMessage("S",
              "successfulOperation",
              "travelAdvanceApprovedBy",
              [`${decryptedDataParsed.keyVault.user.firstName} ${decryptedDataParsed.keyVault.user.lastName}`],
              { 
                showConfirmButton: true,
                confirmCallbackFn: ()=>{
                  that.closeMission();
                }
              }
            );
            // MessageBox.success(
            //   "The travel advance is approved by " +
            //     decryptedDataParsed.keyVault.user.firstName +
            //     " " +
            //     decryptedDataParsed.keyVault.user.lastName,
            //   {
            //     actions: [MessageBox.Action.CLOSE],
            //     onClose: async function (sAction) {
            //       that.closeMission();
            //     },
            //     dependentOn: that.getView(),
            //   }
            // );
          },
          error: async function (jqXHR, textStatus, errorDesc) {
            that.closeBusyFragment();
            if (jqXHR.status == 401) {
              that.closeMission();
            } else {
              that.alertMessage("E", "errorOperation", "serverError", [],null);
              // MessageBox.error("Something went wrong", {
              //   actions: [MessageBox.Action.CLOSE],
              //   onClose: function (sAction) {},
              //   dependentOn: that.getView(),
              // });
            }
          },
        });
      },

      sendBackAdvance: async function (oEvent) {
        const that = this;
        const envInfo = await that.getEnvInfo();
        const decryptedDataParsed = await that.getTravelStorage();

        //--Check employee is him/herself approves
        const oMembersModel = this.getModel("membersModel");
        const aMembers = oMembersModel.getProperty("/members");

        const oMe = _.find(aMembers, (m)=>{
          if (m.employeeID === decryptedDataParsed.keyVault.user.id || m.employeeID === decryptedDataParsed.keyVault.masterUser.id ) {
              return true;
          }
        });

        if (oMe && oMe.employeeID) {
          this.alertMessage("E", "errorOperation", "ownAdvanceCannotBeSentBack", [],null);
          return;
        }
        //--Check employee is him/herself approves

        var aInfoCalculate = this.getView()
          .getModel("missionInfoModel")
          .getData().info;
        var advanceInfo = this.getView()
          .getModel("advanceInfoModel")
          .getData().info;

        var payload = that.getModel("approveModel").getData();

        var obj = {
          missionId: aInfoCalculate.missionID,
          missionDescription: aInfoCalculate.missionDescription,
          advance: advanceInfo.externalCode,
          date: "/Date(" + new Date().getTime() + ")/",
          action: "5",
          loggedInUser: decryptedDataParsed.keyVault.user.id,
          byDelegate: decryptedDataParsed.keyVault.masterUser.id !== decryptedDataParsed.keyVault.user.id ? `${decryptedDataParsed.keyVault.masterUser.firstName} ${decryptedDataParsed.keyVault.masterUser.lastName} (${decryptedDataParsed.keyVault.masterUser.id})` : null,
          payload: payload,
        };

        var encryptedData = await that.getEncryptedData(obj);

        that.openBusyFragment();
        jQuery.ajax({
          type: "POST",
          url: "/approveRejectAdvance",
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
            data: encryptedData,
          }),
          success: async function (data, textStatus, jqXHR) {
            that.closeBusyFragment();
            that.alertMessage("S",
              "successfulOperation",
              "travelAdvanceSentBackBy",
              [`${decryptedDataParsed.keyVault.user.firstName} ${decryptedDataParsed.keyVault.user.lastName}`],
              { 
                showConfirmButton: true,
                confirmCallbackFn: ()=>{
                  that.closeMission();
                }
              }
            );
            // MessageBox.success(
            //   "The travel advance is sent back by " +
            //     decryptedDataParsed.keyVault.user.firstName +
            //     " " +
            //     decryptedDataParsed.keyVault.user.lastName,
            //   {
            //     actions: [MessageBox.Action.CLOSE],
            //     onClose: async function (sAction) {
            //       that.closeMission();
            //     },
            //     dependentOn: that.getView(),
            //   }
            // );
          },
          error: async function (jqXHR, textStatus, errorDesc) {
            that.closeBusyFragment();
            if (jqXHR.status == 401) {
              that.closeMission();
            } else {
              that.alertMessage("E", "errorOperation", "serverError", [],null);
              // MessageBox.error("Something went wrong", {
              //   actions: [MessageBox.Action.CLOSE],
              //   onClose: function (sAction) {},
              //   dependentOn: that.getView(),
              // });
            }
          },
        });
      },
    });
  }
);
