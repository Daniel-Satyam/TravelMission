sap.ui.define(
  [
    "ui5appstage/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/upload/Uploader",
    "ui5appstage/model/formatter",
    "sap/ui/core/date/UI5Date",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/util/Storage",
    "ui5appstage/model/formatter",
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

    return BaseController.extend("ui5appstage.controller.ClaimMission", {
      memberTotalPerDiem: 0,
      missionTotalPerdiem: 0,
      missionTotalTicketAverage: 0,

      onInit: function (evt) {
        this.initializeAppSettings(true);
        const oRouter = this.getRouter();
        oRouter
          .getRoute("claimmission")
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
        await this.initiateClaimAttachment();
        await this.initiateClaimModel();

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
          await this.initiateClaimAttachment();
          await this.initiateClaimModel();

          try {
            await this.getMasters();

            this.getMissionById();
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
            pageErrorMessage: this.getText("userNotFound"),
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
            decryptedDataParsed.keyVault.permission.mission.isClaimable != true
          ) {
            reject(false);
          } else {
            var screenModelData = {
              pageError: false,
              pageErrorMessage: null,
              isNormalMember: false,
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
            externalEntity2: "",
            externalEntity3: "",
            externalEntity4: "",
            externalEntity5: "",
            externalEntities: [],
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

          that.setModel(missionAttachmentsModel, "missionAttachmentsModel");

          resolve(true);
        });
      },

      initiateClaimAttachment: function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          var attachmentRows = [];

          var claimAttachmentsModel = new JSONModel({
            attachments: attachmentRows,
          });

          that.setModel(claimAttachmentsModel, "claimAttachmentsModel");

          resolve(true);
        });
      },

      initiateClaimModel: function () {
        const that = this;
        return new Promise(async function (resolve, reject) {
          var claimInfoModel = new JSONModel({
            info: {},
          });

          that.setModel(claimInfoModel, "claimInfoModel");

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
              var missionMember = false;

              var userIsCreator = false;

              var missionData = JSON.parse(data);

              var missionInfo = missionData.info;

              if (!missionInfo["approvedStartDate"]) {
                missionInfo["approvedStartDate"] = missionInfo["startDate"];
              }
              if (!missionInfo["approvedEndDate"]) {
                missionInfo["approvedEndDate"] = missionInfo["endDate"];
              }

              that.missionTotalPerdiem = missionInfo.totalPerDiemMission;
              that.missionTotalTicketAverage = missionInfo.ticketAverage;

              var auditInfo = missionData.auditLogs;

              for (var i = 0; i < auditInfo.length; i++) {
                if (
                  auditInfo[i].action == "Mission created" &&
                  auditInfo[i].user == decryptedDataParsed.keyVault.user.id
                ) {
                  userIsCreator = true;
                }
                auditInfo[i]["photo"] = await that.getPhoto(auditInfo[i].user);
              }

              var auditModel = new JSONModel({
                info: auditInfo,
              });

              that.setModel(auditModel, "auditModel");

              var mStartDtMin = null;
              var mEndDtMin = null;
              var mStartDtMax = null;
              var mEndDtMax = null;

              if (missionInfo["approvedStartDate"] != null) {
                mStartDtMin = new Date(missionInfo["approvedStartDate"]);
                mStartDtMax = new Date(missionInfo["approvedStartDate"]);
                mStartDtMin.setDate(mStartDtMin.getDate() - 1);
                mStartDtMax.setDate(mStartDtMax.getDate() + 1);
              }

              if (missionInfo["approvedEndDate"] != null) {
                mEndDtMin = new Date(missionInfo["approvedEndDate"]);
                mEndDtMax = new Date(missionInfo["approvedEndDate"]);
                mEndDtMin.setDate(mEndDtMin.getDate() - 1);
                mEndDtMax.setDate(mEndDtMax.getDate() + 1);
              }

              var missionInfoObj = {
                missionDescription: missionInfo.description,
                missionDetails: missionInfo.details,
                missionStartDate: formatter.formatDateUI(missionInfo.startDate),
                missionEndDate: formatter.formatDateUI(missionInfo.endDate),
                missionApprovedStartDate: formatter.formatDateUI(
                  missionInfo.approvedStartDate
                ),
                missionApprovedEndDate: formatter.formatDateUI(
                  missionInfo.approvedEndDate
                ),
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
                externalEntity2: missionInfo.externalEntity2,
                externalEntity3: missionInfo.externalEntity3,
                externalEntity4: missionInfo.externalEntity4,
                externalEntity5: missionInfo.externalEntity5,
                flightType: missionInfo.filightType,
                budgetParked: missionInfo.budgetParked,
                missionID: missionInfo.id,
                startDateMinDate: mStartDtMin,
                startDateMaxDate: mEndDtMax,
                endDateMinDate: mStartDtMin,
                endDateMaxDate: mEndDtMax,
              };

              //--Get external entities
              that.getExternalEntities(missionInfoObj);
              //--Get external entities
              
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

              that.setModel(missionAttachmentsModel, "missionAttachmentsModel");

              var membersArr = [];

              var aInfo = that.getModel("missionInfoModel").getData().info;

              for (var i = 0; i < missionData.members.length; i++) {
                var memberInfo = missionData.members[i];

                if (decryptedDataParsed.keyVault.user.id == memberInfo.id) {
                  that.memberTotalPerDiem = memberInfo.totalPerDiem;
                  missionMember = true;
                }

                var randomID = Formatter.createAttachmentID();

                if (decryptedDataParsed.keyVault.user.id == memberInfo.id) {
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

                    var startDtMin = null;
                    var endDtMin = null;
                    var startDtMax = null;
                    var endDtMax = null;

                    var iStartDate = null;
                    var iEndDate = null;

                    if(itineraryInfo.startDate != null) {
                     	iStartDate = new Date(itineraryInfo.startDate);
                     	iStartDate.setDate(iStartDate.getDate());
                    }
                    if(itineraryInfo.endDate != null) {
                      iEndDate = new Date(itineraryInfo.endDate);
                      iEndDate.setDate(iEndDate.getDate());
                   }

                    // var startDtModified = null;
                    // var endDtModified = null;
                    // if(itineraryInfo.startDate != null) {
                    // 	startDtModified = new Date(itineraryInfo.startDate);
                    // 	startDtModified.setDate(startDtModified.getDate());
                    // }

                    // if(itineraryInfo.endDate != null) {
                    // 	endDtModified = new Date(itineraryInfo.endDate);
                    // 	endDtModified.setDate(endDtModified.getDate());
                    // }

                    if (missionInfo["approvedStartDate"] != null && new Date(missionInfo["approvedStartDate"]).getTime() >= iStartDate.getTime()) {
                      startDtMin = new Date(missionInfo["approvedStartDate"]);
                      startDtMax = new Date(missionInfo["approvedStartDate"]);
                      startDtMin.setDate(startDtMin.getDate() - 1);
                      startDtMax.setDate(startDtMax.getDate() + 1);
                    }else{
                      startDtMin = new Date(missionInfo["approvedStartDate"]);
                      startDtMax = new Date(missionInfo["approvedEndDate"]);
                      startDtMin.setDate(startDtMin.getDate());
                      startDtMax.setDate(startDtMax.getDate());
                    }

                    if (missionInfo["approvedEndDate"] != null && new Date(missionInfo["approvedEndDate"]).getTime() <= iEndDate.getTime() ) {
                      endDtMin = new Date(missionInfo["approvedEndDate"]);
                      endDtMax = new Date(missionInfo["approvedEndDate"]);
                      endDtMin.setDate(endDtMin.getDate() - 1);
                      endDtMax.setDate(endDtMax.getDate() + 1);
                    }else{
                      endDtMin = new Date(missionInfo["approvedStartDate"]);
                      endDtMax = new Date(missionInfo["approvedEndDate"]);
                      endDtMin.setDate(endDtMin.getDate());
                      endDtMax.setDate(endDtMax.getDate());
                    }

                    var randomItineraryID = Formatter.createAttachmentID();
                    var itinieraryObj = {
                      id: randomItineraryID,
                      memberGUID: randomID,
                      city: itineraryInfo.city,
                      ticketType: itineraryInfo.ticketType,
                      startDate: formatter.formatDateUI(
                        itineraryInfo.startDate
                      ),
                      endDate: formatter.formatDateUI(itineraryInfo.endDate),
                      headOfMission: itineraryInfo.isHeadOfMission,
                      hospitalityDefault: itineraryInfo.hospitality,
                      perDiemPerCity: itineraryInfo.perDiemPerCity,
                      ticketAverage: itineraryInfo.ticketAverage,
                      ticketActualCost: itineraryInfo.ticketActualCost,
                      // "startDateMinDate": startDtModified,
                      // "startDateMaxDate": endDtModified,
                      // "endDateMinDate": startDtModified,
                      // "endDateMaxDate": endDtModified
                      startDateMinDate: startDtMin,
                      startDateMaxDate: endDtMax,
                      endDateMinDate: startDtMin,
                      endDateMaxDate: endDtMax,
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

              var screenModelData = that.getModel("screenModel").getData().info;

              if (
                decryptedDataParsed.keyVault.permission.mission.approve == false
              ) {
                if (userIsCreator == false) {
                  if (missionMember == true) {
                    screenModelData.isNormalMember = true;
                  }
                }
              }

              var body = {
                params: {
                  employeeId: decryptedDataParsed.keyVault.user.id,
                  missionId: missionInfo.id,
                },
              };

              var encData = await that.getEncryptedData(body);

              var url = "/fetchClaim";
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
                  var claimDecryptedData = await that.getDecryptedData(data);

                  var claimData = JSON.parse(claimDecryptedData);

                  var claimInfo = {
                    ...claimData.claim.d.results[0],
                    recoveryAmount:
                      claimData.recoveryAmount &&
                      claimData.recoveryAmount.d &&
                      claimData.recoveryAmount.d.results &&
                      claimData.recoveryAmount.d.results.length > 0
                        ? claimData.recoveryAmount.d.results[0].value
                        : null,
                  };

                  var claimInfoModel = new JSONModel({
                    info: claimInfo,
                  });

                  that.setModel(claimInfoModel, "claimInfoModel");

                  var claimAttachment = claimInfo.cust_attachmentNav;

                  var attachmentRows = [];

                  if (
                    claimAttachment &&
                    claimAttachment.fileName != null &&
                    claimAttachment.fileName != ""
                  ) {
                    var claimAttachmentObj = {
                      fileName: claimAttachment.fileName,
                      mimetype: claimAttachment.mimeType,
                      fileSize:
                        Math.round(
                          (parseFloat(claimAttachment.fileSize) / 1024) * 100
                        ) /
                          100 +
                        " KB",
                      file: claimAttachment.fileContent,
                    };
                    attachmentRows.push(claimAttachmentObj);
                  }

                  var claimAttachmentsModel = new JSONModel({
                    attachments: attachmentRows,
                  });

                  that.setModel(claimAttachmentsModel, "claimAttachmentsModel");
                },
                error: async function (jqXHR, textStatus, errorDesc) {},
              });

              that.finishLoading();
            },

            error: async function (jqXHR, textStatus, errorDesc) {
              var screenModelData = that.getModel("screenModel").getData().info;

              screenModelData.pageErrorMessage = that.getText("serverError");

              screenModelData.pageError = false;

              var screenModel = new JSONModel({
                info: screenModelData,
              });

              that.setModel(screenModel, "screenModel");

              that.finishLoading();

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
        let aInfo = oMissionInfoModel.getProperty("/info");

        const oMembersModel = this.getModel("membersModel");
        let membersModelData = oMembersModel.getProperty("/members");

        let currentDt = null;
        let datesValid = true;

        // startDateMinDate: mStartDtMin,
        // startDateMaxDate: mStartDtMax,
        // endDateMinDate: mEndDtMin,
        // endDateMaxDate: mEndDtMax,
        const oMember = _.find(membersModelData, ["guid", guid]);
        const oItinerary = _.find(oMember.itinerary, ["id", id]);
        const aItineraryOthers = _.filter(
          oMember.itinerary,
          (i) => i.id !== id
        );

        if (type == "start") {
          if (oItinerary) {
            currentDt = new Date(oItinerary.startDate);
          }

          aItineraryOthers.forEach((o) => {
              let startDt = new Date(o.startDate);
              let endDt = new Date(o.endDate);

              let diffTime = Math.abs(endDt - startDt);
              let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              let noOfDays = diffDays + 1;

              for (let k = 0; k < noOfDays; k++) {
                let newDate = new Date(startDt.getTime());
                newDate.setDate(newDate.getDate() + k);
                if (currentDt.getTime() === newDate.getTime()) {
                  datesValid = false;
                  break;
                }
              }
          });

          // for (var i = 0; i < membersModelData.length; i++) {
          //   if (membersModelData[i].guid == guid) {
          //     var memberItinerary = membersModelData[i].itinerary;

          //     for (var j = 0; j < memberItinerary.length; j++) {
          //       if (memberItinerary[j].id == id) {
          //         currentDt = new Date(memberItinerary[j].startDate);
          //       }
          //     }
          //   }
          // }

          // for (var i = 0; i < membersModelData.length; i++) {
          //   if (membersModelData[i].guid == guid) {
          //     var memberItinerary = membersModelData[i].itinerary;

          //     for (var j = 0; j < memberItinerary.length; j++) {
          //       if (memberItinerary[j].id != id) {
          //         var startDt = new Date(memberItinerary[j].startDate);

          //         var endDt = new Date(memberItinerary[j].endDate);

          //         var diffTime = Math.abs(endDt - startDt);

          //         var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          //         var noOfDays = diffDays + 1;

          //         for (var k = 0; k < noOfDays; k++) {
          //           var newDate = new Date(startDt.getTime());

          //           newDate.setDate(newDate.getDate() + k);

          //           if (currentDt.getTime() === newDate.getTime()) {
          //             datesValid = false;

          //             break;
          //           }
          //         }
          //       }
          //     }
          //   }
          // }

          if (datesValid == false) {
            this.alertMessage("E", "errorsFound", "overlapItineraryError", [], null);

            oItinerary.startDate = null;

            // MessageBox.error(
            //   "Please select any other date which is not overlap with other cities dates",
            //   {
            //     actions: [MessageBox.Action.CLOSE],

            //     onClose: async function (sAction) {},

            //     dependentOn: that.getView(),
            //   }
            // );

            // for (var i = 0; i < membersModelData.length; i++) {
            //   if (membersModelData[i].guid == guid) {
            //     var memberItinerary = membersModelData[i].itinerary;

            //     for (var j = 0; j < memberItinerary.length; j++) {
            //       if (memberItinerary[j].id == id) {
            //         memberItinerary[j].startDate = null;

            //         break;
            //       }
            //     }
            //   }
            // }
          } else {
            if (oItinerary.endDate != null) {
              let startDt = new Date(oItinerary.startDate);

              let endDt = new Date(oItinerary.endDate);

              if (startDt > endDt) {
                oItinerary.endDate = null;
              }
            }

            if (oItinerary.startDate != null) {
              let startDt = new Date(oItinerary.startDate);
              if (startDt.getTime() > oItinerary.endDateMinDate.getTime()) {
                oItinerary.endDateMinDate = UI5Date.getInstance(startDt);
              }
              if (startDt.getTime() > oItinerary.endDateMaxDate.getTime()) {
                oItinerary.endDateMaxDate = UI5Date.getInstance(startDt);
              }
            }

            // for (let i = 0; i < membersModelData.length; i++) {
            //   if (membersModelData[i].guid == guid) {
            //     var memberItinerary = membersModelData[i].itinerary;

            //     for (var j = 0; j < memberItinerary.length; j++) {
            //       if (memberItinerary[j].id == id) {

            //         if (memberItinerary[j].endDate != null) {
            //           var startDt = new Date(memberItinerary[j].startDate);

            //           var endDt = new Date(memberItinerary[j].endDate);

            //           if (startDt > endDt) {
            //             memberItinerary[j].endDate = null;
            //           }
            //         }

            //         if (memberItinerary[j].startDate != null) {
            //           var startDt = new Date(memberItinerary[j].startDate);

            //           memberItinerary[j].endDateMinDate =
            //             UI5Date.getInstance(startDt);
            //         }
            //       }
            //     }
            //   }
            // }
          }
        } else if (type == "end") {
          

          if(oItinerary){
            currentDt = new Date(oItinerary.endDate);
          }

          // for (var i = 0; i < membersModelData.length; i++) {
          //   if (membersModelData[i].guid == guid) {
          //     var memberItinerary = membersModelData[i].itinerary;

          //     for (var j = 0; j < memberItinerary.length; j++) {
          //       if (memberItinerary[j].id == id) {
          //         currentDt = new Date(memberItinerary[j].endDate);
          //       }
          //     }
          //   }
          // }

          aItineraryOthers.forEach((o) => {
              let startDt = new Date(o.startDate);
              let endDt = new Date(o.endDate);

              let diffTime = Math.abs(endDt - startDt);
              let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              let noOfDays = diffDays + 1;

              for (let k = 0; k < noOfDays; k++) {
                let newDate = new Date(startDt.getTime());
                newDate.setDate(newDate.getDate() + k);
                if (currentDt.getTime() === newDate.getTime()) {
                  datesValid = false;
                  break;
                }
              }
          });

          // for (var i = 0; i < membersModelData.length; i++) {
          //   if (membersModelData[i].guid == guid) {
          //     var memberItinerary = membersModelData[i].itinerary;

          //     for (var j = 0; j < memberItinerary.length; j++) {
          //       if (memberItinerary[j].id != id) {
          //         var startDt = new Date(memberItinerary[j].startDate);

          //         var endDt = new Date(memberItinerary[j].endDate);

          //         var diffTime = Math.abs(endDt - startDt);

          //         var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          //         var noOfDays = diffDays + 1;

          //         for (var k = 0; k < noOfDays; k++) {
          //           var newDate = new Date(startDt.getTime());

          //           newDate.setDate(newDate.getDate() + k);

          //           if (currentDt.getTime() === newDate.getTime()) {
          //             datesValid = false;

          //             break;
          //           }
          //         }
          //       }
          //     }
          //   }
          // }

          if (datesValid == false) {
            this.alertMessage("E", "errorsFound", "overlapItineraryError", [],null);

            oItinerary.endDate = null;
            // MessageBox.error(
            //   "Please select any other date which is not overlap with other cities dates",
            //   {
            //     actions: [MessageBox.Action.CLOSE],

            //     onClose: async function (sAction) {},

            //     dependentOn: that.getView(),
            //   }
            // );

            // for (var i = 0; i < membersModelData.length; i++) {
            //   if (membersModelData[i].guid == guid) {
            //     var memberItinerary = membersModelData[i].itinerary;

            //     for (var j = 0; j < memberItinerary.length; j++) {
            //       if (memberItinerary[j].id == id) {
            //         memberItinerary[j].endDate = null;

            //         break;
            //       }
            //     }
            //   }
            // }
          } else {

            if (oItinerary.startDate != null) {
              let startDt = new Date(oItinerary.startDate);

              let endDt = new Date(oItinerary.endDate);

              if (startDt > endDt) {
                oItinerary.startDate = null;
              }
            }

            if (oItinerary.endDate != null) {
              let endDt = new Date(oItinerary.endDate);
              if (endDt.getTime() < oItinerary.startDateMaxDate.getTime()) {
                oItinerary.startDateMaxDate = UI5Date.getInstance(endDt);
              }
              if (endDt.getTime() < oItinerary.startDateMinDate.getTime()) {
                oItinerary.startDateMinDate = UI5Date.getInstance(endDt);
              }
            }

            // for (var i = 0; i < membersModelData.length; i++) {
            //   if (membersModelData[i].guid == guid) {
            //     var memberItinerary = membersModelData[i].itinerary;

            //     for (var j = 0; j < memberItinerary.length; j++) {
            //       if (memberItinerary[j].id == id) {
            //         if (memberItinerary[j].startDate != null) {
            //           var startDt = new Date(memberItinerary[j].startDate);

            //           var endDt = new Date(memberItinerary[j].endDate);

            //           if (startDt > endDt) {
            //             memberItinerary[j].startDate = null;
            //           }
            //         }

            //         if (memberItinerary[j].endDate != null) {
            //           var endDt = new Date(memberItinerary[j].endDate);

            //           memberItinerary[j].startDateMaxDate =
            //             UI5Date.getInstance(endDt);
            //         }
            //       }
            //     }
            //   }
            // }
          }
        }

        // var membersModel = new JSONModel({
        //   members: membersModelData,
        // });

        // this.setModel(membersModel, "membersModel");

        oMembersModel.setProperty("/members", membersModelData);

        this.findTicketAndPerDiemPerCity(guid, id, oEvent);
      },

      findTicketAndPerDiemPerCity: async function (guid, id, oEvent) {
        const that = this;

        const envInfo = await this.getEnvInfo();

        var obj = {
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

        var mModelData = this.getModel("membersModel").getData().members;

        var aInfo = this.getModel("missionInfoModel").getData().info;

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

                obj.ticketType = itineraryData[j].ticketType;

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
          obj.payGrade != "" &&
          obj.ticketType != ""
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

              var membersModel = new JSONModel({
                members: mModelData,
              });

              that.setModel(membersModel, "membersModel");

              var missionInfoModel = new JSONModel({
                info: aInfo,
              });

              that.setModel(missionInfoModel, "missionInfoModel");

              that.closeBusyFragment();
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

      claimMission: async function () {
        const that = this;
        const decryptedDataParsed = await this.getTravelStorage();
        const envInfo = await this.getEnvInfo();

        const oMissionInfoModel = this.getModel("missionInfoModel");
        let aInfoCalculate = oMissionInfoModel.getProperty("/info");

        const oMembersModel = this.getModel("membersModel");
        let mModelDataCalculate = oMembersModel.getProperty("/members");

        const oClaimAttachmentsModel = this.getModel("claimAttachmentsModel");
        let attachments = oClaimAttachmentsModel.getProperty("/attachments");

        const oClaimInfoModel = this.getModel("claimInfoModel");
        let claimInfo = oClaimInfoModel.getProperty("/info");

        // var mModelDataCalculate =
        //   this.getModel("membersModel").getData().members;

        // var aInfoCalculate = this.getModel("missionInfoModel").getData().info;

        // var attachments = this.getModel("claimAttachmentsModel").getData()
        //   .attachments;

        // var claimInfo = this.getModel("claimInfoModel").getData().info;

        if (attachments.length > 0) {
          let sectorAvailableBudget = 0;
          let missionTicketAverage = parseFloat(this.missionTotalTicketAverage);
          let missionTotalPerdiem = parseFloat(this.missionTotalPerdiem);

          let body = {
            params: {
              sector: aInfoCalculate.sector,
            },
          };

          const encData = await that.getEncryptedData(body);

          const url = "/fetchSectorInfo";
          that.openBusyFragment();
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
              const sectorDecryptedData = await that.getDecryptedData(data);
              const sectorData = JSON.parse(sectorDecryptedData);

              sectorAvailableBudget = sectorData && sectorData.d &&
                sectorData.d.results[0].cust_Available_budget;

               const decree = that
                .getModel("missionAttachmentsModel")
                .getData().attachments;

              let obj = {
                missionId: aInfoCalculate.missionID,
                missionDescription: aInfoCalculate.missionDescription,
                employeeId: decryptedDataParsed.keyVault.user.id,
                byDelegate:
                  decryptedDataParsed.keyVault.masterUser.id !==
                  decryptedDataParsed.keyVault.user.id
                    ? `${decryptedDataParsed.keyVault.masterUser.firstName} ${decryptedDataParsed.keyVault.masterUser.lastName} (${decryptedDataParsed.keyVault.masterUser.id})`
                    : null,
                sector: aInfoCalculate.sector,
                date: "/Date(" + new Date().getTime() + ")/",
                claimAmount: 0,
                claimParked: 0,
                missionTotalTicketCost: 0,
                missionTotalExpense: 0,
                missionTotalPerdiem: 0,
                memberTotalTicketCost: 0,
                memberTotalPerDiem: 0,
                memberTotalExpense: 0,
                sectorAvailableBudget: 0,
                itinerary: [],
                location: aInfoCalculate.destination,
                type: "10",
                status: "2",
                attachments: [],
                decreeAttachments: decree,
                claimStartDate: null,
                claimEndDate: null,
                claimUpdate: false,
              };
              let claimStDate = null;
                let claimEnDate = null;
              for (let i = 0; i < mModelDataCalculate.length; i++) {
                obj.employeeId = mModelDataCalculate[i].employeeID;
                let itineraryData = mModelDataCalculate[i].itinerary;
                
                for (let j = 0; j < itineraryData.length; j++) {
                  let hoursToAdd = 12 * 60 * 60 * 1000;
                  let itineraryStartDate = new Date(itineraryData[j].startDate);
                  itineraryStartDate.setTime(
                    itineraryStartDate.getTime() + hoursToAdd
                  );
                  let itineraryEndDate = new Date(itineraryData[j].endDate);
                  itineraryEndDate.setTime(
                    itineraryEndDate.getTime() + hoursToAdd
                  );

                  if (claimStDate == null) {
                    claimStDate = itineraryStartDate;
                  } else {
                    if (claimStDate.getTime() > itineraryStartDate.getTime()) {
                      claimStDate = itineraryStartDate;
                    }
                  }

                  if (claimEnDate == null) {
                    claimEnDate = itineraryEndDate;
                  } else {
                    if (itineraryEndDate.getTime() > claimEnDate.getTime()) {
                      claimEnDate = itineraryEndDate;
                    }
                  }

                  let itineraryPerDiem;
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
                  let itineraryTicketAverage;
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
                  let itineraryObj = {
                    itineraryStartDate:
                      "/Date(" + itineraryStartDate.getTime() + ")/",
                    itineraryEndDate:
                      "/Date(" + itineraryEndDate.getTime() + ")/",
                    itineraryCity: itineraryData[j].city,
                    itinerayPerDiem: itineraryPerDiem,
                    itinerayTicketAverage: itineraryTicketAverage,
                  };

                  obj.itinerary.push(itineraryObj);
                }
              }

              obj.claimStartDate = "/Date(" + claimStDate.getTime() + ")/";
              obj.claimEndDate = "/Date(" + claimEnDate.getTime() + ")/";

              let memberTicketAverageCalculate = 0;
              let memberPerDiemPerCityCalculate = 0;

              for (let i = 0; i < mModelDataCalculate.length; i++) {
                memberTicketAverageCalculate = 0;
                memberPerDiemPerCityCalculate = 0;
                let itineraryData = mModelDataCalculate[i].itinerary;
                for (let j = 0; j < itineraryData.length; j++) {
                  let itineraryPerDiem;
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
                  let itineraryTicketAverage;
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
                    memberPerDiemPerCityCalculate + itineraryPerDiem;
                  memberTicketAverageCalculate =
                    memberTicketAverageCalculate + itineraryTicketAverage;
                }
                mModelDataCalculate[i].employeeTotalPerdiem =
                  memberPerDiemPerCityCalculate;
                mModelDataCalculate[i].employeeTotalTicket =
                  memberTicketAverageCalculate;
                mModelDataCalculate[i].employeeTotalExpense =
                  memberPerDiemPerCityCalculate + memberTicketAverageCalculate;
                obj.memberTotalTicketCost = memberTicketAverageCalculate;
                obj.memberTotalPerDiem = memberPerDiemPerCityCalculate;
                obj.memberTotalExpense =
                  memberPerDiemPerCityCalculate + memberTicketAverageCalculate;
                obj.claimAmount = memberPerDiemPerCityCalculate;
              }

              obj.missionTotalTicketCost = missionTicketAverage;

              for (let l = 0; l < attachments.length; l++) {
                let attachmentRequest = {
                  file: "",
                  fileName: "",
                  fileSize: 0,
                  mimetype: "",
                };
                attachmentRequest.file = attachments[l].file;
                attachmentRequest.fileName = attachments[l].fileName;
                attachmentRequest.fileSize = attachments[l].fileSize;
                attachmentRequest.mimetype = attachments[l].mimetype;
                obj.attachments.push(attachmentRequest);
              }

              let memberPerDiemDifference =
                parseFloat(that.memberTotalPerDiem) -
                parseFloat(obj.memberTotalPerDiem);

              if (claimInfo && claimInfo.cust_Claim_Parked) {
                obj.claimParked =
                  parseFloat(claimInfo.cust_Claim_Parked) +
                  memberPerDiemDifference;
                obj.claimUpdate = true;
              } else {
                obj.claimParked = memberPerDiemDifference;
              }

              if (memberPerDiemDifference >= 0) {
                obj.sectorAvailableBudget =
                  parseFloat(sectorAvailableBudget) +
                  Math.abs(parseFloat(memberPerDiemDifference));
                obj.missionTotalPerdiem =
                  missionTotalPerdiem -
                  Math.abs(parseFloat(memberPerDiemDifference));
              } else {
                obj.sectorAvailableBudget =
                  parseFloat(sectorAvailableBudget) -
                  Math.abs(parseFloat(memberPerDiemDifference));
                obj.missionTotalPerdiem =
                  missionTotalPerdiem +
                  Math.abs(parseFloat(memberPerDiemDifference));
              }

              obj.missionTotalExpense =
                obj.missionTotalTicketCost + obj.missionTotalPerdiem;

              if (obj.sectorAvailableBudget >= 0) {
                const requestBody = {
                  params: obj,
                };

                //var encryptedData = await that.getEncryptedData(requestBody);
                const url = "/claimMission";
                that.openBusyFragment();
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

                    that.alertMessage("S",
                      "successfulOperation",
                      "claimSubmitted",
                      [],
                      null
                    );
                    // MessageBox.success(
                    //   "The claim has been submitted successfully",
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
              } else {
                that.closeBusyFragment();
                that.alertMessage("E", "errorOperation", "sectorBudgetLowError", [],null);
                // MessageBox.error("The available budget of sector is low", {
                //   actions: [MessageBox.Action.CLOSE],
                //   onClose: async function (sAction) {},
                //   dependentOn: that.getView(),
                // });
              }
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
        } else {
          that.closeBusyFragment();
          that.alertMessage("E", "errorOperation", "uploadValidAttachment", [],null);
  

          // MessageBox.error("Please upload valid attachment", {
          //   actions: [MessageBox.Action.CLOSE],
          //   onClose: async function (sAction) {},
          //   dependentOn: that.getView(),
          // });
        }
      },

      arrayBufferToBase64: function (buffer) {
        var binary = "";
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      },

      _handleRawFileClaim: function (oFile) {
        const that = this;

        var oFileRaw = {
          name: oFile.name,
          mimetype: oFile.type,
          size: oFile.size,
          createdAt: oFile.lastModified,
          data: null,
        };

        var reader = new FileReader();

        reader.onload = function (e) {
          oFileRaw.data = this.arrayBufferToBase64(e.target.result);

          var claimAttachmentsModelData = that
            .getModel("claimAttachmentsModel")
            .getData().attachments;

          var claimAttachmentObj = {
            fileName: oFileRaw.name,
            mimetype: oFileRaw.mimetype,
            fileSize: oFileRaw.size,
            file: oFileRaw.data,
          };

          claimAttachmentsModelData.push(claimAttachmentObj);

          var claimAttachmentsModel = new JSONModel({
            attachments: claimAttachmentsModelData,
          });

          that.setModel(claimAttachmentsModel, "claimAttachmentsModel");
        }.bind(that);

        reader.readAsArrayBuffer(oFile);
      },

      onClaimAttachmentAdd: function (oEvent) {
        var oFileUploadComponent = oEvent
          .getParameters("items")
          .item.getFileObject();

        if (oFileUploadComponent) {
          if (
            oFileUploadComponent.type == "application/pdf" ||
            oFileUploadComponent.type == "text/plain" ||
            oFileUploadComponent.type == "image/png" ||
            oFileUploadComponent.type == "image/jpeg" ||
            oFileUploadComponent.type ==
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          ) {
            this._handleRawFileClaim(oFileUploadComponent);
            oEvent.getSource().getList().removeAllItems();
          } else {
            oEvent.getSource().getList().removeAllItems();
          }
        }
      },

      onClaimAttachmentRemove: function (oEvent) {
        oEvent.preventDefault();

        var oFileUploadComponent = oEvent.getSource().mProperties;

        if (oFileUploadComponent) {
          var oFileUploadComponentName = oFileUploadComponent.fileName;
          var oFileUploadComponentUrl = oFileUploadComponent.url;

          var claimAttachmentsModelData = this.getModel(
            "claimAttachmentsModel"
          ).getData().attachments;

          for (var j = claimAttachmentsModelData.length - 1; j >= 0; j--) {
            if (
              claimAttachmentsModelData[j].fileName ==
                oFileUploadComponentName &&
              claimAttachmentsModelData[j].file == oFileUploadComponentUrl
            ) {
              claimAttachmentsModelData.splice(j, 1);
            }
          }

          var claimAttachmentsModel = new JSONModel({
            attachments: claimAttachmentsModelData,
          });

          this.setModel(claimAttachmentsModel, "claimAttachmentsModel");
        }
      },

      onAttachmentMimeTypeMismatch: function () {
        const that = this;

        this.alertMessage("E", "errorOperation", "attachmentFiletypeMismatch", [],null);

        // MessageBox.error("Please select only txt,png,pdf,jpg,xlsx file types", {
        //   actions: [MessageBox.Action.CLOSE],
        //   onClose: function (sAction) {},
        //   dependentOn: that.getView(),
        // });
      },
    });
  }
);
