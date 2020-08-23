/* eslint-disable one-var */
import moment from "moment-timezone";

const SpartanLyncServices = {

   /**
    *  Settings
    */

   debug: false,                                            // Enable detailed debugging to Console on API calls
   devDomain: "geotab.local",                               // Domain for local development

   splHumanTimeFormat: "dd MMM DD, YYYY LT z",              // moment() format for converting from UNIX timestamp to Human format in User's Timezone
   splStoreSyncRetry: 60000,                                // (Default: 1 min) How frequently to retry saving storage object to remote server

   sensorDataLifetime: 180,                                 // (Default: 180 seconds) Afer this period, cached vehicle sensor data is refreshed from API (in seconds)
   sensorDataNotFoundMsg: "No Sensors Found",               // Message shows when no SpartanLync sensors were found for a vehicle search
   onErrorCloseUIDelay: 5,                                  // (In seconds) How many seconds to delay before closing Sensor Data Window showing error message

   sensorSearchRetryRangeInDays: [1, 2, 7, 30, 60, 90],     // Days from now to search for sensors (on App Start)
   sensorSearchTimeRangeForRepeatSearchesInSeconds: 3600,   // (Default: 1 Hour) 3600 Seconds from now to use for repeating sensor search's

   splToolsSearchRetry: 60000,                              // (Default: 1 min) How often to poll backend for SplTools Add-In configured for this user in this database

   alertsDefaultStartupDelay: 8,                            // (Default: 8 seconds) UI will start showing alerts XX seconds after App loads in Browser

   addInJSONName: "SpartanLync Map",                        // Name of this Add-In within SystemSettings in MyGeotab Database
   buildMetadataFilename: "build.meta",                     // Filename residing in deployment directory containg build metadata, shown when hovering over SpartanLync Map Watermark

   defaultLanguage: "en",                                   // This property will be overridden by user.language in MyGeotab, then by in lang setting in SplTools
   supportedLanguages: {                                    // Languages supported by SpartanLync Map
      "en": "English",
      "fr": "Fran&#231;ais",
      "es": "Espa&#241;ol"
   },

   vehComponents: {                                         // Id/Description/TranslationCodes for supported Vehicles components
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
   goLib: null,
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

   _splToolsInstalled: false,
   _splStore: null,
   _splMapUrl: null,
   _dbDeviceIds: null,
   _timeZone: null,

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
      me._splStore.timestamp = moment().utc().format();

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

      /**
      * Register callbacks to event array
      *
      * @param {string}   event        - Name of Event (Required)
      * @param {function} callback     - Callback executed when this event occurs
      * @param {boolean}  execOnceOnly - Execute Callback once, then remove from Event Array (Optional - Default: true)
      *
      * @returns void
      */
      register: function (event, callback, execOnceOnly) {
         const me = this;
         const execOneTime = typeof execOnceOnly !== "undefined" && execOnceOnly === false ? false : true;

         if (event !== null && typeof event !== "undefined" && typeof callback === "function") {
            if (typeof me._events[event] === "undefined") {
               me._events[event] = [{
                  func: callback,
                  execOnce: execOneTime
               }];
            }
            else {
               me._events[event].push({
                  func: callback,
                  execOnce: execOneTime
               });
            }
         }
      },

      /**
      * Invoke registered callbacks (if any) on a event(s) array
      *
      * @param {string} event - Name of Event Array to execute stored callbacks (Required)
      *
      * @returns void
      */
      exec: function (event) {
         const me = this;
         if (event !== null &&
            typeof event !== "undefined" &&
            typeof me._events[event] !== "undefined" &&
            Array.isArray(me._events[event]) &&
            me._events[event].length
         ) {
            me._events[event] = me._events[event].filter((callee) => {
               if (typeof callee.func === "function") {
                  callee.func();
               }
               return !callee.execOnce;
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
   },

   /**
   *
   * Handler for dynamically-loaded elements on config-panel-tabs that need Translation
   *
   */
   trOnElementLoad: function () {
      const me = {
         _parent: this,

         _appRootId: "#real-time-map-container",
         _appRootElemObj: null,

         _imgClass: "img.loader",

         _tabs: {
            "vehicle": {
               "tabRootSelector": "#VehicleList",
               "tabRootObj": null,
            },
            "status": {
               "tabRootSelector": "#StatusList",
               "tabRootObj": null,
            },
            "exception": {
               "tabRootSelector": "#ExceptionsList",
               "tabRootObj": null,
            },
         },


         _init: function () {
            me._appRootElemObj = document.querySelector(me._appRootId);
            for (const tab in me._tabs) {
               const tabDb = me._tabs[tab];
               tabDb.tabRootObj = me._appRootElemObj.querySelector(tabDb.tabRootSelector);
            }
         },

         _delImg: function (tab) {
            if (!me._appRootElemObj) {
               me._init();
            }
            const tabInfo = me._tabs[tab];
            tabInfo.tabRootObj.querySelectorAll(me._imgClass).forEach((imgElemObj) => {
               imgElemObj.parentNode.removeChild(imgElemObj);
            });
         },

         vehicle: function () {
            me._delImg("vehicle");
            splmap.onChangeReTrDom(me._tabs["vehicle"].tabRootSelector);
         },

         status: function () {
            me._delImg("status");
            splmap.onChangeReTrDom(me._tabs["status"].tabRootSelector);
         },

         exception: function () {
            me._delImg("exception");
            splmap.onChangeReTrDom(me._tabs["exception"].tabRootSelector);
         }
      };
      return me;
   }.bind(this)(this),

   /**
    * Language Translation Tools
    *
    *  @returns void
    */
   tr: function () {
      const me = {
         _parent: this,
         _appRootId: "#real-time-map-container",

         _appInit: true,
         _appRootElemObj: null,

         _postDomLoaded: false,

         _langDB: null,
         _toLang: null,

         _autoTrSelectorTranslated: [],
         _autoTrSelectorArr: [
            "#RTM-LiveButton | splmap_controlspanel_label_live",
            "#RTM-ControlsContainer #speedLabel label | splmap_controlspanel_label_speed",
            "#RTM-ControlsContainer .inputControls label | splmap_controlspanel_label_date",
            "#RTM-ControlsContainer .inputControls label | splmap_controlspanel_label_time_start",
            "#RTM-ControlsContainer .inputControls label | splmap_controlspanel_label_time_current",

            "#timeControls .RTM-pauseIcon [data-tip] | splmap_controlspanel_tooltip_pause",
            "#SpeedControlDropUp [data-tip] | splmap_controlspanel_label_speed_tooltip",
            "#RTM-Map .leaflet-control-zoom .leaflet-control-zoom-in [title] | splmap_map_zoom_in",
            "#RTM-Map .leaflet-control-zoom .leaflet-control-zoom-out [title] | splmap_map_zoom_out",
            "#collapse-button [data-tip] | splmap_tooltip_configpanel_open",
            "#RTM-TimeSlider .noUi-handle-lower [data-tip] | splmap_controlspanel_label_time_start",
            "#RTM-TimeSlider .noUi-handle-upper [data-tip] | splmap_controlspanel_label_time_current",

            "#RTM-VehicleTitle | splmap_configpanel_vehtab_title",
            "#clearDevices [data-tip] | splmap_tooltip_vehtab_toggle_all",
            "#deleteDevices [data-tip] | splmap_tooltip_vehtab_delete_all",
            "#VehicleList .mdc-list-item__meta.material-icons [data-tip] | splmap_tooltip_vehtab_veh_remove",
            "#VehicleList .spl-list-item .vehicle [data-tip] | splmap_tooltip_vehtab_veh_flyto",
            "#VehicleList .showConfig [data-tip] | splmap_tooltip_vehtab_veh_hideshow",
            "#vehicle-tab .config-Header p | splmap_configpanel_vehtab_list_label",

            "#RTM-StatusTitle | splmap_configpanel_statustab_title",
            "#toggleStatus [data-tip] | splmap_tooltip_statustab_toggle_all",
            "#deleteStatus [data-tip] | splmap_tooltip_statustab_delete_all",
            "#StatusList .showConfig [data-tip] | splmap_tooltip_statustab_status_hideshow",
            "#StatusList .mdc-list-item__meta.material-icons [data-tip] | splmap_tooltip_statustab_status_remove",
            "#status-tab .config-Header p | splmap_configpanel_statustab_list_label",

            "#RTM-ExceptionTitle | splmap_configpanel_exceptiontab_title",
            "#clearExceptions [data-tip] | splmap_tooltip_exceptiontab_toggle_all",
            "#deleteExceptions [data-tip] | splmap_tooltip_exceptiontab_delete_all",
            "#ExceptionsList .showConfig [data-tip] | splmap_tooltip_exceptiontab_exception_hideshow",
            "#ExceptionsList .mdc-list-item__meta.material-icons [data-tip] | splmap_tooltip_exceptiontab_exception_remove",
            "#exception-tab .config-Header p | splmap_configpanel_exceptiontab_list_label",

            "#RTM-exception-search-bar [placeholder] | splmap_configpanel_search",
            "#RTM-status-search-bar [placeholder] | splmap_configpanel_search",
            "#RTM-vehicle-search-bar [placeholder] | splmap_configpanel_search",
         ],

         _init: function (toLang) {
            console.log("--- APP LANGUAGE " + (me._appInit ? "USED BY DEFAULT" : "SWITCHED TO") + " [ " + toLang + " ]");

            // Error Handling
            if (typeof window.splmap === "undefined" ||
               typeof window.splmap.lang === "undefined" ||
               typeof window.splmap.lang[toLang] === "undefined") {
               console.log("--- ERROR!!! Cannot switch to language [ " + toLang + " ].... Language Not Found");
               return;
            }
            me._toLang = toLang;
            me._langDB = window.splmap.lang[toLang];
            me._appRootElemObj = document.querySelector(me._appRootId);

            // Translate elements in DOM
            me._translateInlineElements();
            me._translateElementsInDom();
         },

         _translateInlineElements: function () {
            if (!me._langDB) {
               return;
            }
            me._appRootElemObj.querySelectorAll("[translate]").forEach((el) => {
               const trVal = el.getAttribute("translate");
               const trArr = trVal.split("|");
               const elAttrName = trArr[0];
               const trId = trArr[1];

               // Translate element attribute value
               el.setAttribute(elAttrName, me.t(trId));
            });
         },

         _translateElementsInDom: function () {
            if (!me._langDB) {
               return;
            }
            const autoTrSelectorArr = me._parseAutoTrSelectorArr();
            for (const selRec in autoTrSelectorArr) {
               let sel = selRec;
               let attr = null;
               let trOk = false;

               // Look for HTML attribute in selector,
               // if found we'll pull value using getAttribute() instead of .innerHtml property
               if (selRec.indexOf("[") > -1 && selRec.match(/\[(.*)\]/).length === 2) {
                  sel = selRec.split("[")[0].trim();
                  attr = selRec.match(/\[(.*)\]/)[1];
               }
               me._appRootElemObj.querySelectorAll(sel).forEach((el) => {
                  autoTrSelectorArr[selRec].forEach(trId => {
                     const content = attr ? (el.getAttribute(attr) ? el.getAttribute(attr).trim() : "") : (el.innerHTML.trim() ? el.innerHTML.trim() : "");
                     const trValEN = me.t(trId, "en").replace("TR-", "");  //DEBUG  // Get value in string to replace
                     const trVal = me.t(trId);                             // Get replacement value
                     if (trValEN && trVal && content.indexOf(trValEN) > -1) {
                        const newContent = content.replace(trVal.indexOf("(") > -1 ? trValEN : (new RegExp(trValEN, "g")), trVal);
                        if (attr) {
                           el.setAttribute(attr, newContent);
                        }
                        else {
                           el.innerHTML = newContent;
                        }
                        trOk = true;
                     }
                  });
               });
               if (!trOk) {
                  if (me._postDomLoaded) {
                     console.log(`--- Info! Translation match not found for DOM selector [ ${selRec} ]... May be Empty`);
                  }
               }
               else {
                  me._autoTrSelectorTranslated[selRec] = true;
               }
            }
         },

         _parseAutoTrSelectorArr: function () {
            const selDbArr = [];
            for (const i in me._autoTrSelectorArr) {
               const selRec = me._autoTrSelectorArr[i];
               if (selRec.indexOf("|") > -1) {
                  const selArr = selRec.split("|");
                  const sel = selArr[0].trim();
                  const trId = selArr[1].trim();
                  if (sel && trId && typeof me._autoTrSelectorTranslated[sel] === "undefined") {
                     if (typeof selDbArr[sel] === "undefined") {
                        selDbArr[sel] = [trId];
                     }
                     else {
                        selDbArr[sel].push(trId);
                     }
                  }
               }
            }
            return selDbArr;
         },

         _decodeHtmlCharacterEntities: function (html) {
            const txtAreaObj = document.createElement("textarea");
            txtAreaObj.innerHTML = html;
            return txtAreaObj.value;
         },

         t: function (id, lang) {
            // Lib has not been switched(), therefore use default language
            if (!me._langDB && me._appInit) {
               me._init(window.splmap.defaultLanguage);
               if (!me._langDB) {
                  return "";
               }
               return me.t(id);
            }
            // If token found, look for something to search/replace in translation
            const overrideLang = typeof lang !== "undefined" && typeof lang === "string" ? lang : null;
            const args = Array.prototype.slice.call(arguments);
            let trVal = null;

            if (overrideLang !== null && typeof window.splmap.lang[overrideLang] === "undefined") {
               console.log("--- ERROR!!! Cannot translate with temporary language [ " + overrideLang + " ].... Language Not Found");
               return "";
            }
            else if (overrideLang) {
               const tempLangDb = window.splmap.lang[overrideLang];
               trVal = typeof tempLangDb[id] !== "undefined" ? tempLangDb[id] : "";
               args.shift(); // Remove id from arguments
               args.shift(); // Remove lang from arguments
            }
            else {
               trVal = typeof me._langDB[id] !== "undefined" ? me._langDB[id] : "";
               args.shift(); // Remove id from arguments
            }
            if (args.length && trVal && trVal.indexOf("{") > -1) {
               args.forEach(arg => {
                  if (Array.isArray(arg) && arg.length === 2) {
                     const tokenKey = arg[0];
                     const tokenVal = arg[1];
                     trVal = trVal.replace(tokenKey, tokenVal);
                  }
               });
            }
            return me._decodeHtmlCharacterEntities(trVal);
         },

         onChangeReTrDom: function (flushSelectorContains) {
            if (!me._langDB || !me._postDomLoaded || typeof flushSelectorContains === "undefined") {
               return;
            }

            // Remove from cache entries with the specified selector
            for (const sel in me._autoTrSelectorTranslated) {
               if (sel.indexOf(flushSelectorContains) > -1) {
                  delete me._autoTrSelectorTranslated[sel];
               }
            }

            // Rescan DOM for dynamic elements loaded that were flushed from cache
            me.onDomLoaded();
         },

         onDomLoaded: function () {
            if (!me._langDB) {
               return;
            }
            // Language translate elements in DOM that needed time to load
            me._postDomLoaded = true;
            me._translateInlineElements();
            me._translateElementsInDom();
         },

         langTokens: function (html) {
            if (!me._langDB) {
               return;
            }
            html.match(/{(.*?)}/g).map(function (tokenStr) {
               const id = tokenStr.replace("{", "").replace("}", "");
               html = html.replace(tokenStr, me.t(id));
            });
            return html;
         },

         switchTo: function (toLang) {
            me._appInit = false;
            me._autoTrSelectorTranslated = [];
            me._init(toLang);
         }
      };
      return me;
   }.bind(this)(this)
};

export default SpartanLyncServices;