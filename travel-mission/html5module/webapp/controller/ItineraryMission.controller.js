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

    return BaseController.extend("ui5app.controller.ItineraryMission", {


      missionTotalExpense: 0,

      onInit: function (evt) {
        this.initializeAppSettings(true);
        const oRouter = this.getRouter();
        oRouter
          .getRoute("itinerarymission")
          .attachMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function (oEvent) {
        var oArgs = oEvent.getParameter("arguments");
        this.missionId = oArgs.mission;
        this.initialize();
      },

      closeMission: async function () {
        await this.initializeModel();
        await this.initiateDynamicMembers();
        await this.initiateMissionAttachment();

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

      initialize: async function () {
        const oViewModel = new JSONModel({
          enableSave: false,
        });

        this.setModel(oViewModel, "itineraryMissionModel");

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

          try {
            await this.getMasters();

            await this.getMissionById();
            this.finishLoading();
          } catch (e) {
            this.finishLoading();
            this.alertMessage("E", "errorOperation", "sessionExpired", [], {
              showConfirmButton: true,
              confirmCallbackFn: () => {
                that.closeMission();
              }
            });
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
          if (
            decryptedDataParsed.keyVault.permission.mission.itinerayUpdate !=
            true
          ) {
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
              userID: "",
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

      getMissionById: async function () {
        const that = this;

        const envInfo = await this.getEnvInfo();

        const decryptedDataParsed = await that.getTravelStorage();

        var obj = {
          mission: this.missionId,
          user: decryptedDataParsed.keyVault.user.id,
        };

        var encryptedInfo = await this.getEncryptedData(obj);

        return new Promise(async function (resolve, reject) {
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

              that.missionTotalExpense = missionInfo.totalExpenseOnMission;

              var missionInfoObj = {
                missionDescription: missionInfo.description,
                missionDetails: missionInfo.details,
                missionStartDate: formatter.formatDateUI(missionInfo.startDate),
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
                        (parseFloat(missionAttachments[a].fileSize) / 1024) *
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
                .setModel(missionAttachmentsModel, "missionAttachmentsModel");

              var membersArr = [];

              var aInfo = that
                .getView()
                .getModel("missionInfoModel")
                .getData().info;

              /*
						var startDtModified = null;
						var endDtModified = null;
						if(aInfo.missionStartDate != null) {
							startDtModified = new Date(aInfo.missionStartDate);
							startDtModified.setDate(startDtModified.getDate() - 1);
						}
						if(aInfo.missionEndDate != null) {
							endDtModified = new Date(aInfo.missionEndDate);
							endDtModified.setDate(endDtModified.getDate() + 1);
						}
						*/

              for (var i = 0; i < missionData.members.length; i++) {
                var memberInfo = missionData.members[i];
                var randomID = Formatter.createAttachmentID();
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
                    startDate: formatter.formatDateUI(itineraryInfo.startDate),
                    endDate: formatter.formatDateUI(itineraryInfo.endDate),
                    headOfMission: itineraryInfo.isHeadOfMission,
                    hospitalityDefault: itineraryInfo.hospitality,
                    perDiemPerCity: itineraryInfo.perDiemPerCity,
                    ticketAverage: itineraryInfo.ticketAverage,
                    ticketActualCost: itineraryInfo.ticketActualCost,
                    //"startDateMinDate": startDtModified,
                    //"startDateMaxDate": endDtModified,
                    //"endDateMinDate": startDtModified,
                    //"endDateMaxDate": endDtModified
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
                          (parseFloat(memberAttachments[ma].fileSize) / 1024) *
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

              var membersModel = new JSONModel({
                members: membersArr,
              });

              that.setModel(membersModel, "membersModel");

              var approvalInfo = missionData.approval;

              var approvalModel = new JSONModel({
                info: approvalInfo,
              });

              that.setModel(approvalModel, "approvalModel");

              var auditInfo = missionData.auditLogs;

              for (var i = 0; i < auditInfo.length; i++) {
                auditInfo[i]["photo"] = await that.getPhoto(auditInfo[i].user);
              }

              var auditModel = new JSONModel({
                info: auditInfo,
              });

              that.setModel(auditModel, "auditModel");

              resolve(true);
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

      handleItineraryDatesChange: function (type, guid, id, oEvent) {
        const that = this;
        const oMissionInfoModel = this.getModel("missionInfoModel");
        const oMembersModel = this.getModel("membersModel");

        let aInfo = oMissionInfoModel.getProperty("/info");
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
                    if (memberItinerary[j].endDate != null) {
                      var startDt = new Date(memberItinerary[j].startDate);
                      var endDt = new Date(memberItinerary[j].endDate);
                      if (startDt > endDt) {
                        memberItinerary[j].endDate = null;
                      }
                    }

                    /*
									if(memberItinerary[j].startDate != null) {
										var startDt = new Date(memberItinerary[j].startDate);
										memberItinerary[j].endDateMinDate = UI5Date.getInstance(startDt);
									}
									*/
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
                    /*
									if(aInfo.missionStartDate != null) {
										var startDt = new Date(aInfo.missionStartDate);
										startDt.setDate(startDt.getDate() - 1);
										if(new Date(memberItinerary[j].endDate) < startDt) {
											memberItinerary[j].endDate = null;
										}
									}
									if(aInfo.missionEndDate != null) {
										var endDt = new Date(aInfo.missionEndDate);
										endDt.setDate(endDt.getDate() + 1);
										if(new Date(memberItinerary[j].endDate) > endDt) {
											memberItinerary[j].endDate = null;
										}
									}
									*/

                    if (memberItinerary[j].startDate != null) {
                      var startDt = new Date(memberItinerary[j].startDate);
                      var endDt = new Date(memberItinerary[j].endDate);
                      if (startDt > endDt) {
                        memberItinerary[j].startDate = null;
                      }
                    }

                    /*
									if(memberItinerary[j].endDate != null) {
										var endDt = new Date(memberItinerary[j].endDate);
										memberItinerary[j].startDateMaxDate = UI5Date.getInstance(endDt);
									}
									*/
                  }
                }
              }
            }
          }
        }

        // var membersModel = new JSONModel({
        //   members: membersModelData,
        // });

        // this.setModel(membersModel, "membersModel");
        oMembersModel.setProperty("/members", membersModelData);

        this.findTicketAndPerDiemPerCity(guid, id, oEvent, null);
      },

      findTicketAndPerDiemPerCity: async function (guid, id, oEvent, type) {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oViewModel = this.getModel("itineraryMissionModel");
        const oMembersModel = this.getModel("membersModel");
        const oMissionInfoModel = this.getModel("missionInfoModel");

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
        let mModelData = oMembersModel.getProperty("/members");
        let aInfo = oMissionInfoModel.getProperty("/info");

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
                if (type != null && type == "ticketType") {
                  obj.ticketType = itineraryData[j].ticketType;
                } else {
                  obj.ticketType = null;
                }
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

          var encryptedData = await that.getEncryptedData(requestBody);

          var url = "/findTicketAndPerDiemPerCity";
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
                    var itineraryPerDiemPerCity;
                    if (!isNaN(itineraryData[j].perDiemPerCity)) {
                      itineraryPerDiemPerCity = parseFloat(
                        itineraryData[j].perDiemPerCity
                      );
                    } else {
                      if (itineraryData[j].perDiemPerCity.indexOf(",") > -1) {
                        itineraryPerDiemPerCity = parseFloat(
                          itineraryData[j].perDiemPerCity.replace(/\,/g, "")
                        );
                      } else {
                        itineraryPerDiemPerCity = parseFloat(
                          itineraryData[j].perDiemPerCity
                        );
                      }
                    }

                    var itineraryTicketAverage;
                    if (!isNaN(itineraryData[j].ticketAverage)) {
                      itineraryTicketAverage = parseFloat(
                        itineraryData[j].ticketAverage
                      );
                    } else {
                      if (itineraryData[j].ticketAverage.indexOf(",") > -1) {
                        itineraryTicketAverage = parseFloat(
                          itineraryData[j].ticketAverage.replace(/\,/g, "")
                        );
                      } else {
                        itineraryTicketAverage = parseFloat(
                          itineraryData[j].ticketAverage
                        );
                      }
                    }

                    memberPerDiemPerCity =
                      memberPerDiemPerCity + itineraryPerDiemPerCity;
                    memberTicketAverage =
                      memberTicketAverage + itineraryTicketAverage;
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
                    var itineraryPerDiemPerCity;
                    if (!isNaN(itineraryData[j].perDiemPerCity)) {
                      itineraryPerDiemPerCity = parseFloat(
                        itineraryData[j].perDiemPerCity
                      );
                    } else {
                      if (itineraryData[j].ticketAverage.indexOf(",") > -1) {
                        itineraryPerDiemPerCity = parseFloat(
                          itineraryData[j].perDiemPerCity.replace(/\,/g, "")
                        );
                      } else {
                        itineraryPerDiemPerCity = parseFloat(
                          itineraryData[j].perDiemPerCity
                        );
                      }
                    }

                    var itineraryTicketAverage;
                    if (!isNaN(itineraryData[j].ticketAverage)) {
                      itineraryTicketAverage = parseFloat(
                        itineraryData[j].ticketAverage
                      );
                    } else {
                      if (itineraryData[j].ticketAverage.indexOf(",") > -1) {
                        itineraryTicketAverage = parseFloat(
                          itineraryData[j].ticketAverage.replace(/\,/g, "")
                        );
                      } else {
                        itineraryTicketAverage = parseFloat(
                          itineraryData[j].ticketAverage
                        );
                      }
                    }

                    memberPerDiemPerCity =
                      memberPerDiemPerCity + itineraryPerDiemPerCity;
                    memberTicketAverage =
                      memberTicketAverage + itineraryTicketAverage;
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

              //   var membersModel = new JSONModel({
              //     members: mModelData,
              //   });
              //   that.setModel(membersModel, "membersModel");

              oMembersModel.setProperty("/members", mModelData);

              //     var missionInfoModel = new JSONModel({
              //   info: aInfo,
              // });

              // that.setModel(missionInfoModel, "missionInfoModel");
              oMissionInfoModel.setProperty("/info", aInfo);

              that.closeBusyFragment();
              that.toastMessage(
                "I",
                null,
                "perdiemCalculatedSaveToUpdate",
                [],
                { showConfirmButton: true }
              );

              that.enableSaveButton();
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

      ticketActualCostChange: function (oEvent) {
        oEvent.getSource().setValue(oEvent.getSource().getValue());

        this.toastMessage("I", null, "ticketCostChangedSaveToUpdate", [], {
          showConfirmButton: true,
        });

        this.enableSaveButton();
      },

      enableSaveButton: function () {
        const oViewModel = this.getModel("itineraryMissionModel");
        oViewModel.setProperty("/enableSave", true);

        const oButton = this.byId("idUpdateItineraryButton");
        if (oButton) {
          oButton.$().addClass("animate__tada");
          oButton.$().on("animationend", function () {
            oButton.$().removeClass("animate__tada");
            oButton.$().off("animationend");
          });
        }
      },

      prepareMissionForUpdate: async function () {
        const that = this;
        const oSectorsModel = this.getModel("sectorsModel");
        const oMissionInfoModel = this.getModel("missionInfoModel");
        const oMembersModel = this.getModel("membersModel");

        const travelStorageEncrypted = Storage.get("travel_mission_storage");
        const travelStorage = await that.getDecryptedData(
          travelStorageEncrypted
        );
        const travelStorageInfo = JSON.parse(travelStorage);

        const aSectors = _.cloneDeep(oSectorsModel.getProperty("/sectors"));
        const oMission = _.cloneDeep(oMissionInfoModel.getProperty("/info"));
        const aMembers = _.cloneDeep(oMembersModel.getProperty("/members"));

        let oMissionRequest = {
          info: {
            missionId: oMission.missionID,
            missionTotalExpense: 0,
            missionTotalTicketCost: 0,
            missionTotalPerdiem: 0,
            sector: oMission.sector,
            sectorAvailableBudget: 0,
            sectorUtilizedBudget: 0,
            date: "/Date(" + new Date().getTime() + ")/",
            loggedInUser: travelStorageInfo.keyVault.user.id,
          },
          members: [],
        };

        //--Calculate budget options
        let sectorAvailableBudget = 0;
        let sectorUtilizedBudget = 0;

        let oSector = _.find(aSectors, ["externalCode", oMission.sector]);
        if (oSector) {
          if (oSector.cust_Available_budget != null) {
            sectorAvailableBudget = parseFloat(oSector.cust_Available_budget);
          }

          if (oSector.cust_Parked_Amount != null) {
            sectorUtilizedBudget = parseFloat(oSector.cust_Utilized_Budget);
          }
        }

        aMembers.forEach((oMember) => {
          let oMemberRequest = {
            employeeID: oMember.employeeID,
            employeeTotalExpense: 0,
            employeeTotalPerdiem: 0,
            employeeTotalTicket: 0,
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
                perDiemPerCity: 0,
                ticketActualCost: 0,
                ticketAverage: 0,
              };

              if (!isNaN(oItinerary.perDiemPerCity)) {
                oItineraryRequest.perDiemPerCity = parseFloat(
                  oItinerary.perDiemPerCity
                );
              }

              if (!isNaN(oItinerary.ticketAverage)) {
                oItineraryRequest.ticketAverage = parseFloat(
                  oItinerary.ticketAverage
                );
              }

              if (!isNaN(oItinerary.ticketActualCost)) {
                oItineraryRequest.ticketAverage =
                  oItineraryRequest.ticketActualCost = parseFloat(
                    oItinerary.ticketActualCost
                  );
              }

              oMemberRequest.employeeTotalPerdiem =
                oMemberRequest.employeeTotalPerdiem +
                oItineraryRequest.perDiemPerCity;
              oMemberRequest.employeeTotalTicket =
                oMemberRequest.employeeTotalTicket +
                oItineraryRequest.ticketAverage;

              //--Convert to string
              oItineraryRequest.perDiemPerCity =
                oItineraryRequest.perDiemPerCity.toString();
              oItineraryRequest.ticketAverage =
                oItineraryRequest.ticketAverage.toString();
              oItineraryRequest.ticketActualCost =
                oItineraryRequest.ticketActualCost.toString();

              oMemberRequest.itinerary.push(oItineraryRequest);
            });

            oMemberRequest.employeeTotalExpense =
              oMemberRequest.employeeTotalPerdiem +
              oMemberRequest.employeeTotalTicket;

            oMissionRequest.info.missionTotalPerdiem =
              oMissionRequest.info.missionTotalPerdiem +
              oMemberRequest.employeeTotalPerdiem;
            oMissionRequest.info.missionTotalTicketCost =
              oMissionRequest.info.missionTotalTicketCost +
              oMemberRequest.employeeTotalTicket;
            oMissionRequest.info.missionTotalExpense =
              oMissionRequest.info.missionTotalExpense +
              oMemberRequest.employeeTotalExpense;
          }

          oMemberRequest.employeeTotalPerdiem =
            oMemberRequest.employeeTotalPerdiem.toString();
          oMemberRequest.employeeTotalTicket =
            oMemberRequest.employeeTotalTicket.toString();
          oMemberRequest.employeeTotalExpense =
            oMemberRequest.employeeTotalExpense.toString();

          oMissionRequest.members.push(oMemberRequest);
        });

        let missionTotalExpenseDifference =
          parseFloat(this.missionTotalExpense) -
          parseFloat(oMissionRequest.info.missionTotalExpense);

        if (missionTotalExpenseDifference >= 0) {
          sectorUtilizedBudget =
            parseFloat(sectorUtilizedBudget) -
            Math.abs(parseFloat(missionTotalExpenseDifference));
        } else {
          sectorUtilizedBudget =
            parseFloat(sectorUtilizedBudget) +
            Math.abs(parseFloat(missionTotalExpenseDifference));
        }

        if (missionTotalExpenseDifference >= 0) {
          sectorAvailableBudget =
            parseFloat(sectorAvailableBudget) +
            Math.abs(parseFloat(missionTotalExpenseDifference));
        } else {
          sectorAvailableBudget =
            parseFloat(sectorAvailableBudget) -
            Math.abs(parseFloat(missionTotalExpenseDifference));
        }

        if (sectorUtilizedBudget < 0) {
          sectorUtilizedBudget = 0;
        }

        oMissionRequest.info.sectorAvailableBudget =
          sectorAvailableBudget.toString();
        oMissionRequest.info.sectorUtilizedBudget =
          sectorUtilizedBudget.toString();

        if (sectorAvailableBudget >= 0) {
          return oMissionRequest;
        } else {
          this.alertMessage(
            "E",
            "errorOperation",
            "sectorBudgetLowError",
            [],
            null
          );
          return null;
        }
      },
      updateChanges: async function () {
        const that = this;
        const oViewModel = this.getModel("itineraryMissionModel");
        const oUpdateRequest = await this.prepareMissionForUpdate();
        const envInfo = await this.getEnvInfo();
        const url = "/updateTicketItinerary";

        this.openBusyFragment("missionBeingUpdated");

        const requestBody = {
          params: oUpdateRequest,
        };

        const encryptedData = await that.getEncryptedData(requestBody);

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
            that.closeBusyFragment();
            const decryptedData = await that.getDecryptedData(data);
            const serviceResult = JSON.parse(decryptedData);

            if (serviceResult && serviceResult.status === "OK") {
              that.toastMessage(
                "S",
                "successfulOperation",
                "missionUpdated",
                [],
                null
              );
              oViewModel.setProperty("/enableSave", false);
            }
            try {
              that.openBusyFragment("refreshingMissionData");
              const refreshMission = await that.getMissionById();
              that.closeBusyFragment();
            } catch (e) {
              that.closeBusyFragment();
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

      updateTicketCost: async function (guid, id, oEvent) {
        const that = this;
        const envInfo = await this.getEnvInfo();
        var mModelDataCalculate = this.getView()
          .getModel("membersModel")
          .getData().members;
        var aInfoCalculate = this.getView()
          .getModel("missionInfoModel")
          .getData().info;
        var sectorsModelData = this.getView()
          .getModel("sectorsModel")
          .getData().sectors;

        const decryptedDataParsed = await that.getTravelStorage();

        var sectorAvailableBudget = 0;
        var sectorUtilizedBudget = 0;

        for (var i = 0; i < sectorsModelData.length; i++) {
          if (sectorsModelData[i].externalCode == aInfoCalculate.sector) {
            if (sectorsModelData[i].cust_Available_budget != null) {
              sectorAvailableBudget = parseFloat(
                sectorsModelData[i].cust_Available_budget
              );
            }

            if (sectorsModelData[i].cust_Utilized_Budget != null) {
              sectorUtilizedBudget = parseFloat(
                sectorsModelData[i].cust_Utilized_Budget
              );
            }
          }
        }

        var obj = {
          missionId: aInfoCalculate.missionID,
          employeeId: "",
          itineraryCity: "",
          itineraryStartDate: "",
          itineraryEndDate: "",
          itinerayActualCost: 0,
          itinerayPerDiem: 0,
          itinerayTicketAverage: 0,
          itineraryTicketType: "",
          missionTotalTicketCost: 0,
          missionTotalExpense: 0,
          missionTotalPerdiem: 0,
          memberTotalTicketCost: 0,
          memberTotalPerDiem: 0,
          memberTotalExpense: 0,
          sectorAvailableBudget: 0,
          sectorUtilizedBudget: 0,
          sector: aInfoCalculate.sector,
          date: "/Date(" + new Date().getTime() + ")/",
          loggedInUser: decryptedDataParsed.keyVault.user.id,
        };

        var itineraryActualCost;
        for (var i = 0; i < mModelDataCalculate.length; i++) {
          if (guid == mModelDataCalculate[i].guid) {
            obj.employeeId = mModelDataCalculate[i].employeeID;
            var itineraryData = mModelDataCalculate[i].itinerary;
            for (var j = 0; j < itineraryData.length; j++) {
              if (id == itineraryData[j].id) {
                itineraryActualCost = parseFloat(
                  itineraryData[j].ticketActualCost
                );
                if (!isNaN(itineraryActualCost)) {
                  obj.itinerayActualCost = itineraryActualCost;
                  obj.itinerayTicketAverage = itineraryActualCost;
                  itineraryData[j].ticketAverage = itineraryActualCost;
                  var hoursToAdd = 12 * 60 * 60 * 1000;
                  var itineraryStartDate = new Date(itineraryData[j].startDate);
                  itineraryStartDate.setTime(
                    itineraryStartDate.getTime() + hoursToAdd
                  );
                  var itineraryEndDate = new Date(itineraryData[j].endDate);
                  itineraryEndDate.setTime(
                    itineraryEndDate.getTime() + hoursToAdd
                  );
                  obj.itineraryStartDate =
                    "/Date(" + itineraryStartDate.getTime() + ")/";
                  obj.itineraryEndDate =
                    "/Date(" + itineraryEndDate.getTime() + ")/";
                  obj.itineraryCity = itineraryData[j].city;
                  var itineraryPerDiem;
                  if (!isNaN(itineraryData[j].perDiemPerCity)) {
                    itineraryPerDiem = parseFloat(
                      itineraryData[j].perDiemPerCity
                    );
                  } else {
                    if (itineraryData[j].perDiemPerCity.indexOf(",") > -1) {
                      itineraryPerDiem = parseFloat(
                        itineraryData[j].perDiemPerCity.replace(/\,/g, "")
                      );
                    } else {
                      itineraryPerDiem = parseFloat(
                        itineraryData[j].perDiemPerCity
                      );
                    }
                  }
                  obj.itinerayPerDiem = itineraryPerDiem;
                }
                obj.itineraryTicketType = itineraryData[j].ticketType;
              }
            }
          }
        }

        var memberTicketAverageCalculate = 0;
        var memberPerDiemPerCityCalculate = 0;
        var missionTicketAverageCalculate = 0;
        var missionPerDiemPerCityCalculate = 0;
        var missionTotalExpenseCalculate = 0;

        for (var i = 0; i < mModelDataCalculate.length; i++) {
          memberTicketAverageCalculate = 0;
          memberPerDiemPerCityCalculate = 0;
          if (guid == mModelDataCalculate[i].guid) {
            var itineraryData = mModelDataCalculate[i].itinerary;
            for (var j = 0; j < itineraryData.length; j++) {
              var itineraryPerDiemPerCity;
              if (!isNaN(itineraryData[j].perDiemPerCity)) {
                itineraryPerDiemPerCity = parseFloat(
                  itineraryData[j].perDiemPerCity
                );
              } else {
                if (itineraryData[j].perDiemPerCity.indexOf(",") > -1) {
                  itineraryPerDiemPerCity = parseFloat(
                    itineraryData[j].perDiemPerCity.replace(/\,/g, "")
                  );
                } else {
                  itineraryPerDiemPerCity = parseFloat(
                    itineraryData[j].perDiemPerCity
                  );
                }
              }

              var itineraryTicketAverage;
              if (!isNaN(itineraryActualCost)) {
                itineraryTicketAverage = parseFloat(
                  itineraryData[j].ticketAverage
                );
              } else {
                if (itineraryData[j].ticketAverage.indexOf(",") > -1) {
                  itineraryTicketAverage = parseFloat(
                    itineraryData[j].ticketAverage.replace(/\,/g, "")
                  );
                } else {
                  itineraryTicketAverage = parseFloat(
                    itineraryData[j].ticketAverage
                  );
                }
              }
              memberPerDiemPerCityCalculate =
                memberPerDiemPerCityCalculate + itineraryPerDiemPerCity;
              memberTicketAverageCalculate =
                memberTicketAverageCalculate + itineraryTicketAverage;
            }
            mModelDataCalculate[i].employeeTotalPerdiem =
              memberPerDiemPerCityCalculate;
            mModelDataCalculate[i].employeeTotalTicket =
              memberTicketAverageCalculate;
            mModelDataCalculate[i].employeeTotalExpense =
              memberPerDiemPerCityCalculate + memberTicketAverageCalculate;
            missionTicketAverageCalculate =
              missionTicketAverageCalculate + memberTicketAverageCalculate;
            missionPerDiemPerCityCalculate =
              missionPerDiemPerCityCalculate + memberPerDiemPerCityCalculate;
            missionTotalExpenseCalculate =
              missionTotalExpenseCalculate +
              missionTicketAverageCalculate +
              missionPerDiemPerCityCalculate;
            obj.memberTotalTicketCost = memberTicketAverageCalculate;
            obj.memberTotalPerDiem = memberPerDiemPerCityCalculate;
            obj.memberTotalExpense =
              memberPerDiemPerCityCalculate + memberTicketAverageCalculate;
          } else {
            var itineraryData = mModelDataCalculate[i].itinerary;
            for (var j = 0; j < itineraryData.length; j++) {
              var itineraryPerDiemPerCity;
              var itineraryTicketAverage;

              if (!isNaN(itineraryData[j].perDiemPerCity)) {
                itineraryPerDiemPerCity = parseFloat(
                  itineraryData[j].perDiemPerCity
                );
              } else {
                if (itineraryData[j].perDiemPerCity.indexOf(",") > -1) {
                  itineraryPerDiemPerCity = parseFloat(
                    itineraryData[j].perDiemPerCity.replace(/\,/g, "")
                  );
                } else {
                  itineraryPerDiemPerCity = parseFloat(
                    itineraryData[j].perDiemPerCity
                  );
                }
              }

              if (!isNaN(itineraryData[j].ticketAverage)) {
                itineraryTicketAverage = parseFloat(
                  itineraryData[j].ticketAverage
                );
              } else {
                if (itineraryData[j].ticketAverage.indexOf(",") > -1) {
                  itineraryTicketAverage = parseFloat(
                    itineraryData[j].ticketAverage.replace(/\,/g, "")
                  );
                } else {
                  itineraryTicketAverage = parseFloat(
                    itineraryData[j].ticketAverage
                  );
                }
              }

              memberPerDiemPerCityCalculate =
                memberPerDiemPerCityCalculate + itineraryPerDiemPerCity;
              memberTicketAverageCalculate =
                memberTicketAverageCalculate + itineraryTicketAverage;
            }

            missionTicketAverageCalculate =
              missionTicketAverageCalculate + memberTicketAverageCalculate;
            missionPerDiemPerCityCalculate =
              missionPerDiemPerCityCalculate + memberPerDiemPerCityCalculate;
            missionTotalExpenseCalculate =
              missionTotalExpenseCalculate +
              missionTicketAverageCalculate +
              missionPerDiemPerCityCalculate;
          }
        }

        obj.missionTotalTicketCost = missionTicketAverageCalculate;
        obj.missionTotalPerdiem = missionPerDiemPerCityCalculate;
        obj.missionTotalExpense =
          missionTicketAverageCalculate + missionPerDiemPerCityCalculate;

        var missionTotalExpenseDifference =
          parseFloat(this.missionTotalExpense) -
          parseFloat(obj.missionTotalExpense);

        if (missionTotalExpenseDifference >= 0) {
          sectorUtilizedBudget =
            parseFloat(sectorUtilizedBudget) -
            Math.abs(parseFloat(missionTotalExpenseDifference));
        } else {
          sectorUtilizedBudget =
            parseFloat(sectorUtilizedBudget) +
            Math.abs(parseFloat(missionTotalExpenseDifference));
        }

        if (missionTotalExpenseDifference >= 0) {
          sectorAvailableBudget =
            parseFloat(sectorAvailableBudget) +
            Math.abs(parseFloat(missionTotalExpenseDifference));
        } else {
          sectorAvailableBudget =
            parseFloat(sectorAvailableBudget) -
            Math.abs(parseFloat(missionTotalExpenseDifference));
        }

        if (sectorUtilizedBudget < 0) {
          sectorUtilizedBudget = 0;
        }

        obj.sectorAvailableBudget = sectorAvailableBudget;
        obj.sectorUtilizedBudget = sectorUtilizedBudget;

        if (sectorAvailableBudget >= 0) {
          if (
            obj.missionId != "" &&
            obj.employeeId != "" &&
            obj.itineraryCity != "" &&
            obj.itineraryStartDate != "" &&
            obj.itineraryEndDate != "" &&
            obj.itinerayActualCost != "" &&
            obj.missionTotalTicketCost != "" &&
            obj.missionTotalExpense != "" &&
            obj.missionTotalPerdiem != "" &&
            obj.memberTotalTicketCost != "" &&
            obj.memberTotalExpense != ""
          ) {
            var mModelData = this.getView()
              .getModel("membersModel")
              .getData().members;
            var aInfo = this.getView()
              .getModel("missionInfoModel")
              .getData().info;

            var requestBody = {
              params: obj,
            };

            var encryptedData = await that.getEncryptedData(requestBody);

            var url = "/updateTicketItinerary";
            this.openBusyFragment();
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
                var itineraryActualCost;
                for (var i = 0; i < mModelData.length; i++) {
                  if (guid == mModelData[i].guid) {
                    var itineraryData = mModelData[i].itinerary;
                    for (var j = 0; j < itineraryData.length; j++) {
                      if (id == itineraryData[j].id) {
                        itineraryActualCost = parseFloat(
                          itineraryData[j].ticketActualCost
                        );
                        if (
                          !isNaN(parseInt(itineraryData[j].ticketActualCost))
                        ) {
                          itineraryData[j].ticketAverage = itineraryActualCost;
                        }
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
                      var itineraryPerDiemPerCity;
                      if (!isNaN(itineraryData[j].perDiemPerCity)) {
                        itineraryPerDiemPerCity = parseFloat(
                          itineraryData[j].perDiemPerCity
                        );
                      } else {
                        if (itineraryData[j].perDiemPerCity.indexOf(",") > -1) {
                          itineraryPerDiemPerCity = parseFloat(
                            itineraryData[j].perDiemPerCity.replace(/\,/g, "")
                          );
                        } else {
                          itineraryPerDiemPerCity = parseFloat(
                            itineraryData[j].perDiemPerCity
                          );
                        }
                      }

                      var itineraryTicketAverage;
                      if (!isNaN(itineraryData[j].ticketAverage)) {
                        itineraryTicketAverage = parseFloat(
                          itineraryData[j].ticketAverage
                        );
                      } else {
                        if (itineraryData[j].ticketAverage.indexOf(",") > -1) {
                          itineraryTicketAverage = parseFloat(
                            itineraryData[j].ticketAverage.replace(/\,/g, "")
                          );
                        } else {
                          itineraryTicketAverage = parseFloat(
                            itineraryData[j].ticketAverage
                          );
                        }
                      }
                      memberPerDiemPerCity =
                        memberPerDiemPerCity + itineraryPerDiemPerCity;
                      memberTicketAverage =
                        memberTicketAverage + itineraryTicketAverage;
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
                      var itineraryPerDiemPerCity;
                      if (!isNaN(itineraryData[j].perDiemPerCity)) {
                        itineraryPerDiemPerCity = parseFloat(
                          itineraryData[j].perDiemPerCity
                        );
                      } else {
                        if (itineraryData[j].perDiemPerCity.indexOf(",") > -1) {
                          itineraryPerDiemPerCity = parseFloat(
                            itineraryData[j].perDiemPerCity.replace(/\,/g, "")
                          );
                        } else {
                          itineraryPerDiemPerCity = parseFloat(
                            itineraryData[j].perDiemPerCity
                          );
                        }
                      }

                      var itineraryTicketAverage;
                      if (!isNaN(itineraryData[j].ticketAverage)) {
                        itineraryTicketAverage = parseFloat(
                          itineraryData[j].ticketAverage
                        );
                      } else {
                        if (itineraryData[j].ticketAverage.indexOf(",") > -1) {
                          itineraryTicketAverage = parseFloat(
                            itineraryData[j].ticketAverage.replace(/\,/g, "")
                          );
                        } else {
                          itineraryTicketAverage = parseFloat(
                            itineraryData[j].ticketAverage
                          );
                        }
                      }

                      memberPerDiemPerCity =
                        memberPerDiemPerCity + itineraryPerDiemPerCity;
                      memberTicketAverage =
                        memberTicketAverage + itineraryTicketAverage;
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
                aInfo.totalExpense =
                  missionTicketAverage + missionPerDiemPerCity;
                aInfo.budgetAvailable = sectorAvailableBudget;

                var membersModel = new JSONModel({
                  members: mModelData,
                });
                that.setModel(membersModel, "membersModel");

                var missionInfoModel = new JSONModel({
                  info: aInfo,
                });

                that.setModel(missionInfoModel, "missionInfoModel");

                that.closeBusyFragment();

                that.alertMessage(
                  "S",
                  "successfulOperation",
                  "itineraryUpdated",
                  [],
                  {
                    showConfirmButton: true,
                    confirmCallbackFn: () => {
                      that.closeMission();
                    },
                  }
                );

                // MessageBox.success(
                //   "The itinerary details are updated successfully",
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
          }
        } else {
          that.alertMessage("E", "errorOperation", "sectorBudgetLowError", [],null);
          return;
          // MessageBox.error("The available budget of sector is low", {
          //   actions: [MessageBox.Action.CLOSE],
          //   onClose: async function (sAction) {},
          //   dependentOn: that.getView(),
          // });
        }
      },
    });
  }
);
