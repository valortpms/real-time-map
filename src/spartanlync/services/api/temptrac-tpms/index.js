import moment from "moment-timezone";
import "core-js/stable";
import "regenerator-runtime/runtime";

/* eslint-disable complexity */
/* eslint-disable camelcase */
export function INITGeotabTpmsTemptracLib(api, retrySearchRange, repeatingSearchRange, retryFaultSearchRange, repeatingFaultSearchRange) {
   return function () {
      const me = {

         /**
          *  Private Variables
          */
         _timer: {},

         _diagIdsLocalStorageKeyName: "Spl_diagIds_storage",
         _diagIdsLocalStorageVersion: "1.2",
         _diagIdsLocalStorageAge: 345600, // Time (in seconds) before refreshing geotab database Diagnostic IDs from Geotab API. (Default 96 hours)

         _api: api,
         _apiFaultFirstTimeCall: true,
         _apiFirstTimeCall: true,

         _apiCallFaultRetryCount: 0,
         _apiCallRetryCount: 0,

         _devId: null,
         _devConfig: {},
         _devSelectedComp: "",
         _devComponents: {
            ids: "tractor,trailer1,trailer2,trailer3",
            names: {
               tractor: "Tractor",
               trailer1: "Trailer 1",
               trailer2: "Dolly",
               trailer3: "Trailer 2"
            },
            diagIds: {
               byName: {
                  tractor: "Tractor tire location",
                  trailer1: "Trailer 1 tire location",
                  trailer2: "Trailer 2 tire location",
                  trailer3: "Trailer 3 tire location"
               },
               byIds: {}
            },
            deviceIds: {
               byName: {
                  tractor: "Peripheral device: tractor ID",
                  trailer1: "Peripheral device: trailer 1 ID",
                  trailer2: "Peripheral device: trailer 2 ID",
                  trailer3: "Peripheral device: trailer 3 ID"
               },
               byIds: {}
            },
            idsLoaded: false
         },
         _diagIdsLoadedCallbacks: [],

         _tpmsAlerts: {
            "aKLJDxjee7kuoKR9UxakwaA": {
               name: "Missing Sensor",
               type: "Sensor Fault",
               trId: "alert_missing_sensor",
               color: "RED"
            },
            "DiagnosticVehicleBatteryLowVoltageId": {
               name: "Vehicle Battery has LOW Voltage",
               type: "Battery Fault",
               trId: "alert_battery_low_voltage",
               color: "AMBER"
            },

            "aZOW3ovi390i98yF2ZKR1qg": {
               name: "Leak Detected",
               type: "Tire Pressure Fault",
               trId: "leak_detected",
               color: "RED"
            },
            "aDXwtFQfg4EKkLSFd5Hs2rA": {
               name: "Extreme Over Pressure",
               type: "Tire Pressure Fault",
               trId: "alert_pressure_extreme_over",
               color: "RED"
            },
            "aZStc9p8eaUi8_ORP7eZ8eQ": {
               name: "Extreme Under Pressure",
               type: "Tire Pressure Fault",
               trId: "alert_pressure_extreme_under",
               color: "RED"
            },
            "ak1udf2L2UEemAp833dbAZQ": {
               name: "Over Temperature",
               type: "Tire Temperature Fault",
               trId: "alert_temperature_over",
               color: "AMBER"
            },
            "alCsVoz4p50ap9rPVxYnr_A": {
               name: "Over Pressure",
               type: "Tire Pressure Fault",
               trId: "alert_pressure_over",
               color: "AMBER"
            },
            "alDp49zHqz0eqtLawXDYc_g": {
               name: "Under Pressure",
               type: "Tire Pressure Fault",
               trId: "alert_pressure_under",
               color: "AMBER"
            }
         },

         _vehIgnitionData: null,

         _sDataCallback: null,
         _fDataCallback: null,

         _fromDate: null,
         _toDate: null,
         _toDateOverride: null,

         _fromFaultDate: null,
         _toFaultDate: null,
         _toFaultDateOverride: null,
         _showAllFaults: false,

         _repSType: null,
         _repCallback: null,

         _timeRangeForRepeatSearchesInSeconds: repeatingSearchRange,
         _timeSearchRetryRangeInDays: retrySearchRange,

         _timeRangeForRepeatFaultSearchesInSeconds: repeatingFaultSearchRange,
         _timeFaultSearchRetryRangeInDays: retryFaultSearchRange,

         /**
         * getData() Retrieves TPMS /Temptrac sensor data from Geotab API
         *
         * @param {string} devId    - Geotab Device Id
         * @param {string} devComp  - Vehicle component (null = all/any, tractor, trailer1, dolly, trailer2)
         * @param {string} callback - Callback func to invoke upon retrieval of data
         * @param {any} firstTimeCallOverride - Manually override firstTime/repeat behaviour
         * @param {int} toDateOverride - Manually override value of _toDate property
         *
         * If first call, start with a search over last 24 hours.
         * - If nothing found, retry with 2 days, then 1 week, 1 month, 2 months, then we give up
         * - If sensor data found,
         *   (1) convert sensor data to a time-sorted array of sensor objects and
         *   (2) pass back to supplied callback function
         *
         * @return {array} Array of Sensor objects, sorted by time from oldest to newest
         */
         getData: function (devId, devComp, callback, firstTimeCallOverride, toDateOverride) {
            if (devId.toString().trim() === "" || typeof callback === "undefined" || typeof callback !== "function") {
               return;
            }
            if (typeof firstTimeCallOverride !== "undefined" && firstTimeCallOverride !== null) {
               me._apiFirstTimeCall = firstTimeCallOverride;
            }
            if (typeof toDateOverride !== "undefined" && toDateOverride !== null) {
               me._toDateOverride = toDateOverride;
            }
            me._devId = devId;
            me._devSelectedComp = devComp;
            me._sDataCallback = callback;
            me._setDateRangeAndInvokeCall();
         },

         /**
         * getFaults() Retrieves Vehicle faults and ignition data from Geotab API
         *
         * @param {string} devId    - Geotab Device Id
         * @param {string} callback - Callback func to invoke upon retrieval of fault data
         * @param {any} firstTimeCallOverride - Manually override firstTime/repeat behaviour
         * @param {int} toDateOverride - Manually override value of _toFaultDate property
         *
         * If first call, start with a search over last 24 hours.
         * - If nothing found, retry with 2 days, then 1 week, 1 month, 2 months, then we give up
         * - If sensor data found,
         *   (1) convert sensor data to a time-sorted array of sensor objects and
         *   (2) pass back to supplied callback function
         *
         * @return {array} Array of Fault objects, sorted by time from oldest to newest
         * @return {array} Array of Ignition data objects, sorted by time from oldest to newest
         */
         getFaults: function (devId, callback, firstTimeCallOverride, toDateOverride, showAllFaults) {
            if (devId.toString().trim() === "" || typeof callback === "undefined" || typeof callback !== "function") {
               return;
            }
            if (typeof firstTimeCallOverride !== "undefined" && firstTimeCallOverride !== null) {
               me._apiFaultFirstTimeCall = firstTimeCallOverride;
            }
            if (typeof toDateOverride !== "undefined" && toDateOverride !== null) {
               me._toFaultDateOverride = toDateOverride;
            }
            me._devId = devId;
            me._fDataCallback = callback;
            me._showAllFaults = typeof showAllFaults !== "undefined" && showAllFaults === true ? true : false;

            me._buildDiagIdLib().then(() => {
               me._buildDiagIdDB();
               me._setDateRangeAndInvokeFaultCalls();
            });
         },

         /**
         * getVehStatus() Retrieves Vehicle status info from Geotab API
         *
         * @param {string} devId    - Geotab Device Id
         * @param {string} callback - Callback func to invoke upon retrieval of data
         *
         * @return {array} Vehicle status object
         */
         getVehStatus: function (devId, vStatusCallback) {
            if (devId.toString().trim() === "" || typeof vStatusCallback === "undefined" || typeof vStatusCallback !== "function") {
               return;
            }

            // Build DeviceStatus API Call
            const apiCall = {
               typeName: "DeviceStatusInfo",
               search: {
                  deviceSearch: {
                     id: devId
                  }
               }
            };
            console.log("VehicleID [ " + devId + " ]: getVehStatus(): Collecting latest Vehicle Status information...");

            // Invoke Device Status API Call
            me._timer.a1 = new Date();
            me._api.call("Get", apiCall,
               function (result) {
                  if (result && result.length) {
                     const vehStatusObj = result[0];
                     me._timer.a2 = new Date();
                     console.log("VehicleID [ " + devId + " ]: getVehStatus(): Vehicle Status Info retrieved - " + me._convertSecondsToHMS((me._timer.a2 - me._timer.a1) / 1000));
                     vStatusCallback(vehStatusObj);
                  }
                  else {
                     console.log("--- Error: getVehStatus.api.call(): EMPTY RESPONSE");
                     vStatusCallback(null);
                  }
               },
               function (errorString) {
                  me._timer.a2 = new Date();
                  console.log("VehicleID [ " + devId + " ]: ERROR: Vehicle Status Info retrieval failed - " + me._convertSecondsToHMS((me._timer.a2 - me._timer.a1) / 1000));
                  console.log("VehicleID [ " + devId + " ]: ERROR: getVehStatus.api.call(): " + errorString);
                  vStatusCallback(null);
               });
         },

         getVehComponentDB: function () {
            return me._devComponents;
         },

         getTpmsAlerts: function () {
            return me._tpmsAlerts;
         },

         resetAsFirstTime: function () {
            me._devId = null;
            me._devConfig = {};
            me._devSelectedComp = "";
            me._apiCallFaultRetryCount = 0;
            me._apiCallRetryCount = 0;
            me._apiFirstTimeCall = true;
            me._apiFaultFirstTimeCall = true;
            me._vehIgnitionData = null;
            me._showAllFaults = false;
         },

         resetForNewVehComponent: function () {
            me._devId = null;
            me._devSelectedComp = "";
            me._apiCallFaultRetryCount = 0;
            me._apiCallRetryCount = 0;
            me._apiFirstTimeCall = true;
            me._apiFaultFirstTimeCall = true;
            me._vehIgnitionData = null;
            me._showAllFaults = false;
         },

         onDiagIdsLoaded: function (callback) {
            if (typeof callback === "function") {
               // If DeviceIds loaded, invoke Callback
               if (me._devComponents.loaded) {
                  callback(me._devComponents);
               }
               // Otherwise, Queue it for after DeviceIds are loaded
               else {
                  me._diagIdsLoadedCallbacks.push(callback);
               }
            }
         },

         _setDateRangeAndInvokeFaultCalls: function () {
            me._toFaultDate = me._toFaultDateOverride ? moment.unix(me._toFaultDateOverride).utc().format() : moment().utc().format();

            // First call, search for data over last few days
            if (me._apiFaultFirstTimeCall) {

               // If retry limit is reached without fault data, send a callback failure response
               if (me._apiCallFaultRetryCount === me._timeFaultSearchRetryRangeInDays.length) {
                  me._apiCallFaultRetryCount = 0;
                  me._toFaultDateOverride = null;
                  me._fDataCallback(null, me._vehIgnitionData);
                  return;
               }
               // Iterate date range array USING _apiCallFaultRetryCount until a successful API response
               me._fromFaultDate = moment().utc().subtract(me._timeFaultSearchRetryRangeInDays[me._apiCallFaultRetryCount], "day").format();
               if (me._toFaultDateOverride) {
                  // Calculate FROM using user-supplied UNIX timestamp instead of NOW
                  me._fromFaultDate = moment.unix(me._toFaultDateOverride).utc().subtract(me._timeFaultSearchRetryRangeInDays[me._apiCallFaultRetryCount], "day").format();
               }
            }
            // Repeat call, search over the last few minutes
            else {
               me._fromFaultDate = moment().utc().subtract(me._timeRangeForRepeatFaultSearchesInSeconds, "seconds").format();
               if (me._toFaultDateOverride) {
                  // Calculate FROM using user-supplied UNIX timestamp instead of NOW
                  me._fromFaultDate = moment.unix(me._toFaultDateOverride).utc().subtract(me._timeRangeForRepeatFaultSearchesInSeconds, "seconds").format();
               }
            }

            // Build then perform TPMS/Temptrac Multicall
            console.log("Please Wait...Attempt#" + (me._apiCallFaultRetryCount + 1) +
               " Retrieving TPMS Fault data on VehicleID [ " + me._devId + " ] using " + (
                  me._apiFaultFirstTimeCall ?
                     me._timeFaultSearchRetryRangeInDays[me._apiCallFaultRetryCount] + " day" :
                     me._convertSecondsToHMS(me._timeRangeForRepeatFaultSearchesInSeconds)
               ) + " date range: FROM: " + me._fromFaultDate + " => TO: " + me._toFaultDate);

            // Invoke Get.Fault + Get.TireLocation(Using DiagIds from VehComponentsTable) API Calls
            const apiCall = [
               ["Get", {
                  typeName: "FaultData",
                  search: {
                     fromDate: me._fromFaultDate,
                     toDate: me._toFaultDate,
                     deviceSearch: {
                        id: me._devId
                     }
                  }
               }],
               ["Get", {
                  typeName: "StatusData",
                  search: {
                     fromDate: me._fromFaultDate,
                     toDate: me._toFaultDate,
                     deviceSearch: {
                        id: me._devId
                     },
                     diagnosticSearch: {
                        id: "DiagnosticIgnitionId"
                     }
                  }
               }]
            ];
            if (Object.keys(me._devComponents["diagIds"]["byIds"]).length) {
               Object.keys(me._devComponents["diagIds"]["byIds"]).forEach(diagId => {
                  apiCall.push(["Get", {
                     typeName: "StatusData",
                     search: {
                        fromDate: me._fromFaultDate,
                        toDate: me._toFaultDate,
                        deviceSearch: {
                           id: me._devId
                        },
                        diagnosticSearch: {
                           id: diagId
                        }
                     }
                  }]);
               });
            }

            me._timer.b3 = new Date();
            me._api.multiCall(apiCall,
               function (result) {
                  if (result && result.length >= 3) {
                     const fromFaultDateUnix = moment(me._fromFaultDate).unix();
                     const toFaultDateUnix = moment(me._toFaultDate).unix();
                     let faultDataFound = false;
                     let tireLocData = {};
                     const fdata = {};

                     me._timer.b4 = new Date();
                     console.log("Fault data for VehicleID [ " + me._devId + " ] retrieved - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000));
                     console.log("Fault data for VehicleID [ " + me._devId + " ] being analyzed - Almost There!");

                     // Collect Ignition data
                     me._vehIgnitionData = me._generateVehIgnitionDb(result[1]);

                     // Assemble and merge Tire Location data from multi-vehicle Component query
                     for (let i = 2; i < result.length; i++) {
                        tireLocData = { ...tireLocData, ...me._generateFaultAxleLocDb(result[i]) };
                     }

                     // Analyze fault data
                     me._timer.b3 = new Date();
                     for (const frec of result[0]) {
                        const frecDateUnix = moment(frec.dateTime).unix();
                        if (!frec.id || frec.device.id !== me._devId || typeof frec.diagnostic.id === "undefined" ||
                           !(frecDateUnix >= fromFaultDateUnix && frecDateUnix <= toFaultDateUnix)) {
                           continue; // Invalid records discarded
                        }
                        const faultId = !me._showAllFaults ? frec.diagnostic.id : frec.diagnostic.id + "_" + (Math.random().toString(36).substr(2, 5));
                        const recObj = {
                           id: faultId,
                           diagId: frec.diagnostic.id,
                           time: frecDateUnix
                        };

                        // Keep the most recent fault record by time
                        if (typeof fdata[faultId] === "undefined") {
                           fdata[faultId] = recObj;
                        }
                        else if (recObj.time > fdata[faultId].time) {
                           fdata[faultId] = recObj;
                        }

                        // Attach VehComponent/Axle/Tire location to Fault record (If found in Tire Location DB)
                        if (Object.keys(tireLocData).length) {
                           Object.keys(tireLocData).forEach(vehComp => {
                              if (typeof tireLocData[vehComp][fdata[faultId].time] !== "undefined") {
                                 const tireLocRec = tireLocData[vehComp][fdata[faultId].time];
                                 tireLocRec.vehComp = vehComp;
                                 if (typeof fdata[faultId].loc === "undefined") {
                                    fdata[faultId].loc = [];
                                 }
                                 fdata[faultId].loc.push(tireLocRec);
                              }
                           });
                        }

                        // Attach Alert level to a few Faults (TPMS-related)
                        if (typeof fdata[faultId].alert === "undefined" && typeof me._tpmsAlerts[fdata[faultId].diagId] !== "undefined") {
                           fdata[faultId].alert = me._tpmsAlerts[fdata[faultId].diagId];
                        }

                        // Specify whether fault occurred after the most recent ignition
                        fdata[faultId].occurredOnLatestIgnition = fdata[faultId].time >= me._vehIgnitionData["on-latest"] ? true : false;

                        faultDataFound = true;
                     }
                     if (!faultDataFound) {
                        if (me._apiFaultFirstTimeCall) {

                           // If its a first time call + no fault date found, Retry with a different date range
                           console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND! Retrying search with another date range...");
                           me._apiCallFaultRetryCount++;
                           me._setDateRangeAndInvokeFaultCalls();
                           return;
                        }
                        else {

                           // Repeat calls will fails with "No Results" found. No Retry. Return "No Results" callback response
                           console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND for this date range!");
                           me._apiCallFaultRetryCount = 0;
                           me._toFaultDateOverride = null;
                           me._fDataCallback(null, me._vehIgnitionData);
                           return;
                        }
                     }
                     else {
                        // Future calls after this successful response will not be a first-timer
                        me._apiFaultFirstTimeCall = false;

                        // Build API calls for searching for diagnostic descriptions for the Fault Ids found
                        const calls = [];
                        const faultArr = [];
                        const diagDesc = {};
                        if (Object.keys(fdata).length) {
                           for (const faultId of Object.keys(fdata)) {
                              if (typeof diagDesc[fdata[faultId].diagId] === "undefined") {
                                 calls.push(["Get", {
                                    typeName: "Diagnostic",
                                    search: {
                                       id: fdata[faultId].diagId
                                    }
                                 }]);
                                 diagDesc[fdata[faultId].diagId] = "";
                              }
                           }

                           // Search for Diagnostic descriptions
                           me._api.multiCall(calls,
                              function (result) {
                                 if (result && result.length) {

                                    // Assemble Diagnostic descriptions
                                    for (const res of result) {
                                       if (Array.isArray(res) && res.length) {
                                          for (const frec of res) {
                                             if (typeof frec.name === "undefined" || !frec.id) {
                                                continue; // Invalid / missing records discarded
                                             }
                                             diagDesc[frec.id] = frec.name;
                                          }
                                       }
                                       else if (typeof res === "object" && typeof res.name !== "undefined" && res.id) {
                                          diagDesc[res.id] = res.name;
                                       }
                                    }

                                    // Merge Diagnostic descriptions with Fault data
                                    for (const faultId of Object.keys(fdata)) {
                                       if (diagDesc[fdata[faultId].diagId]) {
                                          fdata[faultId].msg = diagDesc[fdata[faultId].diagId];
                                          faultArr.push(fdata[faultId]);
                                       }
                                    }

                                    me._timer.b4 = new Date();
                                    console.log("Fault data for VehicleID [ " + me._devId + " ] analyzed and sorted - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000) + ".");

                                    // Return fault data to callback
                                    me._apiCallFaultRetryCount = 0;
                                    me._toFaultDateOverride = null;
                                    me._fDataCallback(faultArr, me._vehIgnitionData);
                                    return;
                                 }
                                 else {
                                    if (me._apiFaultFirstTimeCall) {
                                       me._apiCallFaultRetryCount++;
                                       me._setDateRangeAndInvokeFaultCalls();
                                       return;
                                    }

                                    // Return "NOT-FOUND" callback response
                                    me._apiCallFaultRetryCount = 0;
                                    me._fDataCallback(null, me._vehIgnitionData);
                                 }
                              });
                        }
                        else {
                           if (me._apiFaultFirstTimeCall) {
                              me._apiCallFaultRetryCount++;
                              me._setDateRangeAndInvokeFaultCalls();
                              return;
                           }

                           // Return "NOT-FOUND" callback response
                           me._apiCallFaultRetryCount = 0;
                           me._fDataCallback(null, me._vehIgnitionData);
                        }
                     }
                  }

                  // No results from API Call, Retry
                  else {

                     // Retry if its a first time call
                     if (me._apiFaultFirstTimeCall) {
                        me._apiCallFaultRetryCount++;
                        me._setDateRangeAndInvokeFaultCalls();
                        return;
                     }

                     // Return "NOT-FOUND" callback response
                     console.log("VehicleID [ " + me._devId + " ]: NO FAULT DATA FOUND for this date range!");
                     me._apiCallFaultRetryCount = 0;
                     me._toFaultDateOverride = null;
                     me._fDataCallback(null, me._vehIgnitionData);
                  }
               },
               function (errorString) {
                  me._timer.b4 = new Date();
                  console.log("VehicleID [ " + me._devId + " ]: ---- Sensor data retrieval failed - " + me._convertSecondsToHMS((me._timer.b4 - me._timer.b3) / 1000));
                  console.log("VehicleID [ " + me._devId + " ]: _setDateRangeAndInvokeFaultCalls() ERROR: " + errorString);

                  // Retry if its a first time call
                  if (me._apiFaultFirstTimeCall) {
                     me._apiCallFaultRetryCount++;
                     me._setDateRangeAndInvokeFaultCalls();
                     return;
                  }

                  // Return "NOT-FOUND" callback response
                  me._apiCallFaultRetryCount = 0;
                  me._toFaultDateOverride = null;
                  me._fDataCallback(null, me._vehIgnitionData);
               });
         },

         _setDateRangeAndInvokeCall: function () {
            let vehComps = "";
            me._toDate = me._toDateOverride ? moment.unix(me._toDateOverride).utc().format() : moment().utc().format();

            // First call, search for data over last few days
            if (me._apiFirstTimeCall) {

               // If retry limit is reached without sensor data, send a failure response to callback func
               if (me._apiCallRetryCount === me._timeSearchRetryRangeInDays.length) {
                  me._apiCallRetryCount = 0;
                  me._toDateOverride = null;
                  me._sDataCallback(null);
                  return;
               }

               // Iterate date range array USING _apiCallRetryCount until a successful API response
               me._fromDate = moment().utc().subtract(me._timeSearchRetryRangeInDays[me._apiCallRetryCount], "day").format();
               if (me._toDateOverride) {
                  // Calculate FROM using user-supplied UNIX timestamp instead of NOW
                  me._fromDate = moment.unix(me._toDateOverride).utc().subtract(me._timeSearchRetryRangeInDays[me._apiCallRetryCount], "day").format();
               }
            }
            // Repeat call, search over the last few minutes
            else {
               me._fromDate = moment().utc().subtract(me._timeRangeForRepeatSearchesInSeconds, "seconds").format();
               if (me._toDateOverride) {
                  // Calculate FROM using user-supplied UNIX timestamp instead of NOW
                  me._fromDate = moment.unix(me._toDateOverride).utc().subtract(me._timeRangeForRepeatSearchesInSeconds, "seconds").format();
               }
            }

            // Search for all Vehicle componenents, if a specific component not specified
            vehComps = me._devSelectedComp ? me._devSelectedComp : me._devComponents.ids;

            // Build then perform TPMS/Temptrac Multicall
            console.log("Please Wait...Attempt#" + (me._apiCallRetryCount + 1) +
               " Retrieving " + (me._devSelectedComp ? me._devComponents.names[me._devSelectedComp].toUpperCase() : "ALL") +
               " Sensor Data on VehicleID [ " + me._devId + " ] using " + (
                  me._apiFirstTimeCall ?
                     me._timeSearchRetryRangeInDays[me._apiCallRetryCount] + " day" :
                     me._convertSecondsToHMS(me._timeRangeForRepeatSearchesInSeconds)
               ) + " date range: FROM: " + me._fromDate + " => TO: " + me._toDate);

            me._timer.b1 = new Date();
            me._buildApiCall(vehComps).then((calls) => {
               me._api.multiCall(calls,
                  function (result) {
                     if (result && result.length) {
                        const fromDateUnix = moment(me._fromDate).unix();
                        const toDateUnix = moment(me._toDate).unix();
                        let sensorDataFound = false;
                        const sdata = {};

                        me._timer.b2 = new Date();
                        console.log("Sensor data for VehicleID [ " + me._devId + " ] retrieved - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000));

                        // Analyze and Sort sensor data
                        console.log("Sensor data for VehicleID [ " + me._devId + " ] being analyzed - Almost There!");
                        me._timer.b1 = new Date();
                        for (const res of result) {
                           if (Array.isArray(res) && res.length) {
                              for (const srec of res) {
                                 const srecDateUnix = moment(srec.dateTime).unix();
                                 if (!srec.id || !srec.dateTime || srec.device.id !== me._devId || typeof srec.diagnostic.id === "undefined" ||
                                    !(srecDateUnix > fromDateUnix && srecDateUnix < toDateUnix)) {
                                    continue; // Invalid records discarded
                                 }
                                 const diagName = me._locLib.idxIds[srec.diagnostic.id];
                                 const vehCompType = me._locLib[diagName].type;

                                 // Init Sensor Data ordered by Vehicle component
                                 if (typeof sdata[vehCompType] === "undefined") {
                                    sdata[vehCompType] = {
                                       tpmstemp: {},
                                       tpmspress: {},
                                       temptrac: {}
                                    };
                                 }

                                 // Store Temptrac sensor reading
                                 if (diagName.indexOf("reefer temperature") > -1) {
                                    const zone = me._extractZoneFromLoc(diagName);
                                    const locId = "temptrac_" + zone.trim().replace(/ /g, "").toLowerCase();
                                    const recObj = {
                                       id: locId,
                                       type: "Temptrac",
                                       time: srecDateUnix,
                                       zone: zone,
                                       val: me._fromDataToValueObj(srec)
                                    };

                                    // Remember most recent records by Location
                                    if (typeof sdata[vehCompType].temptrac[locId] === "undefined") {
                                       sdata[vehCompType].temptrac[locId] = recObj;
                                    }
                                    else if (recObj.time > sdata[vehCompType].temptrac[locId].time) {
                                       sdata[vehCompType].temptrac[locId] = recObj;
                                    }
                                 }
                                 // Store TPMS Temperature sensor reading
                                 else if (diagName.indexOf("ire temperature:") > -1) {
                                    const axle = me._extractAxleFromLoc(diagName).replace(/^trailer [0-9] /g, "");
                                    const locId = "tiretemp_" + axle.trim().replace(/ /g, "").toLowerCase();
                                    const recObj = {
                                       id: locId,
                                       type: "Tire Temperature",
                                       time: srecDateUnix,
                                       axle: axle,
                                       val: me._fromDataToValueObj(srec)
                                    };

                                    // Remember most recent records by Location
                                    if (typeof sdata[vehCompType].tpmstemp[locId] === "undefined") {
                                       sdata[vehCompType].tpmstemp[locId] = recObj;
                                    }
                                    else if (recObj.time > sdata[vehCompType].tpmstemp[locId].time) {
                                       sdata[vehCompType].tpmstemp[locId] = recObj;
                                    }
                                 }
                                 // Store TPMS Pressure sensor reading
                                 else if (diagName.indexOf("ire pressure:") > -1) {
                                    const axle = me._extractAxleFromLoc(diagName).replace(/^trailer [0-9] /g, "");
                                    const locId = "tirepress_" + axle.trim().replace(/ /g, "").toLowerCase();
                                    const recObj = {
                                       id: locId,
                                       type: "Tire Pressure",
                                       time: srecDateUnix,
                                       axle: axle,
                                       val: me._fromDataToValueObj(srec)
                                    };

                                    // Remember most recent records by Location
                                    if (typeof sdata[vehCompType].tpmspress[locId] === "undefined") {
                                       sdata[vehCompType].tpmspress[locId] = recObj;
                                    }
                                    else if (recObj.time > sdata[vehCompType].tpmspress[locId].time) {
                                       sdata[vehCompType].tpmspress[locId] = recObj;
                                    }
                                 }
                                 sensorDataFound = true;
                              }
                           }
                        }

                        if (!sensorDataFound) {
                           if (me._apiFirstTimeCall) {

                              // If its a first time call + no sensor date found, Retry with a different date range
                              console.log("NO SENSOR DATA FOUND on VehicleID [ " + me._devId + " ]! Retrying search with another date range...");
                              me._apiCallRetryCount++;
                              me._setDateRangeAndInvokeCall();
                              return;
                           }
                           else {

                              // Repeat calls will fails with "No Results" found. No Retry. Return "No Results" response to callback
                              me._apiCallRetryCount = 0;
                              me._toDateOverride = null;
                              me._sDataCallback(null);
                              return;
                           }
                        }
                        else {
                           me._timer.b2 = new Date();
                           console.log("Sensor data for VehicleID [ " + me._devId + " ] analyzed and sorted - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000) + ".");

                           if (!me._devSelectedComp) {

                              // Search results for the Entire Vehicle Train chooses the highest-priority vehicle component found in search results
                              const vehCompsFound = Object.keys(sdata);
                              if (vehCompsFound.length === 1) {
                                 me._devSelectedComp = vehCompsFound[0];
                              }
                              else {
                                 for (const comp of me._devComponents.ids.split(",")) {
                                    if (vehCompsFound.includes(comp)) {
                                       me._devSelectedComp = comp;
                                       break;
                                    }
                                 }
                              }

                              // Build vehicle component configuration, returned on future search results
                              me._devConfig = {
                                 ids: vehCompsFound,
                                 total: vehCompsFound.length,
                                 compsdata: sdata
                              };
                           }
                           me._devConfig.active = me._devSelectedComp;

                           // Future calls after this successful response will not be a first-timer
                           me._apiFirstTimeCall = false;

                           // Return sensor data for single Vehicle component to UI callback
                           me._apiCallRetryCount = 0;
                           const compdata = JSON.parse(JSON.stringify(sdata[me._devSelectedComp]));
                           compdata.vehId = me._devId;
                           compdata.vehCfg = me._devConfig;

                           // If toDate override supplied in parameters, return toDate property in result data
                           if (compdata && me._toDateOverride) {
                              compdata.toDate = me._toDateOverride;
                           }
                           me._toDateOverride = null;
                           me._sDataCallback(compdata);
                           return;
                        }
                     }

                     // No results from multicall, Retry
                     else {
                        me._apiCallRetryCount++;
                        me._setDateRangeAndInvokeCall();
                        return;
                     }
                  },
                  function (errorString) {
                     me._timer.b2 = new Date();
                     console.log("VehicleID [ " + me._devId + " ]: ---- Sensor data retrieval failed - " + me._convertSecondsToHMS((me._timer.b2 - me._timer.b1) / 1000));
                     console.log("VehicleID [ " + me._devId + " ]: _setDateRangeAndInvokeCall() ERROR: " + errorString);

                     // Retry if its a first time call
                     if (me._apiFirstTimeCall) {
                        me._apiCallRetryCount++;
                        me._setDateRangeAndInvokeCall();
                     }
                  });
            });
         },

         _generateFaultAxleLocDb: function (result) {
            const locData = {};

            if (result && result.length) {
               for (const res of result) {
                  if (Array.isArray(res) && res.length) {
                     for (const frec of res) {
                        if (typeof frec.data === "undefined" ||
                           typeof frec.dateTime === "undefined" ||
                           typeof frec.diagnostic === "undefined" ||
                           typeof frec.diagnostic.id === "undefined") {
                           continue; // Invalid / missing records discarded
                        }
                        const time = moment(frec.dateTime).unix();
                        const vehComp = me._devComponents["diagIds"]["byIds"][frec.diagnostic.id] ? me._devComponents["diagIds"]["byIds"][frec.diagnostic.id] : "unknown";
                        if (typeof locData[vehComp] === "undefined") {
                           locData[vehComp] = {};
                        }
                        locData[vehComp][time] = me._getLocFromGeotabData(frec.data);
                     }
                  }
                  else if (typeof res === "object" &&
                     typeof res.data !== "undefined" &&
                     typeof res.dateTime !== "undefined" &&
                     typeof res.diagnostic !== "undefined" &&
                     typeof res.diagnostic.id !== "undefined"
                  ) {
                     const time = moment(res.dateTime).unix();
                     const vehComp = me._devComponents["diagIds"]["byIds"][res.diagnostic.id] ? me._devComponents["diagIds"]["byIds"][res.diagnostic.id] : "unknown";
                     if (typeof locData[vehComp] === "undefined") {
                        locData[vehComp] = {};
                     }
                     locData[vehComp][time] = me._getLocFromGeotabData(res.data);
                  }
               }
            }
            return locData;
         },

         /**
         * _generateVehIgnitionDb() Stores Ignition Status in Object Db
         *
         * In "data" property;
         * - Ignition on will be indicated by a 1
         * - Ignition off will be indicated by a 0
         *
         * @return {object} structure storing Array of vehicle Ignition organized by ON/OFF status
         */
         _generateVehIgnitionDb: function (result) {
            const ignitionData = {
               "on-latest": 0,
               "on": [],
               "off-latest": 0,
               "off": [],
               "byTime": {},
            };

            if (result && result.length) {
               for (const res of result) {
                  if (Array.isArray(res) && res.length) {
                     for (const rec of res) {
                        if (typeof rec.data === "undefined" ||
                           typeof rec.dateTime === "undefined") {
                           continue; // Invalid / missing records discarded
                        }
                        const time = moment(rec.dateTime).unix();
                        const status = rec.data ? "on" : "off";
                        ignitionData[status].push(time);
                        ignitionData["byTime"][time] = status;
                        ignitionData["on-latest"] = status === "on" && time > ignitionData["on-latest"] ? time : ignitionData["on-latest"];
                        ignitionData["off-latest"] = status === "off" && time > ignitionData["off-latest"] ? time : ignitionData["off-latest"];
                     }
                  }
                  else if (typeof res === "object" &&
                     typeof res.data !== "undefined" &&
                     typeof res.dateTime !== "undefined"
                  ) {
                     const time = moment(res.dateTime).unix();
                     const status = res.data ? "on" : "off";
                     ignitionData[status].push(time);
                     ignitionData["byTime"][time] = status;
                     ignitionData["on-latest"] = status === "on" && time > ignitionData["on-latest"] ? time : ignitionData["on-latest"];
                     ignitionData["off-latest"] = status === "off" && time > ignitionData["off-latest"] ? time : ignitionData["off-latest"];
                  }
               }
            }
            return ignitionData;
         },

         _mDimAssign: function (obj, keyPath, value) {
            const lastKeyIndex = keyPath.length - 1;
            for (const i = 0; i < lastKeyIndex; ++i) {
               const key = keyPath[i];
               if (!(key in obj)) {
                  obj[key] = {};
               }
               obj = obj[key];
            }
            obj[keyPath[lastKeyIndex]] = value;
         },

         _fromDataToValueObj: function (geotabData) {
            const diagName = me._locLib.idxIds[geotabData.diagnostic.id];
            const unitOfMeasure = me._locLib[diagName].unitOfMeasure;
            const valueObj = {};

            // Temperature conversions from Geotab default celcius to farenheit
            if (unitOfMeasure === "UnitOfMeasureDegreesCelsiusId") {
               valueObj.c = parseInt(geotabData.data);
               valueObj.f = me._celciusToFarenheit(parseInt(geotabData.data));
            }
            // Pressure conversions from Geotab default kPa to psi and bar
            else {
               const kpa = parseInt(geotabData.data) / 1000;
               valueObj.kpa = kpa;
               valueObj.psi = me._kpaToPsi(kpa);
               valueObj.bar = me._kpaToBa(kpa);
            }
            return valueObj;
         },

         _celciusToFarenheit: function (c) {
            return Math.round((c * 9 / 5 + 32) * 10) / 10; // Round to 1 decimal place;
         },

         _kpaToPsi: function (kpa) {
            return Math.round((kpa / 6.89475729) * 10) / 10;
         },

         _kpaToBa: function (kpa) {
            return Math.round((kpa / 100) * 10) / 10;
         },

         /**
         * _getLocFromGeotabData() Extract and store Axle/Tire loction in Object Db
         *
         * In "data" property;
         * - Axle is an increment of 1 of the HIGH order 4 bits in data byte
         *     e.g. In byte "0010 0011", 0010 or 2 + 1 = Axle 3
         * - Axle is an increment of 1 of the LOW order 4 bits in data byte
         *     e.g. In byte "0010 0011", 0011 or 3 + 1 = Tire 4
         *
         * @return {object} storing Axle/Tire loction
         */
         _getLocFromGeotabData: function (data) {
            return {
               axle: (data >> 4) + 1,
               tire: (data & 0b00001111) + 1,
            };
         },

         _extractZoneFromLoc: function (loc) {
            return loc.split("reefer temperature")[1].trim().replace("zone", "Zone");
         },

         _extractAxleFromLoc: function (loc) {
            return loc.split(":")[1].trim().replace("axle", "Axle").replace("tire", "Tire");
         },

         _getCompFromDiagName: function (diagName) {
            if (diagName.indexOf("railer 1") > -1) {
               return "trailer1";
            }
            else if (diagName.indexOf("railer 2") > -1) {
               return "trailer2";
            }
            else if (diagName.indexOf("railer 3") > -1) {
               return "trailer3";
            }
            else {
               return "tractor";
            }
         },

         _buildDiagIdLib: function () {
            return new Promise(resolve => {

               // Load DiagIDs from Browser local storage
               me._diagIdsLocalStorage.get().then((diagIDsStoreObj) => {
                  if (diagIDsStoreObj) {
                     console.log("--- buildDiagIdLib(): FOUND Vehicle Diagnostic ID Database");
                     me._locLib = diagIDsStoreObj;
                     resolve();
                  }
                  else {
                     const calls = [];
                     console.log("--- buildDiagIdLib(): Building Vehicle Diagnostic ID Database...");

                     // Build Get.Diagnostic API Call for each TPMS/TempTrac location
                     for (const comp of Object.keys(me._locLib.idxNames)) {
                        for (const loc of me._locLib.idxNames[comp]) {
                           calls.push(["Get", {
                              typeName: "Diagnostic",
                              search: {
                                 name: loc,
                                 diagnosticType: "GoDiagnostic"
                              }
                           }]);
                        }
                     }

                     // Invoke Get.Diagnostic API Calls
                     me._timer.a3 = new Date();
                     me._api.multiCall(calls,
                        function (results) {
                           if (results && results.length) {
                              for (const obj of results) {
                                 const res = obj[0];
                                 const diagName = res.name;
                                 const diagId = res.id;

                                 if (typeof me._locLib.idxIds[diagId] === "undefined") {
                                    me._locLib.idxIds[diagId] = diagName;
                                    me._locLib[diagName] = {
                                       loc: diagName,
                                       id: diagId,
                                       unitOfMeasure: res.unitOfMeasure,
                                       type: me._getCompFromDiagName(diagName),
                                    };
                                 }
                              }

                              // Save to Browser local storage
                              me._diagIdsLocalStorage.set(me._locLib);

                              // Done
                              me._timer.a4 = new Date();
                              console.log("--- buildDiagIdLib(): Built Vehicle Diagnostic ID Database - " + me._convertSecondsToHMS((me._timer.a4 - me._timer.a3) / 1000));
                              me._diagIdsLocalStorage.lockClear();
                           }
                           else {
                              console.log("--- buildDiagIdLib(): ERROR: EMPTY RESPONSE - " + me._convertSecondsToHMS((me._timer.a4 - me._timer.a3) / 1000));
                           }
                           resolve();
                        },
                        function (errorStr) {
                           me._timer.a4 = new Date();
                           console.log("--- buildDiagIdLib(): ERROR: Vehicle Diagnostic ID Database build failed - " + me._convertSecondsToHMS((me._timer.a4 - me._timer.a3) / 1000) + " - " + errorStr);
                           resolve();
                        });
                  }
               });
            });
         },

         _buildDiagIdDB: function () {
            if (!me._devComponents.idsLoaded && Object.keys(me._devComponents["diagIds"]["byName"]).length) {

               // Populate _devComponents.diagIds.byIds[] & _devComponents.deviceIds.byIds[] from _locLib
               Object.keys(me._devComponents["diagIds"]["byName"]).forEach(comp => {

                  // Build DiagId Reverse-Lookup Table
                  const diagName = me._devComponents["diagIds"]["byName"][comp];
                  if (typeof me._locLib[diagName] !== "undefined" && typeof me._locLib[diagName].id !== "undefined") {
                     me._devComponents["diagIds"]["byIds"][me._locLib[diagName].id] = comp;
                  }

                  // Build DeviceId Lookup Table
                  if (typeof me._devComponents["deviceIds"]["byName"][comp] !== "undefined" &&
                     typeof me._locLib[me._devComponents["deviceIds"]["byName"][comp]] !== "undefined" &&
                     typeof me._locLib[me._devComponents["deviceIds"]["byName"][comp]].id !== "undefined") {
                     me._devComponents["deviceIds"]["byIds"][comp] = me._locLib[me._devComponents["deviceIds"]["byName"][comp]].id;
                  }
               });

               // One-time Invoke callbacks waiting on _devComponents.*.byIds[]
               while (me._diagIdsLoadedCallbacks.length && (
                  Object.keys(me._devComponents["diagIds"]["byIds"]).length ||
                  Object.keys(me._devComponents["deviceIds"]["byIds"]).length
               )) {
                  const diagLoadedCallback = me._diagIdsLoadedCallbacks.pop();
                  diagLoadedCallback(me._devComponents);
               }
               me._devComponents.idsLoaded = true;
            }
         },

         _buildApiCall: async function (vehComps) {
            const calls = [];
            const vehCompStr = vehComps || me._devComponents.ids.split(",")[0]; // If undefined, only get tractor sensors

            await me._buildDiagIdLib();
            me._buildDiagIdDB();

            for (const comp of vehCompStr.split(",")) {
               for (const loc of me._locLib.idxNames[comp]) {
                  const diagId = me._locLib[loc].id;
                  calls.push(["Get", {
                     typeName: "StatusData",
                     search: {
                        fromDate: me._fromDate,
                        toDate: me._toDate,
                        deviceSearch: {
                           id: me._devId
                        },
                        diagnosticSearch: {
                           id: diagId
                        }
                     }
                  }]);
               }
            }
            return calls;
         },

         _convertSecondsToHMS: function (seconds) {
            const sec = Number(seconds);
            if (sec < 0.01) {
               return "< 0.01 seconds";
            }
            const h = Math.floor(sec / 3600);
            const m = Math.floor(sec % 3600 / 60);
            const s = Math.floor((sec % 3600 % 60) * 100) / 100;

            const hDisplay = h > 0 ? h + (h === 1 ? " hour" : " hours") : "";
            const mDisplay = m > 0 ? m + (m === 1 ? " minute" : " minutes") : "";
            const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";

            return hDisplay + (hDisplay && mDisplay ? ", " : "") + mDisplay + ((hDisplay || mDisplay) && sDisplay ? ", " : "") + sDisplay;
         },

         _diagIdsLocalStorage: {

            /**
             *  Private Variables
             */
            _lockSuffix: "_lock",
            _lockPollingTime: 1000,   // Time to wait before polling for lock removal
            _lockPollingAttempts: 20, // Amount of attempts to check for lock removal
            _lockTimerCounter: 0,

            /**
             *  Gets data from localStorage
             *  - With lock protection for multiple Async calls to data in local Storage
             *
             *  @returns {*} An object with a property as JS object
             */
            get: async function () {
               const my = this;
               const storageData = my.parseJSON(localStorage.getItem(me._diagIdsLocalStorageKeyName));
               const storageObj = my.validateData(storageData);
               if (storageObj) {
                  return storageObj;
               }
               // Check if lock is SET. If yes, poll until results appear or polling expires
               else if (my.isLockSet()) {
                  await my.lockPoll();
                  const storageData = my.parseJSON(localStorage.getItem(me._diagIdsLocalStorageKeyName));
                  const storageObj = my.validateData(storageData);
                  return storageObj;
               }
               // No Data and Lock is NOT SET, so set it while data is retrieved
               else {
                  my.lockSet();
                  return storageObj;
               }
            },

            validateData: function (storageData) {
               const now = moment().utc().unix();
               let storageObj = null;
               if (storageData) {
                  if (typeof storageData.ver !== "undefined" && typeof storageData.expiry !== "undefined" &&
                     storageData.ver === me._diagIdsLocalStorageVersion && storageData.expiry > now) {
                     storageObj = storageData;
                  }
               }
               return storageObj;
            },

            /**
             *  Saves data into localStorage
             *  @param {data} data The data object
             */
            set: function (storageData) {

               // Set Version
               if (!storageData || typeof storageData.idxNames === "undefined") {
                  return;
               }
               else if (typeof storageData.ver === "undefined") {
                  storageData.ver = me._diagIdsLocalStorageVersion;
               }

               // Set timestamp of Expiry of this local Storage object
               storageData.expiry = moment().utc().add(me._diagIdsLocalStorageAge, "seconds").unix();

               // Attempt to Save Remotely
               localStorage.setItem(me._diagIdsLocalStorageKeyName, JSON.stringify(storageData));
            },

            parseJSON: function (raw) {
               let json = "";
               try {
                  json = JSON.parse(raw);
               } catch (e) {
                  // Malformed JSON
                  return null;
               }
               return json;
            },

            /**
             *  Routines for managing a Semaphore Lock in memory
             *  - Preventing multiple Async calls from performing expensive data fetching operation from Geotab API
             */

            isLockSet: function () {
               const my = this;
               const lockLocalStorageKeyName = me._diagIdsLocalStorageKeyName + my._lockSuffix;
               const lockStartUnix = typeof window[lockLocalStorageKeyName] === "undefined" ? null : window[lockLocalStorageKeyName];
               return lockStartUnix ? true : false;
            },

            lockSet: function () {
               const my = this;
               const lockLocalStorageKeyName = me._diagIdsLocalStorageKeyName + my._lockSuffix;
               window[lockLocalStorageKeyName] = moment().utc().unix();
            },

            lockClear: function () {
               const my = this;
               const lockLocalStorageKeyName = me._diagIdsLocalStorageKeyName + my._lockSuffix;
               delete window[lockLocalStorageKeyName];
            },

            lockPoll: async function () {
               const my = this;
               my._lockTimerCounter = my._lockPollingAttempts;
               await (async function Main() {
                  while (my._lockTimerCounter) {
                     await my.lockPollWait();
                     if (!my.isLockSet()) {
                        break;
                     }
                     my._lockTimerCounter--;
                  }
               })();
            },

            lockPollWait: function () {
               const my = this;
               return new Promise((resolve) => {
                  setTimeout(() => {
                     resolve();
                  }, my._lockPollingTime);
               });
            }
         },

         _locLib: {
            idxNames: {
               tractor: [
                  "Peripheral device: reefer temperature zone 4",
                  "Peripheral device: reefer temperature zone 2",
                  "Peripheral device: reefer temperature zone 3",
                  "Peripheral device: reefer temperature zone 1",
                  "Tire temperature: axle 4 tire 2",
                  "Tire temperature: axle 4 tire 1",
                  "Tire temperature: axle 2 tire 2",
                  "Tire temperature: axle 5 tire 1",
                  "Tire temperature: axle 8 tire 2",
                  "Tire temperature: axle 14 tire 3",
                  "Tire temperature: axle 15 tire 4",
                  "Tire temperature: axle 8 tire 3",
                  "Tire temperature: axle 10 tire 2",
                  "Tire temperature: axle 5 tire 3",
                  "Tire temperature: axle 10 tire 3",
                  "Tire temperature: axle 5 tire 2",
                  "Tire temperature: axle 13 tire 1",
                  "Tire temperature: axle 7 tire 2",
                  "Tire temperature: axle 7 tire 4",
                  "Tire temperature: axle 11 tire 3",
                  "Tire temperature: axle 14 tire 2",
                  "Tire temperature: axle 6 tire 1",
                  "Tire temperature: axle 9 tire 1",
                  "Tire temperature: axle 9 tire 2",
                  "Tire temperature: axle 9 tire 4",
                  "Tire temperature: axle 3 tire 4",
                  "Tire temperature: axle 5 tire 4",
                  "Tire temperature: axle 10 tire 1",
                  "Tire temperature: axle 7 tire 1",
                  "Tire temperature: axle 3 tire 2",
                  "Tire temperature: axle 11 tire 1",
                  "Tire temperature: axle 12 tire 4",
                  "Tire temperature: axle 15 tire 2",
                  "Tire temperature: axle 4 tire 4",
                  "Tire temperature: axle 2 tire 4",
                  "Tire temperature: axle 13 tire 3",
                  "Tire temperature: axle 8 tire 4",
                  "Tire temperature: axle 11 tire 2",
                  "Tire temperature: axle 6 tire 3",
                  "Tire temperature: axle 13 tire 4",
                  "Tire temperature: axle 1 tire 2",
                  "Tire temperature: axle 3 tire 1",
                  "Tire temperature: axle 9 tire 3",
                  "Tire temperature: axle 12 tire 3",
                  "Tire temperature: axle 13 tire 2",
                  "Tire temperature: axle 1 tire 1",
                  "Tire temperature: axle 1 tire 3",
                  "Tire temperature: axle 6 tire 2",
                  "Tire temperature: axle 12 tire 1",
                  "Tire temperature: axle 3 tire 3",
                  "Tire temperature: axle 12 tire 2",
                  "Tire temperature: axle 11 tire 4",
                  "Tire temperature: axle 8 tire 1",
                  "Tire temperature: axle 2 tire 1",
                  "Tire temperature: axle 7 tire 3",
                  "Tire temperature: axle 6 tire 4",
                  "Tire temperature: axle 15 tire 1",
                  "Tire temperature: axle 14 tire 1",
                  "Tire temperature: axle 2 tire 3",
                  "Tire temperature: axle 15 tire 3",
                  "Tire temperature: axle 4 tire 3",
                  "Tire temperature: axle 14 tire 4",
                  "Tire temperature: axle 1 tire 4",
                  "Tire temperature: axle 10 tire 4",
                  "Tire pressure: axle 15 tire 2",
                  "Tire pressure: axle 5 tire 3",
                  "Tire pressure: axle 1 tire 3",
                  "Tire pressure: axle 13 tire 1",
                  "Tire pressure: axle 14 tire 4",
                  "Tire pressure: axle 1 tire 4",
                  "Tire pressure: axle 10 tire 4",
                  "Tire pressure: axle 6 tire 3",
                  "Tire pressure: axle 2 tire 4",
                  "Tire pressure: axle 11 tire 3",
                  "Tire pressure: axle 5 tire 2",
                  "Tire pressure: axle 9 tire 4",
                  "Tire pressure: axle 13 tire 4",
                  "Tire pressure: axle 7 tire 4",
                  "Tire pressure: axle 13 tire 2",
                  "Tire pressure: axle 15 tire 4",
                  "Tire pressure: axle 4 tire 3",
                  "Tire pressure: axle 3 tire 4",
                  "Tire pressure: axle 3 tire 1",
                  "Tire pressure: axle 12 tire 1",
                  "Tire pressure: axle 7 tire 1",
                  "Tire pressure: axle 2 tire 1",
                  "Tire pressure: axle 6 tire 4",
                  "Tire pressure: axle 1 tire 2",
                  "Tire pressure: axle 5 tire 4",
                  "Tire pressure: axle 3 tire 2",
                  "Tire pressure: axle 12 tire 4",
                  "Tire pressure: axle 10 tire 1",
                  "Tire pressure: axle 8 tire 3",
                  "Tire pressure: axle 8 tire 2",
                  "Tire pressure: axle 11 tire 4",
                  "Tire pressure: axle 12 tire 3",
                  "Tire pressure: axle 6 tire 1",
                  "Tire pressure: axle 11 tire 2",
                  "Tire pressure: axle 6 tire 2",
                  "Tire pressure: axle 2 tire 2",
                  "Tire pressure: axle 5 tire 1",
                  "Tire pressure: axle 15 tire 1",
                  "Tire pressure: axle 15 tire 3",
                  "Tire pressure: axle 12 tire 2",
                  "Tire pressure: axle 9 tire 3",
                  "Tire pressure: axle 10 tire 3",
                  "Tire pressure: axle 9 tire 2",
                  "Tire pressure: axle 4 tire 2",
                  "Tire pressure: axle 14 tire 2",
                  "Tire pressure: axle 9 tire 1",
                  "Tire pressure: axle 11 tire 1",
                  "Tire pressure: axle 4 tire 4",
                  "Tire pressure: axle 7 tire 3",
                  "Tire pressure: axle 8 tire 1",
                  "Tire pressure: axle 3 tire 3",
                  "Tire pressure: axle 13 tire 3",
                  "Tire pressure: axle 2 tire 3",
                  "Tire pressure: axle 4 tire 1",
                  "Tire pressure: axle 10 tire 2",
                  "Tire pressure: axle 7 tire 2",
                  "Tire pressure: axle 14 tire 1",
                  "Tire pressure: axle 14 tire 3",
                  "Tire pressure: axle 8 tire 4",
                  "Tire pressure: axle 1 tire 1",
                  "Peripheral device: tractor ID",
                  "Tractor tire location"
               ],

               trailer1: [
                  "Peripheral device tire temperature: trailer 1 axle 4 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 3 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 4 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 2 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 4 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 5 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 1 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 5 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 2 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 1 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 6 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 2 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 6 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 2 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 1 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 1 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 5 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 5 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 3 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 3 tire 4",
                  "Peripheral device tire temperature: trailer 1 axle 6 tire 3",
                  "Peripheral device tire temperature: trailer 1 axle 3 tire 1",
                  "Peripheral device tire temperature: trailer 1 axle 4 tire 2",
                  "Peripheral device tire temperature: trailer 1 axle 6 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 4 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 1 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 5 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 1 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 2 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 1 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 3 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 5 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 6 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 3 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 4 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 6 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 5 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 1 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 2 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 5 tire 3",
                  "Peripheral device tire pressure: trailer 1 axle 3 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 2 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 6 tire 4",
                  "Peripheral device tire pressure: trailer 1 axle 6 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 2 tire 2",
                  "Peripheral device tire pressure: trailer 1 axle 4 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 3 tire 1",
                  "Peripheral device tire pressure: trailer 1 axle 4 tire 2",
                  "Peripheral device: trailer 1 ID",
                  "Trailer 1 tire location"
               ],

               trailer2: [
                  "Peripheral device tire temperature: trailer 2 axle 5 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 3 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 4 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 6 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 2 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 1 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 2 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 3 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 3 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 6 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 1 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 2 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 4 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 6 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 1 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 6 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 3 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 5 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 4 tire 3",
                  "Peripheral device tire temperature: trailer 2 axle 2 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 5 tire 2",
                  "Peripheral device tire temperature: trailer 2 axle 4 tire 4",
                  "Peripheral device tire temperature: trailer 2 axle 1 tire 1",
                  "Peripheral device tire temperature: trailer 2 axle 5 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 3 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 5 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 2 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 4 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 5 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 6 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 5 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 1 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 1 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 4 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 1 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 2 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 3 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 6 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 4 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 6 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 3 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 2 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 5 tire 2",
                  "Peripheral device tire pressure: trailer 2 axle 4 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 2 tire 1",
                  "Peripheral device tire pressure: trailer 2 axle 1 tire 4",
                  "Peripheral device tire pressure: trailer 2 axle 3 tire 3",
                  "Peripheral device tire pressure: trailer 2 axle 6 tire 1",
                  "Peripheral device: trailer 2 ID",
                  "Trailer 2 tire location"
               ],

               trailer3: [
                  "Peripheral device tire temperature: trailer 3 axle 1 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 5 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 3 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 2 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 5 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 2 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 3 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 1 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 5 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 6 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 3 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 6 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 3 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 5 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 6 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 4 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 4 tire 4",
                  "Peripheral device tire temperature: trailer 3 axle 1 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 2 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 6 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 2 tire 2",
                  "Peripheral device tire temperature: trailer 3 axle 4 tire 1",
                  "Peripheral device tire temperature: trailer 3 axle 4 tire 3",
                  "Peripheral device tire temperature: trailer 3 axle 1 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 6 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 1 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 4 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 3 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 4 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 1 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 5 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 6 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 5 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 2 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 5 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 1 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 4 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 2 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 4 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 2 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 3 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 1 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 5 tire 2",
                  "Peripheral device tire pressure: trailer 3 axle 3 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 2 tire 3",
                  "Peripheral device tire pressure: trailer 3 axle 6 tire 1",
                  "Peripheral device tire pressure: trailer 3 axle 6 tire 4",
                  "Peripheral device tire pressure: trailer 3 axle 3 tire 1",
                  "Peripheral device: trailer 3 ID",
                  "Trailer 3 tire location"
               ],
            },
            idxIds: {}
         }
      };
      return me;
   }.bind(this)();
}