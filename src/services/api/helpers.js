import storage from "../../dataStore";
import moment from "moment-timezone";
import { apiConfig, userInfo } from "../../dataStore/api-config";
import { getLiveTime } from "../../utils/helper";

export function makeAPICall(call, parameters) {
   return new Promise((resolve, reject) => {
      apiConfig.api.call(
         call,
         parameters,
         result => {
            // console.warn('10', result);
            resolve(result);
         },
         e => reject(e)
      );
   });
};

export function makeAPIMultiCall(calls) {
   return new Promise((resolve, reject) => {
      apiConfig.api.multiCall(
         calls,
         result => {
            // console.warn('24', result);
            resolve(result);
         },
         e => reject(e)
      );
   });
};

export function getAllActiveDevices(fromDate = moment().utc().format()) {
   const parameters = {
      "typeName": "Device",
      "search": {
         fromDate
      }
   };

   return makeAPICall("Get", parameters);
};

export function getGroups() {
   return makeAPICall("Get", {
      "typeName": "Group"
   });
};

export function getRules() {
   return makeAPICall("Get", {
      "typeName": "Rule"
   });
};

export function getDiagnosticByName(diagnosticName, resultsLimit = 36) {
   return makeAPICall("Get", {
      "typeName": "Diagnostic",
      resultsLimit,
      search: {
         name: `%${diagnosticName}%`,
         groups: apiConfig.state.getGroupFilter(),
         sourceSearch: { id: "SourceGeotabGoId" }
      }
   });
}

export function getRulesByName(ruleName, resultsLimit = 36) {
   return makeAPICall("Get", {
      "typeName": "Rule",
      resultsLimit,
      search: {
         name: `${ruleName}%`,
         groups: apiConfig.state.getGroupFilter()
      }
   });
}

export function getDeviceByName(deviceName, resultsLimit = 36) {
   return makeAPICall("Get", {
      "typeName": "Device",
      resultsLimit,
      search: {
         name: `%${deviceName}%`,
         groups: apiConfig.state.getGroupFilter()
      }
   });
}

export function createDeviceByNameCall(deviceName, resultsLimit = 36) {
   return ["Get", {
      "typeName": "Device",
      resultsLimit,
      search: {
         name: `%${deviceName}%`,
         groups: apiConfig.state.getGroupFilter()
      }
   }];
}

export function getGroupsByName(groupName, resultsLimit = 36) {
   return makeAPICall("Get", {
      "typeName": "Group",
      resultsLimit,
      search: {
         name: `${groupName}%`
      }
   });
}

export function createGroupsByNameCall(groupName, resultsLimit = 36) {
   return ["Get", {
      "typeName": "Group",
      resultsLimit,
      search: {
         name: `${groupName}%`
      }
   }];
}

export function getDevicesInGroups(groups = [{ id: "GroupCompanyId" }], fromDate = moment().utc().format()) {
   return makeAPICall("Get", {
      typeName: "Device",
      search: {
         groups,
         fromDate
      }
   });
}

export function getDeviceByID(id, resultsLimit = 12) {

   const call = createDeviceByIDCall(id);

   return makeAPICall(call[0], call[1]);
}

export function createDeviceByIDCall(id, resultsLimit = 12) {
   return ["Get", {
      "typeName": "Device",
      resultsLimit,
      search: {
         id
      }
   }];
}

export function getGroupByID(id, resultsLimit = 6) {

   const call = createGroupByIDCall(id, resultsLimit);

   return makeAPICall(call[0], call[1]);
}

export function createGroupByIDCall(id, resultsLimit = 6) {

   return ["Get", {
      "typeName": "Group",
      resultsLimit,
      search: {
         id
      }
   }];
}

export function createStatusDataCall(deviceID, diagnosticID, resultsLimit = 6, fromDateUnix, toDateUnix) {
   const fromDate = fromDateUnix ? moment.unix(fromDateUnix).utc().format() : moment.unix(storage.currentTime).utc().format();
   const toDate = toDateUnix ? moment.unix(toDateUnix).utc().format() : moment.unix(storage.currentTime).utc().format();
   return ["Get", {
      "typeName": "StatusData",
      resultsLimit,
      search: {
         deviceSearch: { id: deviceID },
         diagnosticSearch: { id: diagnosticID },
         fromDate,
         toDate
      }
   }];
}

export function saveBlobStorage(type, data) {
   const parameters = {
      "typeName": "AddInData",
      "entity": {
         "addInId": "acg-6AmDE50Wvr-AHHlrMAQ",
         "data": JSON.stringify({
            "userName": userInfo.userName,
            "date": moment.unix(getLiveTime()).utc().format(),
            "configData": {
               [type]: data
            },
         })
      }
   };
   return makeAPICall("Add", parameters);
}

export function setBlobStorage(type, data) {
   return clearBlobObject(type, data).then(() => {
      const blobObj = storage.setBlobStorageObj;
      const blobData = JSON.parse(blobObj.data);
      blobData.configData[type] = data;
      blobObj.data = JSON.stringify(blobData);
      const parameters = {
         "typeName": "AddInData",
         "entity": blobObj
      };
      return makeAPICall("Set", parameters);
   });

}

export function getBlobStorage() {
   const parameters = {
      "typeName": "AddInData",
      "search": {
         "addInId": "acg-6AmDE50Wvr-AHHlrMAQ",
         "whereClause": `userName = "${userInfo.userName}"`,
      }
   };

   return makeAPICall("Get", parameters);
}

export function clearBlobObject(type, data) {
   //Storage API Limitation : Cannot delete properties of objects
   const blobObj = storage.setBlobStorageObj;
   const blobData = JSON.parse(blobObj.data);
   blobData.configData[type] = "";
   blobObj.data = JSON.stringify(blobData);
   const parameters = {
      "typeName": "AddInData",
      "entity": blobObj
   };
   return makeAPICall("Set", parameters);
}
