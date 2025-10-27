const approuter = require("@sap/approuter");
const bodyParser = require("body-parser");
const jsonParser = bodyParser.json({ limit: "15mb" });
const qs = require("querystring");
const xsenv = require("@sap/xsenv");
const axios = require("axios");
const forge = require("node-forge");
const crypto = require("crypto");
const ar = approuter();
const _ = require("lodash");
const { CustomHttpError } = require("./CustomError");
const cookieParser = require("cookie-parser");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const XLSX = require("xlsx");

const {
  ClientCredentials,
  ResourceOwnerPassword,
  AuthorizationCode,
} = require("simple-oauth2");

ar.beforeRequestHandler.use(jsonParser);

ar.beforeRequestHandler.use(cookieParser());

const sDestinationName = "TravelMission_SF_LOOKUP_PRODUCTION";

const sCPIDestinationName = "TravelMission_CPI_PRODUCTION";

const sCPIAuthDestinationName = "TravelMission_CPI_AUTH_PRODUCTION";

//const sDestinationName = "TravelMission_SF_LOOKUP_QA";

//const sCPIDestinationName = "TravelMission_CPI_QA";

//const sCPIAuthDestinationName = "TravelMission_CPI_AUTH_QA";

const sS4DestinationName = "TRAVEL_MISSION_BUDGET_S4";

xsenv.loadEnv();

const cfServices = xsenv.getServices({
  dest: { tag: "destination" },
  connectivity: { tag: "connectivity" },
  uaa: { tag: "xsuaa" },
});

// const dest_service = xsenv.getServices({ dest: { tag: "destination" } }).dest;
// const conn_service = xsenv.getServices({ connectivity: { tag: "connectivity" }});
// const uaa_service = xsenv.getServices({ uaa: { tag: "xsuaa" } }).uaa;
const dest_service = cfServices.dest;
const conn_service = cfServices.connectivity;
const uaa_service = cfServices.uaa;
const sUaaCredentials = dest_service.clientid + ":" + dest_service.clientsecret;

const AESKEY = "u/Gu5posvwDsXUnV5Zaq4g==";
const AESIV = "5D9r9ZVzEYYgha93/aUK2w==";

const _fetchCookies = async function (req) {
  try {
    const decryptedURLs = await _fetchDecryptedData(req.cookies.URLs);
    const cookiesRes = {
      SF: {
        URL: JSON.parse(decryptedURLs).SF,
        basicAuth: req.cookies.SFBasic,
      },
      S4: {
        URL: JSON.parse(decryptedURLs).S4,
        basicAuth: req.cookies.S4Basic,
        locationId: JSON.parse(decryptedURLs).S4LocationId,
      },
      CPI: {
        URL: JSON.parse(decryptedURLs).CPI,
        oAuth: req.cookies.CPIOAuth,
      },
    };

    return cookiesRes;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchDecryptedData = async function (data) {
  var decipher = forge.cipher.createDecipher("AES-CBC", AESKEY);
  decipher.start({ iv: AESIV });
  decipher.update(forge.util.createBuffer(forge.util.hexToBytes(data)));
  decipher.finish();
  return JSON.parse(JSON.stringify(decipher.output.toString()));
};

const _fetchEncryptedData = async function (data) {
  try {
    var cipher = forge.cipher.createCipher("AES-CBC", AESKEY);
    cipher.start({ iv: AESIV });
    cipher.update(forge.util.createBuffer(data));
    cipher.finish();
    var encrypted = cipher.output;
    return encrypted.toHex();
  } catch (e) {
    console.log("Fetch encrypted data error:" + e);
  }
};

const _fetchCFAuthToken = async function () {
  try {
    const tokenUrl = uaa_service.url + "/oauth/token";

    const response = await axios.post(
      tokenUrl,
      qs.stringify({ grant_type: "client_credentials" }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " + Buffer.from(sUaaCredentials).toString("base64"),
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.log("Fetch CF Token Error:" + error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchJwtToken = async function (oauthUrl, oauthClient, oauthSecret) {
  return new Promise((resolve, reject) => {
    const tokenUrl =
      oauthUrl +
      "/oauth/token?grant_type=client_credentials&response_type=token";
    const config = {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(oauthClient + ":" + oauthSecret).toString("base64"),
      },
    };
    axios
      .get(tokenUrl, config)
      .then((response) => {
        resolve(response.data.access_token);
      })
      .catch((error) => {
        reject(error);
      });
  });
};

const _fetchCPIAuthToken = async function (CFAuthToken) {
  try {
    const destinationName = sCPIAuthDestinationName;
    const fetchCPIAuthDestinationInfo = await _fetchDestinationInfo(
      destinationName,
      CFAuthToken
    );

    const config = {
      client: {
        id: fetchCPIAuthDestinationInfo.destinationConfiguration.User,
        secret: fetchCPIAuthDestinationInfo.destinationConfiguration.Password,
      },
      auth: {
        tokenHost: fetchCPIAuthDestinationInfo.destinationConfiguration.URL,
        tokenPath: "/oauth2/api/v1/token",
      },
    };
    const client = new ClientCredentials(config);
    const tokenParams = {
      grant_type: "client_credentials",
    };

    const fetchCPIAuthTokenRes = await client.getToken(tokenParams);
    return JSON.parse(JSON.stringify(fetchCPIAuthTokenRes)).access_token;
  } catch (error) {
    console.log("Fetch CPI Token Error:" + error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchDestinationInfo = async function (destinationName, token) {
  try {
    const tokenUrl =
      dest_service.uri +
      "/destination-configuration/v1/destinations/" +
      destinationName;
    const config = {
      headers: {
        Authorization: "Bearer " + token,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    console.log(`Fetch ${destinationName} Destination Error:` + error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchLoggedinInfo = async function (decryptedData, cookies) {
  try {
    const url = cookies.CPI.URL + "getLoggedinInfo";
    var auth = "Bearer " + cookies.CPI.oAuth;
    const config = {
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
        userEmail: decryptedData.user,
      },
    };
    const response = await axios.get(url, config);
    return response.data;
  } catch (error) {
    if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 401
    ) {
      throw new CustomHttpError(401, "Unauthorized");
    } else if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 400
    ) {
      throw new CustomHttpError(400, "No user found");
    } else {
      throw new CustomHttpError(500, "Something went wrong. Please try again");
    }
  }
};

const _fetchCities = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$filter=picklistId eq 'Destination' and picklistOptions/status eq 'ACTIVE'&$format=json";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchHospitalityOptions = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "Picklist?$expand=picklistOptions, picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$filter=picklistId eq 'Hospitality_Default' and picklistOptions/status eq 'ACTIVE'&$format=json";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchSectors = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "cust_SectorBudget?$format=json&$select=externalCode,externalName_localized,externalName_ar_SA,cust_Utilized_Budget,cust_Parked_Amount,cust_Budget,cust_Available_budget,cust_Delegate_Approver_for_Missions,cust_Head_of_Sector,cust_Delegate_Dynamic_group";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchDecreeTypes = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$filter=picklistId eq 'Decree_name_mission' and picklistOptions/status eq 'ACTIVE'&$format=json";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchTicketTypes = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$format=json&$filter=picklistId eq 'Ticket_Type' and picklistOptions/status eq 'ACTIVE'";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchFlightTypes = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$format=json&$filter=picklistId eq 'Flight_type_mission' and picklistOptions/status eq 'ACTIVE'";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchMulticites = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$filter=picklistId eq 'yesNo' and picklistOptions/status eq 'ACTIVE'&$format=json";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchHeadOfMission = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$filter=picklistId eq 'yesNo' and picklistOptions/status eq 'ACTIVE'&$format=json";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchMissionBudgetInfo = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "cust_SectorBudget?$format=json&$select=externalCode,externalName_localized,externalName_ar_SA,cust_Utilized_Budget,cust_Parked_Amount,cust_Budget,cust_Available_budget";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchMemberDetails = async function (decryptedData, cookies) {
  try {
    const { filter, missionInfo } = decryptedData;
    let employeeFetchUrl =
      cookies.SF.URL +
      "EmpEmployment?$format=json&$top=30&$select=personIdExternal,userId,jobInfoNav/jobCode,jobInfoNav/jobTitle,jobInfoNav/payGrade,jobInfoNav/position,jobInfoNav/payGradeNav/paygradeLevel,jobInfoNav/payGradeNav/name,personNav/personalInfoNav/displayName,personNav/personalInfoNav/firstName,personNav/personalInfoNav/salutationNav/picklistLabels/label,personNav/personalInfoNav/lastName,personNav/personalInfoNav/firstNameAlt1,personNav/personalInfoNav/lastNameAlt1,userNav/title,userNav/department,jobInfoNav/customString6,jobInfoNav/emplStatusNav&$expand=jobInfoNav,jobInfoNav/payGradeNav,personNav/personalInfoNav,personNav/personalInfoNav/salutationNav/picklistLabels,userNav,jobInfoNav/emplStatusNav";

    if (filter.type == "personIdExternal") {
      employeeFetchUrl +=
        "&$filter=personIdExternal like '" +
        filter.value +
        "%' and jobInfoNav/emplStatusNav/externalCode ne 'T'";
    } else if (filter.type == "displayName") {
      employeeFetchUrl +=
        "&$filter=personNav/personalInfoNav/displayName like '%" +
        filter.value +
        "%' and jobInfoNav/emplStatusNav/externalCode ne 'T'";
    } else if (filter.type == "nofilter") {
      employeeFetchUrl +=
        "&$filter=personIdExternal eq '" +
        filter.value +
        "' and jobInfoNav/emplStatusNav/externalCode ne 'T'";
    }

    const auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(encodeURI(employeeFetchUrl), config);

    const aEmployeeList =
      response.data && response.data.d && response.data.d.results
        ? response.data.d.results
        : [];

    if (aEmployeeList && aEmployeeList.length > 0) {
      let startDate = missionInfo.missionStartDate;
      let endDate = missionInfo.missionEndDate;
      let userIds = "";
      aEmployeeList.forEach((m) => {
        userIds = userIds === "" ? `'${m.userId}'` : `${userIds},'${m.userId}'`;
        m.available = true;
      });

      let memberCheckFilter =
        `cust_Status in '1','2','5' and cust_Members/cust_Employee_ID in ${userIds} and ` +
        `cust_Members/cust_itinerary_details_child/cust_start_date le datetimeoffset'${endDate}' and ` +
        `cust_Members/cust_itinerary_details_child/cust_end_date ge datetimeoffset'${startDate}'`;

      if (missionInfo.missionID) {
        memberCheckFilter =
          memberCheckFilter + ` and externalCode ne '${missionInfo.missionID}'`;
      }
      let memberCheckSelect =
        "externalCode,cust_Status,cust_Members/cust_Employee_ID,cust_Members/cust_EmployeeID,cust_Members/cust_First_Name,cust_Members/cust_Last_Name,cust_Members/cust_Mission_ID,cust_Members/cust_Mission_externalCode,cust_Members/cust_itinerary_details_child/cust_start_date,cust_Members/cust_itinerary_details_child/cust_end_date,cust_Members/cust_itinerary_details_child/cust_city";

      let memberCheckUrl =
        cookies.SF.URL +
        `cust_Mission?$format=json&$filter=${memberCheckFilter}&$select=${memberCheckSelect}&$expand=cust_Members,cust_Members/cust_itinerary_details_child`;

      const memberCheckResponse = await axios.get(
        encodeURI(memberCheckUrl),
        config
      );

      if (
        memberCheckResponse &&
        memberCheckResponse.data &&
        memberCheckResponse.data.d &&
        memberCheckResponse.data.d.results
      ) {
        memberCheckResponse.data.d.results.forEach((m0) => {
          if (m0.cust_Members && m0.cust_Members.results) {
            m0.cust_Members.results.forEach((m1) => {
              const i =
                _.findIndex(aEmployeeList, ["userId", m1.cust_Employee_ID]) ||
                -1;
              if (i >= 0) {
                aEmployeeList[i].available = false;
              }
            });
          }
        });
      }
    }

    return aEmployeeList;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchPhoto = async function (decryptedData, cookies) {
  try {
    var tokenUrl =
      cookies.SF.URL +
      "Photo?$format=json&$select=userId,mimeType,photo,&$filter=photoType eq 1 and userId in " +
      decryptedData;

    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchPhotoForMember = async function (decryptedData, cookies) {
  try {
    var tokenUrl =
      cookies.SF.URL +
      "Photo?$format=json&$select=userId,mimeType,photo,&$filter=photoType eq 1 and userId eq " +
      decryptedData;

    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchTicketAndPerDiem = async function (decryptedData, cookies) {
  try {
    const url = cookies.CPI.URL + "findTicketAndPerDiemPerCity";
    var auth = "Bearer " + cookies.CPI.oAuth;
    const config = {
      method: "get",
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify(decryptedData),
    };

    const response = await axios.request(config);
    //--Make ticket costs zero for private and military
    if(decryptedData.hasOwnProperty("flightType") && (decryptedData.flightType === "2" || decryptedData.flightType === "3")) {
      response.data["ticketAverage"] = 0;
    }
    //--Make ticket costs zero  for private and military
    return response.data;
  } catch (error) {
    if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 401
    ) {
      throw new CustomHttpError(401, "Unauthorized");
    } else {
      throw new CustomHttpError(500, "Something went wrong. Please try again");
    }
  }
};

const _updateItineraryBatch = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;
    const sectorFetchUrl =
      "cust_SectorBudget?$format=json&$filter=externalCode eq '" +
      body.info.sector +
      "'&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
    const selectQuery =
      "externalCode,effectiveStartDate,transactionSequence,cust_Mission_Start_Date,cust_Mission_End_Date,cust_No_Of_Days," +
      "cust_ReplicationFlag,cust_Hospitality_Type,cust_Flight_type,cust_Destination,cust_TotalPerdiemMission,cust_TicketAverage," +
      "cust_Total_Expense,cust_Budget_Available,cust_Budget_Parked,cust_Members/cust_Mission_effectiveStartDate,cust_Members/cust_Mission_externalCode," +
      "cust_Members/cust_Mission_transactionSequence,cust_Members/cust_Employee_ID,cust_Members/cust_EmployeeID,cust_Members/cust_Employee_Total_Ticket," +
      "cust_Members/cust_Employee_Total_Perdiem,cust_Members/cust_Employee_Total_Expense," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_effectiveStartDate," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_externalCode,cust_Members/cust_itinerary_details_child/cust_Members_externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_transactionSequence,cust_Members/cust_itinerary_details_child/externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_start_date,cust_Members/cust_itinerary_details_child/cust_end_date," +
      "cust_Members/cust_itinerary_details_child/cust_head_of_mission,cust_Members/cust_itinerary_details_child/cust_hospitality_default," +
      "cust_Members/cust_itinerary_details_child/cust_city,cust_Members/cust_itinerary_details_child/cust_ticket_type," +
      "cust_Members/cust_itinerary_details_child/cust_ticket_average,cust_Members/cust_itinerary_details_child/cust_perdiem_per_city," +
      "cust_Members/cust_itinerary_details_child/cust_Ticket_Actual_Cost";

    const expandQuery =
      "cust_Members,cust_Members/cust_itinerary_details,cust_Members/cust_itinerary_details_child";
    const missionFetchUrl = `cust_Mission?$format=json&$filter=externalCode eq '${body.info.missionId}'&$select=${selectQuery}&$expand=${expandQuery}`;

    let boundary = `batch_${crypto.randomUUID()}`; // batch id

    const batchURL = cookies.SF.URL + "$batch?$format=json";

    const getBatchBody =
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${sectorFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${missionFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}--`;

    const batchResponse = await axios.post(batchURL, getBatchBody, {
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
    });

    //Extract and handle each individual response from the batch
    const batchResult = (await _parseMultipartResponse(batchResponse)) || [];

    if (batchResult[0] && batchResult[1]) {
      const sectorData = _.cloneDeep(batchResult[0].d.results[0]);

      let sectorUpdateRequest = {
        __metadata: sectorData.__metadata,
        cust_Available_budget: body.info.sectorAvailableBudget,
        cust_Utilized_Budget: body.info.sectorUtilizedBudget,
      };

      const missionData = _.cloneDeep(batchResult[1].d.results[0]);

      let missionUpdateRequest = {
        __metadata: missionData.__metadata,
        //--Update related fields
        cust_Total_Expense: body.info.missionTotalExpense,
        cust_TicketAverage: body.info.missionTotalTicketCost,
        cust_TotalPerdiemMission: body.info.missionTotalPerdiem,
        cust_Budget_Available: body.info.sectorAvailableBudget,
        cust_Members: {
          results: [],
        },
      };
      missionData.cust_Members.results.forEach((oMember) => {
        const oMemberFound = _.find(body.members, [
          "employeeID",
          oMember.cust_EmployeeID,
        ]);
        if (oMemberFound) {
          let memberUpdateRequest = {
            __metadata: oMember.__metadata,
            cust_Employee_Total_Expense: oMemberFound.employeeTotalExpense,
            cust_Employee_Total_Perdiem: oMemberFound.employeeTotalPerdiem,
            cust_Employee_Total_Ticket: oMemberFound.employeeTotalTicket,
            cust_itinerary_details_child: {
              results: [],
            },
          };

          oMember.cust_itinerary_details_child.results.forEach(
            (oItinerary, i) => {
              const oItineraryFound = _.find(oMemberFound.itinerary, [
                "externalCode",
                oItinerary.externalCode,
              ]);

              if (oItineraryFound) {
                let itineraryUpdateRequest = {
                  __metadata: oItinerary.__metadata,
                  cust_start_date: oItineraryFound.startDate,
                  cust_end_date: oItineraryFound.endDate,
                  cust_ticket_type: oItineraryFound.ticketType,
                  cust_perdiem_per_city: oItineraryFound.perDiemPerCity,
                  cust_Ticket_Actual_Cost: oItineraryFound.ticketActualCost,
                  cust_ticket_average: oItineraryFound.ticketAverage,
                };
                memberUpdateRequest.cust_itinerary_details_child.results.push(
                  itineraryUpdateRequest
                );
              }
            }
          );

          missionUpdateRequest.cust_Members.results.push(memberUpdateRequest);
        }
      });

      let auditLogUpdateRequest = {
        __metadata: {
          uri: cookies.SF.URL + "cust_Audit_Log",
        },
        externalCode: "1234",
        cust_Timestamp: body.info.date,
        cust_Key: body.info.missionId,
        cust_User: body.info.loggedInUser,
        cust_Action: "GS group update",
        cust_Comments:
          "GS group updated ticket cost for Mission " + body.info.missionId,
      };

      //--Generate request
      let postBoundary = `batch_${crypto.randomUUID()}`; // batch id
      let changeSet = `changeset_${crypto.randomUUID()}`; // changeset id
      const postBatchBody =
        `--${postBoundary}\r\n` +
        `Content-Type: multipart/mixed; boundary=${changeSet}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(sectorUpdateRequest)}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(missionUpdateRequest)}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(auditLogUpdateRequest)}\r\n\r\n` +
        `--${changeSet}--\r\n\r\n` +
        `--${postBoundary}--`;

      const postBatchResponse = await axios.post(batchURL, postBatchBody, {
        headers: {
          Authorization: auth,
          "Content-Type": `multipart/mixed; boundary=${postBoundary}`,
        },
      });

      //Extract and handle each individual response from the batch
      const postBatchResult =
        (await _parseMultipartResponse(postBatchResponse)) || [];

      if (postBatchResult[0] && postBatchResult[1] && postBatchResult[2]) {
        return {
          status: "OK",
        };
      } else {
        return {
          status: "NOT_OK",
        };
      }
    } else {
      throw new Error("Sector or mission data could not be read!");
    }
  } catch (e) {
    console.log("Update itinerary batch error:" + error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _updateItinerary = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    const memberFetchUrl =
      cookies.SF.URL +
      "cust_Members?$format=json&$filter=cust_Mission_externalCode eq '" +
      decryptedData.missionId +
      "' and cust_EmployeeID eq '" +
      decryptedData.employeeId +
      "' &$select=cust_Mission_effectiveStartDate,cust_Mission_externalCode,cust_Mission_transactionSequence,externalCode,cust_Employee_ID,cust_EmployeeID,cust_Employee_Total_Expense,cust_Employee_Total_Ticket,cust_Employee_Total_Perdiem";
    const memberFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const memberFetchResponse = await axios.get(
      memberFetchUrl,
      memberFetchConfig
    );
    if (memberFetchResponse && memberFetchResponse.data) {
      const memberUpdateRequest = memberFetchResponse.data.d.results[0];

      const itineraryFetchUrl =
        cookies.SF.URL +
        "cust_itinerary_details_child?$format=json&$select=cust_Mission_effectiveStartDate,cust_Mission_externalCode,cust_Mission_transactionSequence,cust_Members_externalCode,externalCode,cust_city,cust_start_date,cust_end_date,cust_ticket_average,cust_perdiem_per_city,cust_Ticket_Actual_Cost&$filter=cust_Mission_externalCode eq '" +
        decryptedData.missionId +
        "' and cust_city eq '" +
        decryptedData.itineraryCity +
        "' and cust_Members_externalCode eq '" +
        memberUpdateRequest.externalCode +
        "'";
      const itineraryFetchConfig = {
        headers: {
          Authorization: auth,
        },
      };
      const itineraryFetchResponse = await axios.get(
        itineraryFetchUrl,
        itineraryFetchConfig
      );
      if (itineraryFetchResponse && itineraryFetchResponse.data) {
        const itineraryUpdateRequest = itineraryFetchResponse.data.d.results[0];
        itineraryUpdateRequest.__metadata.uri =
          cookies.SF.URL + "cust_itinerary_details_child";
        itineraryUpdateRequest.cust_start_date =
          decryptedData.itineraryStartDate;
        itineraryUpdateRequest.cust_end_date = decryptedData.itineraryEndDate;
        itineraryUpdateRequest.cust_ticket_average =
          decryptedData.itinerayTicketAverage.toString();
        itineraryUpdateRequest.cust_perdiem_per_city =
          decryptedData.itinerayPerDiem;
        itineraryUpdateRequest.cust_Ticket_Actual_Cost =
          decryptedData.itinerayActualCost;
        itineraryUpdateRequest.cust_ticket_type =
          decryptedData.itineraryTicketType;

        const itineraryUpdateUrl = cookies.SF.URL + "upsert";
        const itineraryUpdateConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: itineraryUpdateUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify(itineraryUpdateRequest),
        };
        const itineraryUpdateResponse = await axios.request(
          itineraryUpdateConfig
        );
        if (itineraryUpdateResponse) {
          memberUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_Members";
          memberUpdateRequest.cust_Employee_Total_Expense =
            decryptedData.memberTotalExpense;
          memberUpdateRequest.cust_Employee_Total_Perdiem =
            decryptedData.memberTotalPerDiem;
          memberUpdateRequest.cust_Employee_Total_Ticket =
            decryptedData.memberTotalTicketCost;

          const memberUpdateUrl = cookies.SF.URL + "upsert";
          const memberUpdateConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: memberUpdateUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify(memberUpdateRequest),
          };
          const memberUpdateResponse = await axios.request(memberUpdateConfig);
          if (memberUpdateResponse && memberUpdateResponse.data) {
            const missionFetchUrl =
              cookies.SF.URL +
              "cust_Mission?$format=json&$filter=externalCode eq '" +
              decryptedData.missionId +
              "' &$select=externalCode,externalName,effectiveStartDate,transactionSequence, cust_Budget_Available,cust_Total_Expense,cust_TicketAverage,cust_TotalPerdiemMission";
            const missionFetchConfig = {
              headers: {
                Authorization: auth,
              },
            };
            const missionFetchResponse = await axios.get(
              missionFetchUrl,
              missionFetchConfig
            );

            if (missionFetchResponse && missionFetchResponse.data) {
              const missionUpdateRequest =
                missionFetchResponse.data.d.results[0];
              missionUpdateRequest.__metadata.uri =
                cookies.SF.URL + "cust_Mission";
              missionUpdateRequest.cust_Total_Expense =
                decryptedData.missionTotalExpense;
              missionUpdateRequest.cust_TicketAverage =
                decryptedData.missionTotalTicketCost;
              missionUpdateRequest.cust_TotalPerdiemMission =
                decryptedData.missionTotalPerdiem;
              missionUpdateRequest.cust_Budget_Available =
                decryptedData.sectorAvailableBudget;

              const missionUpdateUrl = cookies.SF.URL + "upsert";
              const missionUpdateConfig = {
                method: "post",
                maxBodyLength: Infinity,
                url: missionUpdateUrl,
                headers: {
                  Authorization: auth,
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                data: JSON.stringify(missionUpdateRequest),
              };
              const missionUpdateResponse = await axios.request(
                missionUpdateConfig
              );
              if (missionUpdateResponse && missionUpdateResponse.data) {
                const sectorFetchUrl =
                  cookies.SF.URL +
                  "cust_SectorBudget?$format=json&$filter=externalCode eq " +
                  decryptedData.sector +
                  "&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
                const sectorFetchConfig = {
                  headers: {
                    Authorization: auth,
                  },
                };
                const sectorFetchResponse = await axios.get(
                  sectorFetchUrl,
                  sectorFetchConfig
                );

                if (sectorFetchResponse && sectorFetchResponse.data) {
                  const sectorUpdateRequest =
                    sectorFetchResponse.data.d.results[0];
                  sectorUpdateRequest.__metadata.uri =
                    cookies.SF.URL + "cust_SectorBudget";
                  sectorUpdateRequest.cust_Available_budget =
                    decryptedData.sectorAvailableBudget;
                  sectorUpdateRequest.cust_Utilized_Budget =
                    decryptedData.sectorUtilizedBudget;

                  const sectorUpdateUrl = cookies.SF.URL + "upsert";
                  const sectorUpdateConfig = {
                    method: "post",
                    maxBodyLength: Infinity,
                    url: sectorUpdateUrl,
                    headers: {
                      Authorization: auth,
                      "Content-Type": "application/json",
                      Accept: "application/json",
                    },
                    data: JSON.stringify(sectorUpdateRequest),
                  };
                  const sectorUpdateResponse = await axios.request(
                    sectorUpdateConfig
                  );
                  if (sectorUpdateResponse && sectorUpdateResponse.data) {
                    var auditLogUrl =
                      cookies.SF.URL + "cust_Audit_Log?$format=json";

                    const auditLogConfig = {
                      method: "post",
                      maxBodyLength: Infinity,
                      url: auditLogUrl,
                      headers: {
                        Authorization: auth,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                      },
                      data: JSON.stringify({
                        __metadata: {
                          uri: cookies.SF.URL + "cust_Audit_Log",
                        },
                        externalCode: "1234",
                        cust_Timestamp: decryptedData.date,
                        cust_Key: decryptedData.missionId,
                        cust_User: decryptedData.loggedInUser,
                        cust_Action: "GS group update",
                        cust_Comments:
                          "GS group updated ticket cost for Mission " +
                          decryptedData.missionId,
                      }),
                    };
                    await axios.request(auditLogConfig);
                    return true;
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchMissions = async function (decryptedData, cookies) {
  try {
    const url = cookies.CPI.URL + "findMissions";
    var auth = "Bearer " + cookies.CPI.oAuth;
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
        loggedInUserId: decryptedData.user,
      },
    };
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 401
    ) {
      throw new CustomHttpError(401, "Unauthorized");
    } else {
      throw new CustomHttpError(500, "Something went wrong. Please try again");
    }
  }
};

const _createMission = async function (body, userInfo, cookies) {
  try {
    const url = cookies.CPI.URL + "createMission";
    var auth = "Bearer " + cookies.CPI.oAuth;
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
        loggedInUserId: userInfo,
      },
      data: JSON.stringify(body),
    };
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 401
    ) {
      throw new CustomHttpError(401, "Unauthorized");
    } else if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 400
    ) {
      throw new CustomHttpError(400, error.response.data.message);
    } else {
      throw new CustomHttpError(500, "Something went wrong. Please try again");
    }
  }
};

const _getMissionInfo = async function (mission, user, cookies) {
  try {
    const url = cookies.CPI.URL + "getMissionById";
    var auth = "Bearer " + cookies.CPI.oAuth;

    const config = {
      method: "get",
      url: url,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
        loggedInUserId: user,
        missionId: mission,
      },
    };

    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 401
    ) {
      throw new CustomHttpError(401, "Unauthorized");
    } else {
      throw new CustomHttpError(500, "Something went wrong. Please try again");
    }
  }
};

const _approveRejectMission = async function (data, cookies) {
  try {
    const url = cookies.CPI.URL + "approve";
    var auth = "Bearer " + cookies.CPI.oAuth;

    const config = {
      method: "post",
      url: url,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
        missionId: data.mission,
      },
      data: JSON.stringify(data.payload),
    };

    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 401
    ) {
      throw new CustomHttpError(401, "Unauthorized");
    } else {
      throw new CustomHttpError(500, "Something went wrong. Please try again");
    }
  }
};

const _claimMission_v1 = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;
    var SFAuth = Buffer.from(cookies.SF.basicAuth, "base64").toString("utf-8");
    var SFAuthUsername = SFAuth.split(":")[0].split("@")[0];

    const postClaimAttachmentUrl = cookies.SF.URL + "upsert?$format=json";

    const postClaimAttachmentConfig = {
      method: "post",
      maxBodyLength: Infinity,
      url: postClaimAttachmentUrl,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify({
        __metadata: {
          uri: cookies.SF.URL + "Attachment",
          type: "SFOData.Attachment",
        },
        userId: SFAuthUsername,
        fileName: decryptedData.attachments[0].fileName,
        module: "GENERIC_OBJECT",
        viewable: true,
        fileContent: decryptedData.attachments[0].file,
      }),
    };

    const postClaimAttachmentResponse = await axios.request(
      postClaimAttachmentConfig
    );

    if (
      postClaimAttachmentResponse &&
      postClaimAttachmentResponse.data &&
      postClaimAttachmentResponse.data.d.length > 0
    ) {
      const attachmentKey = postClaimAttachmentResponse.data.d[0].key;
      const attachmentId = attachmentKey.split("=")[1];
      var getApproveGroupUrl =
        cookies.SF.URL +
        "cust_Parameters_for_Mission?$format=json&$select=cust_key,cust_Value&$filter=externalCode eq 'Payroll_Group_Mission'";

      const getApproveGroupConfig = {
        headers: {
          Authorization: auth,
        },
      };

      const getApproveGroupResponse = await axios.get(
        getApproveGroupUrl,
        getApproveGroupConfig
      );

      if (
        getApproveGroupResponse &&
        getApproveGroupResponse.data &&
        getApproveGroupResponse.data.d.results.length > 0
      ) {
        const approveGroup =
          getApproveGroupResponse.data.d.results[0].cust_Value;

        var checkClaimUrl =
          cookies.SF.URL +
          "cust_BenefitTravelClaim?$format=json&$filter=cust_EmployeeID eq '" +
          decryptedData.employeeId +
          "' and cust_MissionID eq '" +
          decryptedData.missionId +
          "'";

        const checkClaimConfig = {
          headers: {
            Authorization: auth,
          },
        };

        const checkClaimResponse = await axios.get(
          checkClaimUrl,
          checkClaimConfig
        );

        const postClaimUrl = cookies.SF.URL + "upsert?$format=json";
        var postClaimConfig = null;
        if (
          checkClaimResponse &&
          checkClaimResponse.data &&
          checkClaimResponse.data.d.results.length > 0
        ) {
          var claimRequest = checkClaimResponse.data.d.results[0];
          postClaimConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: postClaimUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify({
              __metadata: {
                uri: cookies.SF.URL + "cust_BenefitTravelClaim",
              },
              externalCode: claimRequest.externalCode,
              mdfSystemEffectiveStartDate:
                claimRequest.mdfSystemEffectiveStartDate,
              cust_EmployeeID: claimRequest.cust_EmployeeID,
              // cust_MissionID: claimRequest.cust_MissionID,
              cust_MissionID: decryptedData.missionId,
              cust_startDate: decryptedData.claimStartDate,
              cust_EndDate: decryptedData.claimEndDate,
              cust_ClaimAmount: decryptedData.claimAmount,
              cust_attachmentNav: {
                __metadata: {
                  uri: cookies.SF.URL + "Attachment(" + attachmentId + ")",
                },
              },
              cust_Status: decryptedData.status,
              cust_Pending_with: approveGroup,
              cust_Claim_Parked: decryptedData.claimParked,
            }),
          };
        } else {
          postClaimConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: postClaimUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify({
              __metadata: {
                uri: cookies.SF.URL + "cust_BenefitTravelClaim",
              },
              externalName:
                "The claim creation in mission " + decryptedData.missionId,
              mdfSystemEffectiveStartDate: decryptedData.date,
              cust_Claim_Type: decryptedData.type,
              cust_EmployeeID: decryptedData.employeeId,
              cust_MissionID: decryptedData.missionId,
              cust_startDate: decryptedData.claimStartDate,
              cust_EndDate: decryptedData.claimEndDate,
              cust_Description:
                "The claim creation for " +
                decryptedData.employeeId +
                " on mission " +
                decryptedData.missionId,
              cust_Location: decryptedData.location,
              cust_ClaimAmount: decryptedData.claimAmount,
              cust_Currency: "AED",
              cust_attachmentNav: {
                __metadata: {
                  uri: cookies.SF.URL + "Attachment(" + attachmentId + ")",
                },
              },
              cust_Status: decryptedData.status,
              cust_Pending_with: approveGroup,
              cust_Claim_Parked: decryptedData.claimParked,
            }),
          };
        }

        const postClaimResponse = await axios.request(postClaimConfig);

        if (
          postClaimResponse &&
          postClaimResponse.data &&
          postClaimResponse.data.d &&
          postClaimResponse.data.d.length > 0 &&
          postClaimResponse.data.d[0].httpCode == 200
        ) {
          const memberFetchUrl =
            cookies.SF.URL +
            "cust_Members?$format=json&$filter=cust_Mission_externalCode eq '" +
            decryptedData.missionId +
            "' and cust_Employee_ID eq '" +
            decryptedData.employeeId +
            "' &$select=cust_Mission_effectiveStartDate,cust_Mission_externalCode,cust_Mission_transactionSequence,externalCode,cust_Employee_ID,cust_EmployeeID,cust_Employee_Total_Expense,cust_Employee_Total_Ticket,cust_Employee_Total_Perdiem";
          const memberFetchConfig = {
            headers: {
              Authorization: auth,
            },
          };
          const memberFetchResponse = await axios.get(
            memberFetchUrl,
            memberFetchConfig
          );
          if (memberFetchResponse && memberFetchResponse.data) {
            const memberUpdateRequest = memberFetchResponse.data.d.results[0];

            for (var it = 0; it < decryptedData.itinerary.length; it++) {
              var itineraryFetchUrl =
                cookies.SF.URL +
                "cust_itinerary_details_child?$format=json&$select=cust_Mission_effectiveStartDate,cust_Mission_externalCode,cust_Mission_transactionSequence,cust_Members_externalCode,externalCode,cust_city,cust_start_date,cust_end_date,cust_ticket_average,cust_perdiem_per_city,cust_Ticket_Actual_Cost&$filter=cust_Mission_externalCode eq '" +
                decryptedData.missionId +
                "' and cust_city eq '" +
                decryptedData.itinerary[it].itineraryCity +
                "' and cust_Members_externalCode eq '" +
                memberUpdateRequest.externalCode +
                "'";
              var itineraryFetchConfig = {
                headers: {
                  Authorization: auth,
                },
              };

              var itineraryFetchResponse = await axios.get(
                itineraryFetchUrl,
                itineraryFetchConfig
              );
              if (itineraryFetchResponse && itineraryFetchResponse.data) {
                var itineraryUpdateRequest =
                  itineraryFetchResponse.data.d.results[0];
                itineraryUpdateRequest.__metadata.uri =
                  cookies.SF.URL + "cust_itinerary_details_child";
                itineraryUpdateRequest.cust_start_date =
                  decryptedData.itinerary[it].itineraryStartDate;
                itineraryUpdateRequest.cust_end_date =
                  decryptedData.itinerary[it].itineraryEndDate;
                itineraryUpdateRequest.cust_ticket_average =
                  decryptedData.itinerary[it].itinerayTicketAverage.toString();
                itineraryUpdateRequest.cust_perdiem_per_city =
                  decryptedData.itinerary[it].itinerayPerDiem;

                var itineraryUpdateUrl = cookies.SF.URL + "upsert";
                var itineraryUpdateConfig = {
                  method: "post",
                  maxBodyLength: Infinity,
                  url: itineraryUpdateUrl,
                  headers: {
                    Authorization: auth,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  data: JSON.stringify(itineraryUpdateRequest),
                };
                await axios.request(itineraryUpdateConfig);
              }
            }

            memberUpdateRequest.__metadata.uri =
              cookies.SF.URL + "cust_Members";
            memberUpdateRequest.cust_Employee_Total_Expense =
              decryptedData.memberTotalExpense;
            memberUpdateRequest.cust_Employee_Total_Perdiem =
              decryptedData.memberTotalPerDiem;
            memberUpdateRequest.cust_Employee_Total_Ticket =
              decryptedData.memberTotalTicketCost;
            memberUpdateRequest.cust_Claimed = "Y";

            const memberUpdateUrl = cookies.SF.URL + "upsert";
            const memberUpdateConfig = {
              method: "post",
              maxBodyLength: Infinity,
              url: memberUpdateUrl,
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              data: JSON.stringify(memberUpdateRequest),
            };
            await axios.request(memberUpdateConfig);
          }

          const missionFetchUrl =
            cookies.SF.URL +
            "cust_Mission?$format=json&$filter=externalCode eq '" +
            decryptedData.missionId +
            "' &$select=externalCode,externalName,effectiveStartDate,transactionSequence,cust_Budget_Available,cust_Total_Expense,cust_TicketAverage,cust_TotalPerdiemMission";
          const missionFetchConfig = {
            headers: {
              Authorization: auth,
            },
          };
          const missionFetchResponse = await axios.get(
            missionFetchUrl,
            missionFetchConfig
          );

          if (missionFetchResponse && missionFetchResponse.data) {
            const missionUpdateRequest = missionFetchResponse.data.d.results[0];
            missionUpdateRequest.__metadata.uri =
              cookies.SF.URL + "cust_Mission";
            missionUpdateRequest.cust_Total_Expense =
              decryptedData.missionTotalExpense;
            missionUpdateRequest.cust_TicketAverage =
              decryptedData.missionTotalTicketCost;
            missionUpdateRequest.cust_TotalPerdiemMission =
              decryptedData.missionTotalPerdiem;

            const missionUpdateUrl = cookies.SF.URL + "upsert";
            const missionUpdateConfig = {
              method: "post",
              maxBodyLength: Infinity,
              url: missionUpdateUrl,
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              data: JSON.stringify(missionUpdateRequest),
            };

            const missionUpdateResponse = await axios.request(
              missionUpdateConfig
            );
            if (missionUpdateResponse && missionUpdateResponse.data) {
              const sectorFetchUrl =
                cookies.SF.URL +
                "cust_SectorBudget?$format=json&$filter=externalCode eq " +
                decryptedData.sector +
                "&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
              const sectorFetchConfig = {
                headers: {
                  Authorization: auth,
                },
              };
              const sectorFetchResponse = await axios.get(
                sectorFetchUrl,
                sectorFetchConfig
              );

              if (sectorFetchResponse && sectorFetchResponse.data) {
                const sectorUpdateRequest =
                  sectorFetchResponse.data.d.results[0];
                sectorUpdateRequest.__metadata.uri =
                  cookies.SF.URL + "cust_SectorBudget";
                sectorUpdateRequest.cust_Available_budget =
                  decryptedData.sectorAvailableBudget;

                const sectorUpdateUrl = cookies.SF.URL + "upsert";
                const sectorUpdateConfig = {
                  method: "post",
                  maxBodyLength: Infinity,
                  url: sectorUpdateUrl,
                  headers: {
                    Authorization: auth,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                  },
                  data: JSON.stringify(sectorUpdateRequest),
                };
                const sectorUpdateResponse = await axios.request(
                  sectorUpdateConfig
                );
                if (sectorUpdateResponse && sectorUpdateResponse.data) {
                  try {
                    const auditLogUrl =
                      cookies.SF.URL + "cust_Audit_Log?$format=json";

                    let comment =
                      "Claim submitted for Mission " + decryptedData.missionId;

                    if (decryptedData.byDelegate !== null) {
                      comment =
                        comment + ` => By delegate ${decryptedData.byDelegate}`;
                    }

                    const auditLogConfig = {
                      method: "post",
                      maxBodyLength: Infinity,
                      url: auditLogUrl,
                      headers: {
                        Authorization: auth,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                      },
                      data: JSON.stringify({
                        __metadata: {
                          uri: cookies.SF.URL + "cust_Audit_Log",
                        },
                        externalCode: "1234",
                        cust_Timestamp: decryptedData.date,
                        cust_Key: decryptedData.missionId,
                        cust_User: decryptedData.employeeId,
                        cust_Action: "Claim Submitted",
                        cust_Comments: comment,
                      }),
                    };
                    await axios.request(auditLogConfig);

                    var getApproverGroupMembersUrl =
                      cookies.SF.URL +
                      "getUsersByDynamicGroup?$format=json&groupId=" +
                      approveGroup +
                      "L";

                    const getApproverGroupMembersConfig = {
                      headers: {
                        Authorization: auth,
                      },
                    };

                    const getApproverGroupMembersResponse = await axios.get(
                      getApproverGroupMembersUrl,
                      getApproverGroupMembersConfig
                    );
                    if (
                      getApproverGroupMembersResponse &&
                      getApproverGroupMembersResponse.data &&
                      getApproverGroupMembersResponse.data.d &&
                      getApproverGroupMembersResponse.data.d.length > 0
                    ) {
                      var groupMembers = [];
                      for (
                        var m = 0;
                        m < getApproverGroupMembersResponse.data.d.length;
                        m++
                      ) {
                        groupMembers.push(
                          getApproverGroupMembersResponse.data.d[m].userId
                        );
                      }
                      if (groupMembers.length > 0) {
                        var groupMembersIds =
                          "'" + groupMembers.join("', '") + "'";

                        var getApproverGroupMembersInfoUrl =
                          cookies.SF.URL +
                          "PerPersonal?$format=json&$filter=personIdExternal in " +
                          groupMembersIds +
                          " &$expand=salutationNav/picklistLabels,personNav/emailNav";

                        const getApproverGroupMembersInfoConfig = {
                          headers: {
                            Authorization: auth,
                          },
                        };

                        const getApproverGroupMembersInfoResponse =
                          await axios.get(
                            getApproverGroupMembersInfoUrl,
                            getApproverGroupMembersInfoConfig
                          );

                        if (
                          getApproverGroupMembersInfoResponse &&
                          getApproverGroupMembersInfoResponse.data &&
                          getApproverGroupMembersInfoResponse.data.d.results &&
                          getApproverGroupMembersInfoResponse.data.d.results
                            .length > 0
                        ) {
                          var recipientsEmail = [];
                          for (
                            var r = 0;
                            r <
                            getApproverGroupMembersInfoResponse.data.d.results
                              .length;
                            r++
                          ) {
                            recipientsEmail.push(
                              getApproverGroupMembersInfoResponse.data.d
                                .results[r].personNav.emailNav.results[0]
                                .emailAddress
                            );
                          }

                          var decreeAttachment = [];

                          if (
                            decryptedData.decreeAttachments &&
                            decryptedData.decreeAttachments.length > 0
                          ) {
                            decreeAttachment.push({
                              fileName:
                                decryptedData.decreeAttachments[0].fileName,
                              mimeType:
                                decryptedData.decreeAttachments[0].mimetype,
                              fileContent:
                                decryptedData.decreeAttachments[0].file,
                            });
                          }
                          var notificationPayload = {
                            type: "Claim",
                            isBeneficiary: "N",
                            isApprover: "Y",
                            missionID: decryptedData.missionId,
                            missionDescription:
                              decryptedData.missionDescription,
                            status: "",
                            subject: "",
                            body: "",
                            link: "",
                            sendIndivially: "N",
                            attachments: decreeAttachment,
                            recipients: [
                              {
                                employeeID: "",
                                name: "Payroll_Group_Mission",
                                name_Ar: "",
                                salutation: "",
                                salutation_Ar: "",
                                emailAddress: recipientsEmail.toString(),
                                cc: "N",
                              },
                            ],
                          };
                          await _sendNotification(
                            notificationPayload,
                            cookies,
                            "sendClaimNotification"
                          );
                          return true;
                        }
                      }
                    }
                  } catch (error) {
                    console.log("Some issues with notification:", error);
                    return false;
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _claimMission = async function (decryptedData, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;
    const SFAuth = Buffer.from(cookies.SF.basicAuth, "base64").toString("utf-8");
    const SFAuthUsername = SFAuth.split(":")[0].split("@")[0];

    const postClaimAttachmentUrl = cookies.SF.URL + "upsert?$format=json";

    const postClaimAttachmentConfig = {
      method: "post",
      maxBodyLength: Infinity,
      url: postClaimAttachmentUrl,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify({
        __metadata: {
          uri: cookies.SF.URL + "Attachment",
          type: "SFOData.Attachment",
        },
        userId: SFAuthUsername,
        fileName: decryptedData.attachments[0].fileName,
        module: "GENERIC_OBJECT",
        viewable: true,
        fileContent: decryptedData.attachments[0].file,
      }),
    };

    const postClaimAttachmentResponse = await axios.request(
      postClaimAttachmentConfig
    );

    if (
      postClaimAttachmentResponse &&
      postClaimAttachmentResponse.data &&
      postClaimAttachmentResponse.data.d.length > 0
    ) {
      const attachmentKey = postClaimAttachmentResponse.data.d[0].key;
      const attachmentId = attachmentKey.split("=")[1];

      //--Rewritten with batch
      let boundary = `batch_${crypto.randomUUID()}`; // batch id
      const batchURL = cookies.SF.URL + "$batch?$format=json";

      const approveGroupFetchUrl =
        "cust_Parameters_for_Mission?$format=json&$select=cust_key,cust_Value&$filter=externalCode eq 'Payroll_Group_Mission'";
      const claimFetchUrl = `cust_BenefitTravelClaim?$format=json&$filter=cust_EmployeeID eq '${decryptedData.employeeId}' and cust_MissionID eq '${decryptedData.missionId}'`;

      const missionExpandQuery =
        "cust_Members,cust_Members/cust_itinerary_details_child";

      const missionSelectQuery =
        "externalCode,effectiveStartDate,transactionSequence,cust_Mission_Start_Date,cust_Mission_End_Date,cust_No_Of_Days," +
        "cust_ReplicationFlag,cust_Hospitality_Type,cust_Flight_type,cust_Destination,cust_TotalPerdiemMission,cust_TicketAverage," +
        "cust_Total_Expense,cust_Budget_Available,cust_Budget_Parked,cust_Members/cust_Mission_effectiveStartDate,cust_Members/cust_Mission_externalCode," +
        "cust_Members/cust_Mission_transactionSequence,cust_Members/cust_Employee_ID,cust_Members/cust_Employee_Total_Ticket," +
        "cust_Members/cust_Employee_Total_Perdiem,cust_Members/cust_Employee_Total_Expense,cust_Members/cust_Claimed," +
        "cust_Members/cust_itinerary_details_child/cust_Mission_effectiveStartDate," +
        "cust_Members/cust_itinerary_details_child/cust_Mission_externalCode,cust_Members/cust_itinerary_details_child/cust_Members_externalCode," +
        "cust_Members/cust_itinerary_details_child/cust_Mission_transactionSequence,cust_Members/cust_itinerary_details_child/externalCode," +
        "cust_Members/cust_itinerary_details_child/cust_start_date,cust_Members/cust_itinerary_details_child/cust_end_date," +
        "cust_Members/cust_itinerary_details_child/cust_head_of_mission,cust_Members/cust_itinerary_details_child/cust_hospitality_default," +
        "cust_Members/cust_itinerary_details_child/cust_city,cust_Members/cust_itinerary_details_child/cust_ticket_type," +
        "cust_Members/cust_itinerary_details_child/cust_ticket_average,cust_Members/cust_itinerary_details_child/cust_perdiem_per_city," +
        "cust_Members/cust_itinerary_details_child/cust_Ticket_Actual_Cost";

      const missionFetchUrl = `cust_Mission?$format=json&$filter=externalCode eq '${decryptedData.missionId}'&$select=${missionSelectQuery}&$expand=${missionExpandQuery}`;

      const sectorFetchUrl = `cust_SectorBudget?$format=json&$filter=externalCode eq ${decryptedData.sector}&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate`;

      const getBatchBody =
        `--${boundary}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `GET ${approveGroupFetchUrl} HTTP/1.1\r\n` +
        `Accept: application/json\r\n\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `GET ${claimFetchUrl} HTTP/1.1\r\n` +
        `Accept: application/json\r\n\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `GET ${missionFetchUrl} HTTP/1.1\r\n` +
        `Accept: application/json\r\n\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `GET ${sectorFetchUrl} HTTP/1.1\r\n` +
        `Accept: application/json\r\n\r\n` +
        `--${boundary}--`;

      const batchResponse = await axios.post(batchURL, getBatchBody, {
        headers: {
          Authorization: auth,
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
        },
      });

      const batchResult = (await _parseMultipartResponse(batchResponse)) || [];

      if (batchResult.length === 0) {
        throw new Error("Mission related data could not be read!");
      }

      const approveGroupFetchResponse =
        batchResult[0] &&
        batchResult[0].d &&
        batchResult[0].d.results &&
        _.cloneDeep(batchResult[0].d.results[0]);

      const claimFetchResponse =
        batchResult[1] &&
        batchResult[1].d &&
        batchResult[1].d.results &&
        _.cloneDeep(batchResult[1].d.results[0]);

      const missionFetchResponse =
        batchResult[2] &&
        batchResult[2].d &&
        batchResult[2].d.results &&
        _.cloneDeep(batchResult[2].d.results[0]);

      const sectorFetchResponse =
        batchResult[3] && batchResult[3].d && batchResult[3].d.results;

      //--Prepare post bodies

      //--Claim update
      const approveGroup = approveGroupFetchResponse.cust_Value;

      let claimUpdateHeader = {};
      if (claimFetchResponse) {
        claimUpdateHeader["__metadata"] = claimFetchResponse["__metadata"];
        claimUpdateHeader["externalCode"] = claimFetchResponse["externalCode"];
        claimUpdateHeader["mdfSystemEffectiveStartDate"] =
          claimFetchResponse["mdfSystemEffectiveStartDate"];
      } else {
        claimUpdateHeader["__metadata"] = {
          uri: cookies.SF.URL + "cust_BenefitTravelClaim",
          type: "SFOData.cust_BenefitTravelClaim"
        };
        claimUpdateHeader["externalName"] = "The claim creation in mission " + decryptedData.missionId;
        claimUpdateHeader["mdfSystemEffectiveStartDate"] = decryptedData.date;
      }
      let claimUpdateRequest = {
        ...claimUpdateHeader,
        cust_Claim_Type: decryptedData.type,
        cust_EmployeeID: decryptedData.employeeId,
        cust_MissionID: decryptedData.missionId,
        cust_startDate: decryptedData.claimStartDate,
        cust_EndDate: decryptedData.claimEndDate,
        cust_Location: decryptedData.location,
        cust_ClaimAmount: decryptedData.claimAmount,
        cust_Currency: "AED",
        cust_Status: decryptedData.status,
        cust_Pending_with: approveGroup,
        cust_Claim_Parked: decryptedData.claimParked,
        cust_Description:
        "The claim creation for " +
        decryptedData.employeeId +
        " on mission " +
        decryptedData.missionId,
        cust_attachmentNav: {
          __metadata: {
            uri: cookies.SF.URL + "Attachment(" + attachmentId + ")",
          },
        },
      };
      //--Claim update

      //--Mission update
      let missionClone = _.clone(missionFetchResponse);
      let missionUpdateRequest = {
        ...missionClone,
        __metadata: missionFetchResponse.__metadata,
        //--Update related fields
        cust_TicketAverage: decryptedData.missionTotalTicketCost,
        cust_Total_Expense: decryptedData.missionTotalExpense,
        cust_TotalPerdiemMission: decryptedData.missionTotalPerdiem,
        cust_Members: {
          results: [],
        },
      };

      missionFetchResponse.cust_Members.results.forEach((oMember) => {
        let memberUpdateRequest = _.cloneDeep(oMember);

        if (oMember.cust_Employee_ID === decryptedData.employeeId) {
          memberUpdateRequest.cust_itinerary_details_child = {
            results: [],
          };
          memberUpdateRequest.cust_Employee_Total_Expense =
            decryptedData.memberTotalExpense;
          memberUpdateRequest.cust_Employee_Total_Perdiem =
            decryptedData.memberTotalPerDiem;
          memberUpdateRequest.cust_Employee_Total_Ticket =
            decryptedData.memberTotalTicketCost;
          memberUpdateRequest.cust_Claimed = "Y";

          for (var i = 0; i < decryptedData.itinerary.length; i++) {
            const oItineraryFound = _.find(
              oMember.cust_itinerary_details_child.results,
              ["cust_city", decryptedData.itinerary[i].itineraryCity]
            );

            if (oItineraryFound) {
              let itineraryUpdateRequest = _.cloneDeep(oItineraryFound);
              itineraryUpdateRequest.cust_start_date =
                decryptedData.itinerary[i].itineraryStartDate;
              itineraryUpdateRequest.cust_end_date =
                decryptedData.itinerary[i].itineraryEndDate;
              itineraryUpdateRequest.cust_ticket_average =
                decryptedData.itinerary[i].itinerayTicketAverage.toString();
              itineraryUpdateRequest.cust_perdiem_per_city =
                decryptedData.itinerary[i].itinerayPerDiem;

              memberUpdateRequest.cust_itinerary_details_child.results.push(
                itineraryUpdateRequest
              );
            }
          }
        }
        missionUpdateRequest.cust_Members.results.push(memberUpdateRequest);
      });
      //--Mission update

      //--Sector update
      let sectorUpdateRequest = sectorFetchResponse[0] || null;
      if (sectorUpdateRequest) {
        sectorUpdateRequest["__metadata"] = {
          uri: cookies.SF.URL + "cust_SectorBudget",
          type: "SFOData.cust_SectorBudget"
        };
        sectorUpdateRequest["cust_Available_budget"] =
          decryptedData.sectorAvailableBudget;
      }
      //--Sector update

      //--Audit log update
      let comment = "Claim submitted for Mission " + decryptedData.missionId;

      if (decryptedData.byDelegate !== null) {
        comment = comment + ` => By delegate ${decryptedData.byDelegate}`;
      }

      const auditLogUpdateRequest = {
        __metadata: {
          uri: cookies.SF.URL + "cust_Audit_Log",
          type: "SFOData.cust_Audit_Log"
        },
        externalCode: "1234",
        cust_Timestamp: decryptedData.date,
        cust_Key: decryptedData.missionId,
        cust_User: decryptedData.employeeId,
        cust_Action: "Claim Submitted",
        cust_Comments: comment,
      };
      //--Audit log update
      //--Prepare post bodies

      //--Generate request
      let postBoundary = `batch_${crypto.randomUUID()}`; // batch id
      let changeSet = `changeset_${crypto.randomUUID()}`; // changeset id
      let postBatchBody =
        `--${postBoundary}\r\n` +
        `Content-Type: multipart/mixed; boundary=${changeSet}\r\n\r\n`;

      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(claimUpdateRequest)}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(missionUpdateRequest)}\r\n\r\n`;
      if (sectorUpdateRequest) {
        postBatchBody =
          postBatchBody +
          `--${changeSet}\r\n` +
          `Content-Type: application/http\r\n` +
          `Content-Transfer-Encoding: binary\r\n\r\n` +
          `POST upsert?$format=json HTTP/1.1\r\n` +
          `Content-Type: application/json;charset=utf-8\r\n` +
          `Accept: application/json\r\n\r\n` +
          `${JSON.stringify(sectorUpdateRequest)}\r\n\r\n`;
      }
      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(auditLogUpdateRequest)}\r\n\r\n` +
        `--${changeSet}--\r\n\r\n` +
        `--${postBoundary}--`;
      //--Generate request

      const postBatchResponse = await axios.post(batchURL, postBatchBody, {
        headers: {
          Authorization: auth,
          "Content-Type": `multipart/mixed; boundary=${postBoundary}`,
        },
      });
      const postBatchResult =
        (await _parseMultipartResponse(postBatchResponse)) || [];
      //--Rewritten with batch

      //--Post update
      if (
        !postBatchResult ||
        (postBatchResult &&
          postBatchResult[0] &&
          postBatchResult[0].hasOwnProperty("error"))
      ) {
        if (postBatchResult[0] && postBatchResult[0].hasOwnProperty("error")) {
          console.log("Post batch error:" + postBatchResult[0].error.message.value);
          throw Error("Post batch error:" + postBatchResult[0].error.message.value);
        }
        throw Error("Error during batch post");
      }
      //--Rewritten with batch

      //--Post update
      try {
        const getApproverGroupMembersUrl =
          cookies.SF.URL +
          "getUsersByDynamicGroup?$format=json&groupId=" +
          approveGroup +
          "L";

        const getApproverGroupMembersConfig = {
          headers: {
            Authorization: auth,
          },
        };

        const getApproverGroupMembersResponse = await axios.get(
          getApproverGroupMembersUrl,
          getApproverGroupMembersConfig
        );
        if (
          getApproverGroupMembersResponse &&
          getApproverGroupMembersResponse.data &&
          getApproverGroupMembersResponse.data.d &&
          getApproverGroupMembersResponse.data.d.length > 0
        ) {
          var groupMembers = [];
          for (
            var m = 0;
            m < getApproverGroupMembersResponse.data.d.length;
            m++
          ) {
            groupMembers.push(getApproverGroupMembersResponse.data.d[m].userId);
          }
          if (groupMembers.length > 0) {
            var groupMembersIds = "'" + groupMembers.join("', '") + "'";

            var getApproverGroupMembersInfoUrl =
              cookies.SF.URL +
              "PerPersonal?$format=json&$filter=personIdExternal in " +
              groupMembersIds +
              " &$expand=salutationNav/picklistLabels,personNav/emailNav";

            const getApproverGroupMembersInfoConfig = {
              headers: {
                Authorization: auth,
              },
            };

            const getApproverGroupMembersInfoResponse = await axios.get(
              getApproverGroupMembersInfoUrl,
              getApproverGroupMembersInfoConfig
            );

            if (
              getApproverGroupMembersInfoResponse &&
              getApproverGroupMembersInfoResponse.data &&
              getApproverGroupMembersInfoResponse.data.d.results &&
              getApproverGroupMembersInfoResponse.data.d.results.length > 0
            ) {
              var recipientsEmail = [];
              for (
                var r = 0;
                r < getApproverGroupMembersInfoResponse.data.d.results.length;
                r++
              ) {
                recipientsEmail.push(
                  getApproverGroupMembersInfoResponse.data.d.results[r]
                    .personNav.emailNav.results[0].emailAddress
                );
              }

              var decreeAttachment = [];

              if (
                decryptedData.decreeAttachments &&
                decryptedData.decreeAttachments.length > 0
              ) {
                decreeAttachment.push({
                  fileName: decryptedData.decreeAttachments[0].fileName,
                  mimeType: decryptedData.decreeAttachments[0].mimetype,
                  fileContent: decryptedData.decreeAttachments[0].file,
                });
              }
              var notificationPayload = {
                type: "Claim",
                isBeneficiary: "N",
                isApprover: "Y",
                missionID: decryptedData.missionId,
                missionDescription: decryptedData.missionDescription,
                status: "",
                subject: "",
                body: "",
                link: "",
                sendIndivially: "N",
                attachments: decreeAttachment,
                recipients: [
                  {
                    employeeID: "",
                    name: "Payroll_Group_Mission",
                    name_Ar: "",
                    salutation: "",
                    salutation_Ar: "",
                    emailAddress: recipientsEmail.toString(),
                    cc: "N",
                  },
                ],
              };
              await _sendNotification(
                notificationPayload,
                cookies,
                "sendClaimNotification"
              );
              return true;
            }
          }
        }
      } catch (error) {
        console.log("Some issues with notification:", error);
        return false;
      }
      //--Post update
    }
  } catch (error) {
    console.log(error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchSectorInfo = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    const sectorFetchUrl =
      cookies.SF.URL +
      "cust_SectorBudget?$format=json&$filter=externalCode eq " +
      decryptedData.sector +
      "&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
    const sectorFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const sectorFetchResponse = await axios.get(
      sectorFetchUrl,
      sectorFetchConfig
    );
    return sectorFetchResponse.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchClaim = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;
    var SFAuth = Buffer.from(cookies.SF.basicAuth, "base64").toString("utf-8");

    var checkClaimUrl =
      cookies.SF.URL +
      "cust_BenefitTravelClaim?$format=json&$expand=cust_attachmentNav&$filter=cust_EmployeeID eq '" +
      decryptedData.employeeId +
      "' and cust_MissionID eq '" +
      decryptedData.missionId +
      "'";

    const checkClaimConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const checkClaimResponse = await axios.get(checkClaimUrl, checkClaimConfig);

    const recoveryFetchUrl = `${
      cookies.SF.URL
    }EmpPayCompNonRecurring?$format=json&$filter=payComponentCode in '1540','1701' and tolower(sequenceNumber) like '%${decryptedData.missionId.toLowerCase()}%' and userId eq '${
      decryptedData.employeeId
    }'`;

    const recoveryFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const recoveryFetchResponse = await axios.get(
      recoveryFetchUrl,
      recoveryFetchConfig
    );

    return {
      claim: checkClaimResponse.data,
      recoveryAmount: recoveryFetchResponse.data,
    };
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchClaims = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    let sFilterOptions = "";
    let aSelected =
      decryptedData?.statusFilters?.filter((oFilter) => oFilter.selected) || [];
    if (aSelected.length > 0) {
      aSelected.forEach((oFilter) => {
        sFilterOptions = sFilterOptions
          ? sFilterOptions + ` or cust_Status eq '${oFilter.externalCode}'`
          : `cust_Status eq '${oFilter.externalCode}'`;
      });
    }

    if (decryptedData?.dateSelection?.beginDate) {
      sFilterOptions =
        aSelected.length > 1 ? "( " + sFilterOptions + " )" : sFilterOptions;
      sFilterOptions =
        sFilterOptions !== ""
          ? sFilterOptions +
            ` and cust_EndDate ge datetime'${decryptedData.dateSelection.beginDate}' and cust_startDate le datetime'${decryptedData.dateSelection.endDate}'`
          : `cust_EndDate ge datetime'${decryptedData.dateSelection.beginDate}' and cust_startDate le datetime'${decryptedData.dateSelection.endDate}'`;
    }

    if (sFilterOptions) {
      var getClaimUrl =
        cookies.SF.URL +
        `cust_BenefitTravelClaim?$format=json&$expand=cust_EmployeeIDNav&$select=externalCode,mdfSystemEffectiveStartDate,cust_MissionID,cust_EmployeeID,cust_startDate,cust_EndDate,cust_Location,cust_ClaimAmount,cust_Status,cust_EmployeeIDNav/defaultFullName&$filter=${sFilterOptions}`;
      const getClaimConfig = {
        headers: {
          Authorization: auth,
        },
      };

      const getClaimResponse = await axios.get(getClaimUrl, getClaimConfig);

      return getClaimResponse.data;
    } else {
      return {
        d: {
          results: [],
        },
      };
    }
  } catch (error) {
    console.log(error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchPendingClaims = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    var getClaimUrl =
      cookies.SF.URL +
      "cust_BenefitTravelClaim?$format=json&$expand=cust_EmployeeIDNav&$select=externalCode,cust_MissionID,cust_EmployeeID,cust_startDate,cust_EndDate,cust_Location,cust_ClaimAmount,cust_Status ,cust_EmployeeIDNav/defaultFullName&$filter=cust_Status eq '2'";

    const getClaimConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const getClaimResponse = await axios.get(getClaimUrl, getClaimConfig);

    return getClaimResponse.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchStatus = async function (cookies) {
  try {
    const tokenUrl =
      cookies.SF.URL +
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$filter=picklistId eq 'Status' and picklistOptions/status eq 'ACTIVE'&$format=json";
    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(tokenUrl, config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchMemberInfo = async function (decryptedData, cookies) {
  try {
    var tokenUrl =
      cookies.SF.URL +
      "EmpEmployment?$format=json&$top=30&$select=personIdExternal,userId,jobInfoNav/jobCode,jobInfoNav/jobTitle,jobInfoNav/payGrade,jobInfoNav/position,jobInfoNav/payGradeNav/paygradeLevel,jobInfoNav/payGradeNav/name,personNav/personalInfoNav/displayName,personNav/personalInfoNav/firstName,personNav/personalInfoNav/salutationNav/picklistLabels/label,personNav/personalInfoNav/lastName,personNav/personalInfoNav/firstNameAlt1,personNav/personalInfoNav/lastNameAlt1,userNav/title,userNav/department,jobInfoNav/customString6,jobInfoNav/emplStatusNav&$expand=jobInfoNav,jobInfoNav/payGradeNav,personNav/personalInfoNav,personNav/personalInfoNav/salutationNav/picklistLabels,userNav,jobInfoNav/emplStatusNav&$filter=personIdExternal in ";

    if (decryptedData.indexOf(",") > -1) {
      var employees = decryptedData.split(",");
      for (var i = 0; i < employees.length; i++) {
        if (i > 0) {
          tokenUrl += ",";
        }
        tokenUrl += "'" + employees[i] + "'";
      }
    } else {
      tokenUrl += "'" + decryptedData + "'";
    }

    var auth = "Basic " + cookies.SF.basicAuth;
    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const response = await axios.get(encodeURI(tokenUrl), config);
    return response.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchClaimInfo = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    var claimUrl =
      cookies.SF.URL +
      "cust_BenefitTravelClaim?$format=json&$expand=cust_attachmentNav&$filter=externalCode eq '" +
      decryptedData +
      "'";

    const checkClaimConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const claimResponse = await axios.get(claimUrl, checkClaimConfig);

    return claimResponse.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _approveRejectClaim = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    var claimUrl =
      cookies.SF.URL +
      "cust_BenefitTravelClaim?$format=json&$filter=externalCode eq '" +
      decryptedData.claim +
      "'";

    const checkClaimConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const claimResponse = await axios.get(claimUrl, checkClaimConfig);
    if (
      claimResponse &&
      claimResponse.data &&
      claimResponse.data.d.results.length > 0
    ) {
      var claimRequest = claimResponse.data.d.results[0];
      const postClaimUrl = cookies.SF.URL + "upsert?$format=json";
      if (decryptedData.action == "1") {
        var postClaimConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: postClaimUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify({
            __metadata: {
              uri: cookies.SF.URL + "cust_BenefitTravelClaim",
            },
            externalCode: claimRequest.externalCode,
            mdfSystemEffectiveStartDate:
              claimRequest.mdfSystemEffectiveStartDate,
            cust_EmployeeID: claimRequest.cust_EmployeeID,
            //cust_MissionID: claimRequest.cust_MissionID,
            cust_MissionID: decryptedData.missionId,
            cust_Status: "1",
            cust_Pending_with: "",
            cust_Claim_Parked: "0",
            cust_Comment: decryptedData.payload.comments,
          }),
        };
      } else {
        var postClaimConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: postClaimUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify({
            __metadata: {
              uri: cookies.SF.URL + "cust_BenefitTravelClaim",
            },
            externalCode: claimRequest.externalCode,
            mdfSystemEffectiveStartDate:
              claimRequest.mdfSystemEffectiveStartDate,
            cust_EmployeeID: claimRequest.cust_EmployeeID,
            // cust_MissionID: claimRequest.cust_MissionID,
            cust_MissionID: decryptedData.missionId,
            cust_Status: "5",
            cust_Pending_with: claimRequest.cust_EmployeeID,
            cust_Claim_Parked: "0",
            cust_Comment: decryptedData.payload.comments,
          }),
        };
      }

      const postClaimResponse = await axios.request(postClaimConfig);

      if (
        postClaimResponse &&
        postClaimResponse.data &&
        postClaimResponse.data.d &&
        postClaimResponse.data.d.length > 0 &&
        postClaimResponse.data.d[0].httpCode == 200
      ) {
        if (decryptedData.action == "5") {
          const memberFetchUrl =
            cookies.SF.URL +
            "cust_Members?$format=json&$filter=cust_Mission_externalCode eq '" +
            claimRequest.cust_MissionID +
            "' and cust_Employee_ID eq '" +
            claimRequest.cust_EmployeeID +
            "' &$select=cust_Mission_effectiveStartDate,cust_Mission_externalCode,cust_Mission_transactionSequence,externalCode,cust_Employee_ID,cust_Employee_Total_Expense,cust_Employee_Total_Ticket,cust_Employee_Total_Perdiem";
          const memberFetchConfig = {
            headers: {
              Authorization: auth,
            },
          };
          const memberFetchResponse = await axios.get(
            memberFetchUrl,
            memberFetchConfig
          );
          if (memberFetchResponse && memberFetchResponse.data) {
            const memberUpdateRequest = memberFetchResponse.data.d.results[0];

            memberUpdateRequest.__metadata.uri =
              cookies.SF.URL + "cust_Members";
            memberUpdateRequest.cust_Claimed = "N";
            const memberUpdateUrl = cookies.SF.URL + "upsert";
            const memberUpdateConfig = {
              method: "post",
              maxBodyLength: Infinity,
              url: memberUpdateUrl,
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              data: JSON.stringify(memberUpdateRequest),
            };
            await axios.request(memberUpdateConfig);
          }
        }

        const sectorFetchUrl =
          cookies.SF.URL +
          "cust_SectorBudget?$format=json&$filter=externalCode eq " +
          decryptedData.sector +
          "&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
        const sectorFetchConfig = {
          headers: {
            Authorization: auth,
          },
        };
        const sectorFetchResponse = await axios.get(
          sectorFetchUrl,
          sectorFetchConfig
        );
        if (sectorFetchResponse && sectorFetchResponse.data) {
          const sectorUpdateRequest = sectorFetchResponse.data.d.results[0];
          sectorUpdateRequest.__metadata.uri =
            cookies.SF.URL + "cust_SectorBudget";
          if (decryptedData.action == "1") {
            sectorUpdateRequest.cust_Utilized_Budget =
              decryptedData.sectorUtilizedBudget;
          } else {
            sectorUpdateRequest.cust_Available_budget =
              decryptedData.sectorAvailableBudget;
          }

          const sectorUpdateUrl = cookies.SF.URL + "upsert";
          const sectorUpdateConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: sectorUpdateUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify(sectorUpdateRequest),
          };
          const sectorUpdateResponse = await axios.request(sectorUpdateConfig);
          if (sectorUpdateResponse && sectorUpdateResponse.data) {
            try {
              var auditLogUrl = cookies.SF.URL + "cust_Audit_Log?$format=json";
              var action = null;
              if (decryptedData.action == "1") {
                action = "Approved";
              } else {
                action = "Sent Back";
              }
              let comment = decryptedData.payload.comments || "";

              comment = `${comment} (Claim ${action} for Mission ${decryptedData.missionId})`;

              if (decryptedData.byDelegate !== null) {
                comment =
                  comment + ` => By delegate ${decryptedData.byDelegate}`;
              }

              comment.trim();
              const auditLogConfig = {
                method: "post",
                maxBodyLength: Infinity,
                url: auditLogUrl,
                headers: {
                  Authorization: auth,
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                data: JSON.stringify({
                  __metadata: {
                    uri: cookies.SF.URL + "cust_Audit_Log",
                  },
                  externalCode: "1234",
                  cust_Timestamp: decryptedData.date,
                  cust_Key: decryptedData.missionId,
                  cust_User: decryptedData.loggedInUser,
                  cust_Action: "Claim " + action,
                  cust_Comments: comment,
                }),
              };
              await axios.request(auditLogConfig);

              var members = [claimRequest.cust_EmployeeID];
              if (members.length > 0) {
                var groupMembersIds = "'" + members.join("', '") + "'";

                var getApproverGroupMembersInfoUrl =
                  cookies.SF.URL +
                  "PerPersonal?$format=json&$filter=personIdExternal in " +
                  groupMembersIds +
                  " &$expand=salutationNav/picklistLabels,personNav/emailNav";

                const getApproverGroupMembersInfoConfig = {
                  headers: {
                    Authorization: auth,
                  },
                };

                const getApproverGroupMembersInfoResponse = await axios.get(
                  getApproverGroupMembersInfoUrl,
                  getApproverGroupMembersInfoConfig
                );

                if (
                  getApproverGroupMembersInfoResponse &&
                  getApproverGroupMembersInfoResponse.data &&
                  getApproverGroupMembersInfoResponse.data.d.results &&
                  getApproverGroupMembersInfoResponse.data.d.results.length > 0
                ) {
                  var recipients = [];
                  for (
                    var r = 0;
                    r <
                    getApproverGroupMembersInfoResponse.data.d.results.length;
                    r++
                  ) {
                    var recipient = {
                      employeeID:
                        getApproverGroupMembersInfoResponse.data.d.results[r]
                          .personIdExternal,
                      name: getApproverGroupMembersInfoResponse.data.d.results[
                        r
                      ].customString2,
                      name_Ar:
                        getApproverGroupMembersInfoResponse.data.d.results[r]
                          .displayName,
                      salutation: null,
                      salutation_Ar: null,
                      emailAddress:
                        getApproverGroupMembersInfoResponse.data.d.results[r]
                          .personNav.emailNav.results[0].emailAddress,
                      cc: "N",
                    };
                    for (
                      s = 0;
                      s <
                      getApproverGroupMembersInfoResponse.data.d.results[r]
                        .salutationNav.picklistLabels.results.length;
                      s++
                    ) {
                      if (
                        getApproverGroupMembersInfoResponse.data.d.results[r]
                          .salutationNav.picklistLabels.results[s].locale ==
                        "en_US"
                      ) {
                        recipient.salutation =
                          getApproverGroupMembersInfoResponse.data.d.results[
                            r
                          ].salutationNav.picklistLabels.results[s].label;
                      } else if (
                        getApproverGroupMembersInfoResponse.data.d.results[r]
                          .salutationNav.picklistLabels.results[s].locale ==
                        "ar_SA"
                      ) {
                        recipient.salutation_Ar =
                          getApproverGroupMembersInfoResponse.data.d.results[
                            r
                          ].salutationNav.picklistLabels.results[s].label;
                      }
                    }

                    recipients.push(recipient);
                  }

                  var decreeAttachment = [];

                  if (
                    decryptedData.decreeAttachments &&
                    decryptedData.decreeAttachments.length > 0
                  ) {
                    decreeAttachment.push({
                      fileName: decryptedData.decreeAttachments[0].fileName,
                      mimeType: decryptedData.decreeAttachments[0].mimetype,
                      fileContent: decryptedData.decreeAttachments[0].file,
                    });
                  }

                  var notificationPayload = {
                    type: "Claim",
                    isBeneficiary: "Y",
                    isApprover: "N",
                    missionID: decryptedData.missionId,
                    missionDescription: decryptedData.missionDescription,
                    status:
                      decryptedData.action == "1" ? "Approved" : "Sentback",
                    subject: "",
                    body: "",
                    link: "",
                    sendIndivially: "Y",
                    attachments: decreeAttachment,
                    params: {
                      ownerEmployeeID: claimRequest.cust_EmployeeID,
                    },
                    recipients: recipients,
                  };

                  await _sendNotification(
                    notificationPayload,
                    cookies,
                    "sendClaimNotification"
                  );
                  return true;
                }
              }
            } catch (error) {
              console.log("Some issues with notification:", error);
              return false;
            }
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _sendNotification = async function (body, cookies, type) {
  try {
    const url = cookies.CPI.URL + type;
    var auth = "Bearer " + cookies.CPI.oAuth;
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify(body),
    };
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    if (
      error &&
      error.response &&
      error.response.status &&
      error.response.status == 401
    ) {
      throw new CustomHttpError(401, "Unauthorized");
    } else {
      console.log(error);
      throw new CustomHttpError(500, "Something went wrong. Please try again");
    }
  }
};

const _advanceMission = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    var getApproveGroupUrl =
      cookies.SF.URL +
      "cust_Parameters_for_Mission?$format=json&$select=cust_key,cust_Value&$filter=externalCode eq 'Payroll_Group_Mission'";

    const getApproveGroupConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const getApproveGroupResponse = await axios.get(
      getApproveGroupUrl,
      getApproveGroupConfig
    );

    if (
      getApproveGroupResponse &&
      getApproveGroupResponse.data &&
      getApproveGroupResponse.data.d.results.length > 0
    ) {
      const approveGroup = getApproveGroupResponse.data.d.results[0].cust_Value;

      var checkAdvanceUrl =
        cookies.SF.URL +
        "cust_TravelAdvance?$format=json&$filter=cust_EmployeeID eq '" +
        decryptedData.employeeId +
        "' and cust_MissionID eq '" +
        decryptedData.missionId +
        "'";

      const checkAdvanceConfig = {
        headers: {
          Authorization: auth,
        },
      };

      const checkAdvanceResponse = await axios.get(
        checkAdvanceUrl,
        checkAdvanceConfig
      );

      const postAdvanceUrl = cookies.SF.URL + "upsert?$format=json";
      var postAdvanceConfig = null;
      if (
        checkAdvanceResponse &&
        checkAdvanceResponse.data &&
        checkAdvanceResponse.data.d.results.length > 0
      ) {
        var advanceRequest = checkAdvanceResponse.data.d.results[0];
        postAdvanceConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: postAdvanceUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify({
            __metadata: {
              uri: cookies.SF.URL + "cust_TravelAdvance",
            },
            externalCode: advanceRequest.externalCode,
            mdfSystemEffectiveStartDate:
              advanceRequest.mdfSystemEffectiveStartDate,
            cust_EmployeeID: advanceRequest.cust_EmployeeID,
            cust_MissionID: advanceRequest.cust_MissionID,
            cust_AdvanceAmount: decryptedData.advanceAmount,
            cust_Status: decryptedData.status,
            cust_Pending_with: approveGroup,
          }),
        };
      } else {
        postAdvanceConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: postAdvanceUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify({
            __metadata: {
              uri: cookies.SF.URL + "cust_TravelAdvance",
            },
            externalName:
              "The advance creation in mission " + decryptedData.missionId,
            mdfSystemEffectiveStartDate: decryptedData.date,
            cust_EmployeeID: decryptedData.employeeId,
            cust_MissionID: decryptedData.missionId,
            cust_StartDate: decryptedData.advanceStartDate,
            cust_EndDate: decryptedData.advanceEndDate,
            cust_Description:
              "The advance creation for " +
              decryptedData.employeeId +
              " on mission " +
              decryptedData.missionId,
            cust_location: decryptedData.location,
            cust_AdvanceAmount: decryptedData.advanceAmount,
            cust_TotalPerDiem: decryptedData.memberTotalPerDiem,
            cust_Status: decryptedData.status,
            cust_Pending_with: approveGroup,
          }),
        };
      }
      const postAdvanceResponse = await axios.request(postAdvanceConfig);

      if (
        postAdvanceResponse &&
        postAdvanceResponse.data &&
        postAdvanceResponse.data.d &&
        postAdvanceResponse.data.d.length > 0 &&
        postAdvanceResponse.data.d[0].httpCode == 200
      ) {
        const memberFetchUrl =
          cookies.SF.URL +
          "cust_Members?$format=json&$filter=cust_Mission_externalCode eq '" +
          decryptedData.missionId +
          "' and cust_Employee_ID eq '" +
          decryptedData.employeeId +
          "' &$select=cust_Mission_effectiveStartDate,cust_Mission_externalCode,cust_Mission_transactionSequence,externalCode,cust_Employee_ID,cust_EmployeeID,cust_Employee_Total_Expense,cust_Employee_Total_Ticket,cust_Employee_Total_Perdiem,cust_AdvanceRequested";
        const memberFetchConfig = {
          headers: {
            Authorization: auth,
          },
        };
        const memberFetchResponse = await axios.get(
          memberFetchUrl,
          memberFetchConfig
        );
        if (memberFetchResponse && memberFetchResponse.data) {
          const memberUpdateRequest = memberFetchResponse.data.d.results[0];

          memberUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_Members";
          memberUpdateRequest.cust_AdvanceRequested = "Y";

          const memberUpdateUrl = cookies.SF.URL + "upsert";
          const memberUpdateConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: memberUpdateUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify(memberUpdateRequest),
          };
          await axios.request(memberUpdateConfig);
        }

        const auditLogUrl = cookies.SF.URL + "cust_Audit_Log?$format=json";

        let comment =
          "Advance submitted for Mission " + decryptedData.missionId;

        if (decryptedData.byDelegate !== null) {
          comment = comment + ` => By delegate ${decryptedData.byDelegate}`;
        }

        const auditLogConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: auditLogUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify({
            __metadata: {
              uri: cookies.SF.URL + "cust_Audit_Log",
            },
            externalCode: "1234",
            cust_Timestamp: decryptedData.date,
            cust_Key: decryptedData.missionId,
            cust_User: decryptedData.employeeId,
            cust_Action: "Advance Submitted",
            cust_Comments: comment,
          }),
        };
        await axios.request(auditLogConfig);
      }
    }

    try {
      var getApproverGroupMembersUrl =
        cookies.SF.URL +
        "getUsersByDynamicGroup?$format=json&groupId=" +
        approveGroup +
        "L";

      const getApproverGroupMembersConfig = {
        headers: {
          Authorization: auth,
        },
      };

      const getApproverGroupMembersResponse = await axios.get(
        getApproverGroupMembersUrl,
        getApproverGroupMembersConfig
      );
      if (
        getApproverGroupMembersResponse &&
        getApproverGroupMembersResponse.data &&
        getApproverGroupMembersResponse.data.d &&
        getApproverGroupMembersResponse.data.d.length > 0
      ) {
        var groupMembers = [];
        for (
          var m = 0;
          m < getApproverGroupMembersResponse.data.d.length;
          m++
        ) {
          groupMembers.push(getApproverGroupMembersResponse.data.d[m].userId);
        }
        if (groupMembers.length > 0) {
          var groupMembersIds = "'" + groupMembers.join("', '") + "'";

          var getApproverGroupMembersInfoUrl =
            cookies.SF.URL +
            "PerPersonal?$format=json&$filter=personIdExternal in " +
            groupMembersIds +
            " &$expand=salutationNav/picklistLabels,personNav/emailNav";

          const getApproverGroupMembersInfoConfig = {
            headers: {
              Authorization: auth,
            },
          };

          const getApproverGroupMembersInfoResponse = await axios.get(
            getApproverGroupMembersInfoUrl,
            getApproverGroupMembersInfoConfig
          );

          if (
            getApproverGroupMembersInfoResponse &&
            getApproverGroupMembersInfoResponse.data &&
            getApproverGroupMembersInfoResponse.data.d.results &&
            getApproverGroupMembersInfoResponse.data.d.results.length > 0
          ) {
            var recipientsEmail = [];
            for (
              var r = 0;
              r < getApproverGroupMembersInfoResponse.data.d.results.length;
              r++
            ) {
              recipientsEmail.push(
                getApproverGroupMembersInfoResponse.data.d.results[r].personNav
                  .emailNav.results[0].emailAddress
              );
            }

            var decreeAttachment = [];

            if (
              decryptedData.decreeAttachments &&
              decryptedData.decreeAttachments.length > 0
            ) {
              decreeAttachment.push({
                fileName: decryptedData.decreeAttachments[0].fileName,
                mimeType: decryptedData.decreeAttachments[0].mimetype,
                fileContent: decryptedData.decreeAttachments[0].file,
              });
            }
            var notificationPayload = {
              type: "Advance",
              isBeneficiary: "N",
              isApprover: "Y",
              missionID: decryptedData.missionId,
              missionDescription: decryptedData.missionDescription,
              status: "",
              subject: "",
              body: "",
              link: "",
              sendIndivially: "N",
              attachments: decreeAttachment,
              recipients: [
                {
                  employeeID: "",
                  name: "Payroll_Group_Mission",
                  name_Ar: "",
                  salutation: "",
                  salutation_Ar: "",
                  emailAddress: recipientsEmail.toString(),
                  cc: "N",
                },
              ],
            };
            await _sendNotification(
              notificationPayload,
              cookies,
              "sendAdvanceNotification"
            );
          }
        }
      }
    } catch (error) {
      console.log("Some issues with notification:", error);
      return false;
    }
    return true;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchAdvance = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    var checkAdvanceUrl =
      cookies.SF.URL +
      "cust_TravelAdvance?$format=json&$filter=cust_EmployeeID eq '" +
      decryptedData.employeeId +
      "' and cust_MissionID eq '" +
      decryptedData.missionId +
      "'";

    const checkAdvanceConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const checkAdvanceResponse = await axios.get(
      checkAdvanceUrl,
      checkAdvanceConfig
    );

    return checkAdvanceResponse.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchAdvances = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    let sFilterOptions = "";
    let aSelected =
      decryptedData?.statusFilters?.filter((oFilter) => oFilter.selected) || [];
    if (aSelected.length > 0) {
      aSelected.forEach((oFilter) => {
        sFilterOptions = sFilterOptions
          ? sFilterOptions + ` or cust_Status eq '${oFilter.externalCode}'`
          : `cust_Status eq '${oFilter.externalCode}'`;
      });
    }
    if (decryptedData?.dateSelection?.beginDate) {
      sFilterOptions =
        aSelected.length > 1 ? "( " + sFilterOptions + " )" : sFilterOptions;
      sFilterOptions =
        sFilterOptions !== ""
          ? sFilterOptions +
            ` and cust_EndDate ge datetime'${decryptedData.dateSelection.beginDate}' and cust_StartDate le datetime'${decryptedData.dateSelection.endDate}'`
          : `cust_EndDate ge datetime'${decryptedData.dateSelection.beginDate}' and cust_StartDate le datetime'${decryptedData.dateSelection.endDate}'`;
    }

    if (sFilterOptions) {
      var getAdvanceUrl =
        cookies.SF.URL +
        `cust_TravelAdvance?$format=json&$expand=cust_EmployeeIDNav&$select=externalCode,cust_MissionID,cust_EmployeeID,cust_StartDate,cust_EndDate,cust_location,cust_Status,cust_EmployeeIDNav/defaultFullName&$filter=${sFilterOptions}`;
      const getAdvanceConfig = {
        headers: {
          Authorization: auth,
        },
      };

      const getAdvanceResponse = await axios.get(
        getAdvanceUrl,
        getAdvanceConfig
      );

      return getAdvanceResponse.data;
    } else {
      return {
        d: {
          results: [],
        },
      };
    }
  } catch (error) {
    console.log(error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchPendingadvances = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    var getAdvanceUrl =
      cookies.SF.URL +
      "cust_TravelAdvance?$format=json&$expand=cust_EmployeeIDNav&$select=externalCode,cust_MissionID,cust_EmployeeID,cust_StartDate,cust_EndDate,cust_location,cust_Status ,cust_EmployeeIDNav/defaultFullName&$filter=cust_Status eq '2'";

    const getAdvanceConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const getAdvanceResponse = await axios.get(getAdvanceUrl, getAdvanceConfig);

    return getAdvanceResponse.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchAdvanceInfo = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    var advanceUrl =
      cookies.SF.URL +
      "cust_TravelAdvance?$format=json&$filter=externalCode eq '" +
      decryptedData +
      "'";

    const checkAdvanceConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const advanceResponse = await axios.get(advanceUrl, checkAdvanceConfig);

    return advanceResponse.data;
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _approveRejectAdvance = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    var advanceUrl =
      cookies.SF.URL +
      "cust_TravelAdvance?$format=json&$filter=externalCode eq '" +
      decryptedData.advance +
      "'";

    const checkAdvanceConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const advanceResponse = await axios.get(advanceUrl, checkAdvanceConfig);
    if (
      advanceResponse &&
      advanceResponse.data &&
      advanceResponse.data.d.results.length > 0
    ) {
      var advanceRequest = advanceResponse.data.d.results[0];
      const postAdvanceUrl = cookies.SF.URL + "upsert?$format=json";
      if (decryptedData.action == "1") {
        var postAdvanceConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: postAdvanceUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify({
            __metadata: {
              uri: cookies.SF.URL + "cust_TravelAdvance",
            },
            externalCode: advanceRequest.externalCode,
            mdfSystemEffectiveStartDate:
              advanceRequest.mdfSystemEffectiveStartDate,
            cust_EmployeeID: advanceRequest.cust_EmployeeID,
            cust_MissionID: advanceRequest.cust_MissionID,
            cust_Status: "1",
            cust_Pending_with: "",
            cust_Comment: decryptedData.payload.comments,
          }),
        };
      } else {
        var postAdvanceConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: postAdvanceUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify({
            __metadata: {
              uri: cookies.SF.URL + "cust_TravelAdvance",
            },
            externalCode: advanceRequest.externalCode,
            mdfSystemEffectiveStartDate:
              advanceRequest.mdfSystemEffectiveStartDate,
            cust_EmployeeID: advanceRequest.cust_EmployeeID,
            cust_MissionID: advanceRequest.cust_MissionID,
            cust_Status: "5",
            cust_Pending_with: advanceRequest.cust_EmployeeID,
            cust_Comment: decryptedData.payload.comments,
          }),
        };
      }

      const postAdvanceResponse = await axios.request(postAdvanceConfig);
      if (
        postAdvanceResponse &&
        postAdvanceResponse.data &&
        postAdvanceResponse.data.d &&
        postAdvanceResponse.data.d.length > 0 &&
        postAdvanceResponse.data.d[0].httpCode == 200
      ) {
        if (decryptedData.action == "5") {
          const memberFetchUrl =
            cookies.SF.URL +
            "cust_Members?$format=json&$filter=cust_Mission_externalCode eq '" +
            advanceRequest.cust_MissionID +
            "' and cust_Employee_ID eq '" +
            advanceRequest.cust_EmployeeID +
            "' &$select=cust_Mission_effectiveStartDate,cust_Mission_externalCode,cust_Mission_transactionSequence,externalCode,cust_Employee_ID,cust_EmployeeID,cust_Employee_Total_Expense,cust_Employee_Total_Ticket,cust_Employee_Total_Perdiem,cust_AdvanceRequested";
          const memberFetchConfig = {
            headers: {
              Authorization: auth,
            },
          };
          const memberFetchResponse = await axios.get(
            memberFetchUrl,
            memberFetchConfig
          );
          if (memberFetchResponse && memberFetchResponse.data) {
            const memberUpdateRequest = memberFetchResponse.data.d.results[0];

            memberUpdateRequest.__metadata.uri =
              cookies.SF.URL + "cust_Members";
            memberUpdateRequest.cust_AdvanceRequested = "N";
            const memberUpdateUrl = cookies.SF.URL + "upsert";
            const memberUpdateConfig = {
              method: "post",
              maxBodyLength: Infinity,
              url: memberUpdateUrl,
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              data: JSON.stringify(memberUpdateRequest),
            };
            await axios.request(memberUpdateConfig);
          }
        }

        try {
          var auditLogUrl = cookies.SF.URL + "cust_Audit_Log?$format=json";
          var action = null;
          if (decryptedData.action == "1") {
            action = "Approved";
          } else {
            action = "Sent Back";
          }

          let comment = decryptedData.payload.comments || "";

          comment = `${comment} (Advance ${action} for Mission ${decryptedData.missionId})`;

          if (decryptedData.byDelegate !== null) {
            comment = comment + ` => By delegate ${decryptedData.byDelegate}`;
          }

          comment.trim();

          const auditLogConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: auditLogUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify({
              __metadata: {
                uri: cookies.SF.URL + "cust_Audit_Log",
              },
              externalCode: "1234",
              cust_Timestamp: decryptedData.date,
              cust_Key: decryptedData.missionId,
              cust_User: decryptedData.loggedInUser,
              cust_Action: "Advance " + action,
              cust_Comments: comment,
            }),
          };
          await axios.request(auditLogConfig);

          var members = [advanceRequest.cust_EmployeeID];
          if (members.length > 0) {
            var groupMembersIds = "'" + members.join("', '") + "'";

            var getApproverGroupMembersInfoUrl =
              cookies.SF.URL +
              "PerPersonal?$format=json&$filter=personIdExternal in " +
              groupMembersIds +
              " &$expand=salutationNav/picklistLabels,personNav/emailNav";

            const getApproverGroupMembersInfoConfig = {
              headers: {
                Authorization: auth,
              },
            };

            const getApproverGroupMembersInfoResponse = await axios.get(
              getApproverGroupMembersInfoUrl,
              getApproverGroupMembersInfoConfig
            );

            if (
              getApproverGroupMembersInfoResponse &&
              getApproverGroupMembersInfoResponse.data &&
              getApproverGroupMembersInfoResponse.data.d.results &&
              getApproverGroupMembersInfoResponse.data.d.results.length > 0
            ) {
              var recipients = [];
              for (
                var r = 0;
                r < getApproverGroupMembersInfoResponse.data.d.results.length;
                r++
              ) {
                var recipient = {
                  employeeID:
                    getApproverGroupMembersInfoResponse.data.d.results[r]
                      .personIdExternal,
                  name: getApproverGroupMembersInfoResponse.data.d.results[r]
                    .customString2,
                  name_Ar:
                    getApproverGroupMembersInfoResponse.data.d.results[r]
                      .displayName,
                  salutation: null,
                  salutation_Ar: null,
                  emailAddress:
                    getApproverGroupMembersInfoResponse.data.d.results[r]
                      .personNav.emailNav.results[0].emailAddress,
                  cc: "N",
                };
                for (
                  s = 0;
                  s <
                  getApproverGroupMembersInfoResponse.data.d.results[r]
                    .salutationNav.picklistLabels.results.length;
                  s++
                ) {
                  if (
                    getApproverGroupMembersInfoResponse.data.d.results[r]
                      .salutationNav.picklistLabels.results[s].locale == "en_US"
                  ) {
                    recipient.salutation =
                      getApproverGroupMembersInfoResponse.data.d.results[
                        r
                      ].salutationNav.picklistLabels.results[s].label;
                  } else if (
                    getApproverGroupMembersInfoResponse.data.d.results[r]
                      .salutationNav.picklistLabels.results[s].locale == "ar_SA"
                  ) {
                    recipient.salutation_Ar =
                      getApproverGroupMembersInfoResponse.data.d.results[
                        r
                      ].salutationNav.picklistLabels.results[s].label;
                  }
                }

                recipients.push(recipient);
              }

              var decreeAttachment = [];

              if (
                decryptedData.decreeAttachments &&
                decryptedData.decreeAttachments.length > 0
              ) {
                decreeAttachment.push({
                  fileName: decryptedData.decreeAttachments[0].fileName,
                  mimeType: decryptedData.decreeAttachments[0].mimetype,
                  fileContent: decryptedData.decreeAttachments[0].file,
                });
              }

              var notificationPayload = {
                type: "Advance",
                isBeneficiary: "Y",
                isApprover: "N",
                missionID: decryptedData.missionId,
                missionDescription: decryptedData.missionDescription,
                status: decryptedData.action == "1" ? "Approved" : "Sentback",
                subject: "",
                body: "",
                link: "",
                sendIndivially: "Y",
                attachments: decreeAttachment,
                params: {
                  ownerEmployeeID: advanceRequest.cust_EmployeeID,
                },
                recipients: recipients,
              };

              await _sendNotification(
                notificationPayload,
                cookies,
                "sendAdvanceNotification"
              );
              return true;
            }
          }
        } catch (error) {
          console.log("Some issues with notification:", error);
          return false;
        }
      }
    }
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _cancelMission = async function (decryptedData, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;

    const sectorFetchUrl =
      `cust_SectorBudget?$format=json` +
      //`&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate,cust_S4_Sector,cust_S4_SubSector,cust_Visible`;
      `&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate,cust_Visible`;

    const missionFetchUrl = `cust_Mission?$format=json&$select=externalCode,effectiveStartDate,transactionSequence,cust_Total_Expense,cust_Status,cust_Pending_With_user,cust_Sector,cust_Total_Expense&$filter=externalCode eq '${decryptedData.missionId}'`;

    const advanceFetchUrl = `cust_TravelAdvance?$format=json&$select=cust_Status,cust_Pending_with&$filter=cust_MissionID eq '${decryptedData.missionId}'`;

    const claimFetchUrl = `cust_BenefitTravelClaim?$format=json&$select=cust_Status,cust_Pending_with&$filter=cust_MissionID eq '${decryptedData.missionId}'`;

    //const getApproveGroupUrl = `cust_Parameters_for_Mission?$format=json&$select=cust_key,cust_Value&$filter=externalCode eq 'GS Group'`;

    let boundary = `batch_${crypto.randomUUID()}`; // batch id
    const batchURL = cookies.SF.URL + "$batch?$format=json";

    const getBatchBody =
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${sectorFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${missionFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${advanceFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${claimFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      //`--${boundary}\r\n` +
      //`Content-Type: application/http\r\n` +
      //`Content-Transfer-Encoding: binary\r\n\r\n` +
      //`GET ${getApproveGroupUrl} HTTP/1.1\r\n` +
      //`Accept: application/json\r\n\r\n` +
      `--${boundary}--`;

    const batchResponse = await axios.post(batchURL, getBatchBody, {
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
    });

    const batchResult = (await _parseMultipartResponse(batchResponse)) || [];

    if (batchResult.length === 0) {
      throw new Error("Sector or mission related data could not be read!");
    }

    const sectorFetchResponse = _.cloneDeep(batchResult[0].d.results);
    const missionUpdateRequest = _.cloneDeep(batchResult[1].d.results[0]);
    const advanceUpdateRequest =
      batchResult[2] &&
      batchResult[2].d &&
      batchResult[2].d.results &&
      _.cloneDeep(batchResult[2].d.results);
    const claimUpdateRequest =
      batchResult[3] &&
      batchResult[3].d &&
      batchResult[3].d.results &&
      _.cloneDeep(batchResult[3].d.results);
    //const getApproveGroupResponse = _.cloneDeep(batchResult[4].d.results[0]);
    //const approveGroup = getApproveGroupResponse
    //  ? getApproveGroupResponse.cust_Value
    //  : null;

    //<--1. Update sector data
    const oSubSector = _.find(sectorFetchResponse, [
      "externalCode",
      missionUpdateRequest.cust_Sector,
    ]);

    // const oMainSector = oSubSector
    //   ? _.find(sectorFetchResponse, {
    //       cust_S4_Sector: oSubSector.cust_S4_Sector,
    //       cust_S4_SubSector: oSubSector.cust_S4_Sector,
    //     })
    //   : null;

    let sectorUpdateRequest = [];
    let budgetTrackingUpdateRequest = [];
    if (oSubSector) {
      sectorUpdateRequest.push({
        __metadata: {
          uri: cookies.SF.URL + "cust_SectorBudget",
        },
        externalCode: oSubSector.externalCode,
        effectiveStartDate: "/Date(" + new Date().getTime() + ")/",
        cust_Available_budget:
          parseFloat(oSubSector.cust_Available_budget) +
          parseFloat(missionUpdateRequest.cust_Total_Expense),
        cust_Parked_Amount:
          parseFloat(oSubSector.cust_Parked_Amount) -
          parseFloat(missionUpdateRequest.cust_Total_Expense),
        cust_Utilized_Budget:
          parseFloat(oSubSector.cust_Utilized_Budget) -
          parseFloat(missionUpdateRequest.cust_Total_Expense),
      });

      //--Add budget tracking logs
      // budgetTrackingUpdateRequest.push({
      //   __metadata: {
      //     uri: cookies.SF.URL + "cust_Budget_Tracking_Missions",
      //   },
      //   externalCode:
      //     decryptedData.missionId +
      //     "-" +
      //     moment(new Date()).format("YYYYMMDD") +
      //     "-0",
      //   effectiveStartDate: "/Date(" + new Date().getTime() + ")/",
      //   cust_MissionID: decryptedData.missionId,
      //   cust_SFSector: oSubSector.externalCode,
      //   cust_S4Sector: oSubSector.cust_S4Sector,
      //   cust_Consumption: 0,
      //   cust_Remaining_Budget:
      //     parseFloat(oSubSector.cust_Available_budget) +
      //     parseFloat(missionUpdateRequest.cust_Total_Expense),
      //   cust_Comments: "Mission cancelled",
      // });
      //--Add budget tracking logs
    }

    // if (oMainSector) {
    //   sectorUpdateRequest.push({
    //     __metadata: {
    //       uri: cookies.SF.URL + "cust_SectorBudget",
    //     },
    //     externalCode: oMainSector.externalCode,
    //     effectiveStartDate: "/Date(" + new Date().getTime() + ")/",
    //     cust_Available_budget:
    //       parseFloat(oMainSector.cust_Available_budget) +
    //       parseFloat(missionUpdateRequest.cust_Total_Expense),
    //     cust_Parked_Amount:
    //       parseFloat(oMainSector.cust_Parked_Amount) -
    //       parseFloat(missionUpdateRequest.cust_Total_Expense),
    //     cust_Utilized_Budget:
    //       parseFloat(oMainSector.cust_Utilized_Budget) -
    //       parseFloat(missionUpdateRequest.cust_Total_Expense),
    //   });

    //   //--Add budget tracking logs
    //   budgetTrackingUpdateRequest.push({
    //     __metadata: {
    //       uri: cookies.SF.URL + "cust_Budget_Tracking_Missions",
    //     },
    //     externalCode:
    //       decryptedData.missionId +
    //       "-" +
    //       moment(new Date()).format("YYYYMMDD") +
    //       "-1",
    //     effectiveStartDate: "/Date(" + new Date().getTime() + ")/",
    //     cust_MissionID: decryptedData.missionId,
    //     cust_SFSector: oMainSector.externalCode,
    //     cust_S4Sector: oMainSector.cust_S4Sector,
    //     cust_Consumption: 0,
    //     cust_Remaining_Budget:
    //       parseFloat(oMainSector.cust_Available_budget) +
    //       parseFloat(missionUpdateRequest.cust_Total_Expense),
    //     cust_Comments: "Mission cancelled",
    //   });
    //   //--Add budget tracking logs
    // }
    //-->1. Update sector data

    //<--2. Update mission data
    missionUpdateRequest.cust_Status = "4"; //--Cancelled
    missionUpdateRequest.cust_Pending_With_user = null;
    missionUpdateRequest.cust_Pending_With_Group = null;
    //-->2. Update mission data

    //<--3. Update advance data
    advanceUpdateRequest &&
      advanceUpdateRequest.forEach((oAdvance) => {
        oAdvance.cust_Status = "4"; //--Cancelled
        oAdvance.cust_Pending_with = null;
      });
    //-->3. Update advance data

    //<--4. Update claim data
    claimUpdateRequest &&
      claimUpdateRequest.forEach((oClaim) => {
        oClaim.cust_Status = "4"; //--Cancelled
        oClaim.cust_Pending_with = null;
      });
    //-->4. Update claim data

    //<--5. Update Audit log
    const auditLogUpdateRequest = {
      __metadata: {
        uri: cookies.SF.URL + "cust_Audit_Log",
      },
      externalCode: "1234",
      cust_Timestamp: decryptedData.date,
      cust_Key: decryptedData.missionId,
      cust_User: decryptedData.employeeId,
      cust_Action: "Mission Cancelled",
      cust_Comments: `Mission ${decryptedData.missionId} has been cancelled by user ${decryptedData.employeeId}`,
    };
    //-->5. Update Audit log

    let postBoundary = `batch_${crypto.randomUUID()}`; // batch id
    let changeSet = `changeset_${crypto.randomUUID()}`; // changeset id
    let postBatchBody =
      `--${postBoundary}\r\n` +
      `Content-Type: multipart/mixed; boundary=${changeSet}\r\n\r\n`;

    //--Generate request
    if (sectorUpdateRequest.length > 0) {
      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(sectorUpdateRequest)}\r\n\r\n`;
    }

    if (budgetTrackingUpdateRequest.length > 0) {
      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(budgetTrackingUpdateRequest)}\r\n\r\n`;
    }

    if (missionUpdateRequest) {
      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(missionUpdateRequest)}\r\n\r\n`;
    }

    if (advanceUpdateRequest && advanceUpdateRequest.length > 0) {
      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(advanceUpdateRequest)}\r\n\r\n`;
    }

    if (claimUpdateRequest && claimUpdateRequest.length > 0) {
      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(claimUpdateRequest)}\r\n\r\n`;
    }

    if (auditLogUpdateRequest) {
      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(auditLogUpdateRequest)}\r\n\r\n`;
    }

    postBatchBody =
      postBatchBody + `--${changeSet}--\r\n\r\n` + `--${postBoundary}--`;

    const postBatchResponse = await axios.post(batchURL, postBatchBody, {
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/mixed; boundary=${postBoundary}`,
      },
    });

    //Extract and handle each individual response from the batch
    const postBatchResult =
      (await _parseMultipartResponse(postBatchResponse)) || [];

    if (postBatchResult) {
      //--Call S4 Odata
      try {
        const deleteS4Document = await _deleteS4Document(
          { missionId: decryptedData.missionId },
          cookies
        );
      } catch (e) {
        console.log(e);
      }
      //--Call S4 Odata
      return true;
    } else {
      return false;
    }
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _cancelMission_v1 = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    const missionFetchUrl =
      cookies.SF.URL +
      "cust_Mission?$select=externalCode,effectiveStartDate,transactionSequence,cust_Status,cust_Pending_With_user,cust_Sector,cust_Total_Expense&$filter=externalCode eq '" +
      decryptedData.missionId +
      "'&$format=json";
    const missionFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const missionFetchResponse = await axios.get(
      missionFetchUrl,
      missionFetchConfig
    );

    if (missionFetchResponse && missionFetchResponse.data) {
      const missionUpdateRequest = missionFetchResponse.data.d.results[0];

      const sectorFetchUrl =
        cookies.SF.URL +
        "cust_SectorBudget?$format=json&$filter=externalCode eq " +
        missionUpdateRequest.cust_Sector +
        "&$select=externalCode,cust_Delegate_Approver_for_Missions,cust_Head_of_Sector,cust_Available_budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
      const sectorFetchConfig = {
        headers: {
          Authorization: auth,
        },
      };
      const sectorFetchResponse = await axios.get(
        sectorFetchUrl,
        sectorFetchConfig
      );

      if (
        sectorFetchResponse &&
        sectorFetchResponse.data &&
        sectorFetchResponse.data.d.results.length > 0
      ) {
        const sectorInfo = sectorFetchResponse.data.d.results[0];

        var delegateApprover = null;

        if (
          sectorInfo.cust_Delegate_Approver_for_Missions != null &&
          sectorInfo.cust_Delegate_Approver_for_Missions != ""
        ) {
          delegateApprover = sectorInfo.cust_Delegate_Approver_for_Missions;
        } else if (
          sectorInfo.cust_Head_of_Sector != null &&
          sectorInfo.cust_Head_of_Sector != ""
        ) {
          delegateApprover = sectorInfo.cust_Head_of_Sector;
        }

        missionUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_Mission";

        missionUpdateRequest.cust_Pending_With_user = delegateApprover;
        missionUpdateRequest.cust_Pending_With_Group = null;
        missionUpdateRequest.cust_Status = "6";

        sectorInfo.__metadata.uri = cookies.SF.URL + "cust_SectorBudget";

        sectorInfo.cust_Utilized_Budget =
          parseFloat(sectorInfo.cust_Utilized_Budget) -
          parseFloat(missionUpdateRequest.cust_Total_Expense);
        sectorInfo.cust_Parked_Amount =
          parseFloat(sectorInfo.cust_Parked_Amount) +
          parseFloat(missionUpdateRequest.cust_Total_Expense);

        const sectorUpdateUrl = cookies.SF.URL + "upsert";
        const sectorUpdateConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: sectorUpdateUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify(sectorInfo),
        };
        await axios.request(sectorUpdateConfig);

        const missionUpdateUrl = cookies.SF.URL + "upsert";
        const missionUpdateConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: missionUpdateUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify(missionUpdateRequest),
        };

        const missionUpdateResponse = await axios.request(missionUpdateConfig);
        if (missionUpdateResponse && missionUpdateResponse.data) {
          try {
            var auditLogUrl = cookies.SF.URL + "cust_Audit_Log?$format=json";
            const auditLogConfig = {
              method: "post",
              maxBodyLength: Infinity,
              url: auditLogUrl,
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              data: JSON.stringify({
                __metadata: {
                  uri: cookies.SF.URL + "cust_Audit_Log",
                },
                externalCode: "1234",
                cust_Timestamp: decryptedData.date,
                cust_Key: decryptedData.missionId,
                cust_User: decryptedData.employeeId,
                cust_Action: "Mission Cancellation Submitted",
                cust_Comments:
                  "Cancellation submitted for Mission " +
                  decryptedData.missionId,
              }),
            };
            await axios.request(auditLogConfig);
            return true;
          } catch (error) {
            console.log("Some issues with audit");
          }
        }
      }
    }
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _approveRejectCancel = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    const missionFetchUrl =
      cookies.SF.URL +
      "cust_Mission?$select=externalCode,effectiveStartDate,transactionSequence,cust_Total_Expense,cust_Status,cust_Pending_With_user,cust_Sector,cust_Total_Expense&$filter=externalCode eq '" +
      decryptedData.missionId +
      "'&$format=json";
    const missionFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const missionFetchResponse = await axios.get(
      missionFetchUrl,
      missionFetchConfig
    );

    if (missionFetchResponse && missionFetchResponse.data) {
      const missionUpdateRequest = missionFetchResponse.data.d.results[0];

      const sectorFetchUrl =
        cookies.SF.URL +
        "cust_SectorBudget?$format=json&$filter=externalCode eq " +
        missionUpdateRequest.cust_Sector +
        "&$select=externalCode,cust_Delegate_Approver_for_Missions,cust_Head_of_Sector,cust_Available_budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
      const sectorFetchConfig = {
        headers: {
          Authorization: auth,
        },
      };
      const sectorFetchResponse = await axios.get(
        sectorFetchUrl,
        sectorFetchConfig
      );

      if (
        sectorFetchResponse &&
        sectorFetchResponse.data &&
        sectorFetchResponse.data.d.results.length > 0
      ) {
        const sectorInfo = sectorFetchResponse.data.d.results[0];

        var getApproveGroupUrl =
          cookies.SF.URL +
          "cust_Parameters_for_Mission?$format=json&$select=cust_key,cust_Value&$filter=externalCode eq 'GS Group'";

        const getApproveGroupConfig = {
          headers: {
            Authorization: auth,
          },
        };

        const getApproveGroupResponse = await axios.get(
          getApproveGroupUrl,
          getApproveGroupConfig
        );

        var approveGroup = null;
        if (
          getApproveGroupResponse &&
          getApproveGroupResponse.data &&
          getApproveGroupResponse.data.d.results.length > 0
        ) {
          approveGroup = getApproveGroupResponse.data.d.results[0].cust_Value;
        }

        if (decryptedData.action == "1") {
          sectorInfo.__metadata.uri = cookies.SF.URL + "cust_SectorBudget";
          sectorInfo.cust_Available_budget =
            parseFloat(sectorInfo.cust_Available_budget) +
            parseFloat(missionUpdateRequest.cust_Total_Expense);
          sectorInfo.cust_Parked_Amount =
            parseFloat(sectorInfo.cust_Parked_Amount) -
            parseFloat(missionUpdateRequest.cust_Total_Expense);

          const sectorUpdateUrl = cookies.SF.URL + "upsert";
          const sectorUpdateConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: sectorUpdateUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify(sectorInfo),
          };
          await axios.request(sectorUpdateConfig);

          const missionUpdateUrl = cookies.SF.URL + "upsert";
          missionUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_Mission";
          missionUpdateRequest.cust_Status = "4";
          missionUpdateRequest.cust_Pending_With_user = null;
          missionUpdateRequest.cust_Pending_With_Group = approveGroup;
          const missionUpdateConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: missionUpdateUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify(missionUpdateRequest),
          };
          await axios.request(missionUpdateConfig);
        } else {
          sectorInfo.__metadata.uri = cookies.SF.URL + "cust_SectorBudget";
          sectorInfo.cust_Utilized_Budget =
            parseFloat(sectorInfo.cust_Utilized_Budget) +
            parseFloat(missionUpdateRequest.cust_Total_Expense);
          sectorInfo.cust_Parked_Amount =
            parseFloat(sectorInfo.cust_Parked_Amount) -
            parseFloat(missionUpdateRequest.cust_Total_Expense);

          const sectorUpdateUrl = cookies.SF.URL + "upsert";
          const sectorUpdateConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: sectorUpdateUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify(sectorInfo),
          };
          await axios.request(sectorUpdateConfig);

          const missionUpdateUrl = cookies.SF.URL + "upsert";
          missionUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_Mission";
          missionUpdateRequest.cust_Status = "1";
          missionUpdateRequest.cust_Pending_With_user = null;
          missionUpdateRequest.cust_Pending_With_Group = approveGroup;
          const missionUpdateConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: missionUpdateUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify(missionUpdateRequest),
          };
          await axios.request(missionUpdateConfig);
        }

        try {
          var auditLogUrl = cookies.SF.URL + "cust_Audit_Log?$format=json";

          let comment =
            "Cancellation " + decryptedData.action == "1"
              ? "Approved"
              : "Sent Back" + " for Mission " + decryptedData.missionId;

          if (decryptedData.byDelegate !== null) {
            comment = comment + ` => By delegate ${decryptedData.byDelegate}`;
          }

          const auditLogConfig = {
            method: "post",
            maxBodyLength: Infinity,
            url: auditLogUrl,
            headers: {
              Authorization: auth,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            data: JSON.stringify({
              __metadata: {
                uri: cookies.SF.URL + "cust_Audit_Log",
              },
              externalCode: "1234",
              cust_Timestamp: decryptedData.date,
              cust_Key: decryptedData.missionId,
              cust_User: decryptedData.employeeId,
              cust_Action:
                "Mission Cancellation " + decryptedData.action == "1"
                  ? "Approved"
                  : "Sent Back",
              cust_Comments: comment,
            }),
          };
          await axios.request(auditLogConfig);
          return true;
        } catch (error) {
          console.log("Some issues with audit log:", error);
          return false;
        }
      }
    }
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _parseMultipartResponse = async (response) => {
  let multipartData = response.data;
  const results = [];

  try {
    // Ensure it's a string
    if (Buffer.isBuffer(multipartData)) {
      multipartData = multipartData.toString();
    }

    // Extract batch boundary from the response
    const changesetMatch =
      multipartData.match(/--changeset_[a-zA-Z0-9-]+/) || [];
    const boundaryMatch = multipartData.match(/--batch_[a-zA-Z0-9-]+/) || [];
    if (!boundaryMatch) {
      throw new Error("Batch boundary not found in response");
    }

    const changeset = changesetMatch[0]; // Example: --changeset_

    const boundary = boundaryMatch[0]; // Example: --batch_123456

    // Split the response into individual batch parts
    const parts = multipartData.split(changeset ? changeset : boundary);

    parts.forEach((part, index) => {
      if (
        !part.trim() ||
        part.includes("--batch_") ||
        part.includes("--changeset_") ||
        part.includes("multipart/mixed")
      ) {
        return; // Skip boundary lines
      }

      // Find the JSON body inside the part (after headers)
      const jsonStart = part.indexOf("{");
      if (jsonStart === -1) {
        return;
      }

      const jsonBody = part.substring(jsonStart).trim();

      try {
        const parsedJson = JSON.parse(jsonBody);
        results.push(parsedJson);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    });
  } catch (error) {
    console.error("Error processing batch response:", error.message);
  }
  return results;
};

const _updateMissionPayrollBatch = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;
    const sectorFetchUrl =
      "cust_SectorBudget?$format=json&$filter=externalCode eq '" +
      body.info.sector +
      "'&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
    const selectQuery =
      "externalCode,effectiveStartDate,transactionSequence,cust_Mission_Start_Date,cust_Mission_End_Date,cust_No_Of_Days," +
      "cust_ReplicationFlag,cust_Hospitality_Type,cust_Flight_type,cust_Destination,cust_TotalPerdiemMission,cust_TicketAverage," +
      "cust_Total_Expense,cust_Budget_Available,cust_Budget_Parked,cust_Members/cust_Mission_effectiveStartDate,cust_Members/cust_Mission_externalCode," +
      "cust_Members/cust_Mission_transactionSequence,cust_Members/cust_Employee_ID,cust_Members/cust_EmployeeID,cust_Members/cust_Employee_Total_Ticket," +
      "cust_Members/cust_Employee_Total_Perdiem,cust_Members/cust_Employee_Total_Expense," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_effectiveStartDate," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_externalCode,cust_Members/cust_itinerary_details_child/cust_Members_externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_transactionSequence,cust_Members/cust_itinerary_details_child/externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_start_date,cust_Members/cust_itinerary_details_child/cust_end_date," +
      "cust_Members/cust_itinerary_details_child/cust_head_of_mission,cust_Members/cust_itinerary_details_child/cust_hospitality_default," +
      "cust_Members/cust_itinerary_details_child/cust_city,cust_Members/cust_itinerary_details_child/cust_ticket_type," +
      "cust_Members/cust_itinerary_details_child/cust_ticket_average,cust_Members/cust_itinerary_details_child/cust_perdiem_per_city," +
      "cust_Members/cust_itinerary_details_child/cust_Ticket_Actual_Cost";

    const expandQuery =
      "cust_Members,cust_Members/cust_itinerary_details,cust_Members/cust_itinerary_details_child";
    const missionFetchUrl = `cust_Mission?$format=json&$filter=externalCode eq '${body.info.missionId}'&$select=${selectQuery}&$expand=${expandQuery}`;

    let boundary = `batch_${crypto.randomUUID()}`; // batch id

    const batchURL = cookies.SF.URL + "$batch?$format=json";

    const getBatchBody =
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${sectorFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${missionFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}--`;

    const batchResponse = await axios.post(batchURL, getBatchBody, {
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
    });

    //Extract and handle each individual response from the batch
    const batchResult = (await _parseMultipartResponse(batchResponse)) || [];

    if (batchResult[0] && batchResult[1]) {
      const sectorData = _.cloneDeep(batchResult[0].d.results[0]);

      let sectorUpdateRequest = {
        __metadata: sectorData.__metadata,
        cust_Available_budget: body.info.budgetAvailable,
        cust_Parked_Amount: body.info.budgetParked,
      };

      const missionData = _.cloneDeep(batchResult[1].d.results[0]);

      let missionUpdateRequest = {
        __metadata: missionData.__metadata,
        //--Update related fields
        cust_Mission_Start_Date: body.info.missionStartDate,
        cust_Mission_End_Date: body.info.missionEndDate,
        cust_No_Of_Days: body.info.noOfDays,
        cust_TicketAverage: body.info.ticketAverage,
        cust_Total_Expense: body.info.totalExpense,
        cust_TotalPerdiemMission: body.info.totalPerdiemMission,
        cust_Budget_Available: body.info.budgetAvailable,
        cust_Budget_Parked: body.info.budgetParked,
        cust_Members: {
          results: [],
        },
      };
      missionData.cust_Members.results.forEach((oMember) => {
        const oMemberFound = _.find(body.members, [
          "employeeID",
          oMember.cust_EmployeeID,
        ]);
        if (oMemberFound) {
          let memberUpdateRequest = {
            __metadata: oMember.__metadata,
            cust_Employee_Total_Expense: oMemberFound.employeeTotalExpense,
            cust_Employee_Total_Perdiem: oMemberFound.employeeTotalPerdiem,
            cust_Employee_Total_Ticket: oMemberFound.employeeTotalTicket,
            cust_itinerary_details_child: {
              results: [],
            },
          };

          oMember.cust_itinerary_details_child.results.forEach(
            (oItinerary, i) => {
              const oItineraryFound = _.find(oMemberFound.itinerary, [
                "externalCode",
                oItinerary.externalCode,
              ]);

              if (oItineraryFound) {
                let itineraryUpdateRequest = {
                  __metadata: oItinerary.__metadata,
                  cust_start_date: oItineraryFound.startDate,
                  cust_end_date: oItineraryFound.endDate,
                  cust_head_of_mission: oItineraryFound.headOfMission,
                  cust_ticket_type: oItineraryFound.ticketType,
                  cust_perdiem_per_city: oItineraryFound.perDiemPerCity,
                  cust_Ticket_Actual_Cost: oItineraryFound.ticketActualCost,
                  cust_ticket_average: oItineraryFound.ticketAverage,
                  cust_hospitality_default: oItineraryFound.hospitalityDefault,
                  cust_city: oItineraryFound.city,
                };
                memberUpdateRequest.cust_itinerary_details_child.results.push(
                  itineraryUpdateRequest
                );
              }
            }
          );

          missionUpdateRequest.cust_Members.results.push(memberUpdateRequest);
        }
      });

      let auditLogUpdateRequest = {
        __metadata: {
          uri: cookies.SF.URL + "cust_Audit_Log",
        },
        externalCode: "1234",
        cust_Timestamp: body.info.date,
        cust_Key: body.info.missionId,
        cust_User: body.info.loggedInUser,
        cust_Action: "Payroll approver update",
        cust_Comments:
          "Payroll approver updated Mission " + body.info.missionId,
      };

      //--Generate request
      let postBoundary = `batch_${crypto.randomUUID()}`; // batch id
      let changeSet = `changeset_${crypto.randomUUID()}`; // changeset id
      const postBatchBody =
        `--${postBoundary}\r\n` +
        `Content-Type: multipart/mixed; boundary=${changeSet}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(sectorUpdateRequest)}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(missionUpdateRequest)}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(auditLogUpdateRequest)}\r\n\r\n` +
        `--${changeSet}--\r\n\r\n` +
        `--${postBoundary}--`;

      const postBatchResponse = await axios.post(batchURL, postBatchBody, {
        headers: {
          Authorization: auth,
          "Content-Type": `multipart/mixed; boundary=${postBoundary}`,
        },
      });

      //Extract and handle each individual response from the batch
      const postBatchResult =
        (await _parseMultipartResponse(postBatchResponse)) || [];

      if (postBatchResult[0] && postBatchResult[1] && postBatchResult[2]) {
        return {
          status: "OK",
        };
      } else {
        return {
          status: "NOT_OK",
        };
      }
    } else {
      throw new Error("Sector or mission data could not be read!");
    }
  } catch (e) {
    console.log("Update mission batch error", e);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};
const _updateMissionPayroll = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;

    const sectorFetchUrl =
      cookies.SF.URL +
      "cust_SectorBudget?$format=json&$filter=externalCode eq " +
      body.info.sector +
      "&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
    const sectorFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const sectorFetchResponse = await axios.get(
      sectorFetchUrl,
      sectorFetchConfig
    );

    if (sectorFetchResponse && sectorFetchResponse.data) {
      const sectorUpdateRequest = sectorFetchResponse.data.d.results[0];
      sectorUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_SectorBudget";
      sectorUpdateRequest.cust_Available_budget = body.info.budgetAvailable;
      sectorUpdateRequest.cust_Parked_Amount = body.info.budgetParked;

      const sectorUpdateUrl = cookies.SF.URL + "upsert?$format=json";
      const sectorUpdateConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: sectorUpdateUrl,
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        data: JSON.stringify(sectorUpdateRequest),
      };
      await axios.request(sectorUpdateConfig);
    }

    const selectQuery =
      "externalCode,effectiveStartDate,transactionSequence,cust_Mission_Start_Date,cust_Mission_End_Date,cust_No_Of_Days," +
      "cust_ReplicationFlag,cust_Hospitality_Type,cust_Flight_type,cust_Destination,cust_TotalPerdiemMission,cust_TicketAverage," +
      "cust_Total_Expense,cust_Budget_Available,cust_Budget_Parked,cust_Members/cust_Mission_effectiveStartDate,cust_Members/cust_Mission_externalCode," +
      "cust_Members/cust_Mission_transactionSequence,cust_Members/cust_Employee_ID,cust_Members/cust_EmployeeID,cust_Members/cust_Employee_Total_Ticket," +
      "cust_Members/cust_Employee_Total_Perdiem,cust_Members/cust_Employee_Total_Expense," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_effectiveStartDate," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_externalCode,cust_Members/cust_itinerary_details_child/cust_Members_externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_transactionSequence,cust_Members/cust_itinerary_details_child/externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_start_date,cust_Members/cust_itinerary_details_child/cust_end_date," +
      "cust_Members/cust_itinerary_details_child/cust_head_of_mission,cust_Members/cust_itinerary_details_child/cust_hospitality_default," +
      "cust_Members/cust_itinerary_details_child/cust_city,cust_Members/cust_itinerary_details_child/cust_ticket_type," +
      "cust_Members/cust_itinerary_details_child/cust_ticket_average,cust_Members/cust_itinerary_details_child/cust_perdiem_per_city," +
      "cust_Members/cust_itinerary_details_child/cust_Ticket_Actual_Cost";
    const expandQuery =
      "cust_Members,cust_Members/cust_itinerary_details,cust_Members/cust_itinerary_details_child";
    const missionFetchUrl =
      cookies.SF.URL +
      `cust_Mission?$format=json&$filter=externalCode eq '${body.info.missionId}'&$select=${selectQuery}&$expand=${expandQuery}`;

    const missionFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const missionFetchResponse = await axios.get(
      missionFetchUrl,
      missionFetchConfig
    );

    if (missionFetchResponse && missionFetchResponse.data) {
      const missionData = _.cloneDeep(missionFetchResponse.data.d.results[0]);

      let missionUpdateRequest = {
        __metadata: missionData.__metadata,
        //--Update related fields
        cust_Mission_Start_Date: body.info.missionStartDate,
        cust_Mission_End_Date: body.info.missionEndDate,
        cust_No_Of_Days: body.info.noOfDays,
        cust_TicketAverage: body.info.ticketAverage,
        cust_Total_Expense: body.info.totalExpense,
        cust_TotalPerdiemMission: body.info.totalPerdiemMission,
        cust_Budget_Available: body.info.budgetAvailable,
        cust_Budget_Parked: body.info.budgetParked,
        cust_Members: {
          results: [],
        },
      };

      missionData.cust_Members.results.forEach((oMember) => {
        const oMemberFound = _.find(body.members, [
          "employeeID",
          oMember.cust_EmployeeID,
        ]);
        if (oMemberFound) {
          let memberUpdateRequest = {
            __metadata: oMember.__metadata,
            cust_Employee_Total_Expense: oMemberFound.employeeTotalExpense,
            cust_Employee_Total_Perdiem: oMemberFound.employeeTotalPerdiem,
            cust_Employee_Total_Ticket: oMemberFound.employeeTotalTicket,
            cust_itinerary_details_child: {
              results: [],
            },
          };

          oMember.cust_itinerary_details_child.results.forEach(
            (oItinerary, i) => {
              const oItineraryFound = _.find(oMemberFound.itinerary, [
                "externalCode",
                oItinerary.externalCode,
              ]);

              if (oItineraryFound) {
                let itineraryUpdateRequest = {
                  __metadata: oItinerary.__metadata,
                  cust_start_date: oItineraryFound.startDate,
                  cust_end_date: oItineraryFound.endDate,
                  cust_head_of_mission: oItineraryFound.headOfMission,
                  cust_ticket_type: oItineraryFound.ticketType,
                  cust_perdiem_per_city: oItineraryFound.perDiemPerCity,
                  cust_Ticket_Actual_Cost: oItineraryFound.ticketActualCost,
                  cust_ticket_average: oItineraryFound.ticketAverage,
                  cust_hospitality_default: oItineraryFound.hospitalityDefault,
                  cust_city: oItineraryFound.city,
                };
                memberUpdateRequest.cust_itinerary_details_child.results.push(
                  itineraryUpdateRequest
                );
              }
            }
          );

          missionUpdateRequest.cust_Members.results.push(memberUpdateRequest);
        }
      });

      const missionUpdateUrl = cookies.SF.URL + "upsert?$format=json";

      const missionUpdateConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: missionUpdateUrl,
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        data: missionUpdateRequest,
      };

      const missionUpdateResponse = await axios.request(missionUpdateConfig);

      return missionUpdateResponse.data;
    }

    throw new CustomHttpError(
      500,
      "Update failed. Mission data could not be fetched. Please try again later."
    );
  } catch (e) {
    console.log("Update mission by Payroll Error:" + e);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _convertFloat = (f) => {
  try {
    return parseFloat(f).toString();
  } catch (e) {
    return "0";
  }
};

const _updateMissionBatch = async function (body, userInfo, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;

    const sectorFetchUrl =
      "cust_SectorBudget?$format=json&$filter=externalCode eq '" +
      body.info.sector +
      "'&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";

    const missionSelectQuery =
      "externalCode,effectiveStartDate,transactionSequence,cust_Mission_Start_Date,cust_Mission_End_Date,cust_No_Of_Days," +
      "cust_ReplicationFlag,cust_Hospitality_Type,cust_Flight_type,cust_Destination,cust_TotalPerdiemMission,cust_TicketAverage," +
      "cust_Total_Expense,cust_Budget_Available,cust_Budget_Parked,cust_Members/cust_Mission_effectiveStartDate,cust_Members/cust_Mission_externalCode," +
      "cust_Members/cust_Mission_transactionSequence,cust_Members/cust_Employee_ID,cust_Members/cust_Employee_Total_Ticket," +
      "cust_Members/cust_Employee_Total_Perdiem,cust_Members/cust_Employee_Total_Expense," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_effectiveStartDate," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_externalCode,cust_Members/cust_itinerary_details_child/cust_Members_externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_transactionSequence,cust_Members/cust_itinerary_details_child/externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_start_date,cust_Members/cust_itinerary_details_child/cust_end_date," +
      "cust_Members/cust_itinerary_details_child/cust_head_of_mission,cust_Members/cust_itinerary_details_child/cust_hospitality_default," +
      "cust_Members/cust_itinerary_details_child/cust_city,cust_Members/cust_itinerary_details_child/cust_ticket_type," +
      "cust_Members/cust_itinerary_details_child/cust_ticket_average,cust_Members/cust_itinerary_details_child/cust_perdiem_per_city," +
      "cust_Members/cust_itinerary_details_child/cust_Ticket_Actual_Cost," +
      "cust_Members/cust_AttachmentNav/attachmentId";

    const missionExpandQuery =
      "cust_Members,cust_Members/cust_itinerary_details,cust_Members/cust_itinerary_details_child,cust_Members/cust_AttachmentNav";
    const missionFetchUrl = `cust_Mission?$format=json&$filter=externalCode eq '${body.info.missionId}'&$select=${missionSelectQuery}&$expand=${missionExpandQuery}`;

    let boundary = `batch_${crypto.randomUUID()}`; // batch id

    const batchURL = cookies.SF.URL + "$batch?$format=json";

    const getBatchBody =
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${sectorFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${missionFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n` +
      `--${boundary}--`;

    const batchResponse = await axios.post(batchURL, getBatchBody, {
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
    });

    //Extract and handle each individual response from the batch
    const batchResult = (await _parseMultipartResponse(batchResponse)) || [];

    if (batchResult[0] && batchResult[1]) {
      const sectorData = _.cloneDeep(batchResult[0].d.results[0]);

      let sectorUpdateRequest = {
        __metadata: sectorData.__metadata,
        cust_Available_budget: _convertFloat(body.info.budgetAvailable),
        cust_Parked_Amount: _convertFloat(body.info.budgetParked),
      };

      const missionData = _.cloneDeep(batchResult[1].d.results[0]);

      let missionUpdateRequest = {
        __metadata: missionData.__metadata,
        //--Update related fields
        cust_Mission_Start_Date: body.info.missionStartDate,
        cust_Mission_End_Date: body.info.missionEndDate,
        cust_No_Of_Days: body.info.noOfDays,
        cust_TicketAverage: _convertFloat(body.info.ticketAverage),
        cust_Total_Expense: _convertFloat(body.info.totalExpense),
        cust_TotalPerdiemMission: _convertFloat(body.info.totalPerdiemMission),
        cust_Budget_Available: _convertFloat(body.info.budgetAvailable),
        cust_Budget_Parked: _convertFloat(body.info.budgetParked),
        cust_Mission_Description: body.info.missionDescription,
        cust_Destination: body.info.destination,
        cust_Hospitality_Type: body.info.hospitality_Type,
        cust_Sector: body.info.sector,
        cust_Status: "2",
        cust_Decree_Type: body.info.decreeType,
        cust_ExternalEntity: body.info.externalEntity,
        cust_Flight_type: body.info.flightType,
        cust_ReplicationFlag: "01",
        cust_Pending_With_user: body.info.pendingWithUser,
        cust_Pending_With_Group: body.info.pendingWithGroup
          ? body.info.pendingWithGroup
          : null,
        cust_Mission_Created_By: userInfo,
        cust_MissionDetails: body.info.missionDetails,
        externalName: body.info.missionDescription,
        cust_Members: {
          results: [],
        },
      };

      //--Upload attachments first
      let uploadBoundary = `batch_${crypto.randomUUID()}`; // batch id
      let uploadChangeSet = `changeset_${crypto.randomUUID()}`; // changeset id
      let uploadBatchBody =
        `--${uploadBoundary}\r\n` +
        `Content-Type: multipart/mixed; boundary=${uploadChangeSet}\r\n\r\n`;
      let uploadBatchOperation = [];
      body.members.forEach((oMember) => {
        if (oMember.attachments.length > 0) {
          let uploadPostRequest = {
            __metadata: {
              uri: cookies.SF.URL + "Attachment",
              type: "SFOData.Attachment",
            },
            userId: userInfo,
            fileName: oMember.attachments[0].fileName,
            module: "GENERIC_OBJECT",
            viewable: true,
            fileContent: oMember.attachments[0].file,
          };

          uploadBatchBody =
            uploadBatchBody +
            `--${uploadChangeSet}\r\n` +
            `Content-Type: application/http\r\n` +
            `Content-Transfer-Encoding: binary\r\n\r\n` +
            `POST upsert?$format=json HTTP/1.1\r\n` +
            `Content-Type: application/json;charset=utf-8\r\n` +
            `Accept: application/json\r\n\r\n` +
            `${JSON.stringify(uploadPostRequest)}\r\n\r\n`;

          uploadBatchOperation.push({
            employeeID: oMember.employeeID,
            attachmentId: null,
          });
        }
      });

      if (uploadBatchOperation.length > 0) {
        uploadBatchBody =
          uploadBatchBody +
          `--${uploadChangeSet}--\r\n\r\n` +
          `--${uploadBoundary}--`;

        const uploadBatchResponse = await axios.post(
          batchURL,
          uploadBatchBody,
          {
            headers: {
              Authorization: auth,
              "Content-Type": `multipart/mixed; boundary=${uploadBoundary}`,
            },
          }
        );

        //Extract and handle each individual response from the batch
        const uploadBatchResult =
          (await _parseMultipartResponse(uploadBatchResponse)) || [];

        uploadBatchResult.forEach((r, i) => {
          if (r.d && r.d.length > 0 && r.d[0].key) {
            try {
              let attachmentId = r.d[0].key.split("=")[1] || null;
              uploadBatchOperation[i]["attachmentId"] = attachmentId;
            } catch (ex) {
              //
            }
          }
        });
      }

      //--Upload attachments first

      let postBoundary = `batch_${crypto.randomUUID()}`; // batch id
      let changeSet = `changeset_${crypto.randomUUID()}`; // changeset id
      let postBatchBody =
        `--${postBoundary}\r\n` +
        `Content-Type: multipart/mixed; boundary=${changeSet}\r\n\r\n`;

      //--First add delete requests
      missionData.cust_Members.results.forEach((oMember) => {
        //--Remove first children
        oMember.cust_itinerary_details_child.results.forEach(
          (oItinerary, i) => {
            let sItineraryUrl = oItinerary.__metadata.uri;
            let sItineraryIndex = sItineraryUrl.indexOf(
              "/cust_itinerary_details_child("
            );
            if (sItineraryIndex !== -1) {
              let sItineraryKey = sItineraryUrl.substring(sItineraryIndex + 1);
              postBatchBody =
                postBatchBody +
                `--${changeSet}\r\n` +
                `Content-Type: application/http\r\n` +
                `Content-Transfer-Encoding: binary\r\n\r\n` +
                `DELETE ${sItineraryKey} HTTP/1.1\r\n\r\n`;
            }
          }
        );

        if (oMember.cust_AttachmentNav) {
          let sAttachmentUrl = oMember.cust_AttachmentNav.__metadata.uri;
          let sAttachmentIndex = sAttachmentUrl.indexOf("/Attachment(");
          if (sAttachmentIndex !== -1) {
            let sAttachmentKey = sAttachmentUrl.substring(sAttachmentIndex + 1);
            postBatchBody =
              postBatchBody +
              `--${changeSet}\r\n` +
              `Content-Type: application/http\r\n` +
              `Content-Transfer-Encoding: binary\r\n\r\n` +
              `DELETE ${sAttachmentKey} HTTP/1.1\r\n\r\n`;
          }
        }

        let sMemberUrl = oMember.__metadata.uri;
        let sIndex = sMemberUrl.indexOf("/cust_Members(");
        if (sIndex !== -1) {
          let sMemberKey = sMemberUrl.substring(sIndex + 1);
          postBatchBody =
            postBatchBody +
            `--${changeSet}\r\n` +
            `Content-Type: application/http\r\n` +
            `Content-Transfer-Encoding: binary\r\n\r\n` +
            `DELETE ${sMemberKey} HTTP/1.1\r\n\r\n`;
        }
      });
      //--First add delete requests

      body.members.forEach((oMember) => {
        let memberUpdateRequest = {
          __metadata: {
            uri: cookies.SF.URL + "cust_Members",
          },
          cust_Employee_Total_Expense: _convertFloat(
            oMember.employeeTotalExpense
          ),
          cust_Employee_Total_Perdiem: _convertFloat(
            oMember.employeeTotalPerdiem
          ),
          cust_Employee_Total_Ticket: _convertFloat(
            oMember.employeeTotalTicket
          ),
          cust_Department: oMember.department,
          cust_Employee_ID: oMember.userID,
          cust_EmployeeID: oMember.employeeID,
          cust_First_Name: oMember.employeeName,
          cust_Grade: oMember.grade,
          cust_Multiple_Cities: oMember.multipleCities,
          cust_saluatation: oMember.salutation,
          cust_Title_Of_Employee: oMember.title,
          cust_NoOfCities: oMember.noOfCities,
          cust_Mission_ID: body.info.missionId,
          cust_Mission_Description: body.info.missionDescription,
          cust_HeadOfMission: "N",
          cust_itinerary_details_child: {
            results: [],
          },
        };

        let oAttachment = _.find(uploadBatchOperation, [
          "employeeID",
          oMember.employeeID,
        ]);

        if (oAttachment && oAttachment.attachmentId) {
          memberUpdateRequest.cust_AttachmentNav = {
            __metadata: {
              uri:
                cookies.SF.URL + "Attachment(" + oAttachment.attachmentId + ")",
            },
          };
        }

        oMember.itinerary.forEach((oItinerary, i) => {
          //--cust_Members - head of mission was missing revised on 12th May 2025 - BD - DS
          //Daniel: please pass the value in head of mission for itinerary to members also.... just like we do in CPI
          if (oItinerary.headOfMission === "Y") {
            memberUpdateRequest.cust_HeadOfMission = "Y";
          }
          //--cust_Members - head of mission was missing revised on 12th May 2025 - BD - DS
          //Daniel: please pass the value in head of mission for itinerary to members also.... just like we do in CPI

          let itineraryUpdateRequest = {
            __metadata: {
              uri: cookies.SF.URL + "cust_itinerary_details_child",
            },
            cust_Mission_externalCode: body.info.missionId,
            cust_start_date: oItinerary.startDate,
            cust_end_date: oItinerary.endDate,
            cust_head_of_mission: oItinerary.headOfMission,
            cust_ticket_type: oItinerary.ticketType,
            cust_perdiem_per_city: _convertFloat(oItinerary.perDiemPerCity),
            cust_Ticket_Actual_Cost: parseFloat(oItinerary.ticketActualCost),
            cust_ticket_average: _convertFloat(oItinerary.ticketAverage),
            cust_hospitality_default: oItinerary.hospitalityDefault,
            cust_city: oItinerary.city,
          };
          memberUpdateRequest.cust_itinerary_details_child.results.push(
            itineraryUpdateRequest
          );
        });

        missionUpdateRequest.cust_Members.results.push(memberUpdateRequest);
      });

      let auditLogUpdateRequest = {
        __metadata: {
          uri: cookies.SF.URL + "cust_Audit_Log",
        },
        externalCode: "1234",
        cust_Timestamp: body.info.date,
        cust_Key: body.info.missionId,
        cust_User: userInfo,
        cust_Action: "Edited",
        cust_Comments: "Mission is edited " + body.info.missionId,
      };

      //--Generate request
      postBatchBody =
        postBatchBody +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(sectorUpdateRequest)}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(missionUpdateRequest)}\r\n\r\n` +
        `--${changeSet}\r\n` +
        `Content-Type: application/http\r\n` +
        `Content-Transfer-Encoding: binary\r\n\r\n` +
        `POST upsert?$format=json HTTP/1.1\r\n` +
        `Content-Type: application/json;charset=utf-8\r\n` +
        `Accept: application/json\r\n\r\n` +
        `${JSON.stringify(auditLogUpdateRequest)}\r\n\r\n` +
        `--${changeSet}--\r\n\r\n` +
        `--${postBoundary}--`;

      const postBatchResponse = await axios.post(batchURL, postBatchBody, {
        headers: {
          Authorization: auth,
          "Content-Type": `multipart/mixed; boundary=${postBoundary}`,
        },
      });

      //Extract and handle each individual response from the batch
      const postBatchResult =
        (await _parseMultipartResponse(postBatchResponse)) || [];

      return postBatchResult;
    } else {
      throw new Error("Sector or mission data could not be read!");
    }
  } catch (e) {
    console.log("Update mission batch error", e);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};
const _updateMission = async function (body, userInfo, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;
    var SFAuth = Buffer.from(cookies.SF.basicAuth, "base64").toString("utf-8");
    var SFAuthUsername = SFAuth.split(":")[0].split("@")[0];

    const sectorFetchUrl =
      cookies.SF.URL +
      "cust_SectorBudget?$format=json&$filter=externalCode eq " +
      body.info.sector +
      "&$select=externalCode,cust_Available_budget,cust_Budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
    const sectorFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const sectorFetchResponse = await axios.get(
      sectorFetchUrl,
      sectorFetchConfig
    );

    if (sectorFetchResponse && sectorFetchResponse.data) {
      const sectorUpdateRequest = sectorFetchResponse.data.d.results[0];
      sectorUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_SectorBudget";
      sectorUpdateRequest.cust_Available_budget = body.info.budgetAvailable;
      sectorUpdateRequest.cust_Parked_Amount = body.info.budgetParked;

      const sectorUpdateUrl = cookies.SF.URL + "upsert";
      const sectorUpdateConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: sectorUpdateUrl,
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: JSON.stringify(sectorUpdateRequest),
      };
      await axios.request(sectorUpdateConfig);
    }

    const missionFetchUrl =
      cookies.SF.URL +
      "cust_Mission?$filter=externalCode eq '" +
      body.info.missionId +
      "'&$format=json&$select=externalCode,effectiveStartDate,transactionSequence,cust_Mission_Description,cust_Destination,cust_Hospitality_Type,cust_Sector,cust_Budget_Available,cust_Mission_Start_Date,cust_Mission_End_Date,cust_No_Of_Days,cust_TicketAverage,cust_TotalPerdiemMission,cust_Status,cust_Total_Expense,cust_Budget_Parked,cust_Decree_Type,cust_Flight_type,cust_ReplicationFlag,cust_Pending_With_user,cust_Pending_With_Group,cust_Mission_Created_By,cust_MissionDetails,externalName";
    const missionFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const missionFetchResponse = await axios.get(
      missionFetchUrl,
      missionFetchConfig
    );

    if (missionFetchResponse && missionFetchResponse.data) {
      const missionUpdateRequest = missionFetchResponse.data.d.results[0];
      missionUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_Mission";
      missionUpdateRequest.cust_Mission_Description =
        body.info.missionDescription;
      missionUpdateRequest.cust_Destination = body.info.destination;
      missionUpdateRequest.cust_Hospitality_Type = body.info.hospitality_Type;
      missionUpdateRequest.cust_Sector = body.info.sector;
      missionUpdateRequest.cust_Budget_Available = body.info.budgetAvailable;
      missionUpdateRequest.cust_Mission_Start_Date = body.info.missionStartDate;
      missionUpdateRequest.cust_Mission_End_Date = body.info.missionEndDate;
      missionUpdateRequest.cust_No_Of_Days = body.info.noOfDays;
      missionUpdateRequest.cust_TicketAverage = body.info.ticketAverage;
      missionUpdateRequest.cust_TotalPerdiemMission =
        body.info.totalPerdiemMission;
      missionUpdateRequest.cust_Status = "2";
      missionUpdateRequest.cust_Total_Expense = body.info.totalExpense;
      missionUpdateRequest.cust_Budget_Parked = body.info.budgetParked;
      missionUpdateRequest.cust_Decree_Type = body.info.decreeType;
      missionUpdateRequest.cust_Flight_type = body.info.flightType;
      missionUpdateRequest.cust_ReplicationFlag = "01";
      missionUpdateRequest.cust_Pending_With_user = body.info.pendingWithUser;
      missionUpdateRequest.cust_Pending_With_Group = null;
      missionUpdateRequest.cust_Mission_Created_By = userInfo;
      missionUpdateRequest.cust_MissionDetails = body.info.missionDetails;
      missionUpdateRequest.externalName = body.info.missionDescription;

      const missionUpdateUrl = cookies.SF.URL + "upsert";
      const missionUpdateConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: missionUpdateUrl,
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: JSON.stringify(missionUpdateRequest),
      };

      const missionUpdateResponse = await axios.request(missionUpdateConfig);
      if (missionUpdateResponse && missionUpdateResponse.data) {
        const memberFetchUrl =
          cookies.SF.URL +
          "cust_Members?$format=json&$filter=cust_Mission_externalCode eq '" +
          body.info.missionId +
          "'&$expand=cust_AttachmentNav";
        const memberFetchConfig = {
          headers: {
            Authorization: auth,
          },
        };
        const memberFetchResponse = await axios.get(
          memberFetchUrl,
          memberFetchConfig
        );
        if (
          memberFetchResponse &&
          memberFetchResponse.data &&
          memberFetchResponse.data.d.results.length > 0
        ) {
          for (var i = 0; i < memberFetchResponse.data.d.results.length; i++) {
            var memberDeleteRequest = memberFetchResponse.data.d.results[i];
            var memberDeleteUrl = memberDeleteRequest.__metadata.uri;
            var memberDeleteConfig = {
              method: "delete",
              maxBodyLength: Infinity,
              url: memberDeleteUrl,
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            };
            await axios.request(memberDeleteConfig);
          }

          for (var j = 0; j < body.members.length; j++) {
            var attachmentId = null;
            if (body.members[j].attachments.length > 0) {
              var postMemeberAttachmentUrl =
                cookies.SF.URL + "upsert?$format=json";

              var postMemberAttachmentConfig = {
                method: "post",
                maxBodyLength: Infinity,
                url: postMemeberAttachmentUrl,
                headers: {
                  Authorization: auth,
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                data: JSON.stringify({
                  __metadata: {
                    uri: cookies.SF.URL + "Attachment",
                    type: "SFOData.Attachment",
                  },
                  userId: SFAuthUsername,
                  fileName: body.members[j].attachments[0].fileName,
                  module: "GENERIC_OBJECT",
                  viewable: true,
                  fileContent: body.members[j].attachments[0].file,
                }),
              };

              var postMemberAttachmentResponse = await axios.request(
                postMemberAttachmentConfig
              );

              if (
                postMemberAttachmentResponse &&
                postMemberAttachmentResponse.data &&
                postMemberAttachmentResponse.data.d.length > 0
              ) {
                var attachmentKey = postMemberAttachmentResponse.data.d[0].key;
                attachmentId = attachmentKey.split("=")[1];
              }
            }

            var memberUpsertReq = null;

            if (attachmentId == null) {
              memberUpsertReq = {
                __metadata: {
                  uri: cookies.SF.URL + "cust_Members",
                  type: "SFOData.cust_Members",
                },
                cust_Mission_effectiveStartDate: body.info.date,
                cust_Mission_externalCode: body.info.missionId,
                cust_Mission_transactionSequence:
                  missionUpdateRequest.transactionSequence,
                cust_Department: body.members[j].department,
                cust_Employee_ID: body.members[j].userID,
                cust_EmployeeID: body.members[j].employeeID,
                cust_First_Name: body.members[j].employeeName,
                cust_Employee_Total_Expense:
                  body.members[j].employeeTotalExpense,
                cust_Employee_Total_Perdiem:
                  body.members[j].employeeTotalPerdiem,
                cust_Employee_Total_Ticket: body.members[j].employeeTotalTicket,
                cust_Grade: body.members[j].grade,
                cust_Multiple_Cities: body.members[j].multipleCities,
                cust_saluatation: body.members[j].salutation,
                cust_Title_Of_Employee: body.members[j].title,
                cust_NoOfCities: body.members[j].noOfCities,
                cust_Mission_ID: body.info.missionId,
                cust_Mission_Description: body.info.missionDescription,
              };
            } else {
              memberUpsertReq = {
                __metadata: {
                  uri: cookies.SF.URL + "cust_Members",
                  type: "SFOData.cust_Members",
                },
                cust_Mission_effectiveStartDate: body.info.date,
                cust_Mission_externalCode: body.info.missionId,
                cust_Mission_transactionSequence:
                  missionUpdateRequest.transactionSequence,
                cust_Department: body.members[j].department,
                cust_Employee_ID: body.members[j].userID,
                cust_EmployeeID: body.members[j].employeeID,
                cust_First_Name: body.members[j].employeeName,
                cust_Employee_Total_Expense:
                  body.members[j].employeeTotalExpense,
                cust_Employee_Total_Perdiem:
                  body.members[j].employeeTotalPerdiem,
                cust_Employee_Total_Ticket: body.members[j].employeeTotalTicket,
                cust_Grade: body.members[j].grade,
                cust_Multiple_Cities: body.members[j].multipleCities,
                cust_saluatation: body.members[j].salutation,
                cust_Title_Of_Employee: body.members[j].title,
                cust_NoOfCities: body.members[j].noOfCities,
                cust_Mission_ID: body.info.missionId,
                cust_Mission_Description: body.info.missionDescription,
                cust_AttachmentNav: {
                  __metadata: {
                    uri: cookies.SF.URL + "Attachment(" + attachmentId + ")",
                  },
                },
              };
            }

            var memberUpdateUrl = cookies.SF.URL + "upsert";
            var memberUpdateConfig = {
              method: "post",
              maxBodyLength: Infinity,
              url: memberUpdateUrl,
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              data: JSON.stringify(memberUpsertReq),
            };

            var memberUpdateResp = await axios.request(memberUpdateConfig);

            if (memberUpdateResp && memberUpdateResp.data) {
              var memberUpdateFetchUrl =
                cookies.SF.URL +
                "cust_Members?$format=json&$filter=cust_Mission_externalCode eq '" +
                body.info.missionId +
                "' and cust_EmployeeID eq '" +
                body.members[j].employeeID +
                "'";
              var memberUpdateFetchConfig = {
                headers: {
                  Authorization: auth,
                },
              };
              var memberUpdateFetchResponse = await axios.get(
                memberUpdateFetchUrl,
                memberUpdateFetchConfig
              );

              if (
                memberUpdateFetchResponse &&
                memberUpdateFetchResponse.data &&
                memberUpdateFetchResponse.data.d.results.length > 0
              ) {
                var memberUpdateFetchRes =
                  memberUpdateFetchResponse.data.d.results[0];

                for (var k = 0; k < body.members[j].itinerary.length; k++) {
                  var itineraryUpsertReq = {
                    __metadata: {
                      uri: cookies.SF.URL + "cust_itinerary_details_child",
                      type: "SFOData.cust_itinerary_details_child",
                    },
                    cust_Mission_effectiveStartDate: body.info.date,
                    cust_Mission_externalCode: body.info.missionId,
                    cust_Mission_transactionSequence:
                      missionUpdateRequest.transactionSequence,
                    cust_Members_externalCode:
                      memberUpdateFetchRes.externalCode,
                    cust_ticket_average:
                      body.members[j].itinerary[k].ticketAverage.toString(),
                    cust_ticket_type: body.members[j].itinerary[k].ticketType,
                    cust_perdiem_per_city:
                      body.members[j].itinerary[k].perDiemPerCity.toString(),
                    cust_end_date: body.members[j].itinerary[k].endDate,
                    cust_start_date: body.members[j].itinerary[k].startDate,
                    cust_head_of_mission:
                      body.members[j].itinerary[k].headOfMission,
                    cust_hospitality_default:
                      body.members[j].itinerary[k].hospitalityDefault,
                    cust_city: body.members[j].itinerary[k].city,
                  };

                  var itineraryUpdateUrl = cookies.SF.URL + "upsert";
                  var itineraryUpdateConfig = {
                    method: "post",
                    maxBodyLength: Infinity,
                    url: itineraryUpdateUrl,
                    headers: {
                      Authorization: auth,
                      "Content-Type": "application/json",
                      Accept: "application/json",
                    },
                    data: JSON.stringify(itineraryUpsertReq),
                  };

                  await axios.request(itineraryUpdateConfig);
                }
              }
            }
          }
          return true;
        }
      }
    }
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _rejectMission = async function (decryptedData, cookies) {
  try {
    var auth = "Basic " + cookies.SF.basicAuth;

    const missionFetchUrl =
      cookies.SF.URL +
      "cust_Mission?$select=externalCode,effectiveStartDate,transactionSequence,cust_Status,cust_Pending_With_user,cust_Sector,cust_Total_Expense&$filter=externalCode eq '" +
      decryptedData.mission +
      "'&$format=json";
    const missionFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const missionFetchResponse = await axios.get(
      missionFetchUrl,
      missionFetchConfig
    );

    if (missionFetchResponse && missionFetchResponse.data) {
      const missionUpdateRequest = missionFetchResponse.data.d.results[0];

      const sectorFetchUrl =
        cookies.SF.URL +
        "cust_SectorBudget?$format=json&$filter=externalCode eq " +
        missionUpdateRequest.cust_Sector +
        "&$select=externalCode,cust_Delegate_Approver_for_Missions,cust_Head_of_Sector,cust_Available_budget,cust_Parked_Amount,cust_Utilized_Budget,effectiveStartDate";
      const sectorFetchConfig = {
        headers: {
          Authorization: auth,
        },
      };
      const sectorFetchResponse = await axios.get(
        sectorFetchUrl,
        sectorFetchConfig
      );

      if (
        sectorFetchResponse &&
        sectorFetchResponse.data &&
        sectorFetchResponse.data.d.results.length > 0
      ) {
        const sectorInfo = sectorFetchResponse.data.d.results[0];

        missionUpdateRequest.__metadata.uri = cookies.SF.URL + "cust_Mission";

        missionUpdateRequest.cust_Pending_With_user = null;
        missionUpdateRequest.cust_Pending_With_Group = null;
        missionUpdateRequest.cust_Status = decryptedData.payload.action;

        sectorInfo.__metadata.uri = cookies.SF.URL + "cust_SectorBudget";

        sectorInfo.cust_Available_budget =
          parseFloat(sectorInfo.cust_Available_budget) +
          parseFloat(missionUpdateRequest.cust_Total_Expense);
        sectorInfo.cust_Parked_Amount =
          parseFloat(sectorInfo.cust_Parked_Amount) -
          parseFloat(missionUpdateRequest.cust_Total_Expense);

        const sectorUpdateUrl = cookies.SF.URL + "upsert";
        const sectorUpdateConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: sectorUpdateUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify(sectorInfo),
        };
        await axios.request(sectorUpdateConfig);

        const missionUpdateUrl = cookies.SF.URL + "upsert";
        const missionUpdateConfig = {
          method: "post",
          maxBodyLength: Infinity,
          url: missionUpdateUrl,
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify(missionUpdateRequest),
        };

        const missionUpdateResponse = await axios.request(missionUpdateConfig);
        if (missionUpdateResponse && missionUpdateResponse.data) {
          try {
            var auditLogUrl = cookies.SF.URL + "cust_Audit_Log?$format=json";
            const auditLogConfig = {
              method: "post",
              maxBodyLength: Infinity,
              url: auditLogUrl,
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              data: JSON.stringify({
                __metadata: {
                  uri: cookies.SF.URL + "cust_Audit_Log",
                },
                externalCode: "1234",
                cust_Timestamp: decryptedData.date,
                cust_Key: decryptedData.mission,
                cust_User: decryptedData.payload.approverId,
                cust_Action: "Mission rejected",
                externalName:
                  "The mission " + decryptedData.mission + " has been rejected",
                cust_Comments: decryptedData.payload.comments,
              }),
            };
            await axios.request(auditLogConfig);
            return true;
          } catch (error) {
            console.log("Some issues with audit");
            return false;
          }
        }
      }
    }
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _getManagerOfHeadOfSector = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;

    const managerFetchUrl = `${cookies.SF.URL}EmpJob?$format=json&$select=userId,managerId&$filter=userId eq '${body.headOfSector}'`;

    const managerFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const managerFetchResponse = await axios.get(
      managerFetchUrl,
      managerFetchConfig
    );

    if (managerFetchResponse && managerFetchResponse.data) {
      const { managerId } = managerFetchResponse.data.d.results[0];
      const sectorFetchUrl = `${cookies.SF.URL}cust_SectorBudget?$format=json&$select=cust_Head_of_Sector,cust_Delegate_Dynamic_group&$filter=cust_Head_of_Sector eq '${managerId}'`;
      const sectorFetchConfig = {
        headers: {
          Authorization: auth,
        },
      };
      const sectorFetchResponse = await axios.get(
        sectorFetchUrl,
        sectorFetchConfig
      );

      if (
        sectorFetchResponse &&
        sectorFetchResponse.data &&
        sectorFetchResponse.data.d.results.length > 0
      ) {
        const sectorInfo = sectorFetchResponse.data.d.results[0];
        return {
          delegateDynamicGroup:
            sectorInfo && sectorInfo.cust_Delegate_Dynamic_group
              ? sectorInfo.cust_Delegate_Dynamic_group
              : null,
          managerId: managerId,
        };
      } else {
        return {
          delegateDynamicGroup: null,
          managerId: managerId,
        };
      }
    }
    throw new CustomHttpError(
      500,
      "Manager could not be found. Please contact your system administrator."
    );
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _getRecoveryAmount = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;

    const recoveryFetchUrl = `${
      cookies.SF.URL
    }EmpPayCompNonRecurring?$format=json&$filter=payComponentCode in '1540','1701' and tolower(sequenceNumber) like '%${body.missionId.toLowerCase()}%' and userId eq '${
      body.employeeId
    }`;

    const recoveryFetchConfig = {
      headers: {
        Authorization: auth,
      },
    };
    const recoveryFetchResponse = await axios.get(
      recoveryFetchUrl,
      recoveryFetchConfig
    );

    if (recoveryFetchResponse && recoveryFetchResponse.data) {
      return recoveryFetchResponse.data;
    }
    throw new CustomHttpError(500, "Recovery amount could not be read.");
  } catch (error) {
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _convertIsoDate = (isoDate) => {
  try {
    const timestamp = parseInt(isoDate.match(/\d+/)[0], 10); // Extract number
    return new Date(timestamp).toISOString(); // Convert to ISO format
  } catch (e) {
    return null;
  }
};

const _checkMissionBatch = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;
    const batchURL = cookies.SF.URL + "$batch?$format=json";

    let boundary = `batch_${crypto.randomUUID()}`; // batch id

    let { missionStartDate, missionEndDate, destination, sector, missionId } =
      body.info;

    missionStartDate = _convertIsoDate(missionStartDate);
    missionEndDate = _convertIsoDate(missionEndDate);

    //--Fetch missions
    let missionCheckFilter =
      `cust_Mission_Start_Date eq datetimeoffset'${missionStartDate}' and ` +
      `cust_Mission_End_Date eq datetimeoffset'${missionEndDate}' and ` +
      `cust_Destination eq '${destination}' and ` +
      `cust_Status in '1','2','5' and ` +
      `cust_Sector eq '${sector}'`;

    if (missionId) {
      missionCheckFilter =
        missionCheckFilter + ` and externalCode ne '${missionId}'`;
    }
    const missionCheckSelect =
      "externalCode,cust_Mission_Start_Date,cust_Mission_End_Date,cust_Destination";
    const missionCheckUrl = `cust_Mission?$format=json&$filter=${missionCheckFilter}&$select=${missionCheckSelect}`;

    //--Construct batch body
    let getBatchBody =
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${missionCheckUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    //--Construct member checks
    // let { members } = body;
    // members.forEach((m) => {
    //   if (m.itinerary && m.itinerary.length > 0) {
    //     m.itinerary.forEach((i) => {
    //       let itineraryStartDate = _convertIsoDate(i.startDate);
    //       let itineraryEndDate = _convertIsoDate(i.endDate);
    //       let memberCheckFilter =
    //         `cust_Employee_ID eq '${m.employeeID}' and cust_itinerary_details_child/cust_start_date le datetimeoffset'${itineraryEndDate}' and ` +
    //         `cust_itinerary_details_child/cust_end_date ge datetimeoffset'${itineraryStartDate}'`;
    //       if (missionId) {
    //         memberCheckFilter =
    //           memberCheckFilter +
    //           ` and cust_Mission_ID ne '${missionId}'`;
    //       }
    //       let memberCheckSelect =
    //         "cust_Employee_ID,cust_First_Name,cust_Last_Name,cust_Mission_ID,cust_itinerary_details_child/cust_start_date,cust_itinerary_details_child/cust_end_date,cust_itinerary_details_child/cust_city";
    //       let memberCheckUrl = `cust_Members?$format=json&$filter=${memberCheckFilter}&$select=${memberCheckSelect}&$expand=cust_itinerary_details_child`;

    //       getBatchBody =
    //         getBatchBody +
    //         `--${boundary}\r\n` +
    //         `Content-Type: application/http\r\n` +
    //         `Content-Transfer-Encoding: binary\r\n\r\n` +
    //         `GET ${memberCheckUrl} HTTP/1.1\r\n` +
    //         `Accept: application/json\r\n\r\n`;
    //     });
    //   }
    // });

    let { members } = body;
    members.forEach((m) => {
      if (m.itinerary && m.itinerary.length > 0) {
        m.itinerary.forEach((i) => {
          let itineraryStartDate = _convertIsoDate(i.startDate);
          let itineraryEndDate = _convertIsoDate(i.endDate);
          let memberCheckFilter =
            `cust_Status in '1','2','5' and cust_Members/cust_EmployeeID eq '${m.employeeID}' and ` +
            `cust_Members/cust_itinerary_details_child/cust_start_date le datetimeoffset'${itineraryEndDate}' and ` +
            `cust_Members/cust_itinerary_details_child/cust_end_date ge datetimeoffset'${itineraryStartDate}'`;

          if (missionId) {
            memberCheckFilter =
              memberCheckFilter + ` and externalCode ne '${missionId}'`;
          }
          let memberCheckSelect =
            "externalCode,cust_Status,cust_Members/cust_Employee_ID,cust_Members/cust_EmployeeID,cust_Members/cust_First_Name,cust_Members/cust_Last_Name,cust_Members/cust_Mission_ID,cust_Members/cust_Mission_externalCode,cust_Members/cust_itinerary_details_child/cust_start_date,cust_Members/cust_itinerary_details_child/cust_end_date,cust_Members/cust_itinerary_details_child/cust_city";

          let memberCheckUrl = `cust_Mission?$format=json&$filter=${memberCheckFilter}&$select=${memberCheckSelect}&$expand=cust_Members,cust_Members/cust_itinerary_details_child`;

          getBatchBody =
            getBatchBody +
            `--${boundary}\r\n` +
            `Content-Type: application/http\r\n` +
            `Content-Transfer-Encoding: binary\r\n\r\n` +
            `GET ${memberCheckUrl} HTTP/1.1\r\n` +
            `Accept: application/json\r\n\r\n`;
        });
      }
    });

    //--End batch body
    getBatchBody = getBatchBody + `--${boundary}--`;

    const batchResponse = await axios.post(batchURL, getBatchBody, {
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
    });

    //Extract and handle each individual response from the batch
    const batchResult = (await _parseMultipartResponse(batchResponse)) || [];

    return {
      results: batchResult,
    };
  } catch (error) {
    console.log(error);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _fetchS4Metadata = async function (body, cookies) {
  try {
    // Make an HTTP request to S/4HANA OData Service
    const response = await executeHttpRequest(
      { destinationName: sS4DestinationName },
      {
        method: "GET",
        url: "/sap/opu/odata/sap/ZFMFR_CREATE_ODATA_SRV/$metadata?sap-client=650", // Replace with your actual OData service
        //url: "/sap/opu/odata/sap/ZINT_ARIBA_S4HANA_SRV/dataSet", // Replace with your actual OData service
        headers: {
          Accept:
            "application/json,text/html,application/xhtml+xml,application/xml",
        },
      }
    );

    console.log("S/4HANA Response:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error("Error calling S/4HANA:", error.message);
  }
};

const _fetchS4Metadata_v1 = async function (body, cookies) {
  try {
    const s4Url = cookies.S4.URL;
    const s4LocationID = cookies.S4.locationId;
    const s4Auth = "Basic " + cookies.S4.basicAuth;
    const connJWTToken = await _fetchJwtToken(
      conn_service.token_service_url,
      conn_service.clientid,
      conn_service.clientsecret
    );

    const response = await axios({
      method: "GET",
      url: `${s4Url}/sap/opu/odata/sap/ZINT_ARIBA_S4HANA_SRV/dataSet?sap-client=650`,
      headers: {
        Authorization: s4Auth,
        Accept: "application/json",
        "Proxy-Authorization": `Bearer ${connJWTToken}`, // Required for OnPremise
        "SAP-Connectivity-SCC-Location_ID": s4LocationID, // Optional
      },
      proxy: {
        host: conn_service.onpremise_proxy_host,
        port: conn_service.onpremise_proxy_port,
      },
    });
    return response.data;
  } catch (error) {
    console.log(error.message);
    throw new CustomHttpError(500, "Something went wrong. Please try again");
  }
};

const _getHOS = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;

    const getHOSUrl =
      cookies.SF.URL +
      `cust_SectorBudget?$format=json&$select=externalCode,cust_Head_of_Sector&$filter=cust_Head_of_Sector eq '${body.userId}'`;

    const getHOSConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const getHOSResponse = await axios.get(getHOSUrl, getHOSConfig);
    if (getHOSResponse && getHOSResponse.data) {
      return getHOSResponse.data.d.results || [];
    } else {
      return [];
    }
  } catch (e) {
    return [];
  }
};

const _checkIsAdmin = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;

    const getAdminGroupUrl =
      cookies.SF.URL +
      "cust_Parameters_for_Mission?$format=json&$select=cust_key,cust_Value&$filter=externalCode in 'Sector Admin Group','Super Admin Group','Payroll_Group_Mission','GS Group'&$select=cust_key,cust_Value,externalName,externalCode";

    const getAdminGroupConfig = {
      headers: {
        Authorization: auth,
      },
    };

    const getAdminGroupResponse = await axios.get(
      getAdminGroupUrl,
      getAdminGroupConfig
    );

    if (getAdminGroupResponse && getAdminGroupResponse.data) {
      const aGroups =
        (getAdminGroupResponse.data.d &&
          getAdminGroupResponse.data.d.results) ||
        [];

      if (aGroups.length === 0) {
        throw new Error("Not authorized");
      }
      const batchURL = cookies.SF.URL + "$batch?$format=json";

      let boundary = `batch_${crypto.randomUUID()}`; // batch id

      //--Construct batch body
      let getBatchBody = "";

      //--Construct member checks
      aGroups.forEach((g) => {
        const userGetUrl = `getUsersByDynamicGroup?$format=json&groupId=${g.cust_Value}L`;

        getBatchBody =
          getBatchBody +
          `--${boundary}\r\n` +
          `Content-Type: application/http\r\n` +
          `Content-Transfer-Encoding: binary\r\n\r\n` +
          `GET ${userGetUrl} HTTP/1.1\r\n` +
          `Accept: application/json\r\n\r\n`;
      });

      //--End batch body
      getBatchBody = getBatchBody + `--${boundary}--`;

      const batchResponse = await axios.post(batchURL, getBatchBody, {
        headers: {
          Authorization: auth,
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
        },
      });

      //Extract and handle each individual response from the batch
      const batchResult = (await _parseMultipartResponse(batchResponse)) || [];

      let users = [];

      batchResult.forEach((r) => {
        if (r && r.d) {
          r.d.forEach((u) => {
            users.push(u.userId);
          });
        }
      });

      //--Get HOS
      const aHOS = await _getHOS(body, cookies);
      //--Get HOS

      if (users.includes(body.userId) || aHOS.length > 0) {
        return {
          isHOS: aHOS.length > 0,
          isAuthorized: true,
        };
      }
      throw new Error("Not authorized");
    } else {
      throw new Error("Not authorized");
    }
  } catch (error) {
    console.log(error.message);
    return {
      isAuthorized: false,
    };
  }
};

const _getMastersBatch = async function (body, cookies) {
  const auth = "Basic " + cookies.SF.basicAuth;
  /*TODO: PickListV2 might be used for performance reasons instead of Picklist service*/
  /*TODO: PickListV2 might be used for performance reasons instead of Picklist service*/

  const valueLists = {
    cities: [],
    hospitalityOptions: [],
    sectors: [],
    decreeTypes: [],
    flightTypes: [],
    ticketTypes: [],
    dynamicGroups: [],
    statuses: [],
    multicities: [],
    headOfMission: [],
    externalEntity: [],
  };

  try {
    let boundary = `batch_${crypto.randomUUID()}`; // batch id
    let getBatchBody = "";
    let aResultMap = [];

    const cityFetchUrl =
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$filter=picklistId eq 'Destination' and picklistOptions/status eq 'ACTIVE'&$format=json";

    //--Construct batch body
    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${cityFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const hospitalityFetchUrl =
      "Picklist?$expand=picklistOptions, picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$filter=picklistId eq 'Hospitality_Default' and picklistOptions/status eq 'ACTIVE'&$format=json";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${hospitalityFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const sectorFetchUrl =
      "cust_SectorBudget?$format=json&$select=externalCode,externalName_localized,externalName_ar_SA,cust_Utilized_Budget,cust_Parked_Amount,cust_Budget,cust_Available_budget,cust_Delegate_Approver_for_Missions,cust_Head_of_Sector,cust_Delegate_Dynamic_group,cust_Decree_Type";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${sectorFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const decreeTypeFetchUrl =
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$filter=picklistId eq 'Decree_name_mission' and picklistOptions/status eq 'ACTIVE'&$format=json";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${decreeTypeFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const flightTypeFetchUrl =
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$format=json&$filter=picklistId eq 'Flight_type_mission' and picklistOptions/status eq 'ACTIVE'";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${flightTypeFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const ticketTypeFetchUrl =
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$format=json&$filter=picklistId eq 'Ticket_Type' and picklistOptions/status eq 'ACTIVE'";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${ticketTypeFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const dynamicGroupsFetchUrl =
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$filter=picklistId eq 'Delegates_Dynamic_Group' and picklistOptions/status eq 'ACTIVE'&$format=json";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${dynamicGroupsFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const statusFetchUrl =
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$filter=picklistId eq 'Status' and picklistOptions/status eq 'ACTIVE'&$format=json";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${statusFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const externalEntityFetchUrl =
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$filter=picklistId eq 'External Entity' and picklistOptions/status eq 'ACTIVE'&$format=json";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${externalEntityFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    const multicityFetchUrl =
      "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label,picklistOptions/status&$filter=picklistId eq 'yesNo' and picklistOptions/status eq 'ACTIVE'&$format=json";

    getBatchBody +=
      `--${boundary}\r\n` +
      `Content-Type: application/http\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n` +
      `GET ${multicityFetchUrl} HTTP/1.1\r\n` +
      `Accept: application/json\r\n\r\n`;

    // const headOfMissionFetchUrl = "Picklist?$expand=picklistOptions,picklistOptions/picklistLabels&$select=picklistOptions/externalCode,picklistOptions/localeLabel,picklistOptions/picklistLabels/locale,picklistOptions/picklistLabels/label&$filter=picklistId eq 'yesNo' and picklistOptions/status eq 'ACTIVE'&$format=json";

    // getBatchBody += `Content-Type: application/http\r\n` +
    // `Content-Transfer-Encoding: binary\r\n\r\n` +
    // `GET ${headOfMissionFetchUrl} HTTP/1.1\r\n` +
    // `Accept: application/json\r\n\r\n`;

    //--End batch body
    getBatchBody = getBatchBody + `--${boundary}--`;

    let i = 0;

    aResultMap.push({ target: "cities", index: i });
    i++;
    aResultMap.push({ target: "hospitalityOptions", index: i });
    i++;
    aResultMap.push({ target: "sectors", index: i });
    i++;
    aResultMap.push({ target: "decreeTypes", index: i });
    i++;
    aResultMap.push({ target: "flightTypes", index: i });
    i++;
    aResultMap.push({ target: "ticketTypes", index: i });
    i++;
    aResultMap.push({ target: "dynamicGroups", index: i });
    i++;
    aResultMap.push({ target: "statuses", index: i });
    i++;
    aResultMap.push({ target: "externalEntity", index: i }); //
    i++;
    aResultMap.push({ target: "multicities", index: i }); // same with head of mission so no need to increase index
    aResultMap.push({ target: "headOfMission", index: i }); // same with multicities so no need to increase index

    const batchURL = cookies.SF.URL + "$batch?$format=json";
    const batchResponse = await axios.post(batchURL, getBatchBody, {
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
    });

    //Extract and handle each individual response from the batch
    const batchResult = (await _parseMultipartResponse(batchResponse)) || [];

    batchResult.forEach((pickList, pickListIndex) => {
      if (pickList && pickList.d && pickList.d.results) {
        const aPickListValues = [];
        if (
          pickList.d.results[0]["__metadata"]["type"] === "SFOData.Picklist"
        ) {
          const oPickListOptions = _.clone(
            pickList.d.results[0].picklistOptions
          );
          oPickListOptions.results.forEach((o) => {
            if (o.status !== "ACTIVE") return;
            
            let oLabelEn = _.find(o.picklistLabels.results, [
              "locale",
              "en_US",
            ]);
            let oLabelAr = _.find(o.picklistLabels.results, [
              "locale",
              "ar_SA",
            ]);
            let labelEn = oLabelEn
              ? oLabelEn["label"]
              : o.externalCode + " - N/A";
            let labelAr = oLabelAr
              ? oLabelAr["label"]
              : o.externalCode + " - لا يوجد";
            aPickListValues.push({
              externalCode: o.externalCode,
              localeLabel: labelEn,
              localeARLabel: labelAr,
            });
          });
        } else if (
          pickList.d.results[0]["__metadata"]["type"] ===
          "SFOData.cust_SectorBudget"
        ) {
          pickList.d.results.forEach((o) => {
            let labelEn = o.externalName_localized
              ? o.externalName_localized
              : o.externalCode + " - N/A";
            let labelAr = o.externalName_ar_SA
              ? o.externalName_ar_SA
              : o.externalCode + " - لا يوجد";
            aPickListValues.push({
              ...o,
              externalCode: o.externalCode,
              localeLabel: labelEn,
              localeARLabel: labelAr,
            });
          });
        }

        //--Set picklist values
        const aTarget = _.filter(aResultMap, ["index", pickListIndex]) || [];

        if (aTarget.length > 0) {
          aTarget.forEach((oTarget) => {
            valueLists[oTarget.target] = _.clone(aPickListValues);
          });
        }
      }
    });

    return valueLists;
  } catch (error) {
    console.log(error.message);
    return valueLists;
  }
};

const _getAdminMissionReport = async function (body, cookies) {
  try {
    const auth = "Basic " + cookies.SF.basicAuth;
    let maxCity = 0;

    //--Get value lists
    const oMasters = await _getMastersBatch(body, cookies);
    //--Get value lists

    //--Get HOS
    const aHOS = await _getHOS(body, cookies);
    //--Get HOS

    //--Fetch data
    const {
      dateSelection,
      destinationSelection,
      sectorSelection,
      statusSelection,
      missionSelection,
    } = body.filters;

    let filterQuery = "";

    if (dateSelection && dateSelection.beginDate !== null) {
      filterQuery = `cust_Mission_End_Date ge datetime'${dateSelection.beginDate}' and cust_Mission_Start_Date le datetime'${dateSelection.endDate}'`;
    }

    if (destinationSelection && destinationSelection.length > 0) {
      let sDestinationList = "";

      destinationSelection.forEach((d) => {
        sDestinationList =
          sDestinationList === "" ? `'${d}'` : `${sDestinationList},'${d}'`;
      });

      filterQuery =
        filterQuery === ""
          ? `cust_Destination in ${sDestinationList}`
          : filterQuery + ` and cust_Destination in ${sDestinationList}`;
    }

    //--Head of sectors
    if (aHOS.length > 0) {
      let sSectorSelection = "";
      aHOS.forEach((s) => {
        sSectorSelection =
          sSectorSelection === ""
            ? `'${s.externalCode}'`
            : `${sSectorSelection},'${s.externalCode}'`;
      });

      filterQuery =
        filterQuery === ""
          ? `cust_Sector in ${sSectorSelection}`
          : filterQuery + ` and cust_Sector in ${sSectorSelection}`;
    } else {
      if (sectorSelection && sectorSelection.length > 0) {
        let sSectorSelection = "";

        sectorSelection.forEach((s) => {
          sSectorSelection =
            sSectorSelection === "" ? `'${s}'` : `${sSectorSelection},'${s}'`;
        });

        filterQuery =
          filterQuery === ""
            ? `cust_Sector in ${sSectorSelection}`
            : filterQuery + ` and cust_Sector in ${sSectorSelection}`;
      }
    }

    if (statusSelection && statusSelection.length > 0) {
      let sStatusSelection = "";

      statusSelection.forEach((s) => {
        sStatusSelection =
          sStatusSelection === "" ? `'${s}'` : `${sStatusSelection},'${s}'`;
      });

      filterQuery =
        filterQuery === ""
          ? `cust_Status in ${sStatusSelection}`
          : filterQuery + ` and cust_Status in ${sStatusSelection}`;
    }

    if (missionSelection !== "" && missionSelection) {
      let sMissionQuery = "";
      let aMissionSelection = [];
      if (missionSelection.indexOf(",") !== -1) {
        aMissionSelection = missionSelection.split(",");
      } else {
        aMissionSelection.push(missionSelection);
      }

      aMissionSelection.forEach((s) => {
        sMissionQuery =
          sMissionQuery === ""
            ? `externalCode like '%${s.trim()}%'`
            : `${sMissionQuery} or externalCode like '%${s.trim()}%'`;
      });

      if (aMissionSelection.length > 1) {
        sMissionQuery = "( " + sMissionQuery + " )";
      }

      filterQuery =
        filterQuery === ""
          ? ` ${sMissionQuery}`
          : filterQuery + ` and ${sMissionQuery}`;
    }

    const selectQuery =
      "externalCode,externalName,cust_Pending_With_Group,cust_Pending_With_user,effectiveStartDate,transactionSequence,cust_Mission_Start_Date,cust_Mission_End_Date,cust_No_Of_Days," +
      "cust_ReplicationFlag,cust_Hospitality_Type,cust_Flight_type,cust_Destination,cust_TotalPerdiemMission,cust_TicketAverage,cust_Sector," +
      "cust_Total_Expense,cust_Budget_Available,cust_Budget_Parked,cust_Decree_Type,cust_ExternalEntity,cust_Status,createdDateTime,createdBy," +
      "cust_Members/cust_Mission_effectiveStartDate,cust_Members/cust_Mission_externalCode,cust_Members/cust_Mission_transactionSequence," +
      "cust_Members/cust_Employee_ID,cust_Members/cust_EmployeeID,cust_Members/cust_First_Name,cust_Members/cust_Last_Name,cust_Members/cust_Title_Of_Employee," +
      "cust_Members/cust_Employee_Total_Ticket,cust_Members/cust_Employee_Total_Perdiem,cust_Members/cust_Employee_Total_Expense," +
      "cust_Members/cust_Multiple_Cities," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_effectiveStartDate," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_externalCode,cust_Members/cust_itinerary_details_child/cust_Members_externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_Mission_transactionSequence,cust_Members/cust_itinerary_details_child/externalCode," +
      "cust_Members/cust_itinerary_details_child/cust_start_date,cust_Members/cust_itinerary_details_child/cust_end_date," +
      "cust_Members/cust_itinerary_details_child/cust_head_of_mission,cust_Members/cust_itinerary_details_child/cust_hospitality_default," +
      "cust_Members/cust_itinerary_details_child/cust_city,cust_Members/cust_itinerary_details_child/cust_ticket_type," +
      "cust_Members/cust_itinerary_details_child/cust_ticket_average,cust_Members/cust_itinerary_details_child/cust_perdiem_per_city," +
      "cust_Members/cust_itinerary_details_child/cust_Ticket_Actual_Cost,cust_Pending_With_userNav/displayName," +
      "cust_Pending_With_GroupNav/label_en_US,cust_Pending_With_GroupNav/label_ar_SA,cust_Pending_With_userNav/displayName,cust_Pending_With_userNav/custom04";

    const expandQuery =
      "cust_Members,cust_Members/cust_itinerary_details,cust_Members/cust_itinerary_details_child,cust_Pending_With_GroupNav,cust_Pending_With_userNav";
    let missionFetchUrl = `${cookies.SF.URL}cust_Mission?$format=json&$select=${selectQuery}&$expand=${expandQuery}`;

    if (filterQuery !== "") {
      missionFetchUrl = missionFetchUrl + `&$filter=${filterQuery}`;
    }

    const config = {
      headers: {
        Authorization: auth,
      },
    };

    const reportResponse = await axios.get(missionFetchUrl, config);

    let resultList = [];

    const _formatDate = (dt) => {
      if (dt != null) {
        const timestamp = parseInt(dt.match(/\d+/)[0]); // Extract the timestamp
        const formattedDate = new Date(timestamp); // Convert to Date object
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const sDate =
          monthNames[formattedDate.getMonth()] +
          " " +
          formattedDate.getDate() +
          ", " +
          formattedDate.getFullYear();

        if (sDate.includes("undefined")) {
          return "Invalid Date - " + dt;
        }

        return sDate;
      }
    };

    const _formatCurrency = (amt) => {
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "AED",
        currencyDisplay: "narrowSymbol",
      })
        .format(amt)
        .replace("AED", "")
        .trim();
    };

    const _formatPendingWith = (m) => {
      let pendingWith = "";
      if (m.cust_Pending_With_user && m.cust_Pending_With_userNav) {
        pendingWith = m.cust_Pending_With_userNav.custom04
          ? m.cust_Pending_With_userNav.custom04
          : m.cust_Pending_With_userNav.displayName;
      }
      if (m.cust_Pending_With_Group && m.cust_Pending_With_GroupNav) {
        if (
          pendingWith !== "" &&
          pendingWith !== null &&
          pendingWith !== undefined
        ) {
          pendingWith =
            pendingWith + " and " + m.cust_Pending_With_GroupNav.label_en_US;
        } else {
          pendingWith = m.cust_Pending_With_GroupNav.label_en_US
            ? m.cust_Pending_With_GroupNav.label_en_US
            : m.cust_Pending_With_GroupNav.label_ar_SA;
        }
      }

      return pendingWith;
    };

    const _readValue = (w, v) => {
      let o;
      let t = "";
      switch (w) {
        case "city":
          o = _.find(oMasters.cities, ["externalCode", v]);
          break;
        case "hospitality":
          o = _.find(oMasters.hospitalityOptions, ["externalCode", v]);
          break;
        case "sector":
          o = _.find(oMasters.sectors, ["externalCode", v]);
          break;
        case "decreeType":
          o = _.find(oMasters.decreeTypes, ["externalCode", v]);
          break;
        case "externalEntity":
          o = _.find(oMasters.externalEntity, ["externalCode", v]);
          break;
        case "flightType":
          o = _.find(oMasters.flightTypes, ["externalCode", v]);
          break;
        case "ticketType":
          o = _.find(oMasters.ticketTypes, ["externalCode", v]);
          break;
        case "status":
          o = _.find(oMasters.statuses, ["externalCode", v]);
          break;
        case "dynamicGroup":
          o = _.find(oMasters.dynamicGroups, ["externalCode", v]);
          break;
        case "multicity":
          o = _.find(oMasters.multicities, ["externalCode", v]);
          break;
        case "headOfMission":
          o = _.find(oMasters.headOfMission, ["externalCode", v]);
          break;
        default:
          return "";
      }

      if (o && o.localeLabel) {
        t = o.localeLabel;
      }

      return t;
    };

    if (
      reportResponse.data &&
      reportResponse.data.d &&
      reportResponse.data.d.results
    ) {
      reportResponse.data.d.results.forEach((m0) => {
        let missionInfo = {
          missionId: m0.externalCode,
          missionDescription: m0.externalName,
          missionStartDate: _formatDate(m0.cust_Mission_Start_Date),
          missionEndDate: _formatDate(m0.cust_Mission_End_Date),
          destination: _readValue("city", m0.cust_Destination),
          sector: _readValue("sector", m0.cust_Sector),
          sectorCode: m0.cust_Sector,
          decreeType: _readValue("decreeType", m0.cust_Decree_Type),
          externalEntity: _readValue("externalEntity", m0.cust_ExternalEntity),
          hospitality: _readValue("hospitality", m0.cust_Hospitality_Type),
          flightType: _readValue("flightType", m0.cust_Flight_type),
          budgetAvailable: _formatCurrency(m0.cust_Budget_Available),
          budgetParked: _formatCurrency(m0.cust_Budget_Parked),
          noOfDays: m0.cust_No_Of_Days,
          status: _readValue("status", m0.cust_Status),
          pendingWith: _formatPendingWith(m0),
          totalExpense: _formatCurrency(m0.cust_Total_Expense),
          totalPerdiem: _formatCurrency(m0.cust_TotalPerdiemMission),
          totalTicketAverage: _formatCurrency(m0.cust_TicketAverage),
          createdAt: _formatDate(m0.createdDateTime),
          createdBy: m0.createdBy,
        };

        if (m0.cust_Members && m0.cust_Members.results) {
          m0.cust_Members.results.forEach((m1, i) => {
            let resultRow = {
              ...missionInfo,
            };
            resultRow[`employeeId`] = m1.cust_EmployeeID;
            resultRow[`employeeName`] = m1.cust_First_Name;
            resultRow[`employeeTitle`] = m1.cust_Title_Of_Employee;
            resultRow[`employeeTotalExpense`] = _formatCurrency(
              m1.cust_Employee_Total_Expense
            );
            resultRow[`employeeTotalPerdiem`] = _formatCurrency(
              m1.cust_Employee_Total_Perdiem
            );
            resultRow[`employeeTotalTicket`] = _formatCurrency(
              m1.cust_Employee_Total_Ticket
            );
            resultRow[`employeeMultipleCity`] = _readValue(
              "multicity",
              m1.cust_Multiple_Cities
            );
            let iCity = 0;
            if (
              m1.cust_itinerary_details_child &&
              m1.cust_itinerary_details_child.results
            ) {
              m1.cust_itinerary_details_child.results.forEach((i0, j) => {
                resultRow[`city_${j}`] = _readValue("city", i0.cust_city);
                resultRow[`cityStartDate_${j}`] = _formatDate(
                  i0.cust_start_date
                );
                resultRow[`cityEndDate_${j}`] = _formatDate(i0.cust_end_date);
                resultRow[`cityHospitality_${j}`] = _readValue(
                  "hospitality",
                  i0.cust_hospitality_default
                );
                resultRow[`cityActualCost_${j}`] = _formatCurrency(
                  i0.cust_Ticket_Actual_Cost
                );
                resultRow[`cityTicketAverage_${j}`] = _formatCurrency(
                  i0.cust_ticket_average
                );
                resultRow[`cityPerdiem_${j}`] = _formatCurrency(
                  i0.cust_perdiem_per_city
                );
                resultRow[`cityHeadOfMission_${j}`] = _readValue(
                  "headOfMission",
                  i0.cust_head_of_mission
                );
                iCity++;
              });
            }

            if (iCity > maxCity) {
              maxCity = iCity;
            }
            resultList.push(resultRow);
          });
        } else {
          resultList.push(missionInfo);
        }
      });
    }
    //--Fetch data

    let columnList = [
      {
        Colsq: 0,
        Colid: "missionId",
        Coltx: "Mission ID",
        Colwd: "9rem",
        Coldt: "string",
      },
      {
        Colsq: 1,
        Colid: "missionDescription",
        Coltx: "Mission Description",
        Colwd: "15rem",
        Coldt: "string",
      },
      {
        Colsq: 2,
        Colid: "missionStartDate",
        Coltx: "Mission Start Date",
        Colwd: "9rem",
        Coldt: "date",
      },
      {
        Colsq: 3,
        Colid: "missionEndDate",
        Coltx: "Mission End Date",
        Colwd: "9rem",
        Coldt: "date",
      },
      {
        Colsq: 4,
        Colid: "destination",
        Coltx: "Destination",
        Colwd: "15rem",
        Coldt: "string",
      },
      {
        Colsq: 5,
        Colid: "sector",
        Coltx: "Sector",
        Colwd: "15rem",
        Coldt: "string",
      },
      {
        Colsq: 6,
        Colid: "sectorCode",
        Coltx: "Sector Code",
        Colwd: "9rem",
        Coldt: "string",
      },
      {
        Colsq: 7,
        Colid: "decreeType",
        Coltx: "Decree Type",
        Colwd: "9rem",
        Coldt: "string",
      },
      {
        Colsq: 8,
        Colid: "externalEntity",
        Coltx: "External Entity",
        Colwd: "9rem",
        Coldt: "string",
      },
      {
        Colsq: 9,
        Colid: "hospitality",
        Coltx: "Hospitality",
        Colwd: "9rem",
        Coldt: "string",
      },
      {
        Colsq: 10,
        Colid: "flightType",
        Coltx: "Flight Type",
        Colwd: "9rem",
        Coldt: "string",
      },
      {
        Colsq: 11,
        Colid: "budgetAvailable",
        Coltx: "Budget Available",
        Colwd: "9rem",
        Coldt: "amount",
      },
      {
        Colsq: 12,
        Colid: "budgetParked",
        Coltx: "Budget Parked",
        Colwd: "9rem",
        Coldt: "amount",
      },
      {
        Colsq: 13,
        Colid: "noOfDays",
        Coltx: "No Of Days",
        Colwd: "9rem",
        Coldt: "number",
      },
      {
        Colsq: 14,
        Colid: "status",
        Coltx: "Status",
        Colwd: "9rem",
        Coldt: "string",
      },
      {
        Colsq: 15,
        Colid: "pendingWith",
        Coltx: "Pending With",
        Colwd: "13rem",
        Coldt: "string",
      },
      {
        Colsq: 16,
        Colid: "totalExpense",
        Coltx: "Total Expense on Mission",
        Colwd: "9rem",
        Coldt: "amount",
      },
      {
        Colsq: 17,
        Colid: "totalPerdiem",
        Coltx: "Total Perdiem Mission",
        Colwd: "9rem",
        Coldt: "amount",
      },
      {
        Colsq: 18,
        Colid: "createdAt",
        Coltx: "Request Date",
        Colwd: "9rem",
        Coldt: "date",
      },
      {
        Colsq: 19,
        Colid: "createdBy",
        Coltx: "Mission Created By",
        Colwd: "9rem",
        Coldt: "string",
      },
      //--Member columns
      {
        Colsq: 20,
        Colid: "employeeId",
        Coltx: "Member Employee ID",
        Colwd: "9rem",
        Coldt: "string",
      },
      {
        Colsq: 21,
        Colid: "employeeName",
        Coltx: "Member Employee Name",
        Colwd: "15rem",
        Coldt: "string",
      },
      {
        Colsq: 22,
        Colid: "employeeTitle",
        Coltx: "Title of Employee",
        Colwd: "15rem",
        Coldt: "string",
      },
      {
        Colsq: 23,
        Colid: "employeeTotalExpense",
        Coltx: "Employee Total Expense",
        Colwd: "9rem",
        Coldt: "amount",
      },
      {
        Colsq: 24,
        Colid: "employeeTotalPerdiem",
        Coltx: "Employee Total Perdiem",
        Colwd: "9rem",
        Coldt: "amount",
      },
      {
        Colsq: 25,
        Colid: "employeeTotalTicket",
        Coltx: "Employee Total Ticket",
        Colwd: "9rem",
        Coldt: "amount",
      },
      {
        Colsq: 26,
        Colid: "employeeMultipleCity",
        Coltx: "Multiple Cities",
        Colwd: "9rem",
        Coldt: "string",
      },
    ];

    let iColsq = columnList[columnList.length - 1].Colsq;
    for (let i = 0; i < maxCity; i++) {
      iColsq++;
      columnList.push({
        Colsq: iColsq,
        Colid: `city_${i}`,
        Coltx: `City ${i + 1}`,
        Colwd: "15rem",
        Coldt: "string",
      });
      iColsq++;
      columnList.push({
        Colsq: iColsq,
        Colid: `cityStartDate_${i}`,
        Coltx: `Start Date - City ${i + 1}`,
        Colwd: "9rem",
        Coldt: "string",
      });
      iColsq++;
      columnList.push({
        Colsq: iColsq,
        Colid: `cityEndDate_${i}`,
        Coltx: `End Date - City ${i + 1}`,
        Colwd: "9rem",
        Coldt: "string",
      });

      iColsq++;
      columnList.push({
        Colsq: iColsq,
        Colid: `cityHospitality_${i}`,
        Coltx: `Hospitality - City ${i + 1}`,
        Colwd: "9rem",
        Coldt: "string",
      });
      iColsq++;
      columnList.push({
        Colsq: iColsq,
        Colid: `cityActualCost_${i}`,
        Coltx: `Ticket Actual Cost - City ${i + 1}`,
        Colwd: "9rem",
        Coldt: "amount",
      });
      iColsq++;
      columnList.push({
        Colsq: iColsq,
        Colid: `cityTicketAverage_${i}`,
        Coltx: `Ticket Average - City ${i + 1}`,
        Colwd: "9rem",
        Coldt: "amount",
      });
      iColsq++;
      columnList.push({
        Colsq: iColsq,
        Colid: `cityPerdiem_${i}`,
        Coltx: `Per Diem - City ${i + 1}`,
        Colwd: "9rem",
        Coldt: "amount",
      });
      iColsq++;
      columnList.push({
        Colsq: iColsq,
        Colid: `cityHeadOfMission_${i}`,
        Coltx: `Is HoM - City ${i + 1}`,
        Colwd: "9rem",
        Coldt: "string",
      });
    }
    // new Array(maxCity).forEach((c,i)=>{

    // });

    return {
      rows: resultList,
      columns: columnList,
    };
  } catch (error) {
    console.log(error.message);
    return {
      rows: [],
      columns: [],
    };
  }
};

ar.beforeRequestHandler.use("/getEnvironmentInfo", async (req, res, next) => {
  try {
    var response = {
      CF: {
        accessToken: req.session.user.token.accessToken,
        refreshToken: req.session.user.token.refreshToken,
        url: uaa_service.url,
        clienId: uaa_service.clientid,
        clientSecret: uaa_service.clientsecret,
      },
    };

    const fetchCFAuthToken = await _fetchCFAuthToken();

    const fetchCPIAuthToken = await _fetchCPIAuthToken(fetchCFAuthToken);

    const cfDestination = sDestinationName;
    const fetchSFDestinationInfo = await _fetchDestinationInfo(
      cfDestination,
      fetchCFAuthToken
    );

    const cpiDestination = sCPIDestinationName;
    const fetchCPIDestinationInfo = await _fetchDestinationInfo(
      cpiDestination,
      fetchCFAuthToken
    );

    // const s4Destination = sS4DestinationName;
    // const fetchS4DestinationInfo = await _fetchDestinationInfo(
    //   s4Destination,
    //   fetchCFAuthToken
    // );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(response))
    );

    const encryptedURLs = await _fetchEncryptedData(
      Buffer.from(
        JSON.stringify({
          SF: fetchSFDestinationInfo.destinationConfiguration.URL,
          CPI: fetchCPIDestinationInfo.destinationConfiguration.URL,
          // S4: fetchS4DestinationInfo.destinationConfiguration.URL,
          // S4LocationId:
          //   fetchS4DestinationInfo.destinationConfiguration
          //     .CloudConnectorLocationId || "",
        })
      )
    );

    const SFBasic = Buffer.from(
      fetchSFDestinationInfo.destinationConfiguration.User +
        ":" +
        fetchSFDestinationInfo.destinationConfiguration.Password
    ).toString("base64");

    // const S4Basic = Buffer.from(
    //   fetchS4DestinationInfo.destinationConfiguration.User +
    //     ":" +
    //     fetchS4DestinationInfo.destinationConfiguration.Password
    // ).toString("base64");

    const cookiesArr = [];
    cookiesArr.push("CPIOAuth=" + fetchCPIAuthToken + "; HttpOnly");
    cookiesArr.push("SFBasic=" + SFBasic + "; HttpOnly");
    // cookiesArr.push("S4Basic=" + S4Basic + "; HttpOnly");
    cookiesArr.push("URLs=" + encryptedURLs + "; HttpOnly");

    res.setHeader("Set-Cookie", cookiesArr);

    res.end(encrypted);
  } catch (error) {
    console.log("Get environment info error:" + error);
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/getEnvironmentInfo) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/getLoggedinInfo", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);
    const decryptedData = await _fetchDecryptedData(req.body.data);
    const fetchLoggedinInfo = await _fetchLoggedinInfo(
      JSON.parse(decryptedData),
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(fetchLoggedinInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      if (error.httpStatusCode == 401) {
        try {
          const fetchCFAuthToken = await _fetchCFAuthToken();

          const fetchCPIAuthToken = await _fetchCPIAuthToken(fetchCFAuthToken);

          res.setHeader(
            "Set-Cookie",
            "CPIOAuth=" + fetchCPIAuthToken + "; HttpOnly"
          );

          const reqCookies = await _fetchCookies(req);
          const decryptedData = await _fetchDecryptedData(req.body.data);
          const fetchLoggedinInfo = await _fetchLoggedinInfo(
            JSON.parse(decryptedData),
            reqCookies
          );

          const encrypted = await _fetchEncryptedData(
            Buffer.from(JSON.stringify(fetchLoggedinInfo))
          );

          res.end(encrypted);
        } catch (error) {
          const errorObj = {
            status: 0,
            message: "",
          };
          if (error instanceof CustomHttpError) {
            errorObj.status = error.httpStatusCode;
            errorObj.message = error.message;
          } else {
            if (typeof error === "string") {
              errorObj.status = 500;
              errorObj.message = error;
            } else if (error instanceof Error) {
              errorObj.status = 500;
              errorObj.message = error.message;
            }
          }

          console.log(
            "Travel mission (/getLoggedinInfo) -> status / " +
              errorObj.status +
              " & message / " +
              errorObj.message
          );

          res.statusCode = errorObj.status;
          res.end(Buffer.from(JSON.stringify(errorObj)));
        }
      } else {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      }
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/getLoggedinInfo) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/getMasters", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const cities = await _fetchCities(reqCookies);

    const hospitalityOptions = await _fetchHospitalityOptions(reqCookies);

    const sectors = await _fetchSectors(reqCookies);

    const decreeTypes = await _fetchDecreeTypes(reqCookies);

    const flightTypes = await _fetchFlightTypes(reqCookies);

    const ticketTypes = await _fetchTicketTypes(reqCookies);

    const multicities = await _fetchMulticites(reqCookies);

    const headOfMission = await _fetchHeadOfMission(reqCookies);

    const mastersObj = {
      cities: cities,
      hospitalityOptions: hospitalityOptions,
      sectors: sectors,
      decreeTypes: decreeTypes,
      flightTypes: flightTypes,
      ticketTypes: ticketTypes,
      multicities: multicities,
      headOfMission: headOfMission,
    };

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(mastersObj))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/getMasters) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use(
  "/findMissionBudgetInfo",
  async (req, res, next) => {
    try {
      const reqCookies = await _fetchCookies(req);
      const missionBudgetInfo = await _fetchMissionBudgetInfo(reqCookies);
      const encrypted = await _fetchEncryptedData(
        Buffer.from(JSON.stringify(missionBudgetInfo))
      );

      res.end(encrypted);
    } catch (error) {
      const errorObj = {
        status: 0,
        message: "",
      };
      if (error instanceof CustomHttpError) {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      } else {
        if (typeof error === "string") {
          errorObj.status = 500;
          errorObj.message = error;
        } else if (error instanceof Error) {
          errorObj.status = 500;
          errorObj.message = error.message;
        }
      }

      console.log(
        "Travel mission (/findMissionBudgetInfo) -> status / " +
          errorObj.status +
          " & message / " +
          errorObj.message
      );

      res.statusCode = errorObj.status;
      res.end(Buffer.from(JSON.stringify(errorObj)));
    }
  }
);

ar.beforeRequestHandler.use("/findMemberDetails", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);
    const memberDetails = await _fetchMemberDetails(req.body.data, reqCookies);
    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(memberDetails))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/findMemberDetails) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/getPhoto", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const photoDetails = await _fetchPhoto(
      JSON.parse(decryptedData).users,
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(photoDetails))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/getPhoto) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/getPhotoForMember", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const photoDetails = await _fetchPhotoForMember(
      JSON.parse(decryptedData).users,
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(photoDetails))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/getPhotoForMember) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use(
  "/findTicketAndPerDiemPerCity",
  async (req, res, next) => {
    try {
      const reqCookies = await _fetchCookies(req);

      const decryptedData = await _fetchDecryptedData(req.body.data);

      const ticketAndPerDiemDetails = await _fetchTicketAndPerDiem(
        JSON.parse(decryptedData).params,
        reqCookies
      );

      const encrypted = await _fetchEncryptedData(
        Buffer.from(JSON.stringify(ticketAndPerDiemDetails))
      );

      res.end(encrypted);
    } catch (error) {
      const errorObj = {
        status: 0,
        message: "",
      };
      if (error instanceof CustomHttpError) {
        if (error.httpStatusCode == 401) {
          try {
            const fetchCFAuthToken = await _fetchCFAuthToken();

            const fetchCPIAuthToken = await _fetchCPIAuthToken(
              fetchCFAuthToken
            );

            res.setHeader(
              "Set-Cookie",
              "CPIOAuth=" + fetchCPIAuthToken + "; HttpOnly"
            );

            const reqCookies = await _fetchCookies(req);

            const decryptedData = await _fetchDecryptedData(req.body.data);

            const ticketAndPerDiemDetails = await _fetchTicketAndPerDiem(
              JSON.parse(decryptedData).params,
              reqCookies
            );

            const encrypted = await _fetchEncryptedData(
              Buffer.from(JSON.stringify(ticketAndPerDiemDetails))
            );

            res.end(encrypted);
          } catch (error) {
            const errorObj = {
              status: 0,
              message: "",
            };
            if (error instanceof CustomHttpError) {
              errorObj.status = error.httpStatusCode;
              errorObj.message = error.message;
            } else {
              if (typeof error === "string") {
                errorObj.status = 500;
                errorObj.message = error;
              } else if (error instanceof Error) {
                errorObj.status = 500;
                errorObj.message = error.message;
              }
            }

            console.log(
              "Travel mission (/findTicketAndPerDiemPerCity) -> status / " +
                errorObj.status +
                " & message / " +
                errorObj.message
            );

            res.statusCode = errorObj.status;
            res.end(Buffer.from(JSON.stringify(errorObj)));
          }
        } else {
          errorObj.status = error.httpStatusCode;
          errorObj.message = error.message;
        }
      } else {
        if (typeof error === "string") {
          errorObj.status = 500;
          errorObj.message = error;
        } else if (error instanceof Error) {
          errorObj.status = 500;
          errorObj.message = error.message;
        }
      }

      console.log(
        "Travel mission (/findTicketAndPerDiemPerCity) -> status / " +
          errorObj.status +
          " & message / " +
          errorObj.message
      );

      res.statusCode = errorObj.status;
      res.end(Buffer.from(JSON.stringify(errorObj)));
    }
  }
);

ar.beforeRequestHandler.use("/findMissions", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);
    const decryptedData = await _fetchDecryptedData(req.body.data);
    const findMissions = await _fetchMissions(
      JSON.parse(decryptedData),
      reqCookies
    );

    res.end(Buffer.from(JSON.stringify(findMissions)));
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      if (error.httpStatusCode == 401) {
        try {
          const fetchCFAuthToken = await _fetchCFAuthToken();

          const fetchCPIAuthToken = await _fetchCPIAuthToken(fetchCFAuthToken);

          res.setHeader(
            "Set-Cookie",
            "CPIOAuth=" + fetchCPIAuthToken + "; HttpOnly"
          );

          const reqCookies = await _fetchCookies(req);
          const decryptedData = await _fetchDecryptedData(req.body.data);
          const findMissions = await _fetchMissions(
            JSON.parse(decryptedData),
            reqCookies
          );

          res.end(Buffer.from(JSON.stringify(findMissions)));
        } catch (error) {
          const errorObj = {
            status: 0,
            message: "",
          };
          if (error instanceof CustomHttpError) {
            errorObj.status = error.httpStatusCode;
            errorObj.message = error.message;
          } else {
            if (typeof error === "string") {
              errorObj.status = 500;
              errorObj.message = error;
            } else if (error instanceof Error) {
              errorObj.status = 500;
              errorObj.message = error.message;
            }
          }

          console.log(
            "Travel mission (/findMissions) -> status / " +
              errorObj.status +
              " & message / " +
              errorObj.message
          );

          res.statusCode = errorObj.status;
          res.end(Buffer.from(JSON.stringify(errorObj)));
        }
      } else {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      }
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/findMissions) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/createMission", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);
    const createMission = await _createMission(
      req.body.data.params,
      req.body.data.userInfo,
      reqCookies
    );
    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(createMission))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      if (error.httpStatusCode == 401) {
        try {
          const fetchCFAuthToken = await _fetchCFAuthToken();

          const fetchCPIAuthToken = await _fetchCPIAuthToken(fetchCFAuthToken);

          res.setHeader(
            "Set-Cookie",
            "CPIOAuth=" + fetchCPIAuthToken + "; HttpOnly"
          );

          const reqCookies = await _fetchCookies(req);
          const createMission = await _createMission(
            req.body.data.params,
            req.body.data.userInfo,
            reqCookies
          );
          const encrypted = await _fetchEncryptedData(
            Buffer.from(JSON.stringify(createMission))
          );

          res.end(encrypted);
        } catch (error) {
          const errorObj = {
            status: 0,
            message: "",
          };
          if (error instanceof CustomHttpError) {
            errorObj.status = error.httpStatusCode;
            errorObj.message = error.message;
          } else {
            if (typeof error === "string") {
              errorObj.status = 500;
              errorObj.message = error;
            } else if (error instanceof Error) {
              errorObj.status = 500;
              errorObj.message = error.message;
            }
          }

          console.log(
            "Travel mission (/createMission) -> status / " +
              errorObj.status +
              " & message / " +
              errorObj.message
          );

          res.statusCode = errorObj.status;
          res.end(Buffer.from(JSON.stringify(errorObj)));
        }
      } else {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      }
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/createMission) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/getMissionById", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const missionInfo = await _getMissionInfo(
      JSON.parse(decryptedData).mission,
      JSON.parse(decryptedData).user,
      reqCookies
    );

    res.end(Buffer.from(JSON.stringify(missionInfo)));
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      if (error.httpStatusCode == 401) {
        try {
          const fetchCFAuthToken = await _fetchCFAuthToken();

          const fetchCPIAuthToken = await _fetchCPIAuthToken(fetchCFAuthToken);

          res.setHeader(
            "Set-Cookie",
            "CPIOAuth=" + fetchCPIAuthToken + "; HttpOnly"
          );

          const reqCookies = await _fetchCookies(req);

          const decryptedData = await _fetchDecryptedData(req.body.data);

          const missionInfo = await _getMissionInfo(
            JSON.parse(decryptedData).mission,
            JSON.parse(decryptedData).user,
            reqCookies
          );

          res.end(Buffer.from(JSON.stringify(missionInfo)));
        } catch (error) {
          const errorObj = {
            status: 0,
            message: "",
          };
          if (error instanceof CustomHttpError) {
            errorObj.status = error.httpStatusCode;
            errorObj.message = error.message;
          } else {
            if (typeof error === "string") {
              errorObj.status = 500;
              errorObj.message = error;
            } else if (error instanceof Error) {
              errorObj.status = 500;
              errorObj.message = error.message;
            }
          }

          console.log(
            "Travel mission (/getMissionById) -> status / " +
              errorObj.status +
              " & message / " +
              errorObj.message
          );

          res.statusCode = errorObj.status;
          res.end(Buffer.from(JSON.stringify(errorObj)));
        }
      } else {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      }
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/getMissionById) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/approveRejectMission", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const missionInfo = await _approveRejectMission(req.body.data, reqCookies);

    res.end(Buffer.from(JSON.stringify(missionInfo)));
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      if (error.httpStatusCode == 401) {
        try {
          const fetchCFAuthToken = await _fetchCFAuthToken();

          const fetchCPIAuthToken = await _fetchCPIAuthToken(fetchCFAuthToken);

          res.setHeader(
            "Set-Cookie",
            "CPIOAuth=" + fetchCPIAuthToken + "; HttpOnly"
          );

          const reqCookies = await _fetchCookies(req);

          const missionInfo = await _approveRejectMission(
            req.body.data,
            reqCookies
          );

          res.end(Buffer.from(JSON.stringify(missionInfo)));
        } catch (error) {
          const errorObj = {
            status: 0,
            message: "",
          };
          if (error instanceof CustomHttpError) {
            errorObj.status = error.httpStatusCode;
            errorObj.message = error.message;
          } else {
            if (typeof error === "string") {
              errorObj.status = 500;
              errorObj.message = error;
            } else if (error instanceof Error) {
              errorObj.status = 500;
              errorObj.message = error.message;
            }
          }

          console.log(
            "Travel mission (/approveMission) -> status / " +
              errorObj.status +
              " & message / " +
              errorObj.message
          );

          res.statusCode = errorObj.status;
          res.end(Buffer.from(JSON.stringify(errorObj)));
        }
      } else {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      }
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/approveMission) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use(
  "/updateTicketItinerary",
  async (req, res, next) => {
    try {
      const reqCookies = await _fetchCookies(req);

      const decryptedData = await _fetchDecryptedData(req.body.data);

      // const updateItinerary = await _updateItinerary(
      const updateItinerary = await _updateItineraryBatch(
        JSON.parse(decryptedData).params,
        reqCookies
      );

      const encrypted = await _fetchEncryptedData(
        Buffer.from(JSON.stringify(updateItinerary))
      );

      res.end(encrypted);
    } catch (error) {
      const errorObj = {
        status: 0,
        message: "",
      };
      if (error instanceof CustomHttpError) {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      } else {
        if (typeof error === "string") {
          errorObj.status = 500;
          errorObj.message = error;
        } else if (error instanceof Error) {
          errorObj.status = 500;
          errorObj.message = error.message;
        }
      }

      console.log(
        "Travel mission (/updateTicketItinerary) -> status / " +
          errorObj.status +
          " & message / " +
          errorObj.message
      );

      res.statusCode = errorObj.status;
      res.end(Buffer.from(JSON.stringify(errorObj)));
    }
  }
);

ar.beforeRequestHandler.use("/claimMission", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    //const decryptedData = await _fetchDecryptedData(req.body.data);

    const claimMission = await _claimMission(req.body.data.params, reqCookies);

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(claimMission))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/claimMission) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/fetchSectorInfo", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const sectorInfo = await _fetchSectorInfo(
      JSON.parse(decryptedData).params,
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(sectorInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/fetchSectorInfo) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/fetchClaim", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const claimInfo = await _fetchClaim(
      JSON.parse(decryptedData).params,
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(claimInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/fetchClaim) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/fetchClaimsAdvances", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const claimInfo = await _fetchClaims(JSON.parse(decryptedData), reqCookies);

    const advanceInfo = await _fetchAdvances(
      JSON.parse(decryptedData),
      reqCookies
    );

    res.end(
      Buffer.from(
        JSON.stringify({
          claims: claimInfo,
          advances: advanceInfo,
        })
      )
    );
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/fetchClaimsAdvances) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use(
  "/fetchPendingClaimsAdvances",
  async (req, res, next) => {
    try {
      const reqCookies = await _fetchCookies(req);

      const decryptedData = await _fetchDecryptedData(req.body.data);

      const claimInfo = await _fetchPendingClaims(
        JSON.parse(decryptedData),
        reqCookies
      );

      const advanceInfo = await _fetchPendingadvances(
        JSON.parse(decryptedData),
        reqCookies
      );

      res.end(
        Buffer.from(
          JSON.stringify({
            claims: claimInfo,
            advances: advanceInfo,
          })
        )
      );
    } catch (error) {
      const errorObj = {
        status: 0,
        message: "",
      };
      if (error instanceof CustomHttpError) {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      } else {
        if (typeof error === "string") {
          errorObj.status = 500;
          errorObj.message = error;
        } else if (error instanceof Error) {
          errorObj.status = 500;
          errorObj.message = error.message;
        }
      }

      console.log(
        "Travel mission (/fetchPendingClaimsAdvances) -> status / " +
          errorObj.status +
          " & message / " +
          errorObj.message
      );

      res.statusCode = errorObj.status;
      res.end(Buffer.from(JSON.stringify(errorObj)));
    }
  }
);

ar.beforeRequestHandler.use("/claimMasters", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const status = await _fetchStatus(reqCookies);

    const cities = await _fetchCities(reqCookies);

    const mastersObj = {
      status: status,
      cities: cities,
    };

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(mastersObj))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/claimMasters) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/findMemberInfo", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);
    const memberDetails = await _fetchMemberInfo(
      req.body.data.filter,
      reqCookies
    );

    res.end(Buffer.from(JSON.stringify(memberDetails)));
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/findMemberInfo) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/fetchClaimInfo", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const claimInfo = await _fetchClaimInfo(
      JSON.parse(decryptedData).claim,
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(claimInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/fetchClaimInfo) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/approveRejectClaim", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    //const decryptedData = await _fetchDecryptedData(req.body.data);

    const claimInfo = await _approveRejectClaim(req.body.data, reqCookies);

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(claimInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/approveRejectClaim) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/advanceMission", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const advanceMission = await _advanceMission(
      JSON.parse(decryptedData).params,
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(advanceMission))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/advanceMission) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/fetchAdvance", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const advanceInfo = await _fetchAdvance(
      JSON.parse(decryptedData).params,
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(advanceInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/fetchAdvance) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/fetchAdvanceInfo", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const advanceInfo = await _fetchAdvanceInfo(
      JSON.parse(decryptedData).advance,
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(advanceInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/fetchAdvanceInfo) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/approveRejectAdvance", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const advanceInfo = await _approveRejectAdvance(
      JSON.parse(decryptedData),
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(advanceInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/approveRejectAdvance) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/cancelMission", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const missionInfo = await _cancelMission(
      JSON.parse(decryptedData),
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(missionInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/cancelMission) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/approveRejectCancel", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const decryptedData = await _fetchDecryptedData(req.body.data);

    const missionInfo = await _approveRejectCancel(
      JSON.parse(decryptedData),
      reqCookies
    );

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(missionInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/approveRejectCancel) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/updateMission", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);
    // const updateMission = await _updateMission(
    //   req.body.data.params,
    //   req.body.data.userInfo,
    //   reqCookies
    // );
    const updateMission = await _updateMissionBatch(
      req.body.data.params,
      req.body.data.userInfo,
      reqCookies
    );
    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(updateMission))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/updateMission) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/updateMissionPayroll", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);
    // const updateMissionPayroll = await _updateMissionPayroll(
    const updateMissionPayroll = await _updateMissionPayrollBatch(
      req.body.data.params,
      reqCookies
    );
    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(updateMissionPayroll))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/updateMissionPayroll) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/rejectMission", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const missionInfo = await _rejectMission(req.body.data, reqCookies);

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(missionInfo))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/rejectMission) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use(
  "/getManagerOfHeadOfSector",
  async (req, res, next) => {
    try {
      const reqCookies = await _fetchCookies(req);
      const managerInfo = await _getManagerOfHeadOfSector(
        req.body.data.params,
        reqCookies
      );
      const encrypted = await _fetchEncryptedData(
        Buffer.from(JSON.stringify(managerInfo))
      );

      res.end(encrypted);
    } catch (error) {
      const errorObj = {
        status: 0,
        message: "",
      };
      if (error instanceof CustomHttpError) {
        errorObj.status = error.httpStatusCode;
        errorObj.message = error.message;
      } else {
        if (typeof error === "string") {
          errorObj.status = 500;
          errorObj.message = error;
        } else if (error instanceof Error) {
          errorObj.status = 500;
          errorObj.message = error.message;
        }
      }

      console.log(
        "Travel mission (/getManagerOfHeadOfSector) -> status / " +
          errorObj.status +
          " & message / " +
          errorObj.message
      );

      res.statusCode = errorObj.status;
      res.end(Buffer.from(JSON.stringify(errorObj)));
    }
  }
);

ar.beforeRequestHandler.use("/getRecoveryAmount", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);
    const recoveryAmount = await _getRecoveryAmount(
      req.body.data.params,
      reqCookies
    );
    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(recoveryAmount))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/getRecoveryAmount) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/checkMission", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const checkMissionResult = await _checkMissionBatch(req.body, reqCookies);
    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(checkMissionResult))
    );

    res.end(encrypted);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/checkMission) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/fetchS4Metadata", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const checkS4Metadata = await _fetchS4Metadata(req.body, reqCookies);

    res.end(checkS4Metadata);
  } catch (error) {
    const errorObj = {
      status: 0,
      message: "",
    };
    if (error instanceof CustomHttpError) {
      errorObj.status = error.httpStatusCode;
      errorObj.message = error.message;
    } else {
      if (typeof error === "string") {
        errorObj.status = 500;
        errorObj.message = error;
      } else if (error instanceof Error) {
        errorObj.status = 500;
        errorObj.message = error.message;
      }
    }

    console.log(
      "Travel mission (/fetchS4Metadata) -> status / " +
        errorObj.status +
        " & message / " +
        errorObj.message
    );

    res.statusCode = errorObj.status;
    res.end(Buffer.from(JSON.stringify(errorObj)));
  }
});

ar.beforeRequestHandler.use("/checkIsAdmin", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const checkIsAdminResult = await _checkIsAdmin(req.body, reqCookies);

    res.end(Buffer.from(JSON.stringify(checkIsAdminResult)));
  } catch (error) {
    res.statusCode = 405;
    res.end(Buffer.from(JSON.stringify({ isAuthorized: false })));
  }
});

ar.beforeRequestHandler.use("/getValueListsBatch", async (req, res, next) => {
  try {
    const reqCookies = await _fetchCookies(req);

    const masterResult = await _getMastersBatch(req.body, reqCookies);

    const encrypted = await _fetchEncryptedData(
      Buffer.from(JSON.stringify(masterResult))
    );
    res.end(encrypted);
  } catch (error) {
    console.log(error);
    res.statusCode = 500;
    res.end(Buffer.from(JSON.stringify({})));
  }
});

ar.beforeRequestHandler.use(
  "/getAdminMissionReport",
  async (req, res, next) => {
    try {
      const reqCookies = await _fetchCookies(req);

      const adminMissionReport = await _getAdminMissionReport(
        req.body,
        reqCookies
      );

      const encrypted = await _fetchEncryptedData(
        Buffer.from(JSON.stringify(adminMissionReport))
      );
      res.end(encrypted);
    } catch (error) {
      res.statusCode = 500;
      res.end(Buffer.from(JSON.stringify({})));
    }
  }
);

ar.beforeRequestHandler.use(
  "/exportAdminMissionReport",
  async (req, res, next) => {
    try {
      const reqCookies = await _fetchCookies(req);

      const adminMissionReport = await _getAdminMissionReport(
        req.body,
        reqCookies
      );

      const wb = XLSX.utils.book_new();

      //--Generate sheet name
      const df = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const reportDateTime = df.format(new Date());

      const sheetContent = [];

      const headerRow = [];
      adminMissionReport.columns.forEach((c) => {
        headerRow.push(c.Coltx);
      });

      sheetContent.push(headerRow);

      adminMissionReport.rows.forEach((r) => {
        const rowContent = [];
        adminMissionReport.columns.forEach((c) => {
          rowContent.push(r[c.Colid]);
        });
        sheetContent.push(rowContent);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetContent);
      XLSX.utils.book_append_sheet(wb, ws, `Sheet 1`);

      const fileResult = await XLSX.write(wb, {
        bookType: "xlsx",
        type: "buffer",
      });

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Mission Report - ${reportDateTime}.xlsx"`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.end(fileResult);
    } catch (error) {
      res.statusCode = 500;
      res.end(error.message);
    }
  }
);

ar.start();
