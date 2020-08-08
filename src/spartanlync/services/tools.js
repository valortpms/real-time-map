import moment from "moment-timezone";
import splCfg from "../config";
import splSrv from "../services";
import { INITSplAPI, INITSplSessionMgr } from "./api";
import { INITGeotabTpmsTemptracLib } from "./api/temptrac-tpms";
import { INITSplSensorDataTools } from "./sensor-data-tools";
import { userInfo, apiConfig } from "../../dataStore/api-config";
import { showMsg, splToolsHelper } from "../components/ui-components";

/**
 *
 *  Initialing / kickstarting / bootstrapping SpartanLync Services
 *
 */
const SpartanLyncServiceTools = {

   /**
   *
   *  INIT Services at Application Start
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
            showMsg.alert(splSrv.splToolsNotInstalledErrorMsg);
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

         // Detect if running on SpartanLync Servers in proxy-mode
         if (typeof splSrv.state.inSpartanLyncDomain !== "undefined" &&
            splSrv.state.inSpartanLyncDomain === true) {
            splSrv.runningOnSpartanLyncDomain = true;
         }

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

         // Perfrom checks to see if SplMap was given instructions by SplTools
         // Called by MyGeotab handleFocus() in PROD
         if (splCfg.appEnv === "dev") {
            splToolsHelper.scanForInstructions();
         }

         // Refresh SplLogo with SplTools settings
         splSrv.events.exec("onLoadSplServices");

         // Notify on successful startup
         showMsg.msg("SpartanLync Map Service Started Successfully");

      }, (errMsg) => {
         const msg = "SpartanLync Map Service Startup Failed";
         console.log(msg + ": " + errMsg);
         showMsg.msg(msg);
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