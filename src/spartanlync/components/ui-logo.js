// eslint-disable-next-line no-unused-vars
import React, { Component } from "react";
import splCfg from "../config";
import splSrv from "../services";
// eslint-disable-next-line no-unused-vars
import { SplGeotabMapInstallationStatusBtn } from "../components/ui-geotab-map-install-widget";
import { makeAPICall } from "../../services/api/helpers";

/**
 *  Renders a SpartanLync Logo Icon meant to show SplMap meta-data
 *
 *  @returns JSX object
 */
export class SplLogo extends Component {

   constructor(props) {
      super(props);

      this.state = {
         buildVersion: "",
         buildDateUnix: null,

         spltoolsTimezone: "",
         spltoolsLang: "",
         spltoolsSensorInfoRefreshRate: 0,
      };

      this.fetchSettings = this.fetchSettings.bind(this);
   };

   componentDidMount() {
      const me = this;

      // Register a callback, invoked when SplTools is successfully initialized
      splSrv.events.register("onLoadSplServices", me.fetchSettings);

      // Get build data from deployment folder on Backend Server
      me.fetchBuildMetaData((metadataTxt) => {
         if (metadataTxt) {
            const [appVer, unixTimestamp] = metadataTxt.trim().split("\n");
            if (appVer && !isNaN(unixTimestamp)) {
               me.setState({
                  buildVersion: appVer,
                  buildDateUnix: unixTimestamp
               });
            }
         }
         else {
            me.setState({
               buildVersion: null,
               buildDateUnix: null
            });
         }
      });
   };

   fetchBuildMetaData(callback) {
      const me = this;
      me.getBuildMetaDataUrl((buildUrl) => {
         if (buildUrl) {
            fetch(buildUrl)
               .then(response => response.text())
               .then(data => callback(data))
               .catch(() => callback(null));
         }
         else {
            console.log(`--- SplLogo: fetchBuildMetaData(): Failed to load SplMap buildMetadata [ ${splSrv.buildMetadataFilename} ] from URL [ ${buildUrl} ]`);
            callback(null);
         }
      });
   };

   fetchSettings() {
      const me = this;
      me.setState({
         spltoolsTimezone: splSrv.splStore.timezone,
         spltoolsLang: splSrv.splStore.lang,
         spltoolsSensorInfoRefreshRate: splSrv.splStore.sensorInfoRefreshRate,
      });
   };

   getBuildMetaDataUrl(callback) {
      const me = this;
      let addInPageName = "";

      // If DEV hardcode the MyGeotab PageName to DEV version of SplMap
      if (splCfg.appEnv === "dev") {
         addInPageName = "#addin-spartanlync_map_dev-index"; // DEV Page Name
      }
      // Otherwise, If PROXY-MODE (Running outside MyGeotab on SpartanLync servers) hardcode the page name to PROD version of SplMap
      else if (splSrv.runningOnSpartanLyncDomain) {
         addInPageName = "#addin-spartanlync_maps-index";   // PROD Page Name
      }
      // On MyGeotab, dynamic discover running version of SplMap
      else {
         addInPageName = window.location.hash.indexOf("?") > -1 ? window.location.hash.split("?")[0] : window.location.hash;
      }

      if (!addInPageName) {
         console.log("--- SplLogo: getBuildMetaDataUrl() Error: Could not identify App addInPageName!");
         callback(null);
      }
      makeAPICall("Get",
         { "typeName": "SystemSettings" })
         .then(([settings]) => {
            let addInJson = null;
            settings.customerPages.map((jsonTxt) => {
               const jsonObj = JSON.parse(jsonTxt);
               if (addInPageName === me.convertAddInNameToMyGeotabPageName(jsonObj.name)) {
                  addInJson = jsonObj;
               }
            });
            if (addInJson) {
               const addInDeploymentUrl = addInJson.items[0].url.split("/").slice(0, -1).join("/");
               const buildMetaUrl = addInDeploymentUrl + "/" + splSrv.buildMetadataFilename;
               callback(buildMetaUrl);
               return;
            }
            console.log("--- SplLogo: getBuildMetaDataUrl() SplMap Add-In Installation not found!");
            callback(null);
         })
         .catch(reason => {
            console.log(`--- SplLogo: getBuildMetaDataUrl(): Error getting buildMetadata URL: ${reason}`);
            callback(null);
         });
   };

   //
   // Convert from Add-In Name in JSON to MyGeotab Page Name format (approximately - the parts that should never change)
   //
   // Examples:
   //    SpartanLync Map (Dev) => #addin-spartanlync_map_dev-index
   //    SpartanLync Maps      => #addin-spartanlync_maps-index
   //
   convertAddInNameToMyGeotabPageName(addInName) {
      if (typeof addInName === "string") {
         return "#addin-" + addInName.toLowerCase().replace(/[\W_]+/g, "_").replace(/^\_|\_$/g, "") + "-index";
      }
      return "";
   };

   render() {
      const unKnownHtml = splmap.tr("about_unknown");
      const timezone = this.state.spltoolsTimezone ? this.state.spltoolsTimezone : unKnownHtml;
      const lang = this.state.spltoolsLang ? splSrv.supportedLanguages[this.state.spltoolsLang] : unKnownHtml;
      const sensorInfoRefreshRate = this.state.spltoolsSensorInfoRefreshRate ? this.state.spltoolsSensorInfoRefreshRate : null;
      const buildVersion = this.state.buildVersion ? this.state.buildVersion : unKnownHtml;
      let buildDateHuman = this.state.buildDateUnix ? splSrv.convertUnixToTzHuman(this.state.buildDateUnix) : unKnownHtml;
      buildDateHuman = buildDateHuman ? buildDateHuman : unKnownHtml;

      return (
         <span className="spl-watermark">
            <div>
               <label>{splmap.tr("about_appname")}</label>
               <div>
                  <strong>{splmap.tr("about_timezone")}:</strong>
                  <span>{timezone}</span>
                  <strong>{splmap.tr("about_refresh")}:</strong>
                  <span>{sensorInfoRefreshRate ? (sensorInfoRefreshRate / 60) + " min" : unKnownHtml}</span>
                  <strong>{splmap.tr("about_lang")}:</strong>
                  <span dangerouslySetInnerHTML={{ __html: lang }}></span>
                  <p>{splmap.tr("about_instruction")}</p>
                  <SplGeotabMapInstallationStatusBtn />
                  <strong>{splmap.tr("about_buildver")}:</strong>
                  <span>{buildVersion}</span>
                  <strong>{splmap.tr("about_builddate")}:</strong>
                  <span>{buildDateHuman}</span>
               </div>
            </div>
         </span>
      );
   }
};