import { initDemoData, generatedDevices } from "./demo-data";

const feedBufferSeconds = 360;

export const fakeUserData = {
   companyAddress: "fakeCompanyAddress"
};

export const fakeSession = {
   userName: "demoUserName",
   database: "demoDatabase",
   sessionId: "demoSessionId"
};

export const typeNameHandlers = {
   "AddInData": [],
   "User": [fakeUserData],

   LogRecord(fromDate, toDate, deviceSearch) {

      const results = Object.values(generatedDevices).flatMap(device =>
         device.getLogRecordForTimeRange(fromDate, toDate)
      );

      return results;
   },

   ExceptionEvent() {
      return [];
   }
};

function getCurrentTime() {
   return moment().utc().unix();
}

export const callNameHandlers = {

   Get(parameters) {
      const {
         typeName
      } = parameters;

      const result = typeNameHandlers[typeName];
      return result;
   },

   GetCoordinates() {
      const y = 43.515228;
      const x = -79.683523;
      return [{ x, y }];
   },

   GetFeed(parameters) {
      const {
         typeName,
         fromVersion,
         search
      } = parameters;

      const {
         search: {
            fromDate
         }
      } = parameters;

      // console.warn(92, typeName, fromVersion);

      const result = {
         data: [],
         toVersion: fromVersion
      };

      const newDataNeeded = fromVersion === undefined || fromVersion < getCurrentTime();

      if (newDataNeeded) {

         const newVersion = getCurrentTime() + feedBufferSeconds;
         const startingTime = fromVersion ? fromVersion : dateToTime(fromDate);

         const typeHandleFunction = typeNameHandlers[typeName];
         result.data = typeHandleFunction(startingTime, newVersion, search);

         result.toVersion = newVersion;
      }
      return result;
   }
};

export const api = {

   call(call, parameters, resolve, reject) {
      const callHandleFunction = callNameHandlers[call];
      const result = callHandleFunction(parameters);
      // console.warn('51', call, parameters, resolve, reject, result);
      resolve(result);
   },

   multiCall(calls, resolve, reject) {

      const results = [];

      calls.map(eachCall => {
         // console.warn('70', eachCall);
         const [callName, parameters] = eachCall;
         this.call(callName, parameters, callResult => results.push(callResult), reject);
      });

      // console.warn(154, results);
      resolve(results);
   },

   getSession(callBack) {
      callBack(fakeSession);
   }

};

export const geotab = {

   addin: {

      set realTimeMap(RTM) {

         initDemoData();

         const { initialize, focus, blur } = RTM();

         const state = {};
         const callback = () => { };
         document.body.style.height = "100vh";

         initialize(api, state, callback);
      }
   },
};

export function dateToTime(date) {
   return moment(date).utc().unix();
}
