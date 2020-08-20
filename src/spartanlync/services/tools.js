import moment from "moment-timezone";
import splCfg from "../config";
import splSrv from "../services";
import { INITSplAPI, INITSplSessionMgr } from "./api";
import { INITGeotabTpmsTemptracLib } from "./api/temptrac-tpms";
import { INITSplSensorDataTools } from "./sensor-data-tools";
import { userInfo, apiConfig } from "../../dataStore/api-config";
import { showMsg, splToolsHelper } from "../components/ui-components";
import { makeAPICall } from "../../services/api/helpers";

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
      splSrv._credentials.db = userInfo.database;
      splSrv._credentials.username = userInfo.userName;
      splSrv._credentials.server = userInfo.server;
      splSrv._credentials.sessionId = userInfo.sessionId;

      splSrv.state = apiConfig.state;
      splSrv._api = new INITSplAPI(splCfg.splApiUrl);
      splSrv.sessionMgr = new INITSplSessionMgr(splSrv._api, splSrv._credentials);
      splSrv.sessionMgr.enableDebug(splCfg.appEnv === "dev" && splSrv.debug ? true : false);
      splSrv.goLib = INITGeotabTpmsTemptracLib(
         apiConfig.api,
         splSrv.sensorSearchRetryRangeInDays,
         splSrv.sensorSearchTimeRangeForRepeatSearchesInSeconds
      );

      splSrv.sdataTools = new INITSplSensorDataTools(splSrv.goLib);
      splSrv.sdataTools.setSensorDataLifetimeInSec(splSrv.sensorDataLifetime);
      splSrv.sdataTools.setSensorDataNotFoundMsg(splSrv.sensorDataNotFoundMsg);
      splSrv.sdataTools.setVehComponents(splSrv.vehComponents.toEn);

      // Detect if running on SpartanLync Servers in proxy-mode
      if (typeof splSrv.state.inSpartanLyncDomain !== "undefined" &&
         splSrv.state.inSpartanLyncDomain === true) {
         splSrv.runningOnSpartanLyncDomain = true;
      }

      // Register Handler for perfroming checks to see if SplMap was given instructions by SplTools
      splSrv.events.register("onAppFocus", splToolsHelper.scanForInstructions, false);

      // Set multi-language utility globally
      window.splmap.defaultLanguage = splSrv.defaultLanguage;
      window.splmap.onChangeReTrDom = splSrv.tr.onChangeReTrDom;
      window.splmap.tr = splSrv.tr.t;
   },

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
            splSrv.tr.switchTo(splSrv.splStore.lang);
         }

         // Set Language-specific sensor data search messages
         splSrv.sdataTools.setSensorSearchInProgressResponseMsg(splmap.tr("sensor_search_busy_msg"));

         // Perfrom checks to see if SplMap was given instructions by SplTools
         // Called by MyGeotab handleFocus() in PROD
         if (splCfg.appEnv === "dev") {
            splToolsHelper.scanForInstructions();
         }

         // Refresh SplLogo with SplTools settings
         splSrv.events.exec("onLoadSplServices");

         // Notify on successful startup
         showMsg.msg(splmap.tr("splmap_service_started"));

         // Language translate elements in DOM that needed time to load
         splSrv.tr.onDomLoaded();

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
   }
};

export default SpartanLyncServiceTools;