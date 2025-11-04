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

    return BaseController.extend("ui5app.controller.AdvanceMission", {
      missionTotalPerdiem: 0,

      onInit: function (evt) {
        this.initializeAppSettings(true);
        const oRouter = this.getRouter();
        oRouter
          .getRoute("advancemission")
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
          await this.initiateAdvanceModel();

          try {
            await this.getMasters();

            this.getMissionById();
          } catch (e) {
            this.finishLoading();
            this.alertMessage(
              "E",
              "errorOperation",
              "sessionExpired",
              [],
              null
            );
            // MessageBox.error("The session is expired. Please refresh.", {
            // 	actions: [MessageBox.Action.CLOSE],
            // 	onClose: async function (sAction) {
            // 		that.closeMission();
            // 	},
            // 	dependentOn: that.getView()
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
            decryptedDataParsed.keyVault.permission.mission.isAdvance != true
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

          that.setModel(missionAttachmentsModel, "missionAttachmentsModel");

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
				externalEntity2: missionInfo.externalEntity2,
                externalEntity3: missionInfo.externalEntity3,
                externalEntity4: missionInfo.externalEntity4,
                externalEntity5: missionInfo.externalEntity5,
                flightType: missionInfo.filightType,
                budgetParked: missionInfo.budgetParked,
                missionID: missionInfo.id,
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
                    var startDtModified = null;
                    var endDtModified = null;
                    if (itineraryInfo.startDate != null) {
                      startDtModified = new Date(itineraryInfo.startDate);
                      startDtModified.setDate(startDtModified.getDate());
                    }

                    if (itineraryInfo.endDate != null) {
                      endDtModified = new Date(itineraryInfo.endDate);
                      endDtModified.setDate(endDtModified.getDate());
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
                      startDateMinDate: startDtModified,
                      startDateMaxDate: endDtModified,
                      endDateMinDate: startDtModified,
                      endDateMaxDate: endDtModified,
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

              var url = "/fetchAdvance";
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

                  var advanceInfoModel = new JSONModel({
                    info: advanceInfo,
                  });

                  that.setModel(advanceInfoModel, "advanceInfoModel");
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

      advanceMission: async function () {
        const that = this;

        const decryptedDataParsed = await this.getTravelStorage();

        const envInfo = await this.getEnvInfo();

        var mModelDataCalculate =
          this.getModel("membersModel").getData().members;

        var aInfoCalculate = this.getModel("missionInfoModel").getData().info;

        var decree = this.getModel("missionAttachmentsModel").getData()
          .attachments;

        var obj = {
          missionId: aInfoCalculate.missionID,
          missionDescription: aInfoCalculate.missionDescription,
          employeeId: decryptedDataParsed.keyVault.user.id,
          byDelegate:
            decryptedDataParsed.keyVault.masterUser.id !==
            decryptedDataParsed.keyVault.user.id
              ? `${decryptedDataParsed.keyVault.masterUser.firstName} ${decryptedDataParsed.keyVault.masterUser.lastName} (${decryptedDataParsed.keyVault.masterUser.id})`
              : null,
          date: "/Date(" + new Date().getTime() + ")/",
          advanceAmount: 0,
          memberTotalPerDiem: 0,
          location: aInfoCalculate.destination,
          status: "2",
          decreeAttachments: decree,
          advanceStartDate: null,
          advanceEndDate: null,
        };

        var memberPerDiemPerCityCalculate = 0;

        for (var i = 0; i < mModelDataCalculate.length; i++) {
          memberPerDiemPerCityCalculate = 0;
          var advanceStDate = null;
          var advanceEnDate = null;
          var itineraryData = mModelDataCalculate[i].itinerary;
          for (var j = 0; j < itineraryData.length; j++) {
            var hoursToAdd = 12 * 60 * 60 * 1000;
            var itineraryStartDate = new Date(itineraryData[j].startDate);
            itineraryStartDate.setTime(
              itineraryStartDate.getTime() + hoursToAdd
            );
            var itineraryEndDate = new Date(itineraryData[j].endDate);
            itineraryEndDate.setTime(itineraryEndDate.getTime() + hoursToAdd);

            if (advanceStDate == null) {
              advanceStDate = itineraryStartDate;
            } else {
              if (advanceStDate.getTime() > itineraryStartDate.getTime()) {
                advanceStDate = itineraryStartDate;
              }
            }

            if (advanceEnDate == null) {
              advanceEnDate = itineraryEndDate;
            } else {
              if (itineraryEndDate.getTime() > claimEnDate.getTime()) {
                advanceEnDate = itineraryEndDate;
              }
            }

            var itineraryPerDiem;
            if (!isNaN(itineraryData[j].perDiemPerCity)) {
              itineraryPerDiem = parseFloat(itineraryData[j].perDiemPerCity);
            } else {
              if (itineraryData[j].perDiemPerCity.indexOf(",") > -1) {
                itineraryPerDiem = parseFloat(
                  itineraryData[j].perDiemPerCity.replace(/\,/g, "")
                );
              } else {
                itineraryPerDiem = parseFloat(itineraryData[j].perDiemPerCity);
              }
            }
            memberPerDiemPerCityCalculate =
              memberPerDiemPerCityCalculate + itineraryPerDiem;
          }
          obj.memberTotalPerDiem = memberPerDiemPerCityCalculate;
        }

        obj.advanceStartDate = "/Date(" + advanceStDate.getTime() + ")/";
        obj.advanceEndDate = "/Date(" + advanceEnDate.getTime() + ")/";

        if (aInfoCalculate.noOfDays >= 5 && aInfoCalculate.noOfDays <= 14) {
          obj.advanceAmount = (parseFloat(obj.memberTotalPerDiem) * 50) / 100;
        } else if (aInfoCalculate.noOfDays > 14) {
          obj.advanceAmount = (parseFloat(obj.memberTotalPerDiem) * 70) / 100;
        }

        var requestBody = {
          params: obj,
        };

        var encryptedData = await that.getEncryptedData(requestBody);
        var decryptedData = await that.getDecryptedData(encryptedData);

        console.log(decryptedData);

        var url = "/advanceMission";
        that.openBusyFragment();
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
            that.alertMessage(
              "S",
              "successfulOperation",
              "advanceSubmitted",
              [],
              null
            );

            // MessageBox.success("The advance has been submitted successfully", {
            // 	actions: [MessageBox.Action.CLOSE],
            // 	onClose: async function (sAction) {
            // 		that.closeMission();
            // 	},
            // 	dependentOn: that.getView()
            // });
          },
          error: async function (jqXHR, textStatus, errorDesc) {
            that.closeBusyFragment();
            if (jqXHR.status == 401) {
              that.closeMission();
            } else {
              that.alertMessage("E", "errorOperation", "serverError", [], null);
              // MessageBox.error("Something went wrong", {
              // 	actions: [MessageBox.Action.CLOSE],
              // 	onClose: function (sAction) {

              // 	},
              // 	dependentOn: that.getView()
              // });
            }
          },
        });
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
    });
  }
);
