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

    return BaseController.extend("ui5app.controller.ApproveMission", {
      onInit: function (evt) {
        this.initializeAppSettings(true);
        const oRouter = this.getRouter();
        oRouter
          .getRoute("approvemission")
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
        this.startLoading();
        const that = this;
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

            this.getMissionById();
          } catch (e) {
            this.finishLoading();
            if (e.status == 401) {
              that.closeMission();
            }
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
          if (decryptedDataParsed.keyVault.permission.mission.approve != true) {
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

              that
                .getView()
                .setModel(missionAttachmentsModel, "missionAttachmentsModel");

              var membersArr = [];

              for (var i = 0; i < missionData.members.length; i++) {
                var memberInfo = missionData.members[i];

                var memberObj = {
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

                  var itinieraryObj = {
                    city: itineraryInfo.city,
                    ticketType: itineraryInfo.ticketType,
                    startDate: formatter.formatDateUI(itineraryInfo.startDate),
                    endDate: formatter.formatDateUI(itineraryInfo.endDate),
                    headOfMission: itineraryInfo.isHeadOfMission,
                    hospitalityDefault: itineraryInfo.hospitality,
                    perDiemPerCity: itineraryInfo.perDiemPerCity,
                    ticketAverage: itineraryInfo.ticketAverage,
                    ticketActualCost: itineraryInfo.ticketActualCost,
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

              that.finishLoading();
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

      approveMission: async function (oEvent) {
        const that = this;

        const envInfo = await that.getEnvInfo();

        const decryptedDataParsed = await that.getTravelStorage();

        var payload = that.getModel("approveModel").getData();

        payload.approverId = decryptedDataParsed.keyVault.user.id;
        payload.byDelegate =
          decryptedDataParsed.keyVault.masterUser.id !==
          decryptedDataParsed.keyVault.user.id
            ? `${decryptedDataParsed.keyVault.masterUser.firstName} ${decryptedDataParsed.keyVault.masterUser.lastName} (${decryptedDataParsed.keyVault.masterUser.id})`
            : null;
        payload.approverName =
          decryptedDataParsed.keyVault.user.firstName +
          " " +
          decryptedDataParsed.keyVault.user.lastName;
        payload.action = "1";

        if (payload.byDelegate) {
          payload.comment =
            payload.comment + ` Approved by delegate ${payload.byDelegate}`;
          payload.comment.trim();
        }

        var obj = {
          payload: payload,
          mission: that.missionId,
        };

        that.openBusyFragment();
        jQuery.ajax({
          type: "POST",
          url: "/approveRejectMission",
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
            data: obj,
          }),
          success: async function (data, textStatus, jqXHR) {
            that.closeBusyFragment();
            that.alertMessage("S",
              "successfulOperation",
              "travelMissionApprovedBy",
              [`${decryptedDataParsed.keyVault.user.firstName} ${decryptedDataParsed.keyVault.user.lastName}`],
              { 
                showConfirmButton: true,
                confirmCallbackFn: async ()=>{
                  await that.initializeModel();
                  await that.initiateDynamicMembers();
                  await that.initiateMissionAttachment();
                  const oRouter = that.getOwnerComponent().getRouter();
                  oRouter.navTo("index");
                }
              }
            );
            // MessageBox.success(
            //   "The travel mission is approved by " +
            //     decryptedDataParsed.keyVault.user.firstName +
            //     " " +
            //     decryptedDataParsed.keyVault.user.lastName,
            //   {
            //     actions: [MessageBox.Action.CLOSE],
            //     onClose: async function (sAction) {
            //       await that.initializeModel();
            //       await that.initiateDynamicMembers();
            //       await that.initiateMissionAttachment();
            //       const oRouter = that.getOwnerComponent().getRouter();
            //       oRouter.navTo("index");
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

      sendBackMission: async function (oEvent) {
        const that = this;

        const envInfo = await that.getEnvInfo();

        const decryptedDataParsed = await that.getTravelStorage();

        var payload = that.getModel("approveModel").getData();

        payload.approverId = decryptedDataParsed.keyVault.user.id;
        payload.byDelegate =
          decryptedDataParsed.keyVault.masterUser.id !==
          decryptedDataParsed.keyVault.user.id
            ? `${decryptedDataParsed.keyVault.masterUser.firstName} ${decryptedDataParsed.keyVault.masterUser.lastName} (${decryptedDataParsed.keyVault.masterUser.id})`
            : null;
        payload.approverName =
          decryptedDataParsed.keyVault.user.firstName +
          " " +
          decryptedDataParsed.keyVault.user.lastName;
        payload.action = "5";

        if (payload.byDelegate) {
          payload.comment =
            payload.comment + ` Sent back by delegate ${payload.byDelegate}`;
          payload.comment.trim();
        }

        var obj = {
          payload: payload,
          mission: that.missionId,
        };
        that.openBusyFragment();
        jQuery.ajax({
          type: "POST",
          url: "/approveRejectMission",
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
            data: obj,
          }),
          success: async function (data, textStatus, jqXHR) {
            that.closeBusyFragment();
            that.alertMessage("S",
              "successfulOperation",
              "travelMissionSentBackBy",
              [`${decryptedDataParsed.keyVault.user.firstName} ${decryptedDataParsed.keyVault.user.lastName}`],
              { 
                showConfirmButton: true,
                confirmCallbackFn: async ()=>{
                  await that.initializeModel();
                  await that.initiateDynamicMembers();
                  await that.initiateMissionAttachment();
                  const oRouter = that.getOwnerComponent().getRouter();
                  oRouter.navTo("index");
                }
              }
            );
            // MessageBox.success(
            //   "The travel mission is sent back by " +
            //     decryptedDataParsed.keyVault.user.firstName +
            //     " " +
            //     decryptedDataParsed.keyVault.user.lastName,
            //   {
            //     actions: [MessageBox.Action.CLOSE],
            //     onClose: async function (sAction) {
            //       await that.initializeModel();
            //       await that.initiateDynamicMembers();
            //       await that.initiateMissionAttachment();
            //       const oRouter = that.getOwnerComponent().getRouter();
            //       oRouter.navTo("index");
            //     },
            //     dependentOn: that.getView(),
            //   }
            // );
          },
          error: async function (jqXHR, textStatus, errorDesc) {
            that.closeBusyFragment();
            that.alertMessage("E", "errorOperation", "serverError", [],null);
            // MessageBox.error("Something went wrong", {
            //   actions: [MessageBox.Action.CLOSE],
            //   onClose: function (sAction) {},
            //   dependentOn: that.getView(),
            // });
          },
        });
      },

      rejectMission: async function (mission) {
        const that = this;

        const envInfo = await that.getEnvInfo();

        const decryptedDataParsed = await that.getTravelStorage();

        var payload = that.getModel("approveModel").getData();

        payload.approverId = decryptedDataParsed.keyVault.user.id;
        payload.byDelegate =
          decryptedDataParsed.keyVault.masterUser.id !==
          decryptedDataParsed.keyVault.user.id
            ? `${decryptedDataParsed.keyVault.masterUser.firstName} ${decryptedDataParsed.keyVault.masterUser.lastName} (${decryptedDataParsed.keyVault.masterUser.id})`
            : null;
        payload.approverName =
          decryptedDataParsed.keyVault.user.firstName +
          " " +
          decryptedDataParsed.keyVault.user.lastName;
        payload.action = "3";

        if (payload.byDelegate) {
          payload.comment = payload.comment + ` Rejected by delegate ${payload.byDelegate}`;
          payload.comment.trim();
        }

        var obj = {
          payload: payload,
          mission: that.missionId,
          date: "/Date(" + new Date().getTime() + ")/",
        };

        return new Promise(async function (resolve, reject) {
          that.openBusyFragment();
          jQuery.ajax({
            type: "POST",
            url: "/rejectMission",
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
              that.closeBusyFragment();
              that.alertMessage("S",
                "successfulOperation",
                "travelMissionRejectedBy",
                [`${decryptedDataParsed.keyVault.user.firstName} ${decryptedDataParsed.keyVault.user.lastName}`],
                { 
                  showConfirmButton: true,
                  confirmCallbackFn: async ()=>{
                    await that.initializeModel();
                    await that.initiateDynamicMembers();
                    await that.initiateMissionAttachment();
                    const oRouter = that.getOwnerComponent().getRouter();
                    oRouter.navTo("index");
                  }
                }
              );
              // MessageBox.success("The mission has been rejected", {
              //   actions: [MessageBox.Action.CLOSE],
              //   onClose: async function (sAction) {
              //     await that.initializeModel();
              //     await that.initiateDynamicMembers();
              //     await that.initiateMissionAttachment();
              //     const oRouter = that.getOwnerComponent().getRouter();
              //     oRouter.navTo("index");
              //   },
              //   dependentOn: that.getView(),
              // });
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              that.closeBusyFragment();
              that.alertMessage("E", "errorOperation", "serverError", [],null);
              // MessageBox.error("Something went wrong", {
              //   actions: [MessageBox.Action.CLOSE],
              //   onClose: function (sAction) {},
              //   dependentOn: that.getView(),
              // });
            },
          });
        });
      },
    });
  }
);
