/* eslint-disable one-var */
import moment from "moment-timezone";
import { endWith } from "rxjs/operators";

const SpartanLyncServices = {

   /**
    *  Settings
    */

   debug: false,                                            // Enable detailed debugging to Console on API calls
   devDomain: "geotab.local",                               // Domain for local development
   appRootId: "#real-time-map-container",                   // Id in DOM of root App Element

   splHumanTimeFormat: "dd MMM DD, YYYY LT z",              // moment() format for converting from UNIX timestamp to Human format in User's Timezone
   splStoreSyncRetry: 60000,                                // (Default: 1 min) How frequently to retry saving storage object to remote server

   sensorDataLifetime: 180,                                 // (Default: 180 seconds) Afer this period, cached vehicle sensor data is refreshed from API (in seconds)
   sensorDataNotFoundMsg: "No Sensors Found",               // Message shows when no SpartanLync sensors were found for a vehicle search
   onErrorCloseUIDelay: 10,                                  // (In seconds) How many seconds to delay before closing Sensor Data Window showing error message

   sensorSearchRetryRangeInDays: [1, 2, 7, 30, 60, 90],     // Days from now to search for sensors (on App Start)
   sensorSearchTimeRangeForRepeatSearchesInSeconds: 3600,   // (Default: 1 Hour) 3600 Seconds from now to use for repeating sensor search's

   faultSearchRetryRangeInDays: [30, 60, 90],               // Days from now to search for faults (on App Start)
   faultSearchTimeRangeForRepeatSearchesInSeconds: 3600,    // 3600 Seconds from now to use for repeating fault search's (default: 1 Hour)

   splToolsSearchRetry: 60000,                              // (Default: 1 min) How often to poll backend for SplTools Add-In configured for this user in this database

   alertsDefaultStartupDelay: 8,                            // (Default: 8 seconds) UI will start showing alerts XX seconds after App loads in Browser

   addInJSONName: "SpartanLync Map",                        // Name of this Add-In within SystemSettings in MyGeotab Database
   buildMetadataFilename: "build.meta",                     // Filename residing in deployment directory containg build metadata, shown when hovering over SpartanLync Map Watermark

   mapFaultLayerName: "splFaultsLayer",                     // Name of leaflet Layer Group containing all SpartanLync Fault polyline objects

   defaultLanguage: "en",                                   // This property will be overridden by user.language in MyGeotab, then by in lang setting in SplTools
   supportedLanguages: {                                    // Languages supported by SpartanLync Map
      "en": "English",
      "fr": "Fran&#231;ais",
      "es": "Espa&#241;ol"
   },

   vehCompDb: {},
   vehCompTr: {                                         // Id/Description/TranslationCodes for supported Vehicles components
      "toEn": {
         "tractor": "Tractor",
         "trailer1": "Trailer 1",
         "trailer2": "Dolly",
         "trailer3": "Trailer 2"
      },
      "toTr": {
         "tractor": "veh_comp_tractor",
         "trailer1": "veh_comp_trailer1",
         "trailer2": "veh_comp_dolly",
         "trailer3": "veh_comp_trailer2"
      }
   },

   splDeeperAddIn: {                                         // Widget Configuration Settings for the MyGeotab Map SpartanLync Deeper Add-In
      name: "SplGeotabMap",
      json: "{\"name\":\"SplGeotabMap\",\"supportEmail\":\"lmitchell@spartanlync.com\",\"version\":\"1.0.1.01\",\"items\":[{\"page\":\"map\",\"mapScript\":{\"url\":\"https://help.spartansense.com/geotab/splgeotabmap/splgeotabmap.html\"}}],\"isSigned\":false}",
   },


   /**
    *  Private Variables
    */

   sessionMgr: null,
   goLibCreatorFunc: null,
   sdataTools: null,

   runningOnSpartanLyncDomain: false,

   state: null,
   _api: null,
   _credentials: {
      db: "",
      username: "",
      server: "",
      sessionId: "",
   },

   _pendingFlyingEvent: false,
   _splToolsInstalled: false,
   _splStore: null,
   _splMapUrl: null,
   _dbDeviceIds: null,
   _timeZone: null,
   _splStore: null,

   /**
    * Cache for Vehicle Fault and Ignition data
    */
   cache: {

      _faultCache: {},
      _ignitionCache: {},

      getFaultData: function (vehId) {
         const me = this;
         if (typeof me._faultCache[vehId] !== "undefined") {
            const fdataArr = [];
            for (const faultId in me._faultCache[vehId]) {
               fdataArr.push(me._faultCache[vehId][faultId]);
            }
            return fdataArr;
         }
         return null;
      },

      storeFaultData: function (vehId, data, quiet) {
         const me = this;
         if (typeof data !== "undefined" && data !== null && Array.isArray(data) && data.length) {

            if (typeof me._faultCache[vehId] === "undefined") {
               me._faultCache[vehId] = {};
            }
            let newOrUpdatedFaultCount = 0;

            // Update fault data cache with individual updates for each fault
            for (const faultObj of data) {
               const faultId = "fault_" + faultObj.id;
               if (typeof me._faultCache[vehId][faultId] === "undefined") {
                  me._faultCache[vehId][faultId] = {};
               }
               if (typeof me._faultCache[vehId][faultId].time === "undefined" || faultObj.time > me._faultCache[vehId][faultId].time) {

                  // Exclude "Sensor Fault" Types / "Missing Sensor" Fault from cache
                  if (typeof faultObj.alert !== "undefined" && typeof faultObj.alert.type !== "undefined" &&
                     faultObj.alert.type === "Sensor Fault") {
                     delete me._faultCache[vehId][faultId];
                     continue;
                  }
                  if (typeof faultObj.alert !== "undefined" &&
                     typeof faultObj.occurredOnLatestIgnition !== "undefined" &&
                     faultObj.occurredOnLatestIgnition) {
                     newOrUpdatedFaultCount++;
                  }
                  me._faultCache[vehId][faultId] = faultObj;
               }
            }
            if (typeof quiet !== "undefined" && quiet === true) { return; }
            if (newOrUpdatedFaultCount) {
               console.log("VehicleID [ " + vehId + " ]: [" + newOrUpdatedFaultCount + "] New Post-Ignition SpartanLync TPMS FAULTS FOUND or UPDATED after the last search.");
            }
            else {
               console.log("VehicleID [ " + vehId + " ]: NO New Post-Ignition SpartanLync TPMS FAULT DATA FOUND for this date range!");
            }
         }
      },

      isFaultFound: function (data) {
         if (typeof data !== "undefined" && data !== null && Array.isArray(data) && data.length) {
            for (const faultObj of data) {
               if (typeof faultObj.alert !== "undefined" &&
                  typeof faultObj.occurredOnLatestIgnition !== "undefined" &&
                  faultObj.occurredOnLatestIgnition) {
                  return true;
               }
            }
         }
         return false;
      },

      getIgnVehIDs: function () {
         const me = this;
         return Object.keys(me._ignitionCache);
      },

      getIgnData: function (vehId) {
         const me = this;
         if (typeof me._ignitionCache[vehId] !== "undefined") {
            return me._ignitionCache[vehId];
         }
         return null;
      },

      storeIgnData: function (vehId, data) {
         const me = this;
         if (typeof data !== "undefined" &&
            data !== null &&
            typeof data === "object" &&
            typeof data["on-latest"] !== "undefined") {

            // Create ignition data cache
            if (typeof me._ignitionCache[vehId] === "undefined" ||
               typeof me._ignitionCache[vehId]["on-latest"] === "undefined" ||
               typeof me._ignitionCache[vehId]["off-latest"] === "undefined") {
               me._ignitionCache[vehId] = data;
            }
            // Merge new data into ignition data cache
            else {
               me._ignitionCache[vehId]["on-latest"] = data["on-latest"] > me._ignitionCache[vehId]["on-latest"] ? data["on-latest"] : me._ignitionCache[vehId]["on-latest"];
               me._ignitionCache[vehId]["off-latest"] = data["off-latest"] > me._ignitionCache[vehId]["off-latest"] ? data["off-latest"] : me._ignitionCache[vehId]["off-latest"];
               me._ignitionCache[vehId]["byTime"] = { ...me._ignitionCache[vehId]["byTime"], ...data["byTime"] };
               me._ignitionCache[vehId]["on"].push(...data["on"]);
               me._ignitionCache[vehId]["off"].push(...data["off"]);
            }
         }
      },

      updateFaultStatusUsingIgnData: function (vehId) {
         const me = this;
         if (typeof vehId !== "undefined" && vehId !== null &&
            typeof me._ignitionCache !== "undefined" && me._ignitionCache !== null &&
            typeof me._ignitionCache[vehId] !== "undefined" && typeof me._ignitionCache === "object" &&
            typeof me._faultCache !== "undefined" && me._faultCache !== null && typeof me._faultCache[vehId] !== "undefined" &&
            typeof me._faultCache[vehId] === "object" && Object.keys(me._faultCache[vehId]).length &&
            typeof me._ignitionCache[vehId]["on-latest"] !== "undefined" && me._ignitionCache[vehId]["on-latest"]
         ) {
            for (const faultId in me._faultCache[vehId]) {
               me._faultCache[vehId][faultId].occurredOnLatestIgnition =
                  (
                     typeof me._faultCache[vehId][faultId].time !== "undefined" &&
                     me._faultCache[vehId][faultId].time >= me._ignitionCache[vehId]["on-latest"]
                  ) ? true : false;
            }
         }
      }
   },

   /**
    * Methods that track when a Vehicle loading operation in configuration panel is occuring
    * and retrieve its instance as requested
    */

   vehRegistry: {

      _objList: {},

      loadingBegin: function (vehId, vehObj) {
         const me = this;
         if (vehId && vehObj && typeof me._objList[vehId] === "undefined") {
            me._objList[vehId] = vehObj;
            me._objList[vehId].loading = moment().unix();
         }
      },
      loadingEnd: function (vehId) {
         const me = this;
         if (vehId && typeof me._objList[vehId] !== "undefined" && typeof me._objList[vehId].loading !== "undefined") {
            delete me._objList[vehId].loading;
         }
      },
      isLoading: function (vehId) {
         const me = this;
         const isLoading = vehId && typeof me._objList[vehId] !== "undefined" && typeof me._objList[vehId].loading !== "undefined" ? true : false;
         return isLoading;
      },
      close: function (vehId) {
         const me = this;
         if (vehId && typeof me._objList[vehId] !== "undefined") {
            delete me._objList[vehId];
         }
      },
      getVeh: function (vehId) {
         const me = this;
         if (vehId && typeof me._objList[vehId] !== "undefined") {
            return me._objList[vehId];
         }
         return null;
      }
   },

   /**
    *  Getters/Setters for _splStore
    */
   get splStore() {
      const me = this;
      return me._splStore;
   },
   set splStore(store) {
      const me = this;
      me._splStore = store;

      // Set timestamp of local Storage object to NOW
      me._splStore.timestamp = moment().format();

      // Save Remotely
      me.sessionMgr.syncSettings(me._splStore, me._dbDeviceIds,
         (accepted) => {
            // If accepted by Remote, remoteStore = localStore
            // If rejected by Remote, remoteStore should be saved to local browser
            if (accepted) {
               console.log("SplMapService: Successfully updated SplStore Remotely");
            }
            else {
               const retryTimeoutInSeconds = parseInt(me.splStoreSyncRetry / 1000);
               console.log("SplMapService: Failed to updated SplStore remotely...Will Retry in " + retryTimeoutInSeconds + " seconds");
               setTimeout(function () {
                  me.splStore = me._splStore;
               }, me.splStoreSyncRetry);
            }
         },
         // Error Handler
         (errMsg) => {
            console.log("SplMapService: Failed to updated SplStore remotely...Reason: " + errMsg);
         });
   },

   /**
    * Register callbacks to event(s) and execute those callbacks when event(s) occur
    */
   events: {

      _events: {},
      _queue: {},

      /**
      * Register callbacks to event array
      *
      * @param {string}   event        - Name of Event (Required)
      * @param {function} callback     - Callback executed when this event occurs
      * @param {boolean}  execOnceOnly - Execute Callback once, then remove from Event Array (Optional - Default: true)
      * @param {string}   vehicleId    - Required VehicleId parameter when executed by queueExec() method
      *
      * @returns EventId (for Event callback deletion)
      */
      register: function (event, callback, execOnceOnly, vehicleId) {
         const me = this;
         const execOneTime = typeof execOnceOnly !== "undefined" && execOnceOnly === false ? false : true;
         const vehId = typeof vehicleId !== "undefined" && vehicleId ? vehicleId : null;
         const evtId = moment().unix() + "_" + Math.random().toString(36).substring(7);

         if (event !== null && typeof event !== "undefined" && typeof callback === "function") {

            // If in Queue, execute it
            if (vehId && typeof me._queue[event] !== "undefined" && typeof me._queue[event][vehId] !== "undefined") {
               const params = me._queue[event][vehId];
               callback(vehId, ...params);
               delete me._queue[event][vehId];
               if (execOneTime) { return null; } // Do not register on event, as it's already been executed
            }

            // Now proceed with registration
            if (typeof me._events[event] === "undefined") {
               me._events[event] = [{
                  id: evtId,
                  func: callback,
                  execOnce: execOneTime,
                  vehId: vehId
               }];
               return evtId;
            }
            else {
               me._events[event].push({
                  id: evtId,
                  func: callback,
                  execOnce: execOneTime,
                  vehId: vehId
               });
               return evtId;
            }
         }
      },

      /**
      * Execute registered callbacks (if any) on a event(s) array
      *
      * @param {string} event - Name of Event Array to execute stored callbacks (Required)
      * @param {array} params - parameters passed to callbacks (Optional)
      *
      * @returns void
      */
      exec: function (event, ...params) {
         const me = this;
         if (event !== null &&
            typeof event !== "undefined" &&
            typeof me._events[event] !== "undefined" &&
            Array.isArray(me._events[event]) &&
            me._events[event].length
         ) {
            me._events[event] = me._events[event].filter((callee) => {
               if (typeof callee.func === "function") {
                  callee.func(...params);
               }
               return !callee.execOnce;
            });
         }
      },

      /**
      * Execute registered per-vehicle callbacks in event(s) array.
      * If vehicle registration not found, queue it for anticipiated future registration
      *
      * Use clearQueue() method to clear the queued callbacks
      *
      * @param {string} event - Name of Event Array to execute stored callbacks (Required)
      * @param {string} vehId - Events registered and executed by VehicleId (Required)
      * @param {array} params - parameters passed to callbacks (Optional)
      *
      * @returns void
      */
      queueExec: function (event, vehId, ...params) {
         const me = this;
         if (event && vehId) {
            // If Event registered to this vehicle, execute it
            if (typeof me._events[event] !== "undefined" && me.findVehIdInEvent(event, vehId)) {
               me._events[event] = me._events[event].filter((callee) => {
                  if (callee.vehId && callee.vehId === vehId) {
                     if (typeof callee.func === "function") {
                        params.unshift(vehId);
                        callee.func(...params);
                     }
                     return !callee.execOnce;
                  }
                  return true;
               });
            }
            // Otherwise queue it, for future
            else {
               if (typeof me._queue[event] === "undefined") { me._queue[event] = {}; }
               params.unshift(vehId);
               me._queue[event][vehId] = params;
            }
         }
      },

      /**
      * Search Events for specific VehicleId
      *
      * @param {string} event - Name of Event Array to search
      * @param {string} vehId - VehicleId to find
      *
      * @returns boolean
      */
      findVehIdInEvent: function (event, vehId) {
         const me = this;
         if (event && vehId && typeof me._events[event] !== "undefined" &&
            Array.isArray(me._events[event]) && me._events[event].length) {
            for (const evtObj of me._events[event]) {
               if (evtObj && evtObj.vehId && evtObj.vehId === vehId) {
                  return true;
               }
            }
         }
         return false;
      },

      /**
      * Clear queue of all vehicles assigned to event
      *
      * @param {string} event - Name of Event Queue to clear
      *
      * @returns void
      */
      queueClear: function (event) {
         const me = this;
         if (typeof me._queue[event] !== "undefined") {
            if (typeof me._events[event] !== "undefined") {
               delete me._events[event];
            }
            delete me._queue[event];
         }
      },

      /**
      * Delete callback from event(s) array using specified EventId
      *
      * @param {string} event - Name of Event Array to execute stored callbacks (Required)
      * @param {int}    evtId - Id of callback in Event Array to delete (Required)
      *
      * @returns void
      */
      delete: function (event, evtId) {
         const me = this;
         if (event !== null &&
            typeof event !== "undefined" &&
            typeof me._events[event] !== "undefined" &&
            Array.isArray(me._events[event]) &&
            me._events[event].length &&
            typeof evtId !== "undefined" && evtId !== null && evtId
         ) {
            me._events[event] = me._events[event].filter((callee) => {
               if (callee.id === evtId) {
                  return false;
               }
               return true;
            });
         }
      }
   },

   /**
    * Convert from Unix timestamp to Human-readable time
    * eg. Sa Aug 17, 2020 7:00 PM EDT
    *
    *  @returns string
    */
   convertUnixToTzHuman: function (unixTime) {
      const me = this;
      return isNaN(unixTime) ? null : moment.unix(unixTime).format(me.splHumanTimeFormat);
   }
};

export default SpartanLyncServices;