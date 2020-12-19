import moment from "moment-timezone";
import splCfg from "../config";
import splSrv from "../services";
import { INITSplAPI, INITSplSessionMgr } from "./api";
import { INITGeotabTpmsTemptracLib } from "./api/temptrac-tpms";
import { INITSplSensorDataTools } from "./sensor-data-tools";
import { showMsg, splToolsHelper } from "../components/ui-components";
import { userInfo, apiConfig } from "../../dataStore/api-config";
import { initSplMapFaults } from "../components/ui-map-faults";
import { makeAPICall } from "../../services/api/helpers";
import { splMapUtil } from "../components/ui-maps";

/**
 *
 *  Initialing / kickstarting / bootstrapping SpartanLync Services
 *
 */
const SpartanLyncServiceTools = {

   /**
   *
   *  Initialize SpartanLync Services at Application Start
   *
   */
   initServices: function () {
      const me = this;

      splSrv._credentials.db = userInfo.database;
      splSrv._credentials.username = userInfo.userName;
      splSrv._credentials.server = userInfo.server;
      splSrv._credentials.sessionId = userInfo.sessionId;

      splSrv.state = apiConfig.state;
      splSrv._api = new INITSplAPI(splCfg.splApiUrl);
      splSrv.sessionMgr = new INITSplSessionMgr(splSrv._api, splSrv._credentials);
      splSrv.sessionMgr.enableDebug(splCfg.appEnv === "dev" && splSrv.debug ? true : false);
      splSrv.goLibCreatorFunc = () => {
         return INITGeotabTpmsTemptracLib(
            apiConfig.api,
            splSrv.sensorSearchRetryRangeInDays,
            splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds,
            splSrv.faultSearchRetryRangeInDays,
            splSrv.faultSearchTimeRangeForRepeatSearchesInSeconds
         );
      };
      splSrv.vehCompDb = splSrv.goLibCreatorFunc().getVehComponentDB();
      splSrv.sdataTools = new INITSplSensorDataTools(splSrv.goLibCreatorFunc);
      splSrv.sdataTools.setSensorDataLifetimeInSec(splSrv.sensorDataLifetime);
      splSrv.sdataTools.setSensorDataNotFoundMsg(splSrv.sensorDataNotFoundMsg);
      splSrv.sdataTools.setVehComponents(splSrv.vehCompTr.toEn);

      // Detect if running on SpartanLync Servers in proxy-mode
      if (typeof splSrv.state.inSpartanLyncDomain !== "undefined" &&
         splSrv.state.inSpartanLyncDomain === true) {
         splSrv.runningOnSpartanLyncDomain = true;
      }

      // Register Handler for perfroming checks to see if SplMap was given instructions by SplTools
      // But if early in boot-up lifecycle, defer till SpartanLync Services Loaded
      splSrv.events.register("onAppFocus", () => {
         if (splSrv._splToolsInstalled) {
            splToolsHelper.scanForInstructions();
         }
         else {
            splSrv.events.register("onLoadSplServices", splToolsHelper.scanForInstructions);
         }
      }, false);

      // Set multi-language utility globally
      window.splmap.defaultLanguage = splSrv.defaultLanguage;
      window.splmap.onChangeReTrDom = me.tr.onChangeReTrDom;
      window.splmap.tr = me.tr.t;

      // Initialize root-element media-width Classes
      me.initRootElemWidthClasses.init();

      // Init SpartanLync Faults Map UI
      initSplMapFaults();

      // Register Handler(s) for dateTime update events
      splSrv.events.register("onMapDateChangeResetReOpenPopups", (newTimeStamp) => splMapUtil.reOpenPopupsAfterMapDateChangeReset(newTimeStamp), false);
      splSrv.events.register("onDateTimeChangeTriggerEvents", () => splMapUtil.throwOnDateTimeChangedEvent(), false);
   },

   /**
   *
   * Initialize in DOM, root-element media-width Classes
   *
   * <root>.width-large    = rootElem MaxWidth: 1040px
   * <root>.width-medium   = rootElem MaxWidth: 980px
   * <root>.width-small    = rootElem MaxWidth: 770px
   *
   */
   initRootElemWidthClasses: function () {
      const me = {
         _rootElem: null,
         _classes: {
            all: ["width-small", "width-medium", "width-large"],
            range: [
               {
                  maxWidth: 770,
                  addClass: "width-small",
                  rmClasses: ["width-medium", "width-large"]
               },
               {
                  maxWidth: 980,
                  addClass: "width-medium",
                  rmClasses: ["width-large", "width-small"]
               },
               {
                  maxWidth: 1040,
                  addClass: "width-large",
                  rmClasses: ["width-medium", "width-small"]
               },
            ]
         },

         _onRootElemResize: function () {
            let classNotFound = true;
            for (const i in me._classes.range) {
               const classObj = me._classes.range[i];
               if (me._rootElem.clientWidth <= classObj.maxWidth) {
                  if (!me._rootElem.classList.contains(classObj.addClass)) {
                     me._rootElem.classList.add(classObj.addClass);
                  }
                  me._rmClass(classObj.rmClasses);
                  classNotFound = false;
                  break;
               }
            }
            if (classNotFound) {
               me._rmClass(me._classes.all);
            }
         },

         _rmClass: function (classArr) {
            classArr.forEach(className => {
               if (me._rootElem.classList.contains(className)) {
                  me._rootElem.classList.remove(className);
               }
            });
         },

         init: function () {
            me._rootElem = document.querySelector(splSrv.appRootId);
            me._onRootElemResize();
            window.addEventListener("resize", me._onRootElemResize);
         },
      };
      return me;
   }.bind(this)(this),

   /**
   *
   *  Start Services after Application Components have successfully Loaded
   *
   */
   checkForSplTools: function () {
      const me = this;
      splSrv.sessionMgr.getSettings((remoteStore, dbDeviceIds) => {
         if (remoteStore === null || typeof remoteStore.splMap === "undefined") {
            showMsg.alert(splmap.tr("error_spltools_notfound"));
            setTimeout(function () {
               me.checkForSplTools();
            }, splSrv.splToolsSearchRetry);
            return;
         }
         splSrv._splToolsInstalled = true;
         splSrv._dbDeviceIds = dbDeviceIds;

         // Update sensorDataLifetime, based on "sensorInfoRefreshRate" user setting in SplTools
         splSrv.sensorDataLifetime = remoteStore.sensorInfoRefreshRate;
         splSrv.sdataTools.setSensorDataLifetimeInSec(splSrv.sensorDataLifetime);

         // Update moment() with User-defined Timezone
         splSrv._timeZone = remoteStore.timezone;
         moment.tz.setDefault(splSrv._timeZone);
         splSrv.events.exec("onSetTimeZoneDefault");

         // Update shared Store object with SplMaps Add-In PageName and Sync with SplTools Add-In
         const oldMapsPageName = remoteStore.splMap.mapsPageName;
         remoteStore.splMap.found = true;
         remoteStore.splMap.mapsPageName = me.getSplMapPageName();
         if (remoteStore.splMap.mapsPageName !== oldMapsPageName) {
            splSrv.splStore = remoteStore; // Save Locally and Sync with SpartanLync Servers
         }
         else {
            splSrv._splStore = remoteStore; // Only Save Locally
         }

         // Switch to SpsTools user-defined language preference
         if (splSrv.defaultLanguage !== splSrv.splStore.lang) {
            me.tr.switchTo(splSrv.splStore.lang);
         }

         // Set Language-specific sensor data search messages
         splSrv.sdataTools.setSensorSearchInProgressResponseMsg(splmap.tr("sensor_search_busy_msg"));

         // Refresh SplLogo with SplTools settings
         splSrv.events.exec("onLoadSplServices");

         // Perfrom checks to see if SplMap was given instructions by SplTools
         // Called by MyGeotab handleFocus() in PROD
         if (splCfg.appEnv === "dev") {
            splToolsHelper.scanForInstructions();
         }

         // Notify on successful startup
         showMsg.msg(splmap.tr("splmap_service_started"));

         // Language translate elements in DOM that needed time to load
         me.tr.onDomLoaded();

      }, (errMsg) => {
         const msg = splmap.tr("splmap_service_failed");
         console.log(msg + ": " + errMsg);
         showMsg.msg(msg);
      });
   },

   /**
   *
   * Fetch / Set as "defaultLanguage" the value of MyGeotab user.language property
   *
   */
   getGeotabUserLanguage: function () {
      return new Promise((resolve) => {
         makeAPICall("Get",
            { "typeName": "User" })
            .then(([user]) => {
               splSrv.defaultLanguage = window.splmap.defaultLanguage = user.language;
            })
            .catch(reason => console.log(`--- Error fetching Account user.language from MyGeotab: ${reason}`))
            .finally(() => resolve());
      });
   },

   /**
   *
   * Parse environment for MyGeotab unique Add-In page name in PROD / App URL in DEV
   * Store
   *
   */
   getSplMapPageName: function () {
      let splMapPageName = "";
      let splMapPageUrl = "";

      if (splSrv.runningOnSpartanLyncDomain) {
         splMapPageName = splMapPageUrl = window.location.origin + window.location.pathname;
      }
      else if (splCfg.appEnv === "dev") {
         splMapPageName = splMapPageUrl = window.location.origin;
      }
      else {
         splMapPageName = window.location.hash.indexOf(",") > -1 ? window.location.hash.split(",")[0] : window.location.hash;
         splMapPageName = splMapPageName.replace("#", "");
         splMapPageUrl = window.location.origin + window.location.pathname + "#" + splMapPageName;
      }
      // Store SplMap URL for any later URL cleanup
      splSrv._splMapUrl = splMapPageUrl;

      return splMapPageName;
   },

   /**
   *
   * Handler for dynamically-loaded elements on config-panel-tabs that need Translation
   *
   */
   trOnElementLoad: function () {
      const me = {
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
            me._appRootElemObj = document.querySelector(splSrv.appRootId);
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
            "#RTM-ControlsContainer .inputControls button.apply-changes-btn | splmap_controlspanel_label_apply_changes_btn",

            "#RTM-ControlsContainer #timeRangeStart [data-tip] | datepicker_enter_to_apply_change",
            "#RTM-ControlsContainer #currentTimeInput [data-tip] | datepicker_enter_to_apply_change",
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
            me._appRootElemObj = document.querySelector(splSrv.appRootId);

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
                     const trValEN = me.t(trId, "en");  // Get value in string to replace
                     const trVal = me.t(trId);          // Get replacement value
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

            // SpartanLync Translation tasks invoked on DOM load
            splSrv.events.exec("trOnDomLoaded");
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

export default SpartanLyncServiceTools;