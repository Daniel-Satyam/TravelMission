/*global _*/
sap.ui.define(
  [
    "ui5appuat/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/upload/Uploader",
    "ui5appuat/model/formatter",
    "sap/ui/core/date/UI5Date",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/util/Storage",
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
    Storage
  ) {
    "use strict";

    return BaseController.extend("ui5appuat.controller.CreateMission", {
      onInit: function (evt) {
        this.initializeAppSettings(true);
        const oRouter = this.getRouter();
        oRouter
          .getRoute("createmission")
          .attachMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function (oEvent) {
        this.initialize();
      },

      closeMission: async function () {
        await this.initializeModel();
        await this.initiateDynamicMembers();
        await this.initiateMissionAttachment();
        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.navTo("index");
      },

      resetMission: async function () {
        await this.initializeModel();
        await this.initiateDynamicMembers();
        await this.initiateMissionAttachment();
      },

      initialize: async function () {
        const oErrorModel = new JSONModel({
          missionErrors: [],
        });
        this.setModel(oErrorModel, "errorModel");

        this.startLoading();
        try {
          await this.preInitializeModel();

          await this.initializeModel();
          await this.initiateDynamicMembers();
          await this.initiateMissionAttachment();

          await this.getMasters();
          this.finishLoading();
        } catch (e) {
          this.finishLoading();
          var screenModelData = {
            pageError: true,
            pageErrorMessage: this.getView()
              .getModel("i18n")
              .getResourceBundle()
              .getText("userNotFound"),
            validationError: false,
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
          if (decryptedDataParsed.keyVault.permission.create != true) {
            reject(false);
          } else {
            var screenModelData = {
              pageError: false,
              pageErrorMessage: null,
              validationError: false,
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
            missionDetails: "",
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
            externalEntity2: "",
            externalEntity3: "",
            externalEntity4: "",
            externalEntity5: "",
            externalEntities: [],
            flightType: "",
            budgetParked: 0,
            missionID: "",
            members: [],
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
          var aInfo = that
            .getView()
            .getModel("missionInfoModel")
            .getData().info;

          var startDtModified = null;
          var endDtModified = null;
          if (aInfo.missionStartDate != null) {
            startDtModified = new Date(aInfo.missionStartDate);
            startDtModified.setDate(startDtModified.getDate());
          }
          if (aInfo.missionEndDate != null) {
            endDtModified = new Date(aInfo.missionEndDate);
            endDtModified.setDate(endDtModified.getDate());
          }

          var rows = [
            {
              guid: 1,
              removable: false,
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
              itinerary: [
                {
                  id: "1",
                  buttonsVisibility: {
                    add: false,
                    delete: false,
                  },
                  memberGUID: 1,
                  city: "",
                  ticketType: "",
                  startDate: null,
                  endDate: null,
                  startDateMinDate: startDtModified,
                  startDateMaxDate: endDtModified,
                  endDateMinDate: startDtModified,
                  endDateMaxDate: endDtModified,
                  headOfMission: "",
                  hospitalityDefault: aInfo.hospitality_Type,
                  perDiemPerCity: 0,
                  ticketAverage: 0,
                  ticketActualCost: 0,
                  reflectBudgetInfo: false,
                },
              ],
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

      updateItineraryCity: function (oEvent) {
        const oValidatedComboBox = oEvent.getSource();
        const sSelectedKey = oValidatedComboBox.getSelectedKey();
        const membersModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        for (var i = 0; i < membersModelData.length; i++) {
          const memberItinerary = membersModelData[i].itinerary;
          for (var j = 0; j < memberItinerary.length; j++) {
            if (memberItinerary[j].id == "1") {
              memberItinerary[j].city = sSelectedKey;
            }
          }
        }

        var membersModel = new JSONModel({
          members: membersModelData,
        });

        this.setModel(membersModel, "membersModel");

        for (var i = 0; i < membersModelData.length; i++) {
          const guid = membersModelData[i].guid;
          const memberItinerary = membersModelData[i].itinerary;
          for (var j = 0; j < memberItinerary.length; j++) {
            if (memberItinerary[j].id == "1") {
              this.findTicketAndPerDiemPerCity(
                guid,
                memberItinerary[j].id,
                null,
                null
              );
            }
          }
        }
      },

      updateHospitality: function (oEvent) {
        const that = this;
        const oValidatedComboBox = oEvent.getSource();
        const sSelectedKey = oValidatedComboBox.getSelectedKey();

        const membersModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        for (var i = 0; i < membersModelData.length; i++) {
          var memberItinerary = membersModelData[i].itinerary;
          for (var j = 0; j < memberItinerary.length; j++) {
            if (memberItinerary[j].id == "1") {
              memberItinerary[j].hospitalityDefault = sSelectedKey;
            }
          }
        }

        var membersModel = new JSONModel({
          members: membersModelData,
        });

        this.setModel(membersModel, "membersModel");

        for (var i = 0; i < membersModelData.length; i++) {
          var guid = membersModelData[i].guid;
          var memberItinerary = membersModelData[i].itinerary;
          for (var j = 0; j < memberItinerary.length; j++) {
            if (memberItinerary[j].id == "1") {
              that.findTicketAndPerDiemPerCity(
                guid,
                memberItinerary[j].id,
                null,
                null
              );
            }
          }
        }
      },

      handleMissionDatesChange: function (type, oEvent) {
        var aInfo = this.getModel("missionInfoModel").getData().info;

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

        var missionInfoModel = new JSONModel({
          info: aInfo,
        });

        this.setModel(missionInfoModel, "missionInfoModel");

        var membersModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        for (var i = 0; i < membersModelData.length; i++) {
          var memberItinerary = membersModelData[i].itinerary;
          for (var j = 0; j < memberItinerary.length; j++) {
            if (memberItinerary[j].id == "1") {
              if (aInfo.missionStartDate != null) {
                memberItinerary[j].startDate = aInfo.missionStartDate;
              }
              if (aInfo.missionEndDate != null) {
                memberItinerary[j].endDate = aInfo.missionEndDate;
              }
            } else {
              memberItinerary[j].startDate = null;
              memberItinerary[j].endDate = null;
            }

            if (aInfo.missionStartDate != null) {
              var startDt = new Date(aInfo.missionStartDate);
              startDt.setDate(startDt.getDate());
              memberItinerary[j].startDateMinDate =
                UI5Date.getInstance(startDt);
              memberItinerary[j].endDateMinDate = UI5Date.getInstance(startDt);
            }

            if (aInfo.missionEndDate != null) {
              var endDt = new Date(aInfo.missionEndDate);
              endDt.setDate(endDt.getDate());
              memberItinerary[j].startDateMaxDate = UI5Date.getInstance(endDt);
              memberItinerary[j].endDateMaxDate = UI5Date.getInstance(endDt);
            }
          }
        }

        var membersModel = new JSONModel({
          members: membersModelData,
        });

        this.setModel(membersModel, "membersModel");

        for (var i = 0; i < membersModelData.length; i++) {
          const guid = membersModelData[i].guid;
          const memberItinerary = membersModelData[i].itinerary;
          for (var j = 0; j < memberItinerary.length; j++) {
            if (memberItinerary[j].id == "1") {
              this.findTicketAndPerDiemPerCity(
                guid,
                memberItinerary[j].id,
                null,
                null
              );
            }
          }
        }
      },

      handleItineraryDatesChange: function (type, guid, id, oEvent) {
        const that = this;

        var aInfo = this.getModel("missionInfoModel").getData().info;

        var membersModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        var currentDt = null;

        var datesValid = true;

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
            this.alertMessage(
              "E",
              "errorsFound",
              "overlapItineraryError",
              [],
              null
            );
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
            this.alertMessage(
              "E",
              "errorsFound",
              "overlapItineraryError",
              [],
              null
            );
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

        var membersModel = new JSONModel({
          members: membersModelData,
        });

        this.setModel(membersModel, "membersModel");

        this.findTicketAndPerDiemPerCity(guid, id, oEvent, null);
      },

      _handleRawFile: function (oFile) {
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

          var missionAttachmentsModelData = that
            .getView()
            .getModel("missionAttachmentsModel")
            .getData().attachments;

          var missionAttachmentObj = {
            fileName: oFileRaw.name,
            mimetype: oFileRaw.mimetype,
            fileSize: oFileRaw.size,
            file: oFileRaw.data,
          };

          missionAttachmentsModelData.push(missionAttachmentObj);

          var missionAttachmentsModel = new JSONModel({
            attachments: missionAttachmentsModelData,
          });

          that
            .getView()
            .setModel(missionAttachmentsModel, "missionAttachmentsModel");
        }.bind(that);

        reader.readAsArrayBuffer(oFile);
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

      onMissionAttachmentAdd: function (oEvent) {
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
            this._handleRawFile(oFileUploadComponent);
            oEvent.getSource().getList().removeAllItems();
          } else {
            oEvent.getSource().getList().removeAllItems();
          }
        }
      },

      onMissionAttachmentRemove: function (oEvent) {
        oEvent.preventDefault();

        var oFileUploadComponent = oEvent.getSource().mProperties;

        if (oFileUploadComponent) {
          var oFileUploadComponentName = oFileUploadComponent.fileName;
          var oFileUploadComponentUrl = oFileUploadComponent.url;

          var missionAttachmentsModelData = this.getView()
            .getModel("missionAttachmentsModel")
            .getData().attachments;

          missionAttachmentsModelData = JSON.parse(
            JSON.stringify(missionAttachmentsModelData)
          );

          for (var i = missionAttachmentsModelData.length - 1; i >= 0; i--) {
            if (
              missionAttachmentsModelData[i].fileName ==
                oFileUploadComponentName &&
              missionAttachmentsModelData[i].file == oFileUploadComponentUrl
            ) {
              missionAttachmentsModelData.splice(i, 1);
            }
          }

          var missionAttachmentsModel = new JSONModel({
            attachments: missionAttachmentsModelData,
          });

          this.setModel(missionAttachmentsModel, "missionAttachmentsModel");
        }
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

      _handleRawFileMember: function (oFile, guid) {
        const that = this;
        const oMembersModel = this.getModel("membersModel");

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
          const membersModelData = oMembersModel.getProperty("/members");

          var memberAttachmentObj = {
            memberGUID: guid,
            fileName: oFileRaw.name,
            mimetype: oFileRaw.mimetype,
            fileSize: oFileRaw.size,
            file: oFileRaw.data,
          };

          const oMember = _.find(membersModelData, ["guid", guid]);

          if (!oMember) {
            return;
          }
          oMember.attachments = []; //Only one attachment is allowed
          oMember.attachments.push(memberAttachmentObj);

          // var membersModel = new JSONModel({
          //   members: membersModelData,
          // });

          // that.setModel(membersModel, "membersModel");

          oMembersModel.setProperty("/members", membersModelData);
        }.bind(that);

        reader.readAsArrayBuffer(oFile);
      },

      onMembersAttachmentAdd: function (oEvent, guid) {
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
            this._handleRawFileMember(oFileUploadComponent, guid);
            oEvent.getSource().getList().removeAllItems();
          } else {
            oEvent.getSource().getList().removeAllItems();
          }
        }
      },

      onMemberAttachmentRemove: function (oEvent, guid) {
        oEvent.preventDefault();

        var oFileUploadComponent = oEvent.getSource().mProperties;

        if (oFileUploadComponent) {
          var oFileUploadComponentName = oFileUploadComponent.fileName;
          var oFileUploadComponentUrl = oFileUploadComponent.url;

          var memberAttachmentsModelData = this.getView()
            .getModel("membersModel")
            .getData().members;

          for (var i = 0; i < memberAttachmentsModelData.length; i++) {
            if (memberAttachmentsModelData[i].guid == guid) {
              var memberAttachments = memberAttachmentsModelData[i].attachments;

              for (var j = memberAttachments.length - 1; j >= 0; j--) {
                if (
                  memberAttachments[j].fileName == oFileUploadComponentName &&
                  memberAttachments[j].file == oFileUploadComponentUrl
                ) {
                  memberAttachments.splice(j, 1);
                }
              }
            }
          }

          var membersModel = new JSONModel({
            members: memberAttachmentsModelData,
          });

          this.setModel(membersModel, "membersModel");
        }
      },

      addMembers: function () {
        var aInfo = this.getModel("missionInfoModel").getData().info;

        var startDtModified = null;
        var endDtModified = null;
        if (aInfo.missionStartDate != null) {
          startDtModified = new Date(aInfo.missionStartDate);
          startDtModified.setDate(startDtModified.getDate());
        }
        if (aInfo.missionEndDate != null) {
          endDtModified = new Date(aInfo.missionEndDate);
          endDtModified.setDate(endDtModified.getDate());
        }

        var randomID = Formatter.createAttachmentID();
        var randomItineraryID = Formatter.createAttachmentID();

        var oModel = this.getModel("membersModel");

        var aMembers = oModel.getProperty("/members");

        var oNewRow = {
          guid: randomID,
          removable: true,
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
          // itinerary: [
          //   {
          //     id: "1",
          //     buttonsVisibility: {
          //       add: false,
          //       delete: false,
          //     },
          //     memberGUID: randomID,
          //     city: aInfo.destination,
          //     ticketType: "",
          //     startDate: aInfo.missionStartDate,
          //     endDate: aInfo.missionEndDate,
          //     startDateMinDate: startDtModified,
          //     startDateMaxDate: endDtModified,
          //     endDateMinDate: startDtModified,
          //     endDateMaxDate: endDtModified,
          //     headOfMission: "",
          //     hospitalityDefault: aInfo.hospitality_Type,
          //     perDiemPerCity: 0,
          //     ticketAverage: 0,
          //     ticketActualCost: 0,
          //   },
          // ],
          attachments: [],
        };

        const bHeadOfMissionEditable = this.isHeadOfMissionEditable(aInfo.decreeType);

        //--Set the first members itinerarys to the new member
        const oFirstMember = aMembers[0];
        if (oFirstMember) {
          oFirstMember.itinerary.forEach((oItinerary) => {
            const oItineraryCopy = _.cloneDeep(oItinerary);
            oItineraryCopy.memberGUID = randomID;
            oItineraryCopy.headOfMission = bHeadOfMissionEditable ? "" : "N";
            oItineraryCopy.perDiemPerCity = 0;
            oItineraryCopy.ticketAverage = 0;
            oItineraryCopy.ticketActualCost = 0;
            oItineraryCopy.ticketType = 0;
            oItineraryCopy.hospitalityDefault = aInfo.hospitality_Type;
            oNewRow.itinerary.push(oItineraryCopy);
          });
        } else {
          oNewRow.itinerary.push({
            id: "1",
            buttonsVisibility: {
              add: false,
              delete: false,
            },
            memberGUID: randomID,
            city: aInfo.destination,
            ticketType: "",
            startDate: aInfo.missionStartDate,
            endDate: aInfo.missionEndDate,
            startDateMinDate: startDtModified,
            startDateMaxDate: endDtModified,
            endDateMinDate: startDtModified,
            endDateMaxDate: endDtModified,
            headOfMission: bHeadOfMissionEditable ? "" : "N",
            hospitalityDefault: aInfo.hospitality_Type,
            perDiemPerCity: 0,
            ticketAverage: 0,
            ticketActualCost: 0,
          });
        }
        //--Set the first members itinerarys to the new member

        aMembers.push(oNewRow);

        oModel.setProperty("/members", aMembers);
      },

      deleteMember: function (guid) {
        var aInfo = this.getModel("missionInfoModel").getData().info;
        var membersModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        for (var i = membersModelData.length - 1; i >= 0; i--) {
          if (membersModelData[i].guid == guid) {
            membersModelData.splice(i, 1);
          }
        }

        var missionTicketAverage = 0;
        var missionPerDiemPerCity = 0;
        var missionTotalExpense = 0;
        for (var i = 0; i < membersModelData.length; i++) {
          missionTicketAverage =
            missionTicketAverage + membersModelData[i].employeeTotalTicket;
          missionPerDiemPerCity =
            missionPerDiemPerCity + membersModelData[i].employeeTotalPerdiem;
          missionTotalExpense =
            missionTotalExpense + missionTicketAverage + missionPerDiemPerCity;
        }

        aInfo.ticketAverage = missionTicketAverage;
        aInfo.totalPerdiemMission = missionPerDiemPerCity;
        aInfo.totalExpense = missionTicketAverage + missionPerDiemPerCity;

        var membersModel = new JSONModel({
          members: membersModelData,
        });

        this.setModel(membersModel, "membersModel");

        var missionInfoModel = new JSONModel({
          info: aInfo,
        });

        this.setModel(missionInfoModel, "missionInfoModel");
      },

      addItinerary: function (guid, oEvent) {
        var aInfo = this.getModel("missionInfoModel").getData().info;
        const bHeadOfMissionEditable = this.isHeadOfMissionEditable(aInfo.decreeType);

        var startDtModified = null;
        var endDtModified = null;
        if (aInfo.missionStartDate != null) {
          startDtModified = new Date(aInfo.missionStartDate);
          startDtModified.setDate(startDtModified.getDate());
        }
        if (aInfo.missionEndDate != null) {
          endDtModified = new Date(aInfo.missionEndDate);
          endDtModified.setDate(endDtModified.getDate());
        }

        var membersModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        for (var i = 0; i < membersModelData.length; i++) {
          if (membersModelData[i].guid == guid) {
            var randomID = Formatter.createAttachmentID();

            var itineraryData = membersModelData[i].itinerary;

            var itineraryObj = {
              id: randomID,
              buttonsVisibility: {
                add: false,
                delete: true,
              },
              memberGUID: guid,
              city: "",
              ticketType: "",
              startDate: null,
              endDate: null,
              startDateMinDate: startDtModified,
              startDateMaxDate: endDtModified,
              endDateMinDate: startDtModified,
              endDateMaxDate: endDtModified,
              //headOfMission: bHeadOfMissionEditable ? "" : "N",
              headOfMission: itineraryData.length > 0 ? itineraryData[0].headOfMission : this.getDefaultHeadOfMission(aInfo.decreeType),
              hospitalityDefault: "",
              perDiemPerCity: 0,
              ticketAverage: 0,
              ticketActualCost: 0,
              reflectBudgetInfo: false,
            };

            itineraryData.push(itineraryObj);

            var membersModel = new JSONModel({
              members: membersModelData,
            });

            this.setModel(membersModel, "membersModel");
          }
        }
      },

      deleteItinerary: function (guid, id, oEvent) {
        var aInfo = this.getModel("missionInfoModel").getData().info;
        var mModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        for (var i = 0; i < mModelData.length; i++) {
          if (mModelData[i].guid == guid) {
            for (var j = mModelData[i].itinerary.length - 1; j >= 0; j--) {
              if (mModelData[i].itinerary[j].id == id) {
                mModelData[i].itinerary.splice(j, 1);
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
            missionTicketAverage = missionTicketAverage + memberTicketAverage;
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

            missionTicketAverage = missionTicketAverage + memberTicketAverage;
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

        this.setModel(membersModel, "membersModel");

        var missionInfoModel = new JSONModel({
          info: aInfo,
        });

        this.setModel(missionInfoModel, "missionInfoModel");
      },

      multicityChange: function (guid, oEvent) {
        if (oEvent.getSource().getSelectedKey() == "Y") {
          var mModelData = this.getView()
            .getModel("membersModel")
            .getData().members;

          for (var i = 0; i < mModelData.length; i++) {
            if (mModelData[i].guid == guid) {
              var itineraryModelData = mModelData[i].itinerary;
              itineraryModelData[0].buttonsVisibility.add = true;
            }
          }

          var membersModel = new JSONModel({
            members: mModelData,
          });

          this.setModel(membersModel, "membersModel");
        } else {
          var mModelData = this.getView()
            .getModel("membersModel")
            .getData().members;

          for (var i = 0; i < mModelData.length; i++) {
            if (mModelData[i].guid == guid) {
              var itineraryModelData = mModelData[i].itinerary;
              for (var j = itineraryModelData.length - 1; j >= 0; j--) {
                if (j == 0) {
                  itineraryModelData[j].buttonsVisibility.add = false;
                } else {
                  itineraryModelData.splice(j, 1);
                }
              }
            }
          }

          var membersModel = new JSONModel({
            members: mModelData,
          });

          this.setModel(membersModel, "membersModel");
        }
      },

      checkBudgetAvailability: async function (bShowLoading = false) {
        let aBudgetTracking = [];
        let bBudgetAvailable = false;
        const oMissionInfoModel = this.getModel("missionInfoModel");
        const missionInfoModelData = oMissionInfoModel.getProperty("/info");

        let missionBudgetAvailable = null;
        let missionParkedAmount = null;

        if (
          !missionInfoModelData.totalExpense ||
          parseFloat(missionInfoModelData.totalExpense) <= 0
        ) {
          this.toastMessage(
            "E",
            "errorOperation",
            "totalMissionExpenseZero",
            [],
            null
          );
          return {
            isBudgetAvailable: bBudgetAvailable,
            budgetTracking: aBudgetTracking,
            missionBudgetAvailable,
            missionParkedAmount,
          };
        }

        if (bShowLoading) {
          this.openBusyFragment("checkingBudget", []);
        }
        try {
          const i = await this.refreshSectors();

          if (bShowLoading) {
            this.closeBusyFragment();
          }
        } catch (e) {
          this.closeBusyFragment();
          //--Could not refresh somehow
        }

        const oSectorsModel = this.getModel("sectorsModel");
        const sectorsModelData = oSectorsModel.getProperty("/sectors");

        const oSubSector = _.find(sectorsModelData, [
          "externalCode",
          missionInfoModelData.sector,
        ]);

        const oMainSector = oSubSector
          ? _.find(sectorsModelData, {
              cust_S4_Sector: oSubSector.cust_S4_Sector,
              cust_S4_SubSector: oSubSector.cust_S4_Sector,
            })
          : null;

        let remainingConsumption;

        if (parseFloat(oSubSector.cust_Available_budget) > 0) {
          remainingConsumption =
            parseFloat(oSubSector.cust_Available_budget) -
            parseFloat(missionInfoModelData.totalExpense);
          let oBudgetTracking = {
            cust_MissionID: "",
            cust_SFSector: oSubSector.externalCode,
            cust_S4Sector: oSubSector.cust_S4_SubSector,
            cust_Consumption: parseFloat(missionInfoModelData.totalExpense),
            cust_Remaining_Budget:
              parseFloat(oSubSector.cust_Available_budget) -
              parseFloat(missionInfoModelData.totalExpense),
            cust_Parked_Amount:
              parseFloat(oSubSector.cust_Parked_Amount) +
              parseFloat(missionInfoModelData.totalExpense),
            cust_Comments: "Create Mission",
            real_Consumption:
              remainingConsumption >= 0
                ? parseFloat(missionInfoModelData.totalExpense)
                : parseFloat(oSubSector.cust_Available_budget),
          };
          aBudgetTracking.push(oBudgetTracking);

          if (remainingConsumption >= 0) {
            bBudgetAvailable = true;
            remainingConsumption = 0;
          }
        } else {
          let oBudgetTracking = {
            cust_MissionID: missionInfoModelData.missionID,
            cust_SFSector: oSubSector.externalCode,
            cust_S4Sector: oSubSector.cust_S4_SubSector,
            cust_Consumption: parseFloat(missionInfoModelData.totalExpense),
            cust_Remaining_Budget:
              parseFloat(oSubSector.cust_Available_budget) -
              parseFloat(missionInfoModelData.totalExpense),
            cust_Parked_Amount:
              parseFloat(oSubSector.cust_Parked_Amount) +
              parseFloat(missionInfoModelData.totalExpense),
            cust_Comments: "Create Mission",
            real_Consumption: 0,
          };
          aBudgetTracking.push(oBudgetTracking);
          remainingConsumption =
            parseFloat(missionInfoModelData.totalExpense) * -1;
        }

        let remainingSectorBudget;
        if (oMainSector && parseFloat(oMainSector.cust_Available_budget) > 0) {
          //--Subsector budget may not be enough use main sector budget
          remainingSectorBudget =
            parseFloat(oMainSector.cust_Available_budget) -
            parseFloat(missionInfoModelData.totalExpense);
          let oBudgetTracking = {
            cust_MissionID: "",
            cust_SFSector: oMainSector.externalCode,
            cust_S4Sector: oMainSector.cust_S4_SubSector,
            cust_Consumption: parseFloat(missionInfoModelData.totalExpense),
            cust_Remaining_Budget: remainingSectorBudget,
            cust_Parked_Amount:
              parseFloat(oMainSector.cust_Parked_Amount) +
              parseFloat(missionInfoModelData.totalExpense),
            cust_Comments: "Create Mission",
            real_Consumption:
              remainingSectorBudget >= 0
                ? parseFloat(missionInfoModelData.totalExpense)
                : 0,
          };
          aBudgetTracking.push(oBudgetTracking);

          if (remainingSectorBudget >= 0) {
            bBudgetAvailable = true;
          } else {
            bBudgetAvailable = false;
          }
        }

        //--Return as is, becuase we will update using budget tracking (New S4-SF Scenario)
        missionBudgetAvailable =
          parseFloat(oSubSector.cust_Available_budget) -
          parseFloat(missionInfoModelData.totalExpense);
        missionParkedAmount =
          parseFloat(oSubSector.cust_Parked_Amount) +
          parseFloat(missionInfoModelData.totalExpense);

        if (!bBudgetAvailable) {
          //--Budget low error - do not return any tracking
          aBudgetTracking = [];
        }

        return {
          isBudgetAvailable: bBudgetAvailable,
          budgetTracking: aBudgetTracking,
          missionBudgetAvailable,
          missionParkedAmount,
        };
      },

      saveMission: async function () {
        const that = this;
        const oMissionInfoModel = this.getModel("missionInfoModel");
        const oMissionAttachmentsModel = this.getModel(
          "missionAttachmentsModel"
        );
        const oMembersModel = this.getModel("membersModel");
        const oSectorsModel = this.getModel("sectorsModel");

        const missionInfoModelData = oMissionInfoModel.getProperty("/info");
        const missionAttachmentsData =
          oMissionAttachmentsModel.getProperty("/attachments");
        const missionMembersData = oMembersModel.getProperty("/members");
        const sectorsModelData = oSectorsModel.getProperty("/sectors");

        let headOfMission = null;

        let validationError = false;

        //--Check arabic description
        const oDescrField = this.byId("missionDescription");
        if (oDescrField) {
          oDescrField.setValueState("None");
          oDescrField.setValueStateText("");
        }
        const bArabicOnly = this.checkIsArabic(
          missionInfoModelData.missionDescription
        );

        if (!bArabicOnly) {
          this.alertMessage(
            "E",
            "errorOperation",
            "arabicDescriptionOnly",
            [],
            {
              confirmCallbackFn: () => {
                if (oDescrField) {
                  oDescrField.focus();
                  oDescrField.setValueState("Error");
                  oDescrField.setValueStateText(
                    this.getText("arabicDescriptionOnly", [])
                  );
                }
              },
            }
          );
          return;
        }
        //--Check arabic description

        //--Check at least one itinerary
        const bItineraryValid = this.checkAtLeastOneItinerary();
        if (!bItineraryValid) return;
        //--Check at least one itinerary

        //--Check decree type and head of mission
        const decreeTypeValidationMessage = this.validateMissionForDecreeType(missionInfoModelData.decreeType, missionMembersData);

        if(decreeTypeValidationMessage){
          this.alertMessageHtml(
            "E",
            "errorOperation",
            decreeTypeValidationMessage.message,
            decreeTypeValidationMessage.params,
            null
          );
          return;
        }
        //--Check decree type and head of mission

        // var missionInfoModelData = this.getView()
        //   .getModel("missionInfoModel")
        //   .getData().info;
        // var missionAttachmentsData = this.getView()
        //   .getModel("missionAttachmentsModel")
        //   .getData().attachments;
        // var missionMembersData = this.getView()
        //   .getModel("membersModel")
        //   .getData().members;

        // var sectorsModelData = this.getView()
        //   .getModel("sectorsModel")
        //   .getData().sectors;

        const aManagerCheckSectors = [
          "17555", //Assistant Undersecretary for Support Services Affairs (17555)
          "15917555", //Assistant Undersecretary for Support Services Affairs (17555)
          "17556", //Assistant Undersecretary for Protocols Affairs(17556)
          "17557", //Assistant Undersecretary for Consular Affairs(17557)
        ];

        const oSector = _.find(sectorsModelData, [
          "externalCode",
          missionInfoModelData.sector,
        ]);

        if (!oSector) {
          this.alertMessage(
            "E",
            "errorOperation",
            "sectorDataNotRead",
            [missionInfoModelData.sector],
            null
          );
          return;
        }

        if (
          oSector.cust_S4_Sector === null ||
          oSector.cust_S4_Sector === "" ||
          oSector.cust_S4_Sector === undefined
        ) {
          this.alertMessage(
            "E",
            "errorOperation",
            "sectorS4CodeNotExist",
            [oSector.externalCode, oSector.localeLabel],
            null
          );
          return;
        }

        const {
          isBudgetAvailable,
          budgetTracking,
          missionBudgetAvailable,
          missionParkedAmount,
        } = await this.checkBudgetAvailability(true);

        if (isBudgetAvailable === false) {
          that.alertMessage(
            "E",
            "errorOperation",
            "sectorBudgetLowError",
            [],
            null
          );
          return;
          // MessageBox.error("The available budget of sector is low", {
          //   actions: [MessageBox.Action.CLOSE],
          //   onClose: async function (sAction) {},
          //   dependentOn: that.getView(),
          // });
        } else {

          //--Set external entities
          this.setExternalEntities(missionInfoModelData);
          //--Set external entities

          let missionRequest = {
            info: {
              budgetAvailable: missionBudgetAvailable,
              budgetParked: missionParkedAmount,
              missionDetails: "",
              createdBy: "",
              decreeType: "",
              externalEntity:"",
              externalEntity2:"",
              externalEntity3:"",
              externalEntity4:"",
              externalEntity5:"",
              destination: "",
              flightType: "",
              hospitality_Type: "",
              missionDescription: "",
              missionEndDate: "",
              missionID: "",
              missionStartDate: "",
              noOfDays: 0,
              pendingWithGroup: oSector.cust_Delegate_Dynamic_group
                ? oSector.cust_Delegate_Dynamic_group
                : "",
              pendingWithUser: oSector.cust_Head_of_Sector,
              sector: "",
              ticketAverage: "",
              totalExpense: "",
              totalPerdiemMission: "",
            },
            members: [],
            attachments: [],
            budgetTracking,
          };

          if (
            missionInfoModelData.decreeType != "" &&
            missionInfoModelData.decreeType != null
          ) {
            missionRequest.info.decreeType = missionInfoModelData.decreeType;
          } else {
            validationError = true;
          }

          if (
            missionInfoModelData.decreeType === "09" || missionInfoModelData.decreeType === "10" 
            
          ) {
            if(missionInfoModelData.externalEntity !== null && missionInfoModelData.externalEntity !== ""){
              missionRequest.info.externalEntity = missionInfoModelData.externalEntity;
              missionRequest.info.externalEntity2 = missionInfoModelData.externalEntity2;
              missionRequest.info.externalEntity3 = missionInfoModelData.externalEntity3;
              missionRequest.info.externalEntity4 = missionInfoModelData.externalEntity4;
              missionRequest.info.externalEntity5 = missionInfoModelData.externalEntity5;
            }else{
              validationError = true;
            }
          }
           
          if (
            missionInfoModelData.destination != "" &&
            missionInfoModelData.destination != null
          ) {
            missionRequest.info.destination = missionInfoModelData.destination;
          } else {
            validationError = true;
          }

          if (
            missionInfoModelData.flightType != "" &&
            missionInfoModelData.flightType != null
          ) {
            missionRequest.info.flightType = missionInfoModelData.flightType;
          } else {
            validationError = true;
          }

          if (
            missionInfoModelData.hospitality_Type != "" &&
            missionInfoModelData.hospitality_Type != null
          ) {
            missionRequest.info.hospitality_Type =
              missionInfoModelData.hospitality_Type;
          } else {
            validationError = true;
          }

          if (
            missionInfoModelData.missionDescription != "" &&
            missionInfoModelData.missionDescription != null
          ) {
            missionRequest.info.missionDescription =
              missionInfoModelData.missionDescription;
          } else {
            validationError = true;
          }

          if (
            missionInfoModelData.missionEndDate != "" &&
            missionInfoModelData.missionEndDate != null
          ) {
            var hoursToAdd = 12 * 60 * 60 * 1000;
            var missionEndDate = new Date(missionInfoModelData.missionEndDate);
            missionEndDate.setTime(missionEndDate.getTime() + hoursToAdd);
            missionRequest.info.missionEndDate =
              "/Date(" + missionEndDate.getTime() + ")/";
          } else {
            validationError = true;
          }

          if (
            missionInfoModelData.missionStartDate != "" &&
            missionInfoModelData.missionStartDate != null
          ) {
            var hoursToAdd = 12 * 60 * 60 * 1000;
            var missionStartDate = new Date(
              missionInfoModelData.missionStartDate
            );
            missionStartDate.setTime(missionStartDate.getTime() + hoursToAdd);
            missionRequest.info.missionStartDate =
              "/Date(" + missionStartDate.getTime() + ")/";
          } else {
            validationError = true;
          }

          if (missionInfoModelData.noOfDays > 0) {
            missionRequest.info.noOfDays = missionInfoModelData.noOfDays;
          } else {
            validationError = true;
          }

          if (
            missionInfoModelData.sector != "" &&
            missionInfoModelData.sector != null
          ) {
            missionRequest.info.sector = missionInfoModelData.sector;
          } else {
            validationError = true;
          }

          if (
            missionInfoModelData.missionDetails != "" &&
            missionInfoModelData.missionDetails != null
          ) {
            missionRequest.info.missionDetails =
              missionInfoModelData.missionDetails;
          }

          const decryptedDataParsed = await this.getTravelStorage();
          missionRequest.info.createdBy = decryptedDataParsed.keyVault.user.id;
          missionRequest.info.ticketAverage =
            missionInfoModelData.ticketAverage;
          missionRequest.info.totalExpense = missionInfoModelData.totalExpense;
          missionRequest.info.totalPerdiemMission =
            missionInfoModelData.totalPerdiemMission;

          for (var i = 0; i < missionAttachmentsData.length; i++) {
            var missionAttachmentRequest = {
              file: "",
              fileName: "",
              fileSize: 0,
              mimetype: "",
            };
            missionAttachmentRequest.file = missionAttachmentsData[i].file;
            missionAttachmentRequest.fileName =
              missionAttachmentsData[i].fileName;
            missionAttachmentRequest.fileSize =
              missionAttachmentsData[i].fileSize;
            missionAttachmentRequest.mimetype =
              missionAttachmentsData[i].mimetype;
            missionRequest.attachments.push(missionAttachmentRequest);
          }

          for (var j = 0; j < missionMembersData.length; j++) {
            var missionMemberRequest = {
              department: "",
              userID: "",
              employeeID: "",
              employeeName: "",
              employeeTotalExpense: 0,
              employeeTotalPerdiem: 0,
              employeeTotalTicket: 0,
              grade: "",
              multipleCities: "",
              noOfCities: "",
              salutation: "",
              title: "",
              itinerary: [],
              attachments: [],
            };

            if (
              missionMembersData[j].employeeID != "" &&
              missionMembersData[j].employeeID != null
            ) {
              missionMemberRequest.employeeID =
                missionMembersData[j].employeeID;
              missionMemberRequest.userID = missionMembersData[j].userID;
            } else {
              validationError = true;
            }
            if (
              missionMembersData[j].employeeName != "" &&
              missionMembersData[j].employeeName != null
            ) {
              missionMemberRequest.employeeName =
                missionMembersData[j].employeeName;
            } else {
              validationError = true;
            }
            if (
              missionMembersData[j].grade != "" &&
              missionMembersData[j].grade != null
            ) {
              missionMemberRequest.grade = missionMembersData[j].grade;
            } else {
              validationError = true;
            }
            if (
              missionMembersData[j].multipleCities != "" &&
              missionMembersData[j].multipleCities != null
            ) {
              missionMemberRequest.multipleCities =
                missionMembersData[j].multipleCities;
            } else {
              validationError = true;
            }
            if (
              missionMembersData[j].salutation != "" &&
              missionMembersData[j].salutation != null
            ) {
              missionMemberRequest.salutation =
                missionMembersData[j].salutation;
            } else {
              validationError = true;
            }
            if (
              missionMembersData[j].title != "" &&
              missionMembersData[j].title != null
            ) {
              missionMemberRequest.title = missionMembersData[j].title;
            } else {
              validationError = true;
            }

            missionMemberRequest.department = missionMembersData[j].department;
            missionMemberRequest.employeeTotalExpense =
              missionMembersData[j].employeeTotalExpense;
            missionMemberRequest.employeeTotalPerdiem =
              missionMembersData[j].employeeTotalPerdiem;
            missionMemberRequest.employeeTotalTicket =
              missionMembersData[j].employeeTotalTicket;
            missionMemberRequest.noOfCities =
              missionMembersData[j].itinerary.length;

            for (var k = 0; k < missionMembersData[j].itinerary.length; k++) {
              var missionItineraryRequest = {
                city: "",
                endDate: "",
                headOfMission: "",
                hospitalityDefault: "",
                perDiemPerCity: "",
                startDate: "",
                ticketActualCost: 0,
                ticketAverage: 0,
                ticketType: "",
              };
              if (
                missionMembersData[j].itinerary[k].city != "" &&
                missionMembersData[j].itinerary[k].city != null
              ) {
                missionItineraryRequest.city =
                  missionMembersData[j].itinerary[k].city;
              } else {
                validationError = true;
              }
              if (
                missionMembersData[j].itinerary[k].endDate != "" &&
                missionMembersData[j].itinerary[k].endDate != null
              ) {
                var hoursToAdd = 12 * 60 * 60 * 1000;
                var itineraryEndDate = new Date(
                  missionMembersData[j].itinerary[k].endDate
                );
                itineraryEndDate.setTime(
                  itineraryEndDate.getTime() + hoursToAdd
                );
                missionItineraryRequest.endDate =
                  "/Date(" + itineraryEndDate.getTime() + ")/";
              } else {
                validationError = true;
              }
              if (
                missionMembersData[j].itinerary[k].startDate != "" &&
                missionMembersData[j].itinerary[k].startDate != null
              ) {
                var hoursToAdd = 12 * 60 * 60 * 1000;
                var itineraryStartDate = new Date(
                  missionMembersData[j].itinerary[k].startDate
                );
                itineraryStartDate.setTime(
                  itineraryStartDate.getTime() + hoursToAdd
                );
                missionItineraryRequest.startDate =
                  "/Date(" + itineraryStartDate.getTime() + ")/";
              } else {
                validationError = true;
              }
              if (
                missionMembersData[j].itinerary[k].headOfMission != "" &&
                missionMembersData[j].itinerary[k].headOfMission != null
              ) {
                missionItineraryRequest.headOfMission =
                  missionMembersData[j].itinerary[k].headOfMission;
                if (missionMembersData[j].itinerary[k].headOfMission === "Y") {
                  headOfMission = missionMemberRequest.employeeID;
                }
              } else {
                validationError = true;
              }
              if (
                missionMembersData[j].itinerary[k].hospitalityDefault != "" &&
                missionMembersData[j].itinerary[k].hospitalityDefault != null
              ) {
                missionItineraryRequest.hospitalityDefault =
                  missionMembersData[j].itinerary[k].hospitalityDefault;
              } else {
                validationError = true;
              }
              if (
                missionMembersData[j].itinerary[k].ticketType != "" &&
                missionMembersData[j].itinerary[k].ticketType != null
              ) {
                missionItineraryRequest.ticketType =
                  missionMembersData[j].itinerary[k].ticketType;
              } else {
                validationError = true;
              }
              missionItineraryRequest.perDiemPerCity =
                missionMembersData[j].itinerary[k].perDiemPerCity;
              missionItineraryRequest.ticketActualCost =
                missionMembersData[j].itinerary[k].ticketActualCost;
              missionItineraryRequest.ticketAverage =
                missionMembersData[j].itinerary[k].ticketAverage;
              missionMemberRequest.itinerary.push(missionItineraryRequest);
            }

            for (var l = 0; l < missionMembersData[j].attachments.length; l++) {
              var missionAttachmentRequest = {
                file: "",
                fileName: "",
                fileSize: 0,
                mimetype: "",
              };
              missionAttachmentRequest.file =
                missionMembersData[j].attachments[l].file;
              missionAttachmentRequest.fileName =
                missionMembersData[j].attachments[l].fileName;
              missionAttachmentRequest.fileSize =
                missionMembersData[j].attachments[l].fileSize;
              missionAttachmentRequest.mimetype =
                missionMembersData[j].attachments[l].mimetype;
              missionMemberRequest.attachments.push(missionAttachmentRequest);
            }

            missionRequest.members.push(missionMemberRequest);
          }

          var screenModelData = this.getView()
            .getModel("screenModel")
            .getData().info;
          screenModelData.validationError = validationError;
          var screenModel = new JSONModel({
            info: screenModelData,
          });
          this.setModel(screenModel, "screenModel");

          if (validationError == false) {
            if (parseFloat(missionInfoModelData.totalExpense) <= 0) {
              this.alertMessage(
                "E",
                "errorOperation",
                "totalMissionExpenseZero",
                [],
                null
              );
              return;
              // MessageBox.error(
              //   "The total mission expense should be greater than zero",
              //   {
              //     actions: [MessageBox.Action.CLOSE],
              //     onClose: async function (sAction) {},
              //     dependentOn: that.getView(),
              //   }
              // );
            } else {
              //--Head of Mission vs Head of Sector Checks
              //--If head of mission is also the head of sector - get the manager of the head of sector
              if (
                headOfMission &&
                headOfMission === oSector.cust_Head_of_Sector &&
                aManagerCheckSectors.includes(missionInfoModelData.sector)
              ) {
                this.openBusyFragment();
                try {
                  const managerInfo = await this.getManagerOfHeadOfSector(
                    oSector.cust_Head_of_Sector
                  );
                  this.closeBusyFragment();
                  missionRequest.info.pendingWithGroup =
                    managerInfo.delegateDynamicGroup
                      ? managerInfo.delegateDynamicGroup
                      : "";
                  missionRequest.info.pendingWithUser = managerInfo.managerId;
                } catch (e) {
                  this.closeBusyFragment();
                  this.alertMessage(
                    "E",
                    "errorOperation",
                    "managerOfHeadOfSectorNotFound",
                    [],
                    null
                  );
                  return;
                }
              }
              //--If head of mission is also the head of sector - get the manager of the head of sector
              //--Head of Mission vs Head of Sector Checks

              //--Check mission
              try {
                await this.openBusyFragment("checkingMissionBeforeSave");
                const checkMissionResponse = await this.checkMission(
                  missionRequest
                );
                await this.closeBusyFragment();
                if (checkMissionResponse === false) {
                  this.toastMessage(
                    "E",
                    "errorsFound",
                    "missionCheckFailed",
                    [],
                    null
                  );
                  this.onOpenErrorPane();
                  return;
                }
              } catch (e) {
                await this.closeBusyFragment();
                return;
              }

              //--Check mission

              const envInfo = await this.getEnvInfo();

              const requestBody = {
                params: missionRequest,
                userInfo: decryptedDataParsed.keyVault.user.id,
              };

              const url = "/createMission";
              this.openBusyFragment("savingMission", []);
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
                  var decryptedData = await that.getDecryptedData(data);

                  var missionCreatedData = JSON.parse(decryptedData);

                  that.closeBusyFragment();

                  that.alertMessage(
                    "S",
                    "successfulOperation",
                    "travelMissionCreated",
                    [missionCreatedData.missionId],
                    {
                      showConfirmButton: true,
                      confirmCallbackFn: () => {
                        that.closeMission();
                      },
                    }
                  );

                  // MessageBox.success(
                  //   "The travel mission is created. Mission ID is " +
                  //     missionCreatedData.missionId,
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
                  } else if (jqXHR.status == 400) {
                    var errorMessage = JSON.parse(jqXHR.responseText);
                    that.alertMessage(
                      "E",
                      "errorOperation",
                      "errorOccuredWithMessage",
                      [jqXHR.responseText],
                      {
                        showConfirmButton: true,
                        confirmCallbackFn: () => {
                          that.closeMission();
                        },
                      }
                    );

                    // MessageBox.error(errorMessage.message, {
                    //   actions: [MessageBox.Action.CLOSE],
                    //   onClose: async function (sAction) {
                    //     that.closeMission();
                    //   },
                    //   dependentOn: that.getView(),
                    // });
                  } else {
                    that.alertMessage(
                      "E",
                      "errorOperation",
                      "serverError",
                      [],
                      {
                        showConfirmButton: true,
                        confirmCallbackFn: () => {
                          that.closeMission();
                        },
                      }
                    );
                  }
                },
              });
            }
          }
        }
      },

      getManagerOfHeadOfSector: async function (headOfSector) {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const requestBody = {
          params: {
            headOfSector,
          },
        };
        const url = "/getManagerOfHeadOfSector";
        return new Promise((resolve, reject) => {
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
              const decryptedData = await that.getDecryptedData(data);
              const managerInfo = JSON.parse(decryptedData);
              resolve(managerInfo);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              reject(null);
            },
          });
        });
      },
      findMissionBudgetInfo: async function (oEvent) {
        const that = this;

        const oValidatedComboBox = oEvent.getSource();
        const sSelectedKey = oValidatedComboBox.getSelectedKey();

        const sectorsModelData = this.getView()
          .getModel("sectorsModel")
          .getData().sectors;

        let delegateApprover = null;

        // for (var i = 0; i < sectorsModelData.length; i++) {
        //   if (sectorsModelData[i].externalCode == sSelectedKey) {
        //     if (
        //       sectorsModelData[i].cust_Delegate_Approver_for_Missions != null &&
        //       sectorsModelData[i].cust_Delegate_Approver_for_Missions != ""
        //     ) {
        //       delegateApprover =
        //         sectorsModelData[i].cust_Delegate_Approver_for_Missions;
        //     } else if (
        //       sectorsModelData[i].cust_Head_of_Sector != null &&
        //       sectorsModelData[i].cust_Head_of_Sector != ""
        //     ) {
        //       delegateApprover = sectorsModelData[i].cust_Head_of_Sector;
        //     }
        //   }
        // }
        const oSector = _.find(sectorsModelData, [
          "externalCode",
          sSelectedKey,
        ]);

        if (!oSector) {
          this.alertMessage(
            "E",
            "errorOperation",
            "sectorDataNotRead",
            [missionInfoModelData.sector],
            null
          );
          return;
        }

        if (
          oSector.cust_S4_Sector === null ||
          oSector.cust_S4_Sector === "" ||
          oSector.cust_S4_Sector === undefined
        ) {
          this.alertMessage(
            "E",
            "errorOperation",
            "sectorS4CodeNotExist",
            [oSector.externalCode, oSector.localeLabel],
            null
          );
          return;
        }

        //--Set decree list and default decree type
        const sDecreeType = this.filterDecreeTypeBySector(sSelectedKey);
        if (!sDecreeType) {
          //--Error check maybe
        }
        //--Set decree list and default decree type

        delegateApprover =
          oSector.cust_Head_of_Sector || oSector.cust_Delegate_Dynamic_group;

        if (delegateApprover == null) {
          that.alertMessage(
            "E",
            "errorOperation",
            "missingApproverForSector",
            [],
            {
              showConfirmButton: true,
              confirmCallbackFn: () => {
                oValidatedComboBox.setSelectedKey(null);
              },
            }
          );
          // MessageBox.error("The selected budget not having delegate approver", {
          //   actions: [MessageBox.Action.CLOSE],
          //   onClose: function (sAction) {
          //     oValidatedComboBox.setSelectedKey(null);
          //   },
          //   dependentOn: that.getView(),
          // });
        } else {
          const envInfo = await this.getEnvInfo();

          jQuery.ajax({
            type: "POST",
            url: "/findMissionBudgetInfo",
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
              var decryptedData = await that.getDecryptedData(data);
              var budgetaData = JSON.parse(decryptedData).d.results;
              var missionBudgetInfoModel = new JSONModel({
                missionBudgetInfo: budgetaData,
              });
              that
                .getView()
                .setModel(missionBudgetInfoModel, "missionBudgetInfoModel");

              var oModel = that.getModel("missionInfoModel");
              var aInfo = oModel.getProperty("/info");
              aInfo.budgetAvailable = 0;
              aInfo.budgetParked = 0;
              for (var i = 0; i < budgetaData.length; i++) {
                if (budgetaData[i].externalCode == sSelectedKey) {
                  if (!isNaN(parseInt(budgetaData[i].cust_Available_budget))) {
                    aInfo.budgetAvailable =
                      budgetaData[i].cust_Available_budget;
                  }

                  if (!isNaN(parseInt(budgetaData[i].cust_Parked_Amount))) {
                    aInfo.budgetParked = budgetaData[i].cust_Parked_Amount;
                  }
                }
              }
              oModel.setProperty("/info", aInfo);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              if (jqXHR.status == 401) {
                that.closeMission();
              }
            },
          });
        }
      },

      fillMemberDetails: async function (guid, oEvent) {
        const that = this;
        if (
          oEvent &&
          oEvent.mParameters &&
          oEvent.mParameters.clearButtonPressed != true
        ) {
          var oItem = oEvent.getParameter("suggestionItem");

          var mModelData = this.getView()
            .getModel("membersModel")
            .getData().members;
          var employeesModelData = oEvent.oSource
            .getModel("employeesModel")
            .getData().employees;

          var payGradeExist = false;
          for (var i = 0; i < employeesModelData.length; i++) {
            if (oItem.getKey() == employeesModelData[i].personIdExternal) {
              for (var j = 0; j < mModelData.length; j++) {
                if (mModelData[j].guid == guid) {
                  if (
                    employeesModelData[i].jobInfoNav.results[0].payGrade !=
                      null &&
                    employeesModelData[i].jobInfoNav.results[0].payGrade !=
                      "" &&
                    employeesModelData[i].jobInfoNav.results[0].payGradeNav
                      .paygradeLevel != null &&
                    employeesModelData[i].jobInfoNav.results[0].payGradeNav
                      .paygradeLevel != ""
                  ) {
                    payGradeExist = true;
                    mModelData[j].employeeName =
                      employeesModelData[
                        i
                      ].personNav.personalInfoNav.results[0].displayName;
                    mModelData[j].salutation =
                      employeesModelData[
                        i
                      ].personNav.personalInfoNav.results[0].salutationNav.picklistLabels.results[0].label;
                    mModelData[j].employeeID = oItem.getKey();
                    mModelData[j].grade =
                      employeesModelData[i].jobInfoNav.results[0].payGrade;
                    mModelData[j].gradeLevel =
                      employeesModelData[
                        i
                      ].jobInfoNav.results[0].payGradeNav.paygradeLevel;
                    if (employeesModelData[i].userNav.department) {
                      mModelData[j].department =
                        employeesModelData[i].userNav.department;
                    } else {
                      mModelData[j].department = "";
                    }
                    mModelData[j].title =
                      employeesModelData[i].jobInfoNav.results[0].jobTitle;
                    mModelData[j].jobLevel =
                      employeesModelData[i].jobInfoNav.results[0].customString6;

                    for (var k = 0; k < mModelData[j].itinerary.length; k++) {
                      that.findTicketAndPerDiemPerCity(
                        guid,
                        mModelData[j].itinerary[k].id,
                        null,
                        null
                      );
                    }
                  }
                }
              }
            }
          }

          if (payGradeExist) {
            var membersModel = new JSONModel({
              members: mModelData,
            });
            this.setModel(membersModel, "membersModel");

            oEvent.getSource().setValue(null);
            oEvent.getSource().getDomRef().blur();
          } else {
            this.alertMessage(
              "E",
              "errorOperation",
              "memberLackOfPayGrade",
              [],
              null
            );
            // MessageBox.error("The selected member not having payGrade", {
            //   actions: [MessageBox.Action.CLOSE],
            //   onClose: function (sAction) {},
            //   dependentOn: that.getView(),
            // });
          }
        }
      },
      openSearchEmployeeDialog: async function (guid) {
        let oEmployeesModel = this.getModel("employeesModel") || null;

        if (!oEmployeesModel) {
          oEmployeesModel = new JSONModel({
            employees: [],
          });
          this.setModel(oEmployeesModel, "employeesModel");
        } else {
          oEmployeesModel.setProperty("/employees", []);
        }

        if (!this._oSearchEmployeeDialog) {
          this._oSearchEmployeeDialog = await Fragment.load({
            id: this.getView().getId(),
            name: "ui5appuat.view.fragments.SearchEmployee",
            controller: this,
          });
          this.getView().addDependent(this._oSearchEmployeeDialog);
        }
        this._oSearchEmployeeDialog.data("guid", guid);
        this._oSearchEmployeeDialog.open();
      },
      confirmEmployeeSelection: function (oEvent) {
        //const oItem = oEvent.getParameter("selectedItem");
        const oItem = oEvent.getSource();
        if (!oItem) {
          return;
        }

        if (oItem.getType() === "Inactive") {
          this.toastMessage(
            "E",
            "errorsFound",
            "selectedEmployeeNotAvaible",
            [],
            null
          );
          return;
        }

        const guid = this._oSearchEmployeeDialog.data("guid");
        const that = this;
        const oMembersModel = this.getModel("membersModel");
        const oEmployeesModel = this.getModel("employeesModel");

        let mModelData = oMembersModel.getProperty("/members") || [];
        let employeesModelData =
          oEmployeesModel.getProperty("/employees") || [];
        let payGradeExist = false;

        for (var i = 0; i < employeesModelData.length; i++) {
          if (
            oItem.data("employeeID") == employeesModelData[i].personIdExternal
          ) {
            for (var j = 0; j < mModelData.length; j++) {
              if (mModelData[j].guid == guid) {
                if (
                  employeesModelData[i].jobInfoNav.results[0].payGrade !=
                    null &&
                  employeesModelData[i].jobInfoNav.results[0].payGrade != "" &&
                  employeesModelData[i].jobInfoNav.results[0].payGradeNav
                    .paygradeLevel != null &&
                  employeesModelData[i].jobInfoNav.results[0].payGradeNav
                    .paygradeLevel != ""
                ) {
                  payGradeExist = true;
                  mModelData[j].employeeName =
                    employeesModelData[
                      i
                    ].personNav.personalInfoNav.results[0].displayName;
                  mModelData[j].salutation =
                    employeesModelData[
                      i
                    ].personNav.personalInfoNav.results[0].salutationNav.picklistLabels.results[0].label;
                  mModelData[j].userID = oItem.data("userID"); //Person ID External
                  mModelData[j].employeeID = oItem.data("employeeID"); //Person ID External

                  mModelData[j].grade =
                    employeesModelData[i].jobInfoNav.results[0].payGrade;
                  mModelData[j].gradeLevel =
                    employeesModelData[
                      i
                    ].jobInfoNav.results[0].payGradeNav.paygradeLevel;
                  if (employeesModelData[i].userNav.department) {
                    mModelData[j].department =
                      employeesModelData[i].userNav.department;
                  } else {
                    mModelData[j].department = "";
                  }
                  mModelData[j].title =
                    employeesModelData[i].jobInfoNav.results[0].jobTitle;
                  mModelData[j].jobLevel =
                    employeesModelData[i].jobInfoNav.results[0].customString6;

                  for (var k = 0; k < mModelData[j].itinerary.length; k++) {
                    that.findTicketAndPerDiemPerCity(
                      guid,
                      mModelData[j].itinerary[k].id,
                      null,
                      null
                    );
                  }
                }
              }
            }
          }
        }

        if (payGradeExist) {
          oMembersModel.setProperty("/members", _.cloneDeep(mModelData));
          this.closeEmployeeSearch();
        } else {
          this.alertMessage(
            "E",
            "errorOperation",
            "memberLackOfPayGrade",
            [],
            null
          );
          // MessageBox.error("The selected member not having payGrade", {
          //   actions: [MessageBox.Action.CLOSE],
          //   onClose: function (sAction) {},
          //   dependentOn: that.getView(),
          // });
        }
      },
      closeEmployeeSearch: function () {
        if (this._oSearchEmployeeDialog) {
          this._oSearchEmployeeDialog.close &&
            this._oSearchEmployeeDialog.close();
        }
      },
      searchForEmployee: async function (oEvent) {
        const guid = this._oSearchEmployeeDialog.data("guid");
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oSource =
          this.byId("EmployeeSearchDialog") ||
          sap.ui.getCore().byId("EmployeeSearchDialog");

        const oMembersModel = this.getModel("membersModel");
        const mModelData = oMembersModel.getProperty("/members");
        const oEmployeesModel = this.getModel("employeesModel");

        const oMissionInfoModel = this.getModel("missionInfoModel");
        const oMissionInfo = oMissionInfoModel.getProperty("/info");

        let sValue = oEvent.getParameter("query")
          ? oEvent.getParameter("query").trim()
          : null;

        if (sValue != null && sValue != "" && sValue.length > 2) {
          oSource.setBusy(true);

          let filterObj = {
            type: "",
            value: sValue,
          };
          if (isNaN(parseInt(sValue))) {
            filterObj.type = "displayName";
          } else {
            filterObj.type = "personIdExternal";
          }
          const oPayload = {
            filter: filterObj,
            missionInfo: oMissionInfo,
          };

          var url = "/findMemberDetails";
          jQuery.ajax({
            type: "POST",
            url: url,
            contentType: "application/json",
            xhrFields: { withCredentials: true },
            data: JSON.stringify({
              data: oPayload,
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
              const decryptedData = await that.getDecryptedData(data);
              for (var i = 0; i < mModelData.length; i++) {
                if (mModelData[i].guid == guid) {
                  mModelData[i].userSuggest = sValue;
                }
              }
              oMembersModel.setProperty("/members", _.cloneDeep(mModelData));

              //--Set results
              const aEmployeeList =
                _.cloneDeep(JSON.parse(decryptedData)) || [];
              oEmployeesModel.setProperty("/employees", aEmployeeList);

              if (aEmployeeList.length > 0) {
                that.getPhotoAll();
              }

              oSource.setBusy(false);
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              oSource.setBusy(false);
              if (jqXHR.status == 401) {
                that.closeMission();
              }
              oEmployeesModel.setProperty("/employees", []);
            },
          });
        }
      },
      findMemberDetails: async function (guid, oEvent) {
        const that = this;
        const envInfo = await this.getEnvInfo();

        var sValue = oEvent.getParameter("suggestValue");
        var mModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        var employeesModel = new JSONModel({
          employees: [],
        });

        oEvent.oSource.setModel(employeesModel, "employeesModel");
        oEvent.oSource.suggest();

        if (sValue != null && sValue != "" && sValue.length > 2) {
          oEvent.oSource.setBusy(true);

          var filterObj = {
            type: "",
            value: sValue,
          };
          if (isNaN(parseInt(sValue))) {
            filterObj.type = "displayName";
          } else {
            filterObj.type = "personIdExternal";
          }
          var obj = {
            filter: filterObj,
          };

          var url = "/findMemberDetails";
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
              var decryptedData = await that.getDecryptedData(data);
              for (var i = 0; i < mModelData.length; i++) {
                if (mModelData[i].guid == guid) {
                  mModelData[i].userSuggest = sValue;
                }
              }
              var membersModel = new JSONModel({
                members: mModelData,
              });
              that.setModel(membersModel, "membersModel");

              var employeesModel = new JSONModel({
                employees: JSON.parse(decryptedData).d.results,
              });

              oEvent.oSource.setModel(employeesModel, "employeesModel");
              oEvent.oSource.setBusy(false);
              oEvent.oSource.suggest();

              if (JSON.parse(decryptedData).d.results.length > 0) {
                that.getPhoto(employeesModel, oEvent);
              }
            },
            error: async function (jqXHR, textStatus, errorDesc) {
              if (jqXHR.status == 401) {
                that.closeMission();
              }
              var employeesModel = new JSONModel({
                employees: [],
              });

              oEvent.oSource.setModel(employeesModel, "employeesModel");
              oEvent.oSource.setBusy(false);
              oEvent.oSource.suggest();
            },
          });
        }
      },

      getPhotoForEmployee: async function (oEvent) {
        const that = this;
        const envInfo = await that.getEnvInfo();
        const oSource = oEvent.getSource();

        var obj = {
          users: oSource.getKey(),
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
            oSource.setIcon(photo);
          },
          error: async function (jqXHR, textStatus, errorDesc) {
            console.log(errorDesc);
            oSource.setDefaultIcon();
          },
        });
      },
      getPhoto: async function (employeesModel, oEvent) {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oEmployeesModel = this.getModel("employeesModel");
        let employeesData = _.cloneDeep(
          oEmployeesModel.getProperty("/employees")
        );
        let users = "";
        for (var i = 0; i < employeesData.length; i++) {
          users += "'" + employeesData[i].personIdExternal + "'";
          if (i < employeesData.length - 1) {
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

            for (var i = 0; i < employeesData.length; i++) {
              for (var j = 0; j < photoData.length; j++) {
                if (employeesData[i].personIdExternal == photoData[j].userId) {
                  if (photoData[j].photo) {
                    employeesData[i].photoNav = {
                      mimeType: photoData[j].mimeType,
                      photo:
                        "data:" +
                        photoData[j].mimeType +
                        ";base64," +
                        photoData[j].photo,
                    };
                  } else {
                    employeesData[i].photoNav = {
                      mimeType: "default",
                      photo: that.userIcon,
                    };
                  }
                }
              }
            }

            for (var k = 0; k < employeesData.length; k++) {
              if (!employeesData[k].photoNav) {
                employeesData[k].photoNav = {
                  mimeType: "default",
                  photo: that.userIcon,
                };
              }
            }

            oEmployeesModel.setProperty("/employees", employeesData);
          },
          error: async function (jqXHR, textStatus, errorDesc) {
            if (jqXHR.status == 401) {
              that.closeMission();
            }
          },
        });
      },
      getPhotoAll: async function () {
        const that = this;
        const envInfo = await this.getEnvInfo();
        const oEmployeesModel = this.getModel("employeesModel");
        let employeesData = _.cloneDeep(
          oEmployeesModel.getProperty("/employees")
        );
        let users = "";
        for (let i = 0; i < employeesData.length; i++) {
          users += "'" + employeesData[i].personIdExternal + "'";
          if (i < employeesData.length - 1) {
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

            for (let i = 0; i < employeesData.length; i++) {
              for (let j = 0; j < photoData.length; j++) {
                if (employeesData[i].personIdExternal == photoData[j].userId) {
                  if (photoData[j].photo) {
                    employeesData[i].photoNav = {
                      mimeType: photoData[j].mimeType,
                      photo:
                        "data:" +
                        photoData[j].mimeType +
                        ";base64," +
                        photoData[j].photo,
                    };
                  } else {
                    employeesData[i].photoNav = {
                      mimeType: "default",
                      photo: that.userIcon,
                    };
                  }
                }
              }
            }

            for (var k = 0; k < employeesData.length; k++) {
              if (!employeesData[k].photoNav) {
                employeesData[k].photoNav = {
                  mimeType: "default",
                  photo: that.userIcon,
                };
              }
            }

            oEmployeesModel.setProperty("/employees", employeesData);
          },
          error: async function (jqXHR, textStatus, errorDesc) {
            if (jqXHR.status == 401) {
              that.closeMission();
            }
          },
        });
      },

      cityChange: async function (guid, id, oEvent) {
        const that = this;

        var membersModelData = this.getView()
          .getModel("membersModel")
          .getData().members;

        var cityValid = true;

        var currentCity = oEvent.getParameter("selectedItem").getKey();

        for (var i = 0; i < membersModelData.length; i++) {
          if (membersModelData[i].guid == guid) {
            var memberItinerary = membersModelData[i].itinerary;

            for (var j = 0; j < memberItinerary.length; j++) {
              if (memberItinerary[j].id != id) {
                if (currentCity == memberItinerary[j].city) {
                  cityValid = false;
                  break;
                }
              }
            }
          }
        }

        if (cityValid == false) {
          this.alertMessage("E", "errorsFound", "overlapCityError", [], null);
          // MessageBox.error(
          //   "Please select any other city which is not overlap with other cities",
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
                  if (currentCity == memberItinerary[j].city) {
                    memberItinerary[j].city = "";
                    break;
                  }
                }
              }
            }
          }

          var membersModel = new JSONModel({
            members: membersModelData,
          });

          this.setModel(membersModel, "membersModel");

          this.findTicketAndPerDiemPerCity(guid, id, oEvent, null);
        } else {
          this.findTicketAndPerDiemPerCity(guid, id, oEvent, null);
        }
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
        };
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

            // if (
            //   oEvent &&
            //   oEvent.oSource &&
            //   oEvent.oSource.aCustomStyleClasses
            // ) {
            //   if (
            //     oEvent.oSource.aCustomStyleClasses.indexOf(
            //       "itineraryHeadOfMission"
            //     ) > -1
            //   ) {
            // if (oEvent.oSource.getSelectedKey() == "Y") {
            //   if (mModelData[i].jobLevel == "4648") {
            //     oEvent.oSource.setSelectedKey("N");
            //     MessageBox.error(
            //       "Employee is not applicable for Head of Mission",
            //       {
            //         actions: [MessageBox.Action.CLOSE],
            //         onClose: function (sAction) {},
            //         dependentOn: that.getView(),
            //       }
            //     );
            //   }
            // }
            //   }
            // }
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

      onAttachmentMimeTypeMismatch: function () {
        const that = this;
        this.alertMessage(
          "E",
          "errorOperation",
          "attachmentFiletypeMismatch",
          [],
          null
        );
        // MessageBox.error("Please select only txt,png,pdf,jpg,xlsx file types", {
        //   actions: [MessageBox.Action.CLOSE],
        //   onClose: function (sAction) {},
        //   dependentOn: that.getView(),
        // });
      },

      handleTxtAreaLiveChange: function (oEvent) {
        var oTextArea = oEvent.getSource();
        this.byId("missionDetails").setValue(oTextArea.getValue());
      },
    });
  }
);
