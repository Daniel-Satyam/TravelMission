sap.ui.define([], function () {
    "use strict";
  
    return {
  
        formatDate: function(dt) {
            if(dt != null) {
                const timestamp = parseInt(dt.match(/\d+/)[0]); // Extract the timestamp
                const formattedDate = new Date(timestamp); // Convert to Date object
                const monthNames = ["Jan", "Feb", "Mar", "Apr",
                    "May", "Jun", "Jul", "Aug",
                    "Sep", "Oct", "Nov", "Dec"];
                return monthNames[(formattedDate.getMonth())] + " " + formattedDate.getDate() + ", " + formattedDate.getFullYear();
            }
        },

        formatDateStr: function(dt) {
            if(dt != null) {
                var dtSplit = dt.split("(");
                var formattedDate = new Date(Number(dtSplit[1].split(")")[0]));
                const monthNames = ["Jan", "Feb", "Mar", "Apr",
                    "May", "Jun", "Jul", "Aug",
                    "Sep", "Oct", "Nov", "Dec"];
                return monthNames[(formattedDate.getMonth())] + " " + formattedDate.getDate() + ", " + formattedDate.getFullYear();
            }
        },

        formatDateUI: function(dt) {
            if(dt != null) {
                var formattedDate = new Date(dt);
                return formattedDate;
            }
        },

        formatIsoDate:function (isoDate){
            try{
              const timestamp = parseInt(isoDate.match(/\d+/)[0], 10); // Extract number
              return this.formatDateHistory(new Date(timestamp)); // Convert to ISO format
            }catch(e){
              return null;
            }
        },

        formatDateHistory: function(dt) {
            if(dt != null) {
                var formattedDate = new Date(dt);

                if(formattedDate == "Invalid Date"){
                    var timestamp = parseInt(dt.match(/\d+/)[0], 10); // Extract number
                    if(timestamp){
                        formattedDate = new Date(timestamp);
                    }
                }
                const monthNames = ["Jan", "Feb", "Mar", "Apr",
                    "May", "Jun", "Jul", "Aug",
                    "Sep", "Oct", "Nov", "Dec"];
                return monthNames[(formattedDate.getMonth())] + " " + formattedDate.getDate() + ", " + formattedDate.getFullYear();
            }
        },

        formatAmount: function(amnt) {
            if(amnt != null) {
                var number = parseFloat(amnt).toFixed(2);
                var regex = /(\d)(?=(\d{3})+(?!\d))/g;
                var replacement = "$1,";
                var formattedNum = number.toString().replace(regex, replacement);
                return formattedNum;
            }
        },

        createAttachmentID: function() {
            var S4 = () => Math.floor((1+Math.random())*0x10000).toString(16).substring(1); 
			var guid = `${S4()}${S4()}-${S4()}-${S4()}-${S4()}-${S4()}${S4()}${S4()}`;
			return guid.toLowerCase();  
        },

        formatStatus: function(st) {
            var status = st;
            if(st != null && st != "") {
                if(st == "Pending") {
                    status = "In Process";
                }
            }
            return status;
        },

        getCity: function(id, lang, modelData) {
			var city = "";
			for(var i=0;i<modelData.length;i++) {
				if(modelData[i].externalCode == id) {
                    if(lang == 'en') {
                        city = modelData[i].localeLabel;
                    } else {
                        city = modelData[i].localeARLabel;
                    }
                    break;
				}
			}

			return 	city;		
		},

        getStatus: function(id, lang, modelData) {
			var status = "";
			for(var i=0;i<modelData.length;i++) {
				if(modelData[i].externalCode == id) {
                    if(lang == 'en') {
                        status = modelData[i].localeLabel;
                    } else {
                        status = modelData[i].localeARLabel;
                    }
                    break;
				}
			}

			return 	status;		
		},

        getEmployeeName: function(id, modelData) {

			var employeeName = "";
			for(var i=0;i<modelData.length;i++) {
				if(modelData[i].personIdExternal == id) {
					employeeName = modelData[i].personNav.personalInfoNav.results[0].firstName + " " + modelData[i].personNav.personalInfoNav.results[0].lastName;
					break;
				}
			}

			return employeeName;
		},

        formatDatetoJSON: function(d){
            let h = 12 * 60 * 60 * 1000;
		    let c = new Date(d);
			c.setTime(c.getTime() + h);
			return "\/Date(" + c.getTime() + ")\/";
        },
        constructPendingWith: function(oPendingWith, oPendingWithGroup, sLang){
            let sPending = "";
            
            if(oPendingWith && oPendingWith.userId){
                sPending = sLang === "en" ? `${oPendingWith.firstNameEn} ${oPendingWith.lastNameEn}` : `${oPendingWith.firstNameAr} ${oPendingWith.lastNameAr}`
            }

            let sPendingGroup = "";

            if(oPendingWithGroup && oPendingWithGroup.externalCode){
                sPendingGroup = sLang === "en" ? `${oPendingWithGroup.label_en_US}` : `${oPendingWithGroup.label_ar_SA}`; 
            }

            let c = sLang === "en" ? 'and' : 'و';

            if(sPending !== ""){
                return sPendingGroup !== "" ? `${sPending} ${c} ${sPendingGroup}` : sPending;
            }else if(sPendingGroup !== ""){
                return sPendingGroup;
            }
        }    
    };
  
}, true);